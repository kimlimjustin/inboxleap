import { agentInstanceService } from '../services/agentInstanceService';

export class T5TAgent {
  /**
   * Get all email addresses handled by Tanya agents
   */
  static async getHandledEmails(): Promise<string[]> {
    return await agentInstanceService.getActiveEmailsForAgentType('t5t');
  }

  /**
   * Check if an email address is handled by Tanya
   */
  static async handlesEmail(emailAddress: string): Promise<boolean> {
    const handledEmails = await this.getHandledEmails();
    return handledEmails.includes(emailAddress);
  }

  /**
   * Extract identifier from email address for Tanya agents
   */
  static extractIdentifier(emailAddress: string): string | null {
    // Handle primary t5t@inboxleap.com
    if (emailAddress === 't5t@inboxleap.com') {
      return 'primary';
    }

    // Handle t5t+identifier@inboxleap.com format
    const match = emailAddress.match(/^t5t\+(.+)@inboxleap\.com$/);
    return match ? match[1] : null;
  }

  /**
   * Get the instance identifier for routing purposes
   */
  static getInstanceIdentifier(emailAddress: string): string {
    const identifier = this.extractIdentifier(emailAddress);
    return identifier || 'unknown';
  }
}

export default T5TAgent;