import { EmailData, EmailRoute } from './types';
import { emailConfigManager } from './EmailConfigManager';

export class EmailRouter {
  // Agent email routing (existing agents only)
  private readonly taskAgentEmails = new Set<string>([
    `todo@${emailConfigManager.getServiceDomain()}`,
    `alex@${emailConfigManager.getServiceDomain()}`,
    `faq@${emailConfigManager.getServiceDomain()}`,
    `todo@${emailConfigManager.getServiceDomain()}`,
    `tasks@${emailConfigManager.getServiceDomain()}`
  ]);

  private readonly intelligenceAgentEmails = new Set<string>([
    // polling + top-5-things
    `polly@${emailConfigManager.getServiceDomain()}`,
    `polling@${emailConfigManager.getServiceDomain()}`,
    `t5t@${emailConfigManager.getServiceDomain()}`,
    `t5t@${emailConfigManager.getServiceDomain()}`,
    `intelligence@${emailConfigManager.getServiceDomain()}`
  ]);

  private normalizeAddress(addr: string): string {
    const m = addr?.match(/<([^>]+)>/);
    return (m ? m[1] : addr || '').toLowerCase().trim();
  }

  determineRouteByRecipient(email: EmailData): EmailRoute {
    const primaryServiceEmail = (process.env.SERVICE_EMAIL || emailConfigManager.getDefaultServiceEmail()).toLowerCase();
    const gmailServiceEmail = (process.env.GMAIL_EMAIL || '').toLowerCase();
    
    const allRecipients = [...(email.to || []), ...(email.cc || []), ...(email.bcc || [])]
      .map(e => this.normalizeAddress(e));

    // Load balancer addresses
    if (allRecipients.some(r => 
      r === this.normalizeAddress(emailConfigManager.getDefaultServiceEmail()) || 
      r === primaryServiceEmail ||
      (gmailServiceEmail && r === gmailServiceEmail)
    )) {
      return 'load_balancer';
    }

    // Task agent addresses
    if (allRecipients.some(r => this.taskAgentEmails.has(r))) {
      return 'task';
    }

    // Intelligence agent addresses (polling / T5T)
    if (allRecipients.some(r => this.intelligenceAgentEmails.has(r))) {
      return 'intelligence';
    }

    // Company-specific agents (e.g., t5t+companyname@inboxleap.com or t5t+companyname-sales@inboxleap.com)
    const hasCompanySpecificAgent = allRecipients.some(r => {
      const serviceDomain = emailConfigManager.getServiceDomain();
      // Pattern matches: agentType+companyname@domain or agentType+companyname-instance@domain
      const pattern = new RegExp(`^(todo|alex|polly|faq|t5t)\\+[a-z0-9\\-]+@${serviceDomain.replace('.', '\\.')}$`);
      return pattern.test(r);
    });

    if (hasCompanySpecificAgent) {
      // Determine route based on agent type
      const agentType = this.extractAgentTypeFromEmail(allRecipients);
      if (agentType && ['todo', 'alex', 'faq'].includes(agentType)) {
        return 'task';
      } else if (agentType && ['polly', 't5t'].includes(agentType)) {
        return 'intelligence';
      }
    }

    return null;
  }

  getTaskAgentEmails(): Set<string> {
    return new Set(this.taskAgentEmails);
  }

  getIntelligenceAgentEmails(): Set<string> {
    return new Set(this.intelligenceAgentEmails);
  }

