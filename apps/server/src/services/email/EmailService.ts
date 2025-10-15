import { EventEmitter } from "events";
import { EmailData } from './types';
import { emailConnectionManager } from './EmailConnectionManager';
import { emailParser } from './EmailParser';
import { emailRouter } from './EmailRouter';
import { smtpServerManager } from './SMTPServerManager';
import { replyProcessor } from './ReplyProcessor';
import { optOutManager } from './OptOutManager';
import { emailQueueService } from '../emailQueueService';
import { storage } from '../../storage';
import { getOrCreateUserByEmail } from '../userService';

export class EmailService extends EventEmitter {
  private isShuttingDown = false;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle IMAP connection events
    emailConnectionManager.on("imapReady", (connectionId: string, imap: any) => {
      this.setupMailboxMonitoring(connectionId, imap);
    });

    emailConnectionManager.on("connectionError", (connectionId: string, error: any) => {
      this.emit("connectionError", connectionId, error);
    });

    emailConnectionManager.on("newConnection", (connectionId: string) => {
      this.emit("newConnection", connectionId);
    });

    // Handle SMTP server events
    smtpServerManager.on("emailReceived", async (emailData: any) => {
      await this.handleSMTPEmail(emailData);
    });

    smtpServerManager.on("smtpServerStarted", (port: number) => {
      this.emit("smtpServerStarted", port);
    });

