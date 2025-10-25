import { storage } from '../storage';
import { QueueManager } from './queue/manager';
import type { QueuedEmail } from './queue/types';
import { T5THandler, AnalyzerHandler, TaskHandler } from './handlers';
import { isServiceEmail } from './utils/emailUtils';

export class EmailQueueService extends QueueManager {
  private t5tHandler: T5THandler;
  private analyzerHandler: AnalyzerHandler;
  private taskHandler: TaskHandler;

  constructor() {
    super();

    this.t5tHandler = new T5THandler(this);
    this.analyzerHandler = new AnalyzerHandler(this);
    this.taskHandler = new TaskHandler(this);
  }

  protected async processEmailInternal(queuedEmail: QueuedEmail): Promise<void> {
    let { email, userId } = queuedEmail;

    // Handle legacy emails queued with 'default' userId - remap to actual user
    if (userId === 'default' || userId === 'system-user') {
      console.log(`⚠️  [QUEUE] Legacy email with userId="${userId}", remapping to actual user from email.from`);
      const { getOrCreateUserByEmail } = await import('./userService');
      const user = await getOrCreateUserByEmail(email.from);
      if (user) {
        userId = user.id;
        // Update the queuedEmail object so handlers receive corrected userId
        queuedEmail = { ...queuedEmail, userId };
        console.log(`✅ [QUEUE] Remapped userId to: ${userId}`);
      } else {
        console.log(`⛔ [QUEUE] Could not remap userId, email verification required for ${email.from}`);
        throw new Error(`Email verification required for sender: ${email.from}`);
      }
    }

    console.log(`🤖 [CLAUDE] Starting AI processing:`);
    console.log(`   📨 Subject: "${email.subject}"`);
    console.log(`   📝 Body length: ${email.body.length} chars`);

    // Check if email already processed
    const existing = await storage.getProcessedEmailByMessageId(email.messageId);
    if (existing) {
      console.log(`⚠️  [CLAUDE] Email already processed, skipping: ${email.messageId}`);
      return;
    }

    // Create processed email record
    console.log(`📝 [CLAUDE] Creating processed email record...`);
    const processedEmail = await storage.createProcessedEmail({
      messageId: email.messageId,
      subject: email.subject,
      sender: email.from,
      recipients: email.to,
      ccList: email.cc,
      bccList: email.bcc,
      body: email.body,
      status: 'processing',
      tasksCreated: 0,
    });

    try {
      // Check for special agent emails in all recipients
      const allRecipients = [...email.to, ...email.cc, ...email.bcc];
      
      // Route to T5T intelligence agent
      const t5tRecipient = allRecipients.find(recipient =>
        recipient.toLowerCase().match(/^t5t(\+[\w-]+)?@inboxleap\.com$/i)
      );
      if (t5tRecipient) {
        console.log(`📊 [T5T] Email sent to T5T agent: ${t5tRecipient}`);
        await this.t5tHandler.process(queuedEmail, processedEmail, t5tRecipient);
        return;
      }

      // Route to Analyzer agent
      const analyzerRecipient = allRecipients.find(recipient =>
        recipient.toLowerCase().match(/^analyzer@inboxleap\.com$/i)
      );
      if (analyzerRecipient) {
        console.log(`📎 [ANALYZER] Email sent to Analyzer agent: ${analyzerRecipient}`);
        await this.analyzerHandler.process(queuedEmail, processedEmail, analyzerRecipient);
        return;
      }

      // Default task processing
      await this.taskHandler.process(queuedEmail, processedEmail);

    } catch (error) {
      console.error(`❌ [CLAUDE] Error processing email:`, error);
      await storage.updateProcessedEmail(processedEmail.id, {
        status: 'failed',
        processingError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const emailQueueService = new EmailQueueService();