  /**
   * Extract agent type from company-specific agent email
   * E.g., t5t+acme-corp@inboxleap.com -> t5t
   */
  extractAgentTypeFromEmail(recipients: string[]): string | null {
    const serviceDomain = emailConfigManager.getServiceDomain();
    
    for (const recipient of recipients) {
      const normalizedEmail = this.normalizeAddress(recipient);
      const pattern = new RegExp(`^(todo|alex|polly|faq|t5t)\\+[a-z0-9\\-]+@${serviceDomain.replace('.', '\\.')}$`);
      const match = normalizedEmail.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Extract company identifier and instance name from company-specific agent email
   * E.g., t5t+acme-corp-sales@inboxleap.com -> { companyId: 'acme-corp', instanceName: 'sales', agentType: 't5t' }
   * E.g., t5t+acme-corp@inboxleap.com -> { companyId: 'acme-corp', instanceName: null, agentType: 't5t' }
   */
  extractAgentDetailsFromEmail(email: string): { companyId: string; instanceName: string | null; agentType: string } | null {
    const normalizedEmail = this.normalizeAddress(email);
    const serviceDomain = emailConfigManager.getServiceDomain();
    const pattern = new RegExp(`^(todo|alex|polly|faq|t5t)\\+([a-z0-9\\-]+)@${serviceDomain.replace('.', '\\.')}$`);
    const match = normalizedEmail.match(pattern);
    
    if (match) {
      const agentType = match[1];
      const companyAndInstance = match[2];
      
      // Check if there's an instance name (last segment after final dash)
      const parts = companyAndInstance.split('-');
      if (parts.length > 1) {
        // Could be company-instance or just company-with-dashes
        // We'll assume last part is instance if it's not part of company name pattern
        const possibleInstance = parts[parts.length - 1];
        const possibleCompany = parts.slice(0, -1).join('-');
        
        // Simple heuristic: if last part is short and common instance names, treat as instance
        if (possibleInstance.length <= 10 && ['sales', 'support', 'primary', 'main', 'dev', 'prod', 'test'].includes(possibleInstance)) {
          return {
            companyId: possibleCompany,
            instanceName: possibleInstance,
            agentType
          };
        }
      }
      
      // Default: treat entire string as company ID
      return {
        companyId: companyAndInstance,
        instanceName: null,
        agentType
      };
    }
    
    return null;
  }

  /**
   * Legacy method for backward compatibility
   * Extract company ID from company-specific intelligence email
   * E.g., t5t+acme-corp@inboxleap.com -> acme-corp
   */
  extractCompanyIdFromEmail(email: string): string | null {
    const details = this.extractAgentDetailsFromEmail(email);
    return details ? details.companyId : null;
  }

  /**
   * Check if email is a company-specific agent email
   */
  isCompanyAgentEmail(email: string): boolean {
    return this.extractAgentDetailsFromEmail(email) !== null;
  }

  /**
   * Legacy method for backward compatibility
   */
  isCompanyIntelligenceEmail(email: string): boolean {
    const details = this.extractAgentDetailsFromEmail(email);
    return details !== null && ['polly', 't5t'].includes(details.agentType);
  }

  /**
   * Get agent details from email data (checks all recipients)
   */
  getAgentDetailsFromEmailData(emailData: EmailData): { companyId: string; instanceName: string | null; agentType: string } | null {
    const allRecipients = [...(emailData.to || []), ...(emailData.cc || []), ...(emailData.bcc || [])];
    
    for (const recipient of allRecipients) {
      const details = this.extractAgentDetailsFromEmail(recipient);
      if (details) {
        return details;
      }
    }
    
    return null;
  }

  /**
   * Legacy method for backward compatibility
   * Get company ID from email data (checks all recipients)
   */
  getCompanyIdFromEmailData(emailData: EmailData): string | null {
    const details = this.getAgentDetailsFromEmailData(emailData);
    return details ? details.companyId : null;
  }

  /**
   * Check if any recipients allow global emails
   */
  async hasGlobalEmailRecipients(emailData: EmailData, agentType: string): Promise<boolean> {
    try {
      const { storage } = await import('../../storage');
      const globalAgents = await storage.getAllGlobalAgentEmails(agentType);

      const allRecipients = [...(emailData.to || []), ...(emailData.cc || []), ...(emailData.bcc || [])]
        .map(e => this.normalizeAddress(e));

      return globalAgents.some((agent: any) =>
        allRecipients.includes(this.normalizeAddress(agent.emailAddress))
      );
    } catch (error) {
      console.error('Error checking global email recipients:', error);
      return false;
    }
  }
}

export const emailRouter = new EmailRouter();
