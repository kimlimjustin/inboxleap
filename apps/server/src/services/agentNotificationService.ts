// Agent-specific notification service with sendEmail method
interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
}

class AgentNotificationService {
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      // Use the existing sendMail function from the mailer service
      const { sendMail } = await import('./mailer');
      
      const success = await sendMail({
        from: process.env.SERVICE_EMAIL || 'todo@yourservice.app',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc,
        bcc: options.bcc
      });
      
      if (!success) {
        throw new Error('Failed to send email via mailer');
      }
      
      console.log(`📧 [AGENT] Email sent successfully to: ${options.to}`);
    } catch (error) {
      console.error('❌ [AGENT] Failed to send email:', error);
      throw error;
    }
  }
}

export const notificationService = new AgentNotificationService();