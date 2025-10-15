import { simpleParser } from 'mailparser';
import { EmailData } from './types';
import { isReplyEmail } from '../utils/emailUtils';

export class EmailParser {
  async parseRawEmail(buffer: string, seqno: number): Promise<EmailData> {
    const parsed = await simpleParser(buffer);

    return {
      messageId: parsed.messageId || `${Date.now()}-${seqno}`,
      subject: parsed.subject || "No Subject",
      from: this.extractEmailAddress(parsed.from),
      to: this.extractEmailAddresses(parsed.to),
      cc: this.extractEmailAddresses(parsed.cc),
      bcc: this.extractEmailAddresses(parsed.bcc),
      body: parsed.text || parsed.html || "",
      date: parsed.date || new Date(),
      // Thread tracking
      inReplyTo: parsed.inReplyTo,
      references: parsed.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : undefined,
      threadId: this.extractThreadId(parsed),
    };
  }

  private extractEmailAddress(address: any): string {
    if (!address) return "";
    if (typeof address === "string") return address;
    if (address.text) return address.text;
    if (address.value && address.value.length > 0) {
      return address.value[0].address || "";
    }
    return "";
  }

  private extractEmailAddresses(addresses: any): string[] {
    if (!addresses) return [];
    if (typeof addresses === "string") return [addresses];
    if (addresses.text) return [addresses.text];
    if (addresses.value && Array.isArray(addresses.value)) {
      return addresses.value.map((addr: any) => addr.address || "").filter(Boolean);
    }
    return [];
  }

  private extractThreadId(parsed: any): string | undefined {
    // First try References header (preferred method)
    if (parsed.references) {
      const refs = Array.isArray(parsed.references) ? parsed.references : [parsed.references];
      if (refs.length > 0) {
        // Use the first reference as thread ID
        return refs[0];
      }
    }
    
    // Fallback to In-Reply-To
    if (parsed.inReplyTo) {
      return parsed.inReplyTo;
    }
    
    // Last resort: use Message-ID if it's the start of a thread
    return parsed.messageId;
  }

  /**
   * Check if an email is a reply to a previous email
   */
  isReplyEmail(email: EmailData): boolean {
    return isReplyEmail(email.subject);
  }

  /**
   * Check if email contains opt-out phrase
   */
  isOptOutEmail(email: EmailData): boolean {
    const body = email.body.toLowerCase();
    const subject = email.subject.toLowerCase();
    
    const optOutPhrases = [
      "never retrieve emails from inboxleap again",
      "never retrieve emails from inboxleap",
      "stop retrieving emails from inboxleap",
      "unsubscribe from inboxleap",
      "opt out of inboxleap"
    ];

    return optOutPhrases.some(phrase => 
      body.includes(phrase) || subject.includes(phrase)
    );
  }
}

export const emailParser = new EmailParser();
