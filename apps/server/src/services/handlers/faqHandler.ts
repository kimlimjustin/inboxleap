import { EmailData } from '../email/types';
import { storage } from '../../storage';
import { sendMail } from '../mailer';
import { getOrCreateUserByEmail } from '../userService';

export class FAQHandler {
  // Rate limiting: max 3 FAQ responses per sender per hour
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  
  private checkRateLimit(senderEmail: string): boolean {
    const now = Date.now();
    const rateLimit = this.rateLimitMap.get(senderEmail);
    
    if (!rateLimit || now > rateLimit.resetTime) {
      // Reset or initialize rate limit
      this.rateLimitMap.set(senderEmail, { count: 1, resetTime: now + 60 * 60 * 1000 }); // 1 hour
      return true;
    }
    
    if (rateLimit.count >= 3) {
      console.log(`📋 [FAQ] Rate limit exceeded for ${senderEmail} (${rateLimit.count}/3)`);
      return false;
    }
    
    rateLimit.count++;
    return true;
  }

  async processEmail(email: EmailData): Promise<void> {
    try {
      console.log(`📋 [FAQ] Processing FAQ email from ${email.from}: ${email.subject}`);
      
      // Prevent infinite loops by checking if the sender is a system email
      if (email.from.includes('@inboxleap.com') || 
          email.from.includes('faq@') ||
          email.from.includes('noreply@') ||
          email.from.includes('no-reply@')) {
        console.log(`📋 [FAQ] Skipping system email from ${email.from} to prevent loops`);
        return;
      }
      
      // Check if this email has already been processed to prevent duplicates
      if (email.messageId) {
        const existingProcessedEmail = await storage.getProcessedEmailByMessageId(email.messageId);
        if (existingProcessedEmail) {
          console.log(`📋 [FAQ] Email ${email.messageId} already processed, skipping`);
          return;
        }
      }
      
      // Check rate limiting to prevent spam
      if (!this.checkRateLimit(email.from)) {
        console.log(`📋 [FAQ] Rate limit exceeded for ${email.from}, skipping`);
        return;
      }
      
      // Extract organization identifier from recipient email
      // Format: faq+orgslug@inboxleap.com
      const faqEmailMatch = email.to.find(recipient => 
        recipient.match(/^faq\+([^@]+)@inboxleap\.com$/)
      );
      
      if (!faqEmailMatch) {
        console.error('📋 [FAQ] No valid FAQ email found in recipients');
        return;
      }
      
      const match = faqEmailMatch.match(/^faq\+([^@]+)@inboxleap\.com$/);
      const orgSlug = match![1];
      
      console.log(`📋 [FAQ] Processing for organization: ${orgSlug}`);
      
      // Find the organization by FAQ email
      const organization = await storage.getFAQOrganizationByEmail(faqEmailMatch);
      if (!organization) {
        console.error(`📋 [FAQ] No organization found for email ${faqEmailMatch}`);
        await this.sendErrorResponse(email, 'Organization not found for this FAQ email.');
        return;
      }
      
      console.log(`📋 [FAQ] Found organization: ${organization.name} (ID: ${organization.id})`);
      
      // Get or create user for the sender
      const senderUser = await getOrCreateUserByEmail(email.from);
      
      // Process the question and generate response
      await this.processInquiryAndRespond(email, organization, senderUser);
      
      // Mark email as processed to prevent duplicate responses
      if (email.messageId) {
        try {
          await storage.createProcessedEmail({
            messageId: email.messageId,
            sender: email.from,
            recipients: email.to,
            ccList: email.cc,
            bccList: email.bcc,
            subject: email.subject,
            body: email.body.substring(0, 1000), // Limit body length
            status: 'processed',
            tasksCreated: 0
          });
          console.log(`📋 [FAQ] Marked email ${email.messageId} as processed`);
        } catch (dbError) {
          // Log error but don't fail the entire process
          console.error(`📋 [FAQ] Failed to mark email as processed:`, dbError);
        }
      }
      
      console.log(`📋 [FAQ] Successfully processed FAQ email for organization ${organization.name}`);
    } catch (error) {
      console.error(`📋 [FAQ] Error processing FAQ email:`, error);
      
      // Mark email as failed to prevent retry loops
      if (email.messageId) {
        try {
          await storage.createProcessedEmail({
            messageId: email.messageId,
            sender: email.from,
            recipients: email.to,
            ccList: email.cc,
            bccList: email.bcc,
            subject: email.subject,
            body: email.body.substring(0, 1000),
            status: 'failed',
            tasksCreated: 0,
            processingError: error instanceof Error ? error.message : 'Unknown error'
          });
          console.log(`📋 [FAQ] Marked email ${email.messageId} as failed`);
        } catch (dbError) {
          console.error(`📋 [FAQ] Failed to mark email as failed:`, dbError);
        }
      }
      
      // Try to send error response
      try {
        await this.sendErrorResponse(email, 'An error occurred while processing your FAQ inquiry. Please try again later.');
      } catch (responseError) {
        console.error(`📋 [FAQ] Failed to send error response:`, responseError);
      }
    }
  }
  
