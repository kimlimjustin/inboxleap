import { S3Client, ListObjectsV2Command, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { simpleParser, ParsedMail } from 'mailparser';
import { EmailData, EmailAttachment } from '../types/interfaces.js';
import { emailService } from './emailService.js';
import { storage } from '../storage.js';
import { getOrCreateUserByEmail } from './userService.js';
import { wsManager } from './websocketManager.js';

interface S3EmailObject {
  Key: string;
  LastModified: Date;
  Size: number;
}

interface S3Object {
  Key?: string;
  LastModified?: Date;
  Size?: number;
}

interface AgentRouting {
  [key: string]: {
    name: string;
    type: 'task' | 'intelligence' | 'survey' | 'risk' | 'polling' | 'document';
    description: string;
  };
}

export class S3EmailBackupProcessor {
  private s3Client: S3Client;
  private bucketName: string;
  private incomingPrefix: string;
  private processedPrefix: string;
  private failedPrefix: string;
  private isProcessing: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  // Agent email routing configuration
  private agentRouting: AgentRouting = {
    'sally@inboxleap.com': {
      name: 'Sally - Survey',
      type: 'survey',
      description: 'Generates surveys from common email questions and analyzes sentiment across departments'
    },
    'marcus@inboxleap.com': {
      name: 'Marcus - Risk Assessment',
      type: 'risk',
      description: 'Scans for compliance violations, identifies security threats, and provides risk mitigation recommendations'
    },
    'todo@inboxleap.com': {
      name: 'Todo - Task Management',
      type: 'task',
      description: 'Extracts to-dos, prioritizes, and deadlines. Auto-assigns tasks to recipients and turns threads into project lists'
    },
    'polly@inboxleap.com': {
      name: 'Polly - Fast Polling',
      type: 'polling',
      description: 'Creates polls from questions in your emails, collects votes and shares real-time results'
    },
    'intelligence@inboxleap.com': {
      name: 'Dina - Document Intelligence',
      type: 'document',
      description: 'Summarizes contracts and attachments, extracts insights, risks, and actions'
    }
    // FAQ routing is handled dynamically by checking for faq+* pattern in routeAndProcessEmail
  };

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    
    this.bucketName = process.env.EMAIL_STORAGE_BUCKET || 'inboxleap-us-production-email-storage';
    this.incomingPrefix = 'incoming-emails/';
    this.processedPrefix = 'processed-emails/';
    this.failedPrefix = 'failed-emails/';
    
    console.log(`📧 [S3-BACKUP] Initialized with bucket: ${this.bucketName}`);
  }

  /**
   * Start the backup email processor with 10-minute intervals
   */
  start(): void {
    if (this.intervalId) {
      console.log('📧 [S3-BACKUP] Processor already running');
      return;
    }

    console.log('🚀 [S3-BACKUP] Starting S3 email backup processor...');
    
    // Run immediately on start
    this.processUnprocessedEmails().catch(error => {
      console.error('❌ [S3-BACKUP] Initial processing failed:', error);
    });
    
    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      this.processUnprocessedEmails().catch(error => {
        console.error('❌ [S3-BACKUP] Scheduled processing failed:', error);
      });
    }, 30 * 1000); // 30 seconds

    console.log('✅ [S3-BACKUP] Processor started (checking every 30 seconds)');
  }

  /**
   * Stop the backup email processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 [S3-BACKUP] Processor stopped');
    }
  }

  /**
   * Process unprocessed emails from S3
   */
  async processUnprocessedEmails(): Promise<void> {
    if (this.isProcessing) {
      console.log('⏸️ [S3-BACKUP] Already processing, skipping this cycle');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      console.log('🔍 [S3-BACKUP] Checking for unprocessed emails...');
      
      const incomingEmails = await this.listS3Objects(this.incomingPrefix);
      console.log(`📋 [S3-BACKUP] Found ${incomingEmails.length} emails in incoming folder`);

      if (incomingEmails.length === 0) {
        console.log('📭 [S3-BACKUP] No emails to process');
        return;
      }

      let processedCount = 0;
      let failedCount = 0;

      for (const emailObj of incomingEmails) {
        try {
          // Check if this email was already processed in our database
          const messageId = this.extractMessageIdFromKey(emailObj.Key);
          if (messageId) {
            const existingEmail = await storage.getProcessedEmailByMessageId(messageId);
            if (existingEmail) {
              console.log(`✅ [S3-BACKUP] Email ${messageId} already processed, moving to processed folder`);
              await this.moveToProcessed(emailObj.Key);
              processedCount++;
              continue;
            }
          }

          // Process the email
          console.log(`🔄 [S3-BACKUP] Processing email: ${emailObj.Key}`);
          const success = await this.processSingleEmail(emailObj);
          
          if (success) {
            await this.moveToProcessed(emailObj.Key);
            processedCount++;
            console.log(`✅ [S3-BACKUP] Successfully processed: ${emailObj.Key}`);
          } else {
            await this.moveToFailed(emailObj.Key);
            failedCount++;
            console.log(`❌ [S3-BACKUP] Failed to process: ${emailObj.Key}`);
          }

          // Small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ [S3-BACKUP] Error processing ${emailObj.Key}:`, error);
          await this.moveToFailed(emailObj.Key);
          failedCount++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`📊 [S3-BACKUP] Processing complete:`);
      console.log(`   ✅ Processed: ${processedCount}`);
      console.log(`   ❌ Failed: ${failedCount}`);
      console.log(`   ⏱️ Duration: ${duration}ms`);

    } catch (error) {
      console.error('❌ [S3-BACKUP] Critical error in backup processor:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * List objects in S3 bucket with given prefix
   */
  private async listS3Objects(prefix: string): Promise<S3EmailObject[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: 100 // Process in batches to avoid overwhelming
      });

      const response = await this.s3Client.send(command);
      
      return (response.Contents || [])
        .filter((obj: S3Object) => obj.Key && obj.LastModified && obj.Size)
        .map((obj: S3Object) => ({
          Key: obj.Key!,
          LastModified: obj.LastModified!,
          Size: obj.Size!
        }))
        .sort((a: S3EmailObject, b: S3EmailObject) => a.LastModified.getTime() - b.LastModified.getTime()); // Oldest first

    } catch (error) {
      console.error(`❌ [S3-BACKUP] Error listing S3 objects with prefix ${prefix}:`, error);
      return [];
    }
  }

  /**
   * Get email content from S3
   */
  private async getEmailFromS3(key: string): Promise<string | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (response.Body) {
        return await response.Body.transformToString();
      }
      
      return null;

    } catch (error) {
      console.error(`❌ [S3-BACKUP] Error getting email from S3 (${key}):`, error);
      return null;
    }
  }

  /**
   * Process a single email from S3
   */
  private async processSingleEmail(emailObj: S3EmailObject): Promise<boolean> {
    try {
      console.log(`🔄 [S3-BACKUP] Starting to process email: ${emailObj.Key}`);
      
      // Get email content from S3
      const rawEmail = await this.getEmailFromS3(emailObj.Key);
      if (!rawEmail) {
        console.error(`❌ [S3-BACKUP] Could not get email content: ${emailObj.Key}`);
        return false;
      }

      console.log(`📥 [S3-BACKUP] Retrieved raw email from S3, size: ${rawEmail.length} bytes`);

      // Parse email
      const parsed = await simpleParser(rawEmail);
      console.log(`🔍 [S3-BACKUP] Email parsed by mailparser. Message ID: ${parsed.messageId}`);
      
      const emailData = await this.parseEmailToEmailData(parsed);
      
      if (!emailData) {
        console.error(`❌ [S3-BACKUP] Could not parse email to EmailData: ${emailObj.Key}`);
        return false;
      }

      // Validate that we have essential email data
      if (!emailData.from) {
        console.error(`❌ [S3-BACKUP] Email missing sender information: ${emailObj.Key}`);
        return false;
      }

      if (emailData.to.length === 0 && emailData.cc.length === 0 && emailData.bcc.length === 0) {
        console.error(`❌ [S3-BACKUP] Email missing all recipient information: ${emailObj.Key}`);
        return false;
      }

      console.log(`✅ [S3-BACKUP] Email validation passed - From: ${emailData.from}, Recipients: ${emailData.to.length + emailData.cc.length + emailData.bcc.length}`);

      // Route email to appropriate agent/processor
      await this.routeAndProcessEmail(emailData);
      
      console.log(`✅ [S3-BACKUP] Successfully processed email: ${emailObj.Key}`);

      // Send real-time notification to relevant users
      await this.notifyRelevantUsers(emailData);

      return true;

    } catch (error) {
      console.error(`❌ [S3-BACKUP] Error processing single email ${emailObj.Key}:`, error);
      return false;
    }
  }

  /**
   * Parse ParsedMail to EmailData format
   */
  private async parseEmailToEmailData(parsed: ParsedMail): Promise<EmailData | null> {
    try {
      // Extract email addresses with debugging
      const fromEmail = this.extractEmailAddress(parsed.from) || 'unknown@example.com';
      const toEmails = this.extractEmailAddresses(parsed.to);
      const ccEmails = this.extractEmailAddresses(parsed.cc);
      const bccEmails = this.extractEmailAddresses(parsed.bcc);

      // Debug logging for email extraction
      console.log(`🔍 [S3-BACKUP] Email address extraction debug:`);
      console.log(`  From (raw):`, this.safeStringify(parsed.from));
      console.log(`  From (extracted): ${fromEmail}`);
      console.log(`  To (raw):`, this.safeStringify(parsed.to));
      console.log(`  To (extracted): [${toEmails.join(', ')}]`);
      console.log(`  CC (raw):`, this.safeStringify(parsed.cc));
      console.log(`  CC (extracted): [${ccEmails.join(', ')}]`);
      console.log(`  BCC (raw):`, this.safeStringify(parsed.bcc));
      console.log(`  BCC (extracted): [${bccEmails.join(', ')}]`);

      // Process attachments
      const attachments: EmailAttachment[] = [];
      if (parsed.attachments && parsed.attachments.length > 0) {
        console.log(`📎 [S3-BACKUP] Found ${parsed.attachments.length} attachments`);
        
        for (const attachment of parsed.attachments) {
          try {
            console.log(`📎 [S3-BACKUP] Processing attachment: ${attachment.filename} (${attachment.contentType}), size: ${attachment.size}`);
            
            attachments.push({
              filename: attachment.filename || 'unknown_attachment',
              contentType: attachment.contentType || 'application/octet-stream',
              size: attachment.size || attachment.content?.length || 0,
              content: attachment.content || Buffer.alloc(0),
              contentId: attachment.contentId || attachment.cid
            });
            
            console.log(`✅ [S3-BACKUP] Successfully processed attachment: ${attachment.filename}`);
          } catch (attachmentError) {
            console.error(`❌ [S3-BACKUP] Error processing attachment ${attachment.filename}:`, attachmentError);
          }
        }
      }

      const emailData: EmailData = {
        messageId: parsed.messageId || `s3backup_${Date.now()}_${Math.random()}`,
        subject: parsed.subject || "No Subject",
        from: fromEmail,
        to: toEmails,
        cc: ccEmails,
        bcc: bccEmails,
        body: parsed.text || parsed.html || "",
        date: parsed.date || new Date(),
        inReplyTo: parsed.inReplyTo,
        references: parsed.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : undefined,
        threadId: this.extractThreadId(parsed),
        attachments: attachments.length > 0 ? attachments : undefined
      };

      console.log(`📧 [S3-BACKUP] Successfully parsed email data:`);
      console.log(`  Subject: "${emailData.subject}"`);
      console.log(`  From: ${emailData.from}`);
      console.log(`  To: [${emailData.to.join(', ')}]`);
      console.log(`  CC: [${emailData.cc.join(', ')}]`);
      console.log(`  BCC: [${emailData.bcc.join(', ')}]`);
      console.log(`  Attachments: ${attachments.length}`);

      return emailData;

    } catch (error) {
      console.error('❌ [S3-BACKUP] Error parsing email to EmailData:', error);
      console.error('❌ [S3-BACKUP] Raw parsed email structure:', this.safeStringify(parsed));
      return null;
    }
  }

  /**
   * Safely stringify objects for logging (handles circular references and large objects)
   */
  private safeStringify(obj: any): string {
    try {
      return JSON.stringify(obj, (key, value) => {
        // Limit depth and handle circular references
        if (key === 'children' || key === 'parent') return '[Circular]';
        if (typeof value === 'object' && value !== null) {
          // Limit the number of properties shown for large objects
          const keys = Object.keys(value);
          if (keys.length > 10) {
            const limited: any = {};
            keys.slice(0, 10).forEach(k => limited[k] = value[k]);
            limited['...'] = `${keys.length - 10} more properties`;
            return limited;
          }
        }
        return value;
      }, 2);
    } catch (error) {
      return `[Error stringifying object: ${error}]`;
    }
  }

  /**
   * Route email to appropriate processor based on recipient
   */
  private async routeAndProcessEmail(email: EmailData): Promise<void> {
    // Check all recipients (to, cc, bcc) for agent email addresses
    const allRecipients = [...email.to, ...email.cc, ...email.bcc];
    
    let routedAgent: string | null = null;
    let agentConfig: any = null;

    // Find the first matching agent
    for (const recipient of allRecipients) {
      const routingKey = recipient.toLowerCase();
      
      // Check for FAQ emails (pattern: faq+anything@inboxleap.com)
      if (routingKey.match(/^faq\+[^@]+@inboxleap\.com$/)) {
        routedAgent = routingKey;
        agentConfig = {
          name: 'FAQ System',
          type: 'faq',
          description: 'Automated FAQ responses using knowledge base'
        };
        break;
      }

      // Check for T5T user-specific emails (pattern: t5t+userID@inboxleap.com or t5t+userID+instance@inboxleap.com)
      if (routingKey.match(/^t5t\+[^@]+@inboxleap\.com$/)) {
        routedAgent = routingKey;
        agentConfig = {
          name: 'T5T - Top Five Things (User-Specific)',
          type: 'intelligence',
          description: 'Identifies trending topics across all emails and prioritizes issues by frequency and urgency'
        };
        break;
      }

      // Check standard agent routing
      if (this.agentRouting[routingKey]) {
        routedAgent = routingKey;
        agentConfig = this.agentRouting[routingKey];
        break;
      }
      
      // Check for Todo custom instance emails (pattern: todo+anything@inboxleap.com)
      if (routingKey.match(/^todo\+[^@]+@inboxleap\.com$/)) {
        routedAgent = routingKey;
        agentConfig = {
          name: 'Todo - Task Management (Custom Instance)',
          type: 'task',
          description: 'Extracts to-dos, prioritizes, and deadlines. Auto-assigns tasks to recipients and turns threads into project lists'
        };
        console.log(`🎯 [S3-BACKUP] Detected Todo custom instance: ${routingKey}`);
        break;
      }
    }

    if (routedAgent && agentConfig) {
      console.log(`🎯 [S3-BACKUP] Routing to ${agentConfig.name} (${routedAgent})`);
      
      try {
        // Route based on agent type
        switch (agentConfig.type) {
          case 'faq':
            // Route to FAQ handler
            console.log(`📋 [S3-BACKUP] Processing as FAQ inquiry`);
            const { faqHandler } = await import('./handlers/faqHandler.js');
            await faqHandler.processEmail(email);
            break;
            
          case 'intelligence':
          case 'survey':
          case 'polling':
          case 'document':
            // For T5T intelligence, only process user-specific emails (t5t+userID@inboxleap.com)
            if (agentConfig.type === 'intelligence' && routedAgent?.startsWith('t5t+')) {
              console.log(`✅ [S3-BACKUP] Email sent to user-specific T5T address (${routedAgent}) - processing as intelligence`);
            }

            // For T5T emails, route to email queue to use T5THandler
            if (routedAgent?.startsWith('t5t+')) {
              console.log(`🧠 [S3-BACKUP] Routing T5T email to queue for T5THandler`);
              const { emailQueueService } = await import('./emailQueueService');
              const { getOrCreateUserByEmail } = await import('./userService');
              const t5tUser = await getOrCreateUserByEmail(email.from);
              await emailQueueService.addToQueue(email, t5tUser.id);
            } else {
              // Route other intelligence to organizational intelligence processor
              console.log(`🧠 [S3-BACKUP] Processing as ${agentConfig.type} intelligence`);
              await emailService.processIntelligenceSubmission(email, 'backup-processor');
            }
            break;

          case 'task':
            // Check if this is a Todo email (base or custom instance)
            const isTodoEmail = allRecipients.some(recipient => 
              recipient.toLowerCase().includes('todo@inboxleap.com') ||
              recipient.toLowerCase().match(/^todo\+[^@]+@inboxleap\.com$/)
            );
            
            if (isTodoEmail) {
              console.log(`🎯 [S3-BACKUP] Routing Todo email through TodoAgent`);
              const { TodoAgent } = await import('../agents/TodoAgent.js');
              const todoAgent = new TodoAgent();
              const result = await todoAgent.process(email);
              console.log(`✅ [S3-BACKUP] TodoAgent result:`, result);
            } else {
              console.log(`📋 [S3-BACKUP] Processing as generic task management`);
              await this.processAsTaskEmail(email);
            }
            break;
            
          case 'risk':
          default:
            // Route to task management
            console.log(`📋 [S3-BACKUP] Processing as task/risk management`);
            await this.processAsTaskEmail(email);
            break;
        }

        console.log(`✅ [S3-BACKUP] Successfully routed and processed via ${agentConfig.name}`);

      } catch (error) {
        console.error(`❌ [S3-BACKUP] Error processing via ${agentConfig.name}:`, error);
        throw error;
      }

    } else {
      // Default fallback - process as regular task email
      console.log(`📧 [S3-BACKUP] No specific agent found, processing as regular task email`);
      await this.processAsTaskEmail(email);
    }
  }

  /**
   * Process email as task email through the queue system
   */
  private async processAsTaskEmail(email: EmailData): Promise<void> {
    try {
      // Get or create user from sender
      const user = await getOrCreateUserByEmail(email.from);
      console.log(`👤 [S3-BACKUP] Processing email for user: ${email.from}`);

      // Process through the email service
      await emailService.processIncomingServiceEmailToQueue(email);
      
    } catch (error) {
      console.error('❌ [S3-BACKUP] Error processing as task email:', error);
      throw error;
    }
  }

  /**
   * Send notification to users relevant to the processed email
   */
  private async notifyRelevantUsers(emailData: EmailData): Promise<void> {
    try {
      // Collect all relevant email addresses (sender + all recipients)
      const relevantEmails = new Set<string>();

      // Add sender
      relevantEmails.add(emailData.from.toLowerCase());

      // Add all recipients
      emailData.to.forEach(email => relevantEmails.add(email.toLowerCase()));
      emailData.cc.forEach(email => relevantEmails.add(email.toLowerCase()));
      emailData.bcc.forEach(email => relevantEmails.add(email.toLowerCase()));

      // Get user IDs for these email addresses
      const userIds: string[] = [];
      for (const email of relevantEmails) {
        try {
          const user = await getOrCreateUserByEmail(email);
          if (user?.id) {
            userIds.push(user.id.toString());
          }
        } catch (error) {
          console.log(`⚠️ [S3-BACKUP] Could not get user for email ${email}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }

      if (userIds.length > 0) {
        // Create notification message
        const notificationMessage = {
          type: 'email_processed',
          data: {
            subject: emailData.subject,
            from: emailData.from,
            to: emailData.to,
            timestamp: new Date().toISOString(),
            message: `New email processed: "${emailData.subject}" from ${emailData.from}`
          }
        };

        // Send notification to relevant users only
        wsManager.broadcastToUsers(notificationMessage, userIds);

        console.log(`📧 [S3-BACKUP] Notified ${userIds.length} users about processed email: "${emailData.subject}"`);
      } else {
        console.log(`⚠️ [S3-BACKUP] No relevant users found to notify for email: "${emailData.subject}"`);
      }

    } catch (error) {
      console.error(`❌ [S3-BACKUP] Error sending notifications for email:`, error);
      // Don't throw - notification failure shouldn't break email processing
    }
  }

  /**
   * Move email to processed folder
   */
  private async moveToProcessed(sourceKey: string): Promise<void> {
    const fileName = sourceKey.split('/').pop() || 'unknown';
    const destinationKey = `${this.processedPrefix}${fileName}`;
    await this.moveS3Object(sourceKey, destinationKey);
  }

  /**
   * Move email to failed folder
   */
  private async moveToFailed(sourceKey: string): Promise<void> {
    const fileName = sourceKey.split('/').pop() || 'unknown';
    const destinationKey = `${this.failedPrefix}${fileName}`;
    await this.moveS3Object(sourceKey, destinationKey);
  }

  /**
   * Move S3 object from source to destination
   */
  private async moveS3Object(sourceKey: string, destinationKey: string): Promise<void> {
    try {
      // Copy object to new location
      await this.s3Client.send(new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey
      }));

      // Delete original object
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: sourceKey
      }));

      console.log(`✅ [S3-BACKUP] Successfully moved ${sourceKey} -> ${destinationKey}`);

    } catch (error: any) {
      // Handle NoSuchKey error specifically
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        console.log(`⚠️ [S3-BACKUP] Object ${sourceKey} doesn't exist (already processed or moved), skipping move operation`);
        return;
      }
      
      console.error(`❌ [S3-BACKUP] Error moving S3 object ${sourceKey} -> ${destinationKey}:`, error);
      throw error;
    }
  }

  /**
   * Extract message ID from S3 key
   */
  private extractMessageIdFromKey(key: string): string | null {
    // S3 key format is usually: incoming-emails/messageId
    const parts = key.split('/');
    return parts[parts.length - 1] || null;
  }

  /**
   * Extract email address from various formats
   */
  private extractEmailAddress(addressData: any): string | null {
    if (!addressData) return null;
    
    // Handle string format (e.g., "User Name <user@example.com>" or "user@example.com")
    if (typeof addressData === 'string') {
      const match = addressData.match(/<(.+?)>/);
      const email = match ? match[1] : addressData.trim();
      return this.isValidEmail(email) ? email : null;
    }
    
    // Handle object format from mailparser with address property
    if (addressData.address) {
      return this.isValidEmail(addressData.address) ? addressData.address : null;
    }
    
    // Handle mailparser format with value array
    if (addressData.value && Array.isArray(addressData.value) && addressData.value.length > 0) {
      const email = addressData.value[0].address;
      return email && this.isValidEmail(email) ? email : null;
    }
    
    // Handle text property format
    if (addressData.text) {
      const match = addressData.text.match(/<(.+?)>/);
      const email = match ? match[1] : addressData.text.trim();
      return this.isValidEmail(email) ? email : null;
    }
    
    return null;
  }

  /**
   * Extract email addresses from various formats
   */
  private extractEmailAddresses(addressData: any): string[] {
    if (!addressData) return [];
    
    // Handle array of address objects (most common case for mailparser)
    if (Array.isArray(addressData)) {
      return addressData
        .map((addr) => addr.address)
        .filter((email) => email && this.isValidEmail(email));
    }

    // Handle mailparser format with value array
    if (addressData.value && Array.isArray(addressData.value)) {
      return addressData.value
        .map((addr: any) => addr.address)
        .filter((email: string) => email && this.isValidEmail(email));
    }

    // Handle single address object
    if (addressData.address) {
      return this.isValidEmail(addressData.address) ? [addressData.address] : [];
    }
    
    // Fallback: try to extract from single address
    const email = this.extractEmailAddress(addressData);
    return email ? [email] : [];
  }

  /**
   * Basic email validation
   */
  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Extract thread ID from parsed email
   */
  private extractThreadId(parsed: ParsedMail): string | undefined {
    // Try to extract thread ID from references or in-reply-to headers
    if (parsed.references && Array.isArray(parsed.references) && parsed.references.length > 0) {
      return parsed.references[0];
    }
    
    if (parsed.inReplyTo) {
      return parsed.inReplyTo;
    }
    
    // Use message ID as thread ID for new threads
    return parsed.messageId;
  }

  /**
   * Get processor status
   */
  getStatus() {
    return {
      isRunning: this.intervalId !== null,
      isProcessing: this.isProcessing,
      bucketName: this.bucketName,
      incomingPrefix: this.incomingPrefix,
      processedPrefix: this.processedPrefix,
      failedPrefix: this.failedPrefix,
      agentCount: Object.keys(this.agentRouting).length,
      agents: this.agentRouting,
      config: {
        awsRegion: process.env.AWS_REGION || 'us-east-1',
        emailStorageBucket: process.env.EMAIL_STORAGE_BUCKET || 'inboxleap-us-production-email-storage'
      }
    };
  }

  /**
   * Test email parsing with a sample email structure
   */
  async testEmailParsing(testEmailData: any): Promise<EmailData | null> {
    console.log('🧪 [S3-BACKUP] Testing email parsing with sample data...');
    console.log('🧪 [S3-BACKUP] Test input:', this.safeStringify(testEmailData));
    
    try {
      const result = await this.parseEmailToEmailData(testEmailData);
      console.log('🧪 [S3-BACKUP] Test result:', this.safeStringify(result));
      return result;
    } catch (error) {
      console.error('🧪 [S3-BACKUP] Test failed:', error);
      return null;
    }
  }
}

// Export singleton instance
export const s3EmailBackupProcessor = new S3EmailBackupProcessor();

