import { EventEmitter } from 'events';
import type { QueuedEmail } from './types';

export class QueueManager extends EventEmitter {
  private queue: QueuedEmail[] = [];
  private processing: boolean = false;
  private maxConcurrentJobs: number = 3;
  private currentJobs: number = 0;
  private maxRetries: number = 3;
  private retryDelay: number = 5000; // 5 seconds

  constructor() {
    super();
    console.log('🚀 Initializing Queue Manager...');
    console.log(`📊 Configuration: maxConcurrentJobs=${this.maxConcurrentJobs}, maxRetries=${this.maxRetries}`);
  }

  /**
   * Start the queue processing system
   */
  startProcessing(): void {
    console.log('📬 Queue manager started');
    this.processing = true;
  }

  /**
   * Add an email to the processing queue
   */
  async addToQueue(email: import('../email/types').EmailData, userId: string): Promise<string> {
    const queueId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedEmail: QueuedEmail = {
      id: queueId,
      email,
      userId,
      timestamp: new Date(),
      status: 'queued',
      retryCount: 0,
    };

    this.queue.push(queuedEmail);
    
    console.log(`📧 [QUEUE] Email queued for processing:`);
    console.log(`   📨 Subject: "${email.subject}"`);
    console.log(`   👤 User: ${userId}`);
    console.log(`   🆔 Queue ID: ${queueId}`);
    console.log(`   📊 Queue size: ${this.queue.length} items`);
    
    // Emit event for real-time updates
    this.emit('emailQueued', {
      queueId,
      subject: email.subject,
      from: email.from,
      timestamp: queuedEmail.timestamp,
    });

    // Try to process if not at capacity
    this.processNext();

    return queueId;
  }

  /**
   * Process the next email in the queue if capacity allows
   */
  async processNext(): Promise<void> {
    if (this.currentJobs >= this.maxConcurrentJobs) {
      console.log(`⏸️  [QUEUE] At capacity (${this.currentJobs}/${this.maxConcurrentJobs}), waiting...`);
      return; // At capacity
    }

    const nextEmail = this.queue.find(item => item.status === 'queued');
    if (!nextEmail) {
      const queuedCount = this.queue.filter(item => item.status === 'queued').length;
      if (queuedCount === 0) {
        console.log(`📭 [QUEUE] No emails in queue to process`);
      }
      return; // No queued emails
    }

    // Mark as processing
    nextEmail.status = 'processing';
    this.currentJobs++;

    console.log(`🔄 [QUEUE] Processing email:`);
    console.log(`   📨 Subject: "${nextEmail.email.subject}"`);
    console.log(`   👤 User: ${nextEmail.userId}`);
    console.log(`   📊 Slots: ${this.currentJobs}/${this.maxConcurrentJobs} used`);
    console.log(`   🕐 Started at: ${new Date().toLocaleTimeString()}`);

    // Emit processing started event
    this.emit('emailProcessingStarted', {
      queueId: nextEmail.id,
      subject: nextEmail.email.subject,
    });

    const startTime = Date.now();

    try {
      // Process the email (this will be handled by the main service)
      await this.processEmailInternal(nextEmail);
      nextEmail.status = 'completed';
      
      const duration = Date.now() - startTime;
      console.log(`✅ [QUEUE] Email processed successfully:`);
      console.log(`   📨 Subject: "${nextEmail.email.subject}"`);
      console.log(`   ⏱️  Duration: ${duration}ms`);
      
      // Emit completion event
      this.emit('emailProcessingCompleted', {
        queueId: nextEmail.id,
        subject: nextEmail.email.subject,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [QUEUE] Error processing email:`);
      console.error(`   📨 Subject: "${nextEmail.email.subject}"`);
      console.error(`   ⏱️  Duration: ${duration}ms`);
      console.error(`   🚨 Error:`, error);
      
      nextEmail.retryCount++;
      nextEmail.error = error instanceof Error ? error.message : String(error);

      if (nextEmail.retryCount < this.maxRetries) {
        // Retry after delay
        nextEmail.status = 'queued';
        console.log(`🔄 [QUEUE] Retrying email processing:`);
        console.log(`   📨 Subject: "${nextEmail.email.subject}"`);
        console.log(`   🔢 Attempt: ${nextEmail.retryCount + 1}/${this.maxRetries}`);
        console.log(`   ⏰ Retry in: ${this.retryDelay}ms`);
        
        setTimeout(() => {
          this.processNext();
        }, this.retryDelay);
      } else {
        // Max retries reached
        nextEmail.status = 'failed';
        console.log(`💀 [QUEUE] Email processing failed permanently:`);
        console.log(`   📨 Subject: "${nextEmail.email.subject}"`);
        console.log(`   🔢 Failed after: ${this.maxRetries} attempts`);
        
        // Emit failure event
        this.emit('emailProcessingFailed', {
          queueId: nextEmail.id,
          subject: nextEmail.email.subject,
          error: nextEmail.error,
        });
      }
    } finally {
      this.currentJobs--;
      
      console.log(`📊 [QUEUE] Slot freed. Current usage: ${this.currentJobs}/${this.maxConcurrentJobs}`);
      
      // Clean up completed/failed items from queue after some time
      setTimeout(() => {
        this.cleanupQueue();
      }, 60000); // Clean up after 1 minute

      // Try to process next item
      setImmediate(() => {
        this.processNext();
      });
    }
  }

  /**
   * Process email - to be overridden by the main service
   */
  protected async processEmailInternal(queuedEmail: QueuedEmail): Promise<void> {
    // This will be implemented by the main service
    throw new Error('processEmailInternal must be implemented by subclass');
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    const queued = this.queue.filter(item => item.status === 'queued').length;
    const processing = this.queue.filter(item => item.status === 'processing').length;
    const completed = this.queue.filter(item => item.status === 'completed').length;
    const failed = this.queue.filter(item => item.status === 'failed').length;

    return {
      queued,
      processing,
      completed,
      failed,
      currentJobs: this.currentJobs,
      maxConcurrentJobs: this.maxConcurrentJobs,
      totalInQueue: this.queue.length,
    };
  }

  /**
   * Get queue history (recent items)
   */
  getQueueHistory(limit: number = 50) {
    return this.queue
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .map(item => ({
        id: item.id,
        subject: item.email.subject,
        from: item.email.from,
        status: item.status,
        timestamp: item.timestamp,
        retryCount: item.retryCount,
        error: item.error,
      }));
  }

  /**
   * Clean up old completed/failed items from queue
   */
  private cleanupQueue(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const beforeCount = this.queue.length;
    
    this.queue = this.queue.filter(item => {
      // Keep if still processing or queued
      if (item.status === 'processing' || item.status === 'queued') {
        return true;
      }
      
      // Keep if completed/failed within the last hour
      return item.timestamp > oneHourAgo;
    });

    const afterCount = this.queue.length;
    if (beforeCount !== afterCount) {
      console.log(`🧹 Cleaned up ${beforeCount - afterCount} old queue items`);
    }
  }

  /**
   * Stop the queue service
   */
  stop(): void {
    this.processing = false;
    console.log('📬 Queue manager stopped');
  }
}