  private async processInquiryAndRespond(email: EmailData, organization: any, senderUser: any): Promise<void> {
    const inquiry = email.body.trim();
    
    console.log(`📋 [FAQ] Processing inquiry: "${inquiry.substring(0, 100)}..."`);
    
    // Get knowledge base (SOP documents)
    const sopDocuments = await storage.getSOPDocumentsByOrganization(organization.id);
    console.log(`📋 [FAQ] Found ${sopDocuments.length} SOP documents`);
    
    // Get existing FAQ entries
    const faqEntries = await storage.getFAQEntriesByOrganization(organization.id);
    console.log(`📋 [FAQ] Found ${faqEntries.length} FAQ entries`);
    
    // Generate AI response using knowledge base
    const response = await this.generateResponseFromKnowledgeBase(
      inquiry,
      sopDocuments,
      faqEntries,
      organization
    );
    
    // Save the inquiry and response as a new FAQ entry
    await this.saveInquiryAsFAQEntry(inquiry, response, organization, senderUser);
    
    // Send email response
    await this.sendFAQResponse(email, response, organization);
  }
  
  private async generateResponseFromKnowledgeBase(
    inquiry: string,
    sopDocuments: any[],
    faqEntries: any[],
    organization: any
  ): Promise<string> {
    try {
      console.log(`📋 [FAQ] Generating AI response from knowledge base`);
      
      // Build context from knowledge base
      let knowledgeContext = `Organization: ${organization.name}\n\n`;
      
      // Add SOP documents to context
      if (sopDocuments.length > 0) {
        knowledgeContext += "KNOWLEDGE BASE DOCUMENTS:\n\n";
        sopDocuments.forEach((doc, index) => {
          knowledgeContext += `${index + 1}. ${doc.title}\n`;
          knowledgeContext += `Category: ${doc.category || 'General'}\n`;
          knowledgeContext += `Content: ${doc.content.substring(0, 1000)}${doc.content.length > 1000 ? '...' : ''}\n\n`;
        });
      }
      
      // Add existing FAQ entries to context
      if (faqEntries.length > 0) {
        knowledgeContext += "FREQUENTLY ASKED QUESTIONS:\n\n";
        faqEntries.forEach((faq, index) => {
          knowledgeContext += `Q${index + 1}: ${faq.question}\n`;
          knowledgeContext += `A${index + 1}: ${faq.answer}\n\n`;
        });
      }
      
      // Create prompt for AI
      const prompt = `You are a helpful FAQ assistant for ${organization.name}. 
      
Based on the knowledge base and FAQ entries below, please provide a comprehensive and helpful answer to the following inquiry.

If the answer is not directly available in the knowledge base, use your general knowledge to provide a helpful response while noting that the specific information may not be in the organization's documentation.

INQUIRY: ${inquiry}

${knowledgeContext}

Please provide a clear, helpful response:`;
      
      // For now, generate a structured response based on available data
      // In a real implementation, you would call an AI service like OpenAI or Claude here
      let response = await this.generateStructuredResponse(inquiry, sopDocuments, faqEntries, organization);
      
      console.log(`📋 [FAQ] Generated response (${response.length} characters)`);
      return response;
      
    } catch (error) {
      console.error('📋 [FAQ] Error generating response from knowledge base:', error);
      return this.generateFallbackResponse(inquiry, organization);
    }
  }
  
