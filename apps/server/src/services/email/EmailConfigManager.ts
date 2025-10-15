import { EmailConfig, SMTPUser } from './types';

export class EmailConfigManager {
  private readonly serviceDomain = 'inboxleap.com';
  private readonly defaultServiceEmail = `agent@${this.serviceDomain}`;

  getServiceEmailConfig(): EmailConfig {
    return {
      email: process.env.SERVICE_EMAIL || this.defaultServiceEmail,
      password: process.env.SERVICE_EMAIL_PASSWORD || "",
      imapHost: process.env.SERVICE_IMAP_HOST || "imap.gmail.com",
      imapPort: parseInt(process.env.SERVICE_IMAP_PORT || "993"),
      smtpHost: process.env.SERVICE_SMTP_HOST || "smtp.gmail.com",
      smtpPort: parseInt(process.env.SERVICE_SMTP_PORT || "587"),
    };
  }

  getGmailServiceConfig(): EmailConfig {
    return {
      email: process.env.GMAIL_EMAIL || "",
      password: process.env.GMAIL_EMAIL_PASSWORD || "",
      imapHost: process.env.GMAIL_IMAP_HOST || "imap.gmail.com",
      imapPort: parseInt(process.env.GMAIL_IMAP_PORT || "993"),
      smtpHost: process.env.GMAIL_SMTP_HOST || "smtp.gmail.com",
      smtpPort: parseInt(process.env.GMAIL_SMTP_PORT || "587"),
    };
  }

  /**
   * Get the best available service email configuration for sending
   */
  getBestServiceEmailForSending(): EmailConfig {
    // In development, if SERVICE_SMTP_HOST is localhost, prefer Gmail
    const primaryConfig = this.getServiceEmailConfig();
    const gmailConfig = this.getGmailServiceConfig();
    
    // If SERVICE_SMTP_HOST is localhost/127.0.0.1, prefer Gmail for sending
    if (primaryConfig.smtpHost === '127.0.0.1' || primaryConfig.smtpHost === 'localhost') {
      if (gmailConfig.password) {
        console.log('📧 Using Gmail SMTP for sending (local SMTP detected)');
        return gmailConfig;
      }
    }
    
    // Prefer primary service email if it has valid credentials and real SMTP
    if (primaryConfig.password && primaryConfig.smtpHost !== '127.0.0.1' && primaryConfig.smtpHost !== 'localhost') {
      return primaryConfig;
    }

    // Fall back to Gmail service email
    if (gmailConfig.password) {
      console.log('📧 Using Gmail SMTP for sending (fallback)');
      return gmailConfig;
    }

    // Return primary config even if not configured (will fail gracefully)
    return primaryConfig;
  }

  /**
   * Get valid SMTP users for authentication
   * SECURITY: Controls who can send emails through our SMTP server
   */
  getValidSMTPUsers(): SMTPUser[] {
    const smtpUsers = process.env.SMTP_USERS || '';
    
    if (!smtpUsers) {
      console.warn('⚠️  SMTP_USERS not configured - SMTP server will reject all authentication');
      return [];
    }
    
    // Format: "user1:pass1,user2:pass2"
    return smtpUsers.split(',').map(userPass => {
      const [username, password] = userPass.split(':');
      if (!username || !password) {
        console.error(`❌ Invalid SMTP user format: ${userPass}`);
        return null;
      }
      return { username: username.trim(), password: password.trim() };
    }).filter(Boolean) as SMTPUser[];
  }

  getServiceDomain(): string {
    return this.serviceDomain;
  }

  getDefaultServiceEmail(): string {
    return this.defaultServiceEmail;
  }
}

export const emailConfigManager = new EmailConfigManager();