    smtpServerManager.on("smtpServerError", (error: any) => {
      this.emit("smtpServerError", error);
    });
  }

  private setupMailboxMonitoring(connectionId: string, imap: any) {
    imap.openBox("INBOX", false, (err: any, box: any) => {
      if (err) {
        console.log(`⚠️  Cannot open INBOX for ${connectionId}: ${err.message || err}`);
        return;
      }

      console.log(
        `Monitoring INBOX for ${connectionId} (${box.messages.total} total messages)`,
      );

      // Process any unread emails first
      this.processUnreadEmails(connectionId, imap);

      // Start IDLE to listen for new emails in real-time
      imap.on("mail", (numNewMsgs: number) => {
        console.log(
          `📧 [${connectionId}] MAIL EVENT: ${numNewMsgs} new email(s) received`,
        );
        this.processNewEmails(connectionId, imap, numNewMsgs);
      });

      // Listen for other useful events
      imap.on("expunge", (seqno: number) => {
        console.log(`🗑️  [${connectionId}] Email ${seqno} was deleted`);
      });

      imap.on("update", (seqno: number, info: any) => {
        console.log(`🔄 [${connectionId}] Email ${seqno} was updated:`, info);
      });

      // Check if server supports IDLE
      if (imap.serverSupports && imap.serverSupports("IDLE")) {
        console.log(`✅ IDLE monitoring active for ${connectionId}`);
      } else {
        console.log(
          `⚠️  IDLE not supported, using periodic checking for ${connectionId}`,
        );
        this.startPeriodicCheck(connectionId, imap);
      }
    });
  }

  private async processUnreadEmails(connectionId: string, imap: any) {
    return new Promise<void>((resolve) => {
      imap.search(["UNSEEN"], (err: any, results: number[]) => {
        if (err || !results || results.length === 0) {
          resolve();
          return;
        }

        console.log(
          `Processing ${results.length} unread emails for ${connectionId}`,
        );
        this.fetchAndProcessEmails(connectionId, imap, results).then(() =>
          resolve(),
        );
      });
    });
  }

  private async processNewEmails(
    connectionId: string,
    imap: any,
    numNewMsgs: number,
  ) {
    console.log(
      `🔍 [${connectionId}] Looking for new emails (${numNewMsgs} reported by server)...`,
    );

    // First try unseen emails
    imap.search(["UNSEEN"], (err: any, results: number[]) => {
      if (err) {
        console.error(`❌ [${connectionId}] Search error:`, err);
        return;
      }

      if (!results || results.length === 0) {
        console.log(
          `📭 [${connectionId}] No unseen emails found, trying recent emails...`,
        );

        // If no unseen emails, try recent emails (last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const formattedDate = fiveMinutesAgo
          .toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
          .replace(/ /g, "-");
        const searchCriteria = ["SINCE", formattedDate];

        imap.search(searchCriteria, (err2: any, recentResults: number[]) => {
          if (err2) {
            console.error(`❌ [${connectionId}] Recent search error:`, err2);
            return;
          }

          if (!recentResults || recentResults.length === 0) {
            console.log(`📭 [${connectionId}] No recent emails found either`);
            return;
          }

          console.log(
            `📬 [${connectionId}] Found ${recentResults.length} recent emails, processing...`,
          );
          this.fetchAndProcessEmails(connectionId, imap, recentResults);
        });
        return;
      }

      console.log(
        `📬 [${connectionId}] Found ${results.length} unseen emails, processing...`,
      );
      this.fetchAndProcessEmails(connectionId, imap, results);
    });
  }

  private async fetchAndProcessEmails(
    connectionId: string,
    imap: any,
    messageIds: number[],
  ) {
    console.log(
      `📥 [${connectionId}] Fetching ${messageIds.length} emails: [${messageIds.join(", ")}]`,
    );

    const fetch = imap.fetch(messageIds, {
      bodies: "",
      markSeen: false,
      struct: true,
    });

    let processedCount = 0;

    fetch.on("message", (msg: any, seqno: number) => {
      console.log(`📨 [${connectionId}] Processing message ${seqno}...`);

      msg.on("body", (stream: any) => {
        let buffer = "";
        stream.on("data", (chunk: any) => {
          buffer += chunk.toString("utf8");
        });

        stream.once("end", async () => {
          try {
            console.log(
              `🔍 [${connectionId}] Parsing email body (${buffer.length} chars)...`,
            );
            
            const emailData = await emailParser.parseRawEmail(buffer, seqno);
            processedCount++;

            console.log(
              `📩 [${connectionId}] Parsed email ${processedCount}/${messageIds.length}:`,
            );
            console.log(`   📨 Subject: "${emailData.subject}"`);
            console.log(`   👤 From: ${emailData.from}`);
            console.log(`   📝 Body length: ${emailData.body.length} chars`);

            // Process the email
            await this.processIncomingEmail(emailData, connectionId);

            // Mark email as seen after successful processing
            try {
              imap.addFlags(seqno, ["\\Seen"], (flagErr: any) => {
                if (flagErr) {
                  console.error(
                    `⚠️ [${connectionId}] Could not mark email ${seqno} as seen:`,
                    flagErr,
                  );
                }
              });
            } catch (flagError) {
              console.error(
                `⚠️ [${connectionId}] Error marking email ${seqno} as seen:`,
                flagError,
              );
            }
          } catch (error) {
            console.error(
              `❌ [${connectionId}] Error parsing email ${seqno}:`,
              error,
            );
          }
        });
      });
    });

    fetch.once("error", (error: any) => {
      console.error(`❌ [${connectionId}] Fetch error:`, error);
    });

    fetch.once("end", () => {
      console.log(
        `✅ [${connectionId}] Finished processing ${processedCount} emails`,
      );
    });
  }

  private async processIncomingEmail(email: EmailData, connectionId: string) {
    try {
      // Check if sender has opted out
      if (await optOutManager.isOptedOut(email.from)) {
        console.log(`📧 [${connectionId}] Sender ${email.from} has opted out, skipping processing`);
        return;
      }

      // Check if this is an opt-out request
      if (await optOutManager.processOptOutEmail(email)) {
        console.log(`📧 [${connectionId}] Processed opt-out request from ${email.from}`);
        return;
      }

      if (connectionId === "service" || connectionId === "gmail-service" || connectionId === "test-service") {
        // For service emails (including test), handle routing
        await this.processIncomingServiceEmail(email);
      } else {
        // For user emails, add to Claude processing queue
        console.log(`🔄 [${connectionId}] Adding user email to queue...`);
        await emailQueueService.addToQueue(email, connectionId);
      }
    } catch (error) {
      console.error(`❌ [${connectionId}] Error processing email:`, error);
    }
  }

  private async processIncomingServiceEmail(email: EmailData) {
    try {
      console.log(`📧 [SERVICE] Processing service email from ${email.from}: ${email.subject}`);

      // Check if this email was already processed
      const existingProcessedEmail = await storage.getProcessedEmailByMessageId(email.messageId);
      if (existingProcessedEmail) {
        console.log(`⚠️  [SERVICE] Email already processed, skipping: ${email.messageId}`);
        return;
      }

      // Determine routing based on recipients
      const route = emailRouter.determineRouteByRecipient(email);
      console.log(`🔀 [SERVICE] Email route determined: ${route}`);

      // Check if this is a reply email
      if (emailParser.isReplyEmail(email)) {
        console.log(`🔄 [SERVICE] Processing reply email...`);
        await replyProcessor.processReplyEmail(email);
        return;
      }

      // Handle based on route
      switch (route) {
        case 'task':
          console.log(`📋 [SERVICE] Routing to task processing...`);
          // Get or create user from email sender
          const taskUser = await getOrCreateUserByEmail(email.from);
          await emailQueueService.addToQueue(email, taskUser.id);
          break;
        
        case 'intelligence':
          console.log(`🧠 [SERVICE] Routing to intelligence processing...`);
          // Get or create user from email sender
          const intelligenceUser = await getOrCreateUserByEmail(email.from);
          await emailQueueService.addToQueue(email, intelligenceUser.id);
          break;
        
        case 'load_balancer':
          console.log(`⚖️  [SERVICE] Routing to load balancer...`);
          // Get or create user from email sender
          const loadBalancerUser = await getOrCreateUserByEmail(email.from);
          await emailQueueService.addToQueue(email, loadBalancerUser.id);
          break;
        
        default:
          console.log(`❓ [SERVICE] No specific route found, using default processing...`);
          // Get or create user from email sender instead of using 'default'
          const defaultUser = await getOrCreateUserByEmail(email.from);
          await emailQueueService.addToQueue(email, defaultUser.id);
          break;
      }

    } catch (error) {
      console.error("❌ [SERVICE] Error processing service email:", error);
    }
  }

  private async handleSMTPEmail(emailData: any) {
    try {
      const parsed = await emailParser.parseRawEmail(emailData.rawContent, 0);
      
      // Override from/to with SMTP envelope data
      parsed.from = emailData.from;
      parsed.to = emailData.to;

      console.log(`📧 [SMTP] Parsed and processing email from ${parsed.from}`);
      await this.processIncomingEmail(parsed, 'smtp');
    } catch (error) {
      console.error("❌ [SMTP] Error processing email:", error);
    }
  }

  private startPeriodicCheck(connectionId: string, imap: any) {
    setInterval(() => {
      if (emailConnectionManager.isMonitoring(connectionId)) {
        this.processNewEmails(connectionId, imap, 0);
      }
    }, 30000); // Check every 30 seconds
  }

  // Public API methods
  async startServiceEmailMonitoring() {
    return emailConnectionManager.startServiceEmailMonitoring();
  }

  async startMonitoring(userId: string) {
    return emailConnectionManager.startMonitoring(userId);
  }

  async stopMonitoring(connectionId: string) {
    return emailConnectionManager.stopMonitoring(connectionId);
  }

  async stopAllMonitoring() {
    this.isShuttingDown = true;
    await emailConnectionManager.stopAllMonitoring();
  }

  async startAllMonitoring() {
    return emailConnectionManager.startAllMonitoring();
  }

  async startSMTPServer() {
    return smtpServerManager.startSMTPServer();
  }

  async stopSMTPServer() {
    return smtpServerManager.stopSMTPServer();
  }

  async cleanup() {
    console.log("🧹 Cleaning up email service...");
    this.isShuttingDown = true;
    
    await this.stopAllMonitoring();
    await this.stopSMTPServer();
    
    console.log("✅ Email service cleanup complete");
  }

  // Utility methods
  getActiveConnections() {
    return emailConnectionManager.getActiveConnections();
  }

  isMonitoring(connectionId: string) {
    return emailConnectionManager.isMonitoring(connectionId);
  }

  isSMTPServerRunning() {
    return smtpServerManager.isRunning();
  }

  // Legacy methods for backwards compatibility
  async processIncomingServiceEmailToQueue(email: EmailData) {
    return this.processIncomingServiceEmail(email);
  }

  async processIntelligenceSubmission(email: EmailData, source: string = 'email') {
    // Import the intelligence processor
    const { intelligenceEmailProcessor } = await import('../intelligenceEmailProcessor');
    
    // Check if this is an intelligence email
    const route = emailRouter.determineRouteByRecipient(email);
    
    if (route === 'intelligence') {
      console.log(`🧠 [EMAIL-SERVICE] Routing intelligence email to processor`);
      await intelligenceEmailProcessor.processIntelligenceSubmission(email, source);
    } else {
      // Route to regular task processing
      console.log(`📋 [EMAIL-SERVICE] Routing to task processing`);
      // Get or create user from email sender
      const taskUser = await getOrCreateUserByEmail(email.from);
      await emailQueueService.addToQueue(email, taskUser.id);
    }
  }
}

export const emailService = new EmailService();