  private async generateStructuredResponse(
    inquiry: string,
    sopDocuments: any[],
    faqEntries: any[],
    organization: any
  ): Promise<string> {
    // Check if inquiry matches existing FAQ entries
    const matchingFAQ = faqEntries.find(faq => 
      faq.question.toLowerCase().includes(inquiry.toLowerCase().substring(0, 50)) ||
      inquiry.toLowerCase().includes(faq.question.toLowerCase().substring(0, 30))
    );
    
    if (matchingFAQ) {
      return `Thank you for your inquiry about ${organization.name}!

Based on our FAQ database, here's the answer to your question:

**${matchingFAQ.question}**

${matchingFAQ.answer}

If you need additional information, please don't hesitate to ask!

Best regards,
${organization.name} FAQ System`;
    }
    
    // Check if inquiry matches SOP documents
    const relevantDocs = sopDocuments.filter(doc => 
      doc.title.toLowerCase().includes(inquiry.toLowerCase().substring(0, 30)) ||
      doc.content.toLowerCase().includes(inquiry.toLowerCase().substring(0, 50)) ||
      inquiry.toLowerCase().includes(doc.title.toLowerCase().substring(0, 20))
    );
    
    if (relevantDocs.length > 0) {
      const doc = relevantDocs[0];
      return `Thank you for your inquiry about ${organization.name}!

I found relevant information in our knowledge base:

**${doc.title}**
${doc.description ? `\n${doc.description}\n` : ''}

${doc.content.length > 800 ? 
  doc.content.substring(0, 800) + '...\n\nFor complete information, please refer to our full documentation.' 
  : doc.content}

${relevantDocs.length > 1 ? `\nI also found ${relevantDocs.length - 1} other relevant document(s) that might be helpful.` : ''}

If you need further clarification, please let me know!

Best regards,
${organization.name} FAQ System`;
    }
    
    // Generic helpful response
    return `Thank you for contacting ${organization.name}!

I've received your inquiry: "${inquiry.substring(0, 100)}${inquiry.length > 100 ? '...' : ''}"

While I don't have specific information about this topic in our current knowledge base, I've forwarded your question to our team. We'll update our FAQ database with this information soon.

${sopDocuments.length > 0 ? 
  `\nYou might find helpful information in our available documentation covering topics like: ${sopDocuments.map(d => d.title).slice(0, 3).join(', ')}.` 
  : ''}

${faqEntries.length > 0 ? 
  `\nYou can also check our existing FAQ entries which cover: ${faqEntries.map(f => f.category || 'General').filter((c, i, arr) => arr.indexOf(c) === i).slice(0, 3).join(', ')}.` 
  : ''}

If you have any urgent questions, please feel free to reach out directly.

Best regards,
${organization.name} FAQ System`;
  }
  
  private generateFallbackResponse(inquiry: string, organization: any): string {
    return `Thank you for contacting ${organization.name}!

I've received your inquiry and will make sure it gets the attention it deserves.

Your question: "${inquiry.substring(0, 200)}${inquiry.length > 200 ? '...' : ''}"

I'm currently processing your request and will follow up with a detailed response shortly. In the meantime, if you have any urgent questions, please don't hesitate to reach out directly.

Best regards,
${organization.name} FAQ System`;
  }
  
  private async saveInquiryAsFAQEntry(
    inquiry: string,
    response: string,
    organization: any,
    senderUser: any
  ): Promise<void> {
    try {
      console.log(`📋 [FAQ] Saving inquiry as FAQ entry for organization ${organization.id}`);
      
      // Create a question from the inquiry (limit length)
      const question = inquiry.length > 200 
        ? inquiry.substring(0, 197) + '...'
        : inquiry;
      
      // Determine category based on content (basic keyword matching)
      let category = 'General';
      if (inquiry.toLowerCase().includes('price') || inquiry.toLowerCase().includes('cost')) {
        category = 'Pricing';
      } else if (inquiry.toLowerCase().includes('technical') || inquiry.toLowerCase().includes('how to')) {
        category = 'Technical';
      } else if (inquiry.toLowerCase().includes('support') || inquiry.toLowerCase().includes('help')) {
        category = 'Support';
      } else if (inquiry.toLowerCase().includes('policy') || inquiry.toLowerCase().includes('rule')) {
        category = 'Policy';
      }
      
      await storage.createFAQEntry({
        organizationId: organization.id,
        question,
        answer: response,
        category,
        relatedDocuments: [],
        createdBy: organization.createdBy // Use organization creator as default
      });
      
      console.log(`📋 [FAQ] Successfully saved FAQ entry`);
    } catch (error) {
      console.error('📋 [FAQ] Error saving FAQ entry:', error);
      // Don't throw error, just log it - the response should still be sent
    }
  }
  
  private async sendFAQResponse(email: EmailData, response: string, organization: any): Promise<void> {
    try {
      console.log(`📋 [FAQ] Sending FAQ response to ${email.from}`);
      
      const replySubject = email.subject.startsWith('Re: ') 
        ? email.subject 
        : `Re: ${email.subject}`;
      
      await sendMail({
        from: organization.faqEmail || 'faq@inboxleap.com',
        to: email.from,
        subject: replySubject,
        text: response,
        replyTo: organization.faqEmail || 'faq@inboxleap.com'
      });
      
      console.log(`📋 [FAQ] Successfully sent FAQ response`);
    } catch (error) {
      console.error('📋 [FAQ] Error sending FAQ response:', error);
      throw error;
    }
  }
  
  private async sendErrorResponse(email: EmailData, errorMessage: string): Promise<void> {
    try {
      const defaultResponse = `Thank you for your email.

Unfortunately, we encountered an issue processing your inquiry: ${errorMessage}

Please try again later or contact us directly if you need immediate assistance.

Best regards,
FAQ Support`;

      await sendMail({
        from: 'faq@inboxleap.com',
        to: email.from,
        subject: `Re: ${email.subject}`,
        text: defaultResponse,
        replyTo: 'faq@inboxleap.com'
      });
      
      console.log(`📋 [FAQ] Sent error response to ${email.from}`);
    } catch (error) {
      console.error('📋 [FAQ] Error sending error response:', error);
    }
  }
}

export const faqHandler = new FAQHandler();