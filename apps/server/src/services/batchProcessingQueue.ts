import { storage } from '../storage';
import { batchIntelligenceService } from './batchIntelligenceService';
import { intelligenceFallbackService, IntelligenceFallbackService } from './intelligenceFallbackService';
import { performanceMonitor } from './performanceMonitor';

interface QueuedEmail {
  id: string;
  subject: string;
  body: string;
  submitter: string;
  timestamp: Date;
  organizationId: string;
  processedEmailId: number;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
}

interface BatchProcessingConfig {
  maxBatchSize: number;
  maxWaitTimeMs: number;
  batchIntervalMs: number;
  maxRetries: number;
  emergencyProcessingThreshold: number; // Process immediately if this many emails are queued
}

const DEFAULT_CONFIG: BatchProcessingConfig = {
  maxBatchSize: 20, // Smaller batches keep latency low
  maxWaitTimeMs: 45 * 1000, // Process within 45 seconds of enqueue
  batchIntervalMs: 30 * 1000, // Check every 30 seconds
  maxRetries: 3,
  emergencyProcessingThreshold: 40 // Process immediately if 40+ emails queued
};

export class BatchProcessingQueue {
  private queue: Map<string, QueuedEmail[]> = new Map(); // organizationId -> emails
  private processingInProgress: Set<string> = new Set(); // organizationIds being processed
  private config: BatchProcessingConfig;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private processingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<BatchProcessingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startBatchProcessor();
  }

  /**
   * Add email to batch processing queue
   */
  async queueEmail(emailData: {
    id: string;
    subject: string;
    body: string;
    submitter: string;
    timestamp: Date;
    organizationId: string;
    processedEmailId: number;
    priority?: 'high' | 'medium' | 'low';
  }): Promise<void> {
    const fallbackCheck = IntelligenceFallbackService.shouldUseFallback(emailData);
    if (fallbackCheck.useFallback) {
      console.log(`[BatchQueue] Using fallback processing for email ${emailData.id}: ${fallbackCheck.reason}`);

      await intelligenceFallbackService.processIndividualFallback({
        reason: fallbackCheck.reason!,
        retryCount: 0,
        maxRetries: 3,
        emailData
      });
      return;
    }

    const queuedEmail: QueuedEmail = {
      ...emailData,
      priority: emailData.priority || 'medium',
      retryCount: 0
    };

    console.log(`[BatchQueue] Queuing email ${emailData.id} for org ${emailData.organizationId}`);

    if (!this.queue.has(emailData.organizationId)) {
      this.queue.set(emailData.organizationId, []);
    }

    const orgQueue = this.queue.get(emailData.organizationId)!;

    if (queuedEmail.priority === 'high') {
      orgQueue.unshift(queuedEmail);
    } else {
      orgQueue.push(queuedEmail);
    }

    const totalQueuedEmails = orgQueue.length;

    if (totalQueuedEmails >= this.config.emergencyProcessingThreshold) {
      console.log(`[BatchQueue] Emergency processing triggered for org ${emailData.organizationId} (${totalQueuedEmails} emails queued)`);
      this.processOrganizationQueue(emailData.organizationId);
    } else if (totalQueuedEmails >= this.config.maxBatchSize) {
      console.log(`[BatchQueue] Batch size reached for org ${emailData.organizationId}, scheduling immediate processing`);
      // Schedule immediate processing (non-blocking)
      setTimeout(() => this.processOrganizationQueue(emailData.organizationId), 100);
    } else {
      this.scheduleProcessing(emailData.organizationId, totalQueuedEmails);
    }

    console.log(`[BatchQueue] Queue status for org ${emailData.organizationId}: ${totalQueuedEmails} emails queued`);
  }

  private scheduleProcessing(organizationId: string, queueSize: number): void {
    if (queueSize === 0) {
      return;
    }

    if (this.processingInProgress.has(organizationId)) {
      return;
    }

    if (this.processingTimers.has(organizationId)) {
      return;
    }

    const timer = setTimeout(() => {
      this.processingTimers.delete(organizationId);
      this.processOrganizationQueue(organizationId).catch(error => {
        console.error(`[BatchQueue] Scheduled processing failed for org ${organizationId}:`, error);
      });
    }, this.config.maxWaitTimeMs);

    this.processingTimers.set(organizationId, timer);
  }

  /**
   * Process all queued emails for an organization
   */
  private async processOrganizationQueue(organizationId: string): Promise<void> {
    const timer = performanceMonitor.createTimer('t5t', 'batch_processing');
    const pendingTimer = this.processingTimers.get(organizationId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.processingTimers.delete(organizationId);
    }
    if (this.processingInProgress.has(organizationId)) {
      console.log(`⏳ [BatchQueue] Already processing org ${organizationId}, skipping`);
      return;
    }

    const orgQueue = this.queue.get(organizationId);
    if (!orgQueue || orgQueue.length === 0) {
      return;
    }

    this.processingInProgress.add(organizationId);
    
    try {
      console.log(`🚀 [BatchQueue] Starting batch processing for org ${organizationId} with ${orgQueue.length} emails`);
      
      // Extract emails from queue (up to max batch size)
      const emailsToProcess = orgQueue.splice(0, this.config.maxBatchSize);
      
      if (orgQueue.length === 0) {
        this.queue.delete(organizationId);
      }

      // Convert to batch processing format
      const batchEmails = emailsToProcess.map(email => ({
        id: email.id,
        subject: email.subject,
        body: email.body,
        submitter: email.submitter,
        timestamp: email.timestamp
      }));

      // Process the batch
      const result = await batchIntelligenceService.processEmailsInBatches(batchEmails, organizationId);

      console.log(`✅ [BatchQueue] Successfully processed batch for org ${organizationId}:`);
      console.log(`   - ${result.totalEmailsProcessed} emails processed`);
      console.log(`   - ${result.totalTokensCreated} intelligence tokens created`);
      console.log(`   - ${result.processingTime}ms processing time`);

      // Update processed emails status in database
      await this.updateProcessedEmailsStatus(emailsToProcess, 'completed', result);

      // Record successful performance metric
      timer.success({
        batchProcessing: true,
        batchSize: result.totalEmailsProcessed,
        tokensCreated: result.totalTokensCreated,
        organizationId
      });

    } catch (error) {
      console.error(`❌ [BatchQueue] Error processing batch for org ${organizationId}:`, error);
      
      // Record failed performance metric
      timer.failure(error instanceof Error ? error : new Error(String(error)), {
        batchProcessing: true,
        organizationId,
        queueSize: orgQueue?.length || 0
      });
      
      // Handle retry logic
      await this.handleProcessingError(organizationId, orgQueue, error);

    } finally {
      this.processingInProgress.delete(organizationId);
    }
  }

  /**
   * Handle processing errors with retry logic
   */
  private async handleProcessingError(organizationId: string, emailsToProcess: QueuedEmail[], error: any): Promise<void> {
    console.log(`🔄 [BatchQueue] Handling error for org ${organizationId}, checking retry options`);

    // Increment retry counts
    const retriableEmails: QueuedEmail[] = [];
    const failedEmails: QueuedEmail[] = [];

    for (const email of emailsToProcess) {
      email.retryCount++;
      
      if (email.retryCount <= this.config.maxRetries) {
        retriableEmails.push(email);
      } else {
        failedEmails.push(email);
      }
    }

    // Re-queue retriable emails
    if (retriableEmails.length > 0) {
      if (!this.queue.has(organizationId)) {
        this.queue.set(organizationId, []);
      }
      
      // Add back to front of queue (prioritize retries)
      const orgQueue = this.queue.get(organizationId)!;
      orgQueue.unshift(...retriableEmails);
      
      console.log(`[BatchQueue] Re-queued ${retriableEmails.length} emails for retry for org ${organizationId}`);
      this.scheduleProcessing(organizationId, orgQueue.length);
    }

    // Mark permanently failed emails
    if (failedEmails.length > 0) {
      await this.updateProcessedEmailsStatus(failedEmails, 'failed', null, error.message);
      console.log(`❌ [BatchQueue] Marked ${failedEmails.length} emails as permanently failed for org ${organizationId}`);
    }
  }

  /**
   * Update processed emails status in database
   */
  private async updateProcessedEmailsStatus(
    emails: QueuedEmail[], 
    status: 'completed' | 'failed',
    result?: any,
    errorMessage?: string
  ): Promise<void> {
    try {
      for (const email of emails) {
        await storage.updateProcessedEmail(email.processedEmailId, {
          status: status === 'completed' ? 'processed' : 'failed',
          processingError: errorMessage || null
        });
      }
    } catch (error) {
      console.error(`❌ [BatchQueue] Error updating email status:`, error);
    }
  }

  /**
   * Start the background batch processor
   */
  private startBatchProcessor(): void {
    if (this.intervalHandle) {
      return; // Already started
    }

    console.log(`🚀 [BatchQueue] Starting background batch processor (interval: ${this.config.batchIntervalMs}ms)`);

    this.intervalHandle = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      await this.processAllQueues();
    }, this.config.batchIntervalMs);
  }

  /**
   * Process all organization queues
   */
  private async processAllQueues(): Promise<void> {
    const organizations = Array.from(this.queue.keys());
    
    if (organizations.length === 0) {
      return;
    }

    console.log(`🔄 [BatchQueue] Processing ${organizations.length} organization queues`);

    const processingPromises = organizations.map(async (organizationId) => {
      const orgQueue = this.queue.get(organizationId);
      
      if (!orgQueue || orgQueue.length === 0) {
        return;
      }

      // Check if we should process this queue
      const oldestEmail = orgQueue[0];
      const waitTime = Date.now() - oldestEmail.timestamp.getTime();
      
      // Process if we've waited long enough OR have enough emails
      if (waitTime >= this.config.maxWaitTimeMs || orgQueue.length >= this.config.maxBatchSize) {
        await this.processOrganizationQueue(organizationId);
      }
    });

    await Promise.allSettled(processingPromises);
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    totalQueued: number;
    organizationQueues: Array<{ organizationId: string; count: number; processing: boolean }>;
    processingCount: number;
  } {
    const organizationQueues: Array<{ organizationId: string; count: number; processing: boolean }> = [];
    let totalQueued = 0;

    for (const [organizationId, queue] of this.queue.entries()) {
      organizationQueues.push({
        organizationId,
        count: queue.length,
        processing: this.processingInProgress.has(organizationId)
      });
      totalQueued += queue.length;
    }

    return {
      totalQueued,
      organizationQueues,
      processingCount: this.processingInProgress.size
    };
  }

  /**
   * Force process all queues immediately (for emergency situations)
   */
  async forceProcessAll(): Promise<void> {
    console.log(`🚨 [BatchQueue] Force processing all queues`);
    
    const organizations = Array.from(this.queue.keys());
    const processingPromises = organizations.map(orgId => {
      const timer = this.processingTimers.get(orgId);
      if (timer) {
        clearTimeout(timer);
        this.processingTimers.delete(orgId);
      }
      return this.processOrganizationQueue(orgId);
    });
    
    await Promise.allSettled(processingPromises);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log(`🛑 [BatchQueue] Starting graceful shutdown`);
    
    this.isShuttingDown = true;

    // Clear any pending scheduled processing
    for (const timer of this.processingTimers.values()) {
      clearTimeout(timer);
    }
    this.processingTimers.clear();

    // Stop accepting new processing
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    // Process all remaining queues
    await this.forceProcessAll();

    // Wait for any in-progress processing to complete
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.processingInProgress.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.processingInProgress.size > 0) {
      console.warn(`⚠️ [BatchQueue] Shutdown timeout reached, ${this.processingInProgress.size} processes still running`);
    }

    console.log(`✅ [BatchQueue] Graceful shutdown completed`);
  }
}

// Export singleton instance
export const batchProcessingQueue = new BatchProcessingQueue();

