import { EventEmitter } from 'events';
import { sendMail } from './mailer';
import { storage } from '../storage';
import type { Task, User } from '@email-task-router/shared';

interface NotificationItem {
  id: string;
  type: 'task_assignment';
  recipientId: string;
  assignerId: string;
  taskId: number;
  data: {
    taskTitle: string;
    taskDescription?: string;
    priority: string;
    dueDate?: Date;
    projectName: string;
    assignerName: string;
    assignerEmail: string;
  };
  timestamp: Date;
  status: 'queued' | 'sent' | 'failed' | 'pending_trust';
  retryCount: number;
  error?: string;
}

interface PendingTrustDecision {
  assignerId: string;
  assignerName: string;
  assignerEmail: string;
  taskCount: number;
  notifications: NotificationItem[];
}

class NotificationService extends EventEmitter {
  private notificationQueue: NotificationItem[] = [];
  private pendingTrustDecisions: Map<string, Map<string, PendingTrustDecision>> = new Map(); // userId -> assignerId -> PendingTrustDecision
  private processing: boolean = false;
  private maxConcurrentJobs: number = 5;
  private currentJobs: number = 0;
  private maxRetries: number = 3;
  private retryDelay: number = 5000; // 5 seconds
  private trustDecisionRateLimit: Map<string, { count: number; resetTime: number }> = new Map(); // userId -> rate limit info

  constructor() {
    super();
    console.log('🔔 Initializing Notification Service...');
    console.log(`📊 Configuration: maxConcurrentJobs=${this.maxConcurrentJobs}, maxRetries=${this.maxRetries}`);
    this.startProcessing();
  }

