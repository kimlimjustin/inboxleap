import { storage } from '../../storage';
import { EmailData, EmailOptOut } from './types';
import { emailParser } from './EmailParser';

export class OptOutManager {
  /**
   * Check if an email sender has opted out
   */
  async isOptedOut(email: string): Promise<boolean> {
    try {
      // Temporarily disabled - always return false
      return false;
      /*
      const normalizedEmail = email.toLowerCase().trim();
      const optOut = await storage.getEmailOptOut(normalizedEmail);
      return !!optOut;
      */
    } catch (error) {
      console.error('Error checking opt-out status:', error);
      return false;
    }
  }

  /**
   * Process potential opt-out email
   */
  async processOptOutEmail(email: EmailData): Promise<boolean> {
    if (!emailParser.isOptOutEmail(email)) {
      return false;
    }

    // Temporarily disabled - just log
    console.log(`📧 [OPT-OUT] Opt-out request detected from ${email.from} but feature temporarily disabled`);
    return false;

    /*
    const normalizedEmail = email.from.toLowerCase().trim();
    
    // Check if already opted out
    if (await this.isOptedOut(normalizedEmail)) {
      console.log(`📧 [OPT-OUT] Email ${normalizedEmail} already opted out, skipping`);
      return true;
    }

    // Add to opt-out list
    try {
      await storage.addEmailOptOut({
        email: normalizedEmail,
        reason: this.extractOptOutReason(email),
        createdAt: new Date()
      });

      console.log(`📧 [OPT-OUT] Added ${normalizedEmail} to opt-out list`);

      // Send confirmation email
      await this.sendOptOutConfirmation(email);

      return true;
    } catch (error) {
      console.error('Error processing opt-out:', error);
      return false;
    }
    */
  }

  private extractOptOutReason(email: EmailData): string {
    const body = email.body.toLowerCase();
    
    if (body.includes("never retrieve emails from inboxleap again")) {
      return "Requested never to retrieve emails again";
    }
    if (body.includes("stop retrieving emails")) {
      return "Requested to stop retrieving emails";
    }
    if (body.includes("unsubscribe")) {
      return "Unsubscribe request";
    }
    
    return "Opt-out request";
  }

  private async sendOptOutConfirmation(email: EmailData): Promise<void> {
    try {
      // Import dynamically to avoid circular dependencies
      const { sendMail } = await import('../mailer');

      await sendMail({
        to: email.from,
        subject: "✅ You've been opted out from InboxLeap",
        text: `Hello,

We've received your request to opt out from InboxLeap email retrieval.

Your email address (${email.from}) has been added to our do-not-contact list, and we will no longer:
- Retrieve emails from your inbox
- Send you confirmation emails
- Process any emails you send to our service

This change is effective immediately.

If you ever want to re-enable InboxLeap services, please contact our support team.

Best regards,
The InboxLeap Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">✅ You've been opted out from InboxLeap</h2>
            <p>Hello,</p>
            
            <p>We've received your request to opt out from InboxLeap email retrieval.</p>
            
            <p>Your email address (<strong>${email.from}</strong>) has been added to our do-not-contact list, and we will no longer:</p>
            <ul>
              <li>Retrieve emails from your inbox</li>
              <li>Send you confirmation emails</li>
              <li>Process any emails you send to our service</li>
            </ul>
            
            <p><strong>This change is effective immediately.</strong></p>
            
            <p>If you ever want to re-enable InboxLeap services, please contact our support team.</p>
            
            <p>Best regards,<br>
            The InboxLeap Team</p>
          </div>
        `
      });

      console.log(`📧 [OPT-OUT] Sent confirmation email to ${email.from}`);
    } catch (error) {
      console.error('Error sending opt-out confirmation:', error);
    }
  }

  /**
   * Get all opted-out emails (for admin purposes)
   */
  async getOptedOutEmails(): Promise<any[]> {
    try {
      // Temporarily disabled
      return [];
      // return await storage.getEmailOptOuts();
    } catch (error) {
      console.error('Error getting opted out emails:', error);
      return [];
    }
  }
}

export const optOutManager = new OptOutManager();
