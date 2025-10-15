import { EventEmitter } from "events";
import { createRequire } from "module";
import { EmailConfig } from './types';
import { emailConfigManager } from './EmailConfigManager';
import { storage } from '../../storage';

const require = createRequire(import.meta.url);
const Imap = require("imap");

export class EmailConnectionManager extends EventEmitter {
  private activeConnections: Map<string, any> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private isShuttingDown = false;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds base delay

  createImapConnection(config: EmailConfig): any {
    return new Imap({
      user: config.email,
      password: config.password,
      host: config.imapHost,
      port: config.imapPort,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: config.imapHost,
      },
      authTimeout: 10000,
      connTimeout: 10000,
      keepalive: {
        interval: 10000,
        idleInterval: 300000, // 5 minutes
        forceNoop: true,
      },
    });
  }

  async startServiceEmailMonitoring() {
    console.log("🚀 Starting real-time service email monitoring for all configured accounts...");

    // Start monitoring primary service email (configured SERVICE_EMAIL or default)
    const primaryConfig = emailConfigManager.getServiceEmailConfig();
    if (primaryConfig.password) {
      console.log(`📧 Starting monitoring for primary service email: ${primaryConfig.email}`);
      await this.stopMonitoring("service");
      this.startRealTimeMonitoring("service", primaryConfig);
    } else {
      console.log("ℹ️  Primary service email not configured (SERVICE_EMAIL_PASSWORD not set)");
    }

    // Start monitoring Gmail service email as backup
    const gmailConfig = emailConfigManager.getGmailServiceConfig();
    if (gmailConfig.email && gmailConfig.password) {
      console.log(`📧 Starting monitoring for Gmail service email: ${gmailConfig.email}`);
      await this.stopMonitoring("gmail-service");
      this.startRealTimeMonitoring("gmail-service", gmailConfig);
    } else {
      console.log("ℹ️  Gmail service email not configured (GMAIL_EMAIL_PASSWORD not set)");
    }

    console.log("✅ Service email monitoring setup complete");
  }

  async startMonitoring(userId: string) {
    try {
      const allCredentials = await storage.getUserEmailCredentials(userId);
      const credentials = allCredentials.find(c => c.isActive);
      if (!credentials) {
        console.log(`No active email credentials found for user ${userId}`);
        return;
      }

      const config: EmailConfig = {
        email: credentials.email,
        password: credentials.imapPassword,
        imapHost: credentials.imapHost || "imap.gmail.com",
        imapPort: credentials.imapPort || 993,
        smtpHost: credentials.imapHost || "smtp.gmail.com", // Use same host for SMTP
        smtpPort: 587,
      };

      // Clean up existing connection
      await this.stopMonitoring(userId);

      // Start real-time monitoring
      this.startRealTimeMonitoring(userId, config);
    } catch (error) {
      console.log(`⚠️  Cannot start monitoring for ${userId}: ${(error as any)?.message || error}`);
    }
  }

  private startRealTimeMonitoring(connectionId: string, config: EmailConfig) {
    const imap = this.createImapConnection(config);
    this.activeConnections.set(connectionId, imap);

    // Emit new connection event
    this.emit("newConnection", connectionId);

    imap.once("ready", () => {
      console.log(`IMAP connection ready for ${connectionId}`);
      this.emit("imapReady", connectionId, imap);
    });

    imap.once("error", (err: any) => {
      // Let handleConnectionError decide how to log the error appropriately
      this.emit("connectionError", connectionId, err);
      this.handleConnectionError(connectionId, config, err);
    });

    imap.once("end", () => {
      console.log(`IMAP connection ended for ${connectionId}`);
      if (!this.isShuttingDown) {
        this.scheduleReconnect(connectionId, config);
      }
    });

    imap.connect();
  }

  private handleConnectionError(connectionId: string, config: EmailConfig, error: any) {
    const attempts = this.reconnectAttempts.get(connectionId) || 0;

    if (error.textCode === "AUTHENTICATIONFAILED") {
      console.log(`❌ [${connectionId}] Authentication failed - invalid credentials`);
      if (connectionId === "service" || connectionId === "gmail-service") {
        console.log(`🔧 [${connectionId}] Please check your email credentials in environment variables`);
      } else {
        console.log(`🔧 [${connectionId}] Please update email credentials for this user`);
      }
      return; // Don't retry auth failures
    }

    if (error.code === 'ECONNREFUSED') {
      if (connectionId === "service") {
        const config = emailConfigManager.getServiceEmailConfig();
        if (config.imapHost === '127.0.0.1' || config.imapHost === 'localhost') {
          console.log(`⚠️  [${connectionId}] Local IMAP server not available - service emails will be handled by fallback Gmail`);
          return; // Don't retry local connections that are expected to fail
        }
      }
      
      console.log(`⚠️  [${connectionId}] Connection refused (attempt ${attempts + 1}/${this.maxReconnectAttempts}): ${error.message}`);
    } 
    else if (error.code === 'ENOTFOUND' || error.code === 'ENOENT') {
      console.log(`⚠️  [${connectionId}] Host not found (attempt ${attempts + 1}/${this.maxReconnectAttempts}): ${error.message}`);
      if (connectionId === "service") {
        console.log(`🔧 [${connectionId}] Check SERVICE_IMAP_HOST configuration`);
      }
      // For service connections, don't retry DNS failures if we have Gmail fallback
      if (connectionId === "service") {
        const gmailConfig = emailConfigManager.getGmailServiceConfig();
        if (gmailConfig.password) {
          console.log(`📧 [${connectionId}] Gmail service email available as fallback`);
          return;
        }
      }
    } 
    else if (connectionId === "gmail-service") {
      console.log(`⚠️  [${connectionId}] Gmail connection error (attempt ${attempts + 1}/${this.maxReconnectAttempts}): ${error.message}`);
      if (attempts === 0) {
        console.log(`🔧 [${connectionId}] Note: Gmail may require an App Password instead of regular password`);
        console.log(`🔧 [${connectionId}] Visit: https://support.google.com/accounts/answer/185833`);
      }
    } 
    else if (error.code === 'ETIMEDOUT') {
      console.log(`⚠️  [${connectionId}] Connection timeout (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
    } 
    else if (error.code === 'ENOTFOUND') {
      console.log(`⚠️  [${connectionId}] DNS lookup failed (attempt ${attempts + 1}/${this.maxReconnectAttempts}): ${error.hostname}`);
    }
    else if (error.code === 'ENETUNREACH' || error.code === 'EHOSTUNREACH') {
      console.log(`⚠️  [${connectionId}] Network unreachable (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
    } 
    else {
      // Generic error handling
      const errorMsg = error.message || error.toString();
      if (errorMsg.includes('IMAP') || errorMsg.includes('connection')) {
        console.log(`⚠️  [${connectionId}] IMAP error (attempt ${attempts + 1}/${this.maxReconnectAttempts}): ${errorMsg}`);
      } else {
        console.log(`⚠️  [${connectionId}] Connection error (attempt ${attempts + 1}/${this.maxReconnectAttempts}): ${errorMsg}`);
      }
    }

    this.scheduleReconnect(connectionId, config);
  }

  private scheduleReconnect(connectionId: string, config: EmailConfig) {
    const existingTimeout = this.reconnectTimeouts.get(connectionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const attempts = this.reconnectAttempts.get(connectionId) || 0;
    if (attempts < this.maxReconnectAttempts) {
      if (!this.isShuttingDown) {
        const delay = this.reconnectDelay * Math.pow(2, attempts); // Exponential backoff
        console.log(`🔄 [${connectionId}] Scheduling reconnect in ${delay / 1000}s (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
        
        const timeout = setTimeout(() => {
          this.reconnectAttempts.set(connectionId, attempts + 1);
          this.startRealTimeMonitoring(connectionId, config);
        }, delay);
        
        this.reconnectTimeouts.set(connectionId, timeout);
      }
    } else {
      console.log(`❌ [${connectionId}] Max reconnection attempts reached, giving up`);
      this.reconnectAttempts.delete(connectionId);
    }
  }

  async stopMonitoring(connectionId: string) {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      try {
        connection.end();
      } catch (error) {
        console.error(`Error closing IMAP connection for ${connectionId}:`, error);
      }
      this.activeConnections.delete(connectionId);
    }

    const timeout = this.reconnectTimeouts.get(connectionId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(connectionId);
    }
  }

  async stopAllMonitoring() {
    console.log("🛑 Stopping all email monitoring...");
    this.isShuttingDown = true;

    const connectionIds = Array.from(this.activeConnections.keys());
    await Promise.all(connectionIds.map(id => this.stopMonitoring(id)));

    console.log("✅ All email monitoring stopped");
  }

  async startAllMonitoring() {
    console.log("🚀 Starting all email monitoring...");
    await this.startServiceEmailMonitoring();
  }

  getActiveConnections(): Map<string, any> {
    return new Map(this.activeConnections);
  }

  isMonitoring(connectionId: string): boolean {
    return this.activeConnections.has(connectionId);
  }
}

export const emailConnectionManager = new EmailConnectionManager();