  /**
   * Queue a task assignment notification
   */
  async queueTaskAssignmentNotification(
    task: Task,
    assignee: User,
    assigner: User,
    projectName: string
  ): Promise<string> {
    const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🔔 [NOTIFICATION] Queuing task assignment notification:`);
    console.log(`   📋 Task: "${task.title}"`);
    console.log(`   👤 Assignee: ${assignee.email}`);
    console.log(`   👨‍💼 Assigner: ${assigner.email}`);

    // Check if assignee has notification preferences disabled
    const preferences = await storage.getNotificationPreferences(assignee.id);
    if (preferences && !preferences.emailNotifications) {
      console.log(`🔕 [NOTIFICATION] Email notifications disabled for ${assignee.email}`);
      return notificationId;
    }

    const notification: NotificationItem = {
      id: notificationId,
      type: 'task_assignment',
      recipientId: assignee.id,
      assignerId: assigner.id,
      taskId: task.id,
      data: {
        taskTitle: task.title,
        taskDescription: task.description || undefined,
        priority: task.priority,
        dueDate: task.dueDate || undefined,
        projectName,
        assignerName: `${assigner.firstName || ''} ${assigner.lastName || ''}`.trim() || assigner.email || 'Unknown User',
        assignerEmail: assigner.email || 'unknown@example.com',
      },
      timestamp: new Date(),
      status: 'queued',
      retryCount: 0,
    };

    // Check trust relationship
    const trustStatus = await this.checkTrustRelationship(assignee.id, assigner.id);
    
    if (trustStatus === 'trusted') {
      // Send immediately
      this.notificationQueue.push(notification);
      console.log(`✅ [TRUST] ${assignee.email} trusts ${assigner.email}, sending notification immediately`);
      this.processNext();
    } else if (trustStatus === 'blocked') {
      // Discard notification
      console.log(`🚫 [TRUST] ${assignee.email} has blocked ${assigner.email}, discarding notification`);
      this.emit('notificationBlocked', {
        notificationId,
        assigneeEmail: assignee.email,
        assignerEmail: assigner.email,
        taskTitle: task.title,
      });
    } else {
      // Pending trust decision - queue for trust prompt
      notification.status = 'pending_trust';
      await this.addToPendingTrustDecisions(assignee.id, assigner, notification);
      console.log(`⏳ [TRUST] No trust relationship between ${assignee.email} and ${assigner.email}, pending trust decision`);
    }

    return notificationId;
  }

  /**
   * Check trust relationship between users
   */
  private async checkTrustRelationship(userId: string, trusterId: string): Promise<'trusted' | 'blocked' | 'unknown'> {
    try {
      const relationship = await storage.getTrustRelationship(userId, trusterId);
      if (!relationship) return 'unknown';
      
      return relationship.trustStatus === 'trusted' ? 'trusted' : 
             relationship.trustStatus === 'blocked' ? 'blocked' : 'unknown';
    } catch (error) {
      console.error('Error checking trust relationship:', error);
      return 'unknown';
    }
  }

  /**
   * Add notification to pending trust decisions
   */
  private async addToPendingTrustDecisions(
    userId: string, 
    assigner: User, 
    notification: NotificationItem
  ) {
    if (!this.pendingTrustDecisions.has(userId)) {
      this.pendingTrustDecisions.set(userId, new Map());
    }

    const userPending = this.pendingTrustDecisions.get(userId)!;
    
    if (!userPending.has(assigner.id)) {
      userPending.set(assigner.id, {
        assignerId: assigner.id,
        assignerName: `${assigner.firstName || ''} ${assigner.lastName || ''}`.trim() || assigner.email || 'Unknown User',
        assignerEmail: assigner.email || 'unknown@example.com',
        taskCount: 0,
        notifications: [],
      });
    }

    const pending = userPending.get(assigner.id)!;
    pending.notifications.push(notification);
    pending.taskCount = pending.notifications.length;

    // Emit event for real-time updates
    this.emit('pendingTrustDecision', {
      userId,
      assignerId: assigner.id,
      assignerName: pending.assignerName,
      taskCount: pending.taskCount,
    });
  }

  /**
   * Check rate limiting for trust decisions
   */
  private checkTrustDecisionRateLimit(userId: string): boolean {
    const now = Date.now();
    const limit = this.trustDecisionRateLimit.get(userId);
    
    if (!limit || now > limit.resetTime) {
      // Reset or create new limit (10 decisions per hour)
      this.trustDecisionRateLimit.set(userId, {
        count: 1,
        resetTime: now + 60 * 60 * 1000, // 1 hour
      });
      return true;
    }
    
    if (limit.count >= 10) {
      return false; // Rate limited
    }
    
    limit.count += 1;
    return true;
  }

  /**
   * Process trust decision and handle pending notifications
   */
  async processTrustDecision(
    userId: string, 
    assignerId: string, 
    decision: 'trust' | 'block'
  ): Promise<void> {
    // Check rate limiting
    if (!this.checkTrustDecisionRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Too many trust decisions in the last hour.');
    }

    console.log(`🤝 [TRUST] Processing trust decision: ${userId} -> ${decision} -> ${assignerId}`);

    // Update trust relationship in database
    await storage.upsertTrustRelationship({
      userId,
      trustedUserId: assignerId,
      trustStatus: decision === 'trust' ? 'trusted' : 'blocked',
    });

    // Get pending notifications for this relationship
    const userPending = this.pendingTrustDecisions.get(userId);
    if (!userPending) return;

    const pending = userPending.get(assignerId);
    if (!pending) return;

    if (decision === 'trust') {
      // Send all pending notifications
      console.log(`📧 [TRUST] Sending ${pending.notifications.length} pending notifications`);
      for (const notification of pending.notifications) {
        notification.status = 'queued';
        this.notificationQueue.push(notification);
      }
      this.processNext();
    } else {
      // Mark as blocked and discard
      console.log(`🚫 [TRUST] Discarding ${pending.notifications.length} pending notifications (blocked)`);
      for (const notification of pending.notifications) {
        this.emit('notificationBlocked', {
          notificationId: notification.id,
          assigneeEmail: notification.data.assignerEmail,
          assignerEmail: notification.data.assignerEmail,
          taskTitle: notification.data.taskTitle,
        });
      }
    }

    // Remove from pending
    userPending.delete(assignerId);
    if (userPending.size === 0) {
      this.pendingTrustDecisions.delete(userId);
    }

    this.emit('trustDecisionProcessed', {
      userId,
      assignerId,
      decision,
      notificationsProcessed: pending.notifications.length,
    });
  }

  /**
   * Get pending trust decisions for a user
   */
  getPendingTrustDecisions(userId: string): PendingTrustDecision[] {
    const userPending = this.pendingTrustDecisions.get(userId);
    if (!userPending) return [];

    return Array.from(userPending.values());
  }

  /**
   * Start the notification processing system
   */
  private startProcessing(): void {
    console.log('🔔 Notification service started');
    this.processing = true;
  }

  /**
   * Process the next notification in the queue
   */
  private async processNext(): Promise<void> {
    if (this.currentJobs >= this.maxConcurrentJobs) {
      console.log(`⏸️  [NOTIFICATION] At capacity (${this.currentJobs}/${this.maxConcurrentJobs}), waiting...`);
      return;
    }

    const nextNotification = this.notificationQueue.find(item => item.status === 'queued');
    if (!nextNotification) {
      return; // No queued notifications
    }

    // Mark as processing
    nextNotification.status = 'sent'; // Temporarily mark as sent to prevent reprocessing
    this.currentJobs++;

    console.log(`📧 [NOTIFICATION] Sending notification:`);
    console.log(`   📋 Task: "${nextNotification.data.taskTitle}"`);
    console.log(`   📊 Jobs: ${this.currentJobs}/${this.maxConcurrentJobs}`);

    const startTime = Date.now();

    try {
      await this.sendTaskAssignmentEmail(nextNotification);
      
      const duration = Date.now() - startTime;
      console.log(`✅ [NOTIFICATION] Email sent successfully:`);
      console.log(`   📋 Task: "${nextNotification.data.taskTitle}"`);
      console.log(`   ⏱️  Duration: ${duration}ms`);

      this.emit('notificationSent', {
        notificationId: nextNotification.id,
        taskTitle: nextNotification.data.taskTitle,
        recipientEmail: (await storage.getUser(nextNotification.recipientId))?.email || 'unknown',
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [NOTIFICATION] Error sending email:`);
      console.error(`   📋 Task: "${nextNotification.data.taskTitle}"`);
      console.error(`   ⏱️  Duration: ${duration}ms`);
      console.error(`   🚨 Error:`, error);

      nextNotification.retryCount++;
      nextNotification.error = error instanceof Error ? error.message : String(error);

      if (nextNotification.retryCount < this.maxRetries) {
        // Retry after delay
        nextNotification.status = 'queued';
        console.log(`🔄 [NOTIFICATION] Retrying notification:`);
        console.log(`   📋 Task: "${nextNotification.data.taskTitle}"`);
        console.log(`   🔢 Attempt: ${nextNotification.retryCount + 1}/${this.maxRetries}`);
        
        setTimeout(() => {
          this.processNext();
        }, this.retryDelay);
      } else {
        // Max retries reached
        nextNotification.status = 'failed';
        console.log(`💀 [NOTIFICATION] Email failed permanently:`);
        console.log(`   📋 Task: "${nextNotification.data.taskTitle}"`);
        
        this.emit('notificationFailed', {
          notificationId: nextNotification.id,
          taskTitle: nextNotification.data.taskTitle,
          error: nextNotification.error,
        });
      }
    } finally {
      this.currentJobs--;
      
      // Clean up old notifications
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
   * Send task assignment email
   */
  private async sendTaskAssignmentEmail(notification: NotificationItem): Promise<void> {
    // Always send from SERVICE email via centralized mailer (Postmark preferred, Service SMTP fallback)
    const fromAddress = process.env.SERVICE_EMAIL || 'todo@yourservice.app';
 
     // Get recipient email
     const recipient = await storage.getUser(notification.recipientId);
     if (!recipient?.email) {
       throw new Error(`Recipient not found: ${notification.recipientId}`);
     }

    const baseUrl = process.env.DASHBOARD_URL || process.env.BASE_URL || 'https://inboxleap.com';
    const dashboardUrl = `${baseUrl}/`;
    const preferencesUrl = `${baseUrl}/settings/notifications`;

    const { data } = notification;
    const dueDateText = data.dueDate 
      ? `📅 Due Date: ${data.dueDate.toLocaleDateString()}\n` 
      : '';

    const subject = `New Task Assigned: ${data.taskTitle}`;
    
    const textContent = `
Hi ${recipient.firstName || recipient.email},

You've been assigned a new task by ${data.assignerName}:

📋 Task: ${data.taskTitle}
${data.taskDescription ? `📝 Description: ${data.taskDescription}\n` : ''}${dueDateText}🎯 Priority: ${data.priority}
📁 Project: ${data.projectName}

View Task: ${dashboardUrl}

---
This notification was sent because ${data.assignerName} (${data.assignerEmail}) assigned you a task.
Manage notification preferences: ${preferencesUrl}
    `.trim();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #0066cc; margin: 0 0 10px 0;">📋 New Task Assigned</h2>
          <p style="color: #666; margin: 0;">You have a new task assignment from ${data.assignerName}</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #333; margin: 0 0 15px 0;">${data.taskTitle}</h3>
          ${data.taskDescription ? `<p style="color: #666; margin: 0 0 15px 0;">${data.taskDescription}</p>` : ''}
          <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
            ${dueDateText ? `<li><strong>Due Date:</strong> ${data.dueDate?.toLocaleDateString()}</li>` : ''}
            <li><strong>Priority:</strong> ${data.priority}</li>
            <li><strong>Project:</strong> ${data.projectName}</li>
            <li><strong>Assigned by:</strong> ${data.assignerName} (${data.assignerEmail})</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-bottom: 20px;">
          <a href="${dashboardUrl}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            📋 View Dashboard
          </a>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>
            <a href="${preferencesUrl}" style="color: #0066cc;">Manage notification preferences</a> | 
            <a href="${dashboardUrl}" style="color: #0066cc;">Dashboard</a>
          </p>
        </div>
      </div>
    `;

    const success = await sendMail({
      from: `"InboxLeap" <${fromAddress}>`,
      to: recipient.email,
      subject,
      text: textContent,
      html: htmlContent,
    });
    if (!success) {
      throw new Error('Failed to send notification email via Postmark/Service SMTP');
    }
   }

  /**
   * Clean up old notifications from queue
   */
  private cleanupQueue(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const beforeCount = this.notificationQueue.length;
    
    this.notificationQueue = this.notificationQueue.filter(item => {
      // Keep if still queued
      if (item.status === 'queued') {
        return true;
      }
      
      // Keep if sent/failed within the last hour
      return item.timestamp > oneHourAgo;
    });

    // Clean up old pending trust decisions (older than 24 hours)
    let pendingCleanedCount = 0;
    for (const [userId, userPendingMap] of this.pendingTrustDecisions.entries()) {
      for (const [assignerId, pending] of userPendingMap.entries()) {
        // Remove notifications older than 24 hours
        const oldNotificationCount = pending.notifications.length;
        pending.notifications = pending.notifications.filter(notif => notif.timestamp > oneDayAgo);
        
        if (pending.notifications.length === 0) {
          // Remove empty pending decision
          userPendingMap.delete(assignerId);
          pendingCleanedCount++;
        } else if (pending.notifications.length !== oldNotificationCount) {
          // Update task count
          pending.taskCount = pending.notifications.length;
        }
      }
      
      // Remove empty user maps
      if (userPendingMap.size === 0) {
        this.pendingTrustDecisions.delete(userId);
      }
    }

    // SECURITY FIX: Clean up expired rate limit entries to prevent memory leaks
    const now = Date.now();
    let rateLimitCleanedCount = 0;
    for (const [userId, limit] of this.trustDecisionRateLimit.entries()) {
      if (now > limit.resetTime) {
        this.trustDecisionRateLimit.delete(userId);
        rateLimitCleanedCount++;
      }
    }

    const afterCount = this.notificationQueue.length;
    if (beforeCount !== afterCount || pendingCleanedCount > 0 || rateLimitCleanedCount > 0) {
      console.log(`🧹 [NOTIFICATION] Cleaned up ${beforeCount - afterCount} old notification items, ${pendingCleanedCount} old pending decisions, and ${rateLimitCleanedCount} expired rate limits`);
    }
  }

  /**
   * Get notification queue status
   */
  getQueueStatus() {
    const queued = this.notificationQueue.filter(item => item.status === 'queued').length;
    const sent = this.notificationQueue.filter(item => item.status === 'sent').length;
    const failed = this.notificationQueue.filter(item => item.status === 'failed').length;
    const pendingTrust = Array.from(this.pendingTrustDecisions.values())
      .reduce((total, userMap) => total + userMap.size, 0);

    return {
      queued,
      sent,
      failed,
      pendingTrust,
      currentJobs: this.currentJobs,
      maxConcurrentJobs: this.maxConcurrentJobs,
      totalInQueue: this.notificationQueue.length,
    };
  }

  /**
   * Stop the notification service
   */
  stop(): void {
    this.processing = false;
    console.log('🔔 Notification service stopped');
  }
}

// Create singleton instance
export const notificationService = new NotificationService();