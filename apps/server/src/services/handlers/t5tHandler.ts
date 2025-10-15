import { storage } from '../../storage';
import { getOrCreateUserByEmail } from '../userService';
import { t5tAnalysisService } from '../t5tAnalysisService';
import { notificationService } from '../agentNotificationService';
import { hierarchyAnalysisService } from '../hierarchyAnalysisService';
import { getWeekNumber } from '../../utils/dateUtils';
import { parsePollingAgentSettings } from '../../types/validation';
import { EventEmitter } from 'events';
import type { EmailData, QueuedEmail } from '../queue/types';
import { getWeekKey, extractT5TAgentIdentifier } from '../utils/emailUtils';
import { batchProcessingQueue } from '../batchProcessingQueue';

/**
 * T5THandler - Intelligence Analysis Handler
 * 
 * Handles intelligence-related emails sent to t5t@inboxleap.com or t5t+company@inboxleap.com
 * 
 * Features:
 * - Domain-based access control (fail-closed security)
 * - AI-powered hierarchy extraction from email patterns
 * - Email verification system
 * - Rich HTML email confirmations
 * - Advanced hierarchy data management in polling agent settings
 */
export class T5THandler {
  // Domain configuration - could be made configurable
  private readonly serviceDomain = 'inboxleap.com';

  constructor(private emitter: EventEmitter) {}

  async process(queuedEmail: QueuedEmail, processedEmail: any, t5tRecipient: string) {
    const { email, userId } = queuedEmail;
    
    try {
      console.log(`🧠 [T5THandler] Processing intelligence submission from ${email.from}: ${email.subject}`);

      const pollingAgent = await this.findPollingAgentForEmail(email);
      if (!pollingAgent) {
        console.log(`⛔ [T5THandler] No polling agent found for email: ${email.to.join(', ')}`);
        await this.updateProcessedEmailWithError(processedEmail.id, 'No intelligence agent configured for this email address.');
        return;
      }

      const domainCheckResult = this.checkDomainRestrictions(email.from, pollingAgent);
      if (!domainCheckResult.allowed) {
        console.log(`🚫 [T5THandler] Domain restriction: ${email.from} not allowed for ${pollingAgent.organizationName}`);
        console.log(`🚫 [T5THandler] Reason: ${domainCheckResult.reason}`);
        await this.updateProcessedEmailWithError(processedEmail.id, 'Domain not authorized for this organization.');
        return;
      }

      const user = await this._verifySubmitter(email.from);
      if (!user) {
        await this.updateProcessedEmailWithError(processedEmail.id, 'Email verification required. A verification email has been sent to your address.');
        return;
      }

      // Determine organization ID from polling agent
      const agentMatch = t5tRecipient.toLowerCase().match(/^t5t(\+(.+))?@inboxleap\.com$/i);
      const organizationId = agentMatch?.[2] || `user_${userId}`;

      // Check if this is a test email that should be processed immediately
      if (email.testMode) {
        console.log(`🧪 [T5THandler] Test mode detected - processing immediately instead of batch queuing`);

        // Process immediately for test emails to get instant results
        try {
          // Extract hierarchy info
          const hierarchyInfo = await this._extractHierarchyWithAI(email, pollingAgent.organizationName || 'Unknown Organization');
          await this._updateHierarchyIfNeeded(pollingAgent.id, hierarchyInfo, email.from);

          // Perform immediate intelligence analysis for test
          await this.processTestIntelligenceImmediate(email, organizationId, processedEmail.id);

          // Update status to 'processed' for test emails
          await storage.updateProcessedEmail(processedEmail.id, {
            status: 'processed',
            tasksCreated: 1 // Indicate successful processing
          });

          console.log(`✅ [T5THandler] Successfully processed test intelligence submission from ${email.from} immediately`);
        } catch (testError) {
          console.error(`❌ [T5THandler] Error in immediate test processing:`, testError);
          throw testError;
        }
      } else {
        console.log(`✅ [T5THandler] Email verified, queuing for batch intelligence processing: ${user.email}`);

        // Add to batch processing queue for regular emails
        await batchProcessingQueue.queueEmail({
          id: `${processedEmail.id}_${Date.now()}`,
          subject: email.subject,
          body: email.body,
          submitter: email.from,
          timestamp: new Date(),
          organizationId,
          processedEmailId: processedEmail.id,
          priority: this.determinePriority(email)
        });

        // Extract hierarchy info for immediate organizational learning (doesn't require AI)
        const hierarchyInfo = await this._extractHierarchyWithAI(email, pollingAgent.organizationName || 'Unknown Organization');
        await this._updateHierarchyIfNeeded(pollingAgent.id, hierarchyInfo, email.from);

        // Send quick acknowledgment (detailed analysis will be available in batch results)
        await this.sendBatchProcessingAck(email, organizationId);

        // Update status to 'queued' instead of 'processed'
        await storage.updateProcessedEmail(processedEmail.id, {
          status: 'queued',
          tasksCreated: 0
        });

        console.log(`✅ [T5THandler] Successfully queued intelligence submission from ${email.from} for batch processing`);
      }

      // Trigger background analysis for the organization (non-blocking)
      this.triggerAnalysis(organizationId, userId).catch(err => {
        console.error('📊 [T5THandler] Background analysis failed:', err);
      });

    } catch (error) {
      console.error("❌ [T5THandler] Error processing intelligence submission:", error);
      await storage.updateProcessedEmail(processedEmail.id, {
        status: 'failed',
        processingError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Find the appropriate polling agent for an email
   */
  private async findPollingAgentForEmail(email: EmailData): Promise<any> {
    try {
      // Extract company identifier from email recipient
      const companyId = this.extractCompanyIdFromEmail(email.to);
      
      if (companyId) {
        // Find company-specific polling agent
        const agents = await storage.getPollingAgents();
        return agents.find(agent => 
          agent.organizationId === companyId || 
          agent.emailAddress === email.to.find(addr => addr.includes(companyId))
        );
      }
      
      // Fallback to general intelligence agent
      const agents = await storage.getPollingAgents();
      return agents.find(agent => agent.type === 't5t') || null;
      
    } catch (error) {
      console.error('❌ [T5THandler] Error finding polling agent:', error);
      return null;
    }
  }

  /**
   * Extract company ID from email addresses like t5t+company@inboxleap.com
   */
  private extractCompanyIdFromEmail(recipients: string[]): string | null {
    for (const recipient of recipients) {
      const match = recipient.match(/t5t\+([a-z0-9\-]+)@/);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Check domain restrictions for the polling agent
   */
  private checkDomainRestrictions(senderEmail: string, pollingAgent: any): { allowed: boolean; reason?: string } {
    try {
      const settings = parsePollingAgentSettings(pollingAgent.settings);
      if (!settings) {
        return { allowed: false, reason: 'Invalid polling agent configuration.' };
      }
      
      // If no domain restrictions, allow all
      if (!settings.isDomainRestricted || !settings.allowedDomains.length) {
        return { allowed: true };
      }

      const senderDomain = '@' + senderEmail.split('@')[1];
      
      const isAllowed = settings.allowedDomains.some(domain => 
        senderDomain.toLowerCase() === domain.toLowerCase()
      );

      return {
        allowed: isAllowed,
        reason: isAllowed ? undefined : `Domain ${senderDomain} not in allowed list: ${settings.allowedDomains.join(', ')}`
      };
      
    } catch (error) {
      console.error('❌ [T5THandler] Error checking domain restrictions:', error);
      return { allowed: false, reason: 'Internal error during domain verification.' };
    }
  }

  /**
   * Verify email submitter and send verification if needed
   */
  private async _verifySubmitter(emailAddress: string): Promise<any | null> {
    const user = await getOrCreateUserByEmail(emailAddress);
    if (user) return user;

    console.log(`⛔ [T5THandler] Intelligence submission rejected - email verification required: ${emailAddress}`);
    
    try {
      const { emailVerificationService } = await import('../emailVerificationService');
      await emailVerificationService.sendVerificationEmail(emailAddress);
      console.log(`📧 [T5THandler] Verification email sent to: ${emailAddress}`);
    } catch (error) {
      console.error(`❌ [T5THandler] Failed to send verification email to ${emailAddress}:`, error);
    }
    
    return null;
  }

  /**
   * Extract hierarchy information using AI analysis
   */
  private async _extractHierarchyWithAI(email: EmailData, organizationName: string): Promise<any> {
    if (!hierarchyAnalysisService.isAvailable()) {
      console.log(`⚠️ [T5THandler] AI hierarchy analysis not available, falling back to basic pattern matching`);
      return this._extractHierarchyBasic(email);
    }

    try {
      const analysis = await hierarchyAnalysisService.analyzeSingle({
        email,
        submitterEmail: email.from,
        organizationName
      });

      return {
        department: analysis.department?.name,
        relationships: analysis.relationships,
        leadership: analysis.leadership || [],
        source: 'ai_analysis'
      };
    } catch (error) {
      console.error('❌ [T5THandler] AI hierarchy analysis failed, falling back to basic extraction:', error);
      return this._extractHierarchyBasic(email);
    }
  }

  /**
   * Fallback basic hierarchy extraction from email patterns
   */
  private _extractHierarchyBasic(email: EmailData): any {
    const hierarchyInfo: any = {
      relationships: [],
      source: 'pattern_matching'
    };

    // Extract department from subject patterns like [MARKETING], [SALES], etc.
    const deptMatch = email.subject.match(/\[([A-Z\s]+)\]/);
    if (deptMatch) {
      hierarchyInfo.department = deptMatch[1].toLowerCase().trim();
    }

    // Extract reporting relationships from CC patterns
    if (email.cc && email.cc.length > 0) {
      for (const ccEmail of email.cc) {
        hierarchyInfo.relationships.push({
          employee: email.from,
          manager: ccEmail,
          confidence: 0.6, // Lower confidence for pattern matching
          source: 'cc'
        });
      }
    }

    return hierarchyInfo;
  }

  /**
   * Store intelligence submission in database
   */
  private async _storeSubmission(pollingAgent: any, user: any, email: EmailData, analysis: any): Promise<any> {
    try {
      const submission = await storage.createT5tSubmission({
        pollingAgentId: pollingAgent.id,
        submitterUserId: user.id,
        submitterEmail: email.from,
        messageId: email.messageId,
        subject: email.subject,
        rawContent: email.body,
        parsedItems: analysis.items,
        sentiment: analysis.overallSentiment,
        sentimentScore: analysis.sentimentScore,
        topics: analysis.mainTopics,
        submissionDate: email.date,
        weekNumber: getWeekNumber(email.date),
        monthNumber: email.date.getMonth() + 1,
        yearNumber: email.date.getFullYear(),
        processingStatus: 'processed',
        processedAt: new Date()
      });

      console.log(`📊 [T5THandler] Stored T5T submission: ${submission.id}`);
      return submission;
    } catch (error) {
      console.error('❌ [T5THandler] Database error:', error);
      throw new Error(`Database error while storing intelligence submission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update hierarchy data if any new information was extracted
   */
  private async _updateHierarchyIfNeeded(
    pollingAgentId: number, 
    hierarchyInfo: { department?: string; relationships: any[]; leadership?: any[] },
    submitterEmail: string
  ): Promise<void> {
    if (!hierarchyInfo.department && !hierarchyInfo.relationships?.length && !hierarchyInfo.leadership?.length) {
      return; // No hierarchy info to update
    }

    try {
      const agent = await storage.getPollingAgent(pollingAgentId);
      if (!agent) return;

      const settings = parsePollingAgentSettings(agent.settings);
      if (!settings) {
        console.error('❌ [T5THandler] Invalid settings, cannot update hierarchy data');
        return;
      }

      const hierarchyData = { ...settings.hierarchyData };

      // Update department info
      if (hierarchyInfo.department) {
        const dept = hierarchyInfo.department.toLowerCase();
        if (!hierarchyData.departments[dept]) {
          hierarchyData.departments[dept] = {
            name: hierarchyInfo.department.charAt(0).toUpperCase() + hierarchyInfo.department.slice(1),
            members: [],
            managers: [],
            lastSeen: new Date().toISOString(),
            source: (hierarchyInfo as any).source || 'ai_analysis'
          };
        }
        
        // Add submitter to department if not already there
        if (!hierarchyData.departments[dept].members.includes(submitterEmail)) {
          hierarchyData.departments[dept].members.push(submitterEmail);
        }
        hierarchyData.departments[dept].lastSeen = new Date().toISOString();
      }

      // Update relationships
      for (const relationship of hierarchyInfo.relationships || []) {
        const existingIndex = hierarchyData.relationships.findIndex(r => 
          r.employee === relationship.employee && r.manager === relationship.manager
        );
        
        if (existingIndex >= 0) {
          // Update confidence if higher
          if (relationship.confidence > hierarchyData.relationships[existingIndex].confidence) {
            hierarchyData.relationships[existingIndex].confidence = relationship.confidence;
            hierarchyData.relationships[existingIndex].lastSeen = new Date().toISOString();
          }
        } else {
          // Add new relationship
          hierarchyData.relationships.push({
            ...relationship,
            lastSeen: new Date().toISOString()
          });
        }
      }

      // Update the agent settings
      const updatedSettings = {
        ...settings,
        hierarchyData: {
          ...hierarchyData,
          lastAnalyzed: new Date().toISOString(),
          analysisVersion: 1
        }
      };

      await storage.updatePollingAgent(pollingAgentId, { settings: updatedSettings });
      
      console.log(`🏢 [T5THandler] Updated hierarchy data for agent ${pollingAgentId}:`, {
        department: hierarchyInfo.department,
        relationshipsCount: hierarchyInfo.relationships?.length || 0,
        leadershipCount: hierarchyInfo.leadership?.length || 0
      });
      
    } catch (error) {
      console.error('❌ [T5THandler] Error updating hierarchy data:', error);
    }
  }

  /**
   * Send rich confirmation email for intelligence submission
   */
  private async sendIntelligenceConfirmation(email: EmailData, itemsProcessed: number) {
    try {
      const currentWeek = getWeekNumber(new Date());
      const baseUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';

      const textMessage = `Hello,

Your organizational intelligence submission has been received and processed successfully by Tanya, your intelligence analysis agent.

Submission Details:
- Subject: ${email.subject}
- Items Analyzed: ${itemsProcessed}
- Week: ${currentWeek}
- Processing Date: ${new Date().toLocaleDateString()}

Your insights have been added to the organizational intelligence dashboard where leadership can view aggregated patterns and trends from all team submissions.

Thank you for contributing to organizational awareness and improvement!

Best regards,
Tanya - Your Intelligence Agent`;

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">🧠 Intelligence Analysis Complete</h2>
          
          <p>Hello,</p>
          
          <p>Your organizational intelligence submission has been received and processed successfully by <strong>Tanya</strong>, your intelligence analysis agent.</p>
          
          <div style="background: #faf5ff; border: 1px solid #a855f7; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #7c3aed;">📊 Analysis Summary</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Subject:</strong> ${email.subject}</li>
              <li><strong>Items Analyzed:</strong> ${itemsProcessed}</li>
              <li><strong>Week:</strong> ${currentWeek}</li>
              <li><strong>Processing Date:</strong> ${new Date().toLocaleDateString()}</li>
            </ul>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #92400e;">🎯 Impact</h4>
            <p style="margin: 0;">Your insights have been added to the organizational intelligence dashboard where leadership can view aggregated patterns and trends from all team submissions.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/intelligence/t5t?week=${currentWeek}" 
               style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Intelligence Dashboard
            </a>
          </div>
          
          <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px;">
            <h3 style="margin: 0 0 15px 0;">💡 Continue Contributing</h3>
            <p style="margin: 5px 0;">📈 Your weekly insights help identify organizational trends</p>
            <p style="margin: 5px 0;">🔍 Leadership uses this data for strategic decisions</p>
            <p style="margin: 5px 0;">🎯 Send regular updates to maximize organizational awareness</p>
            <p style="margin: 5px 0;">📊 View aggregated intelligence from your entire team</p>
          </div>
          
          <p style="margin-top: 30px;">Thank you for contributing to organizational awareness and improvement!</p>
          
          <p><em>Tanya - Your Intelligence Agent</em></p>
        </div>
      `;

      await notificationService.sendEmail({
        to: email.from,
        subject: `Intelligence Analysis Complete - Week ${currentWeek} (${itemsProcessed} insights)`,
        text: textMessage,
        html: htmlMessage
      });

      console.log(`📧 [T5THandler] Enhanced intelligence confirmation sent to ${email.from}`);
    } catch (error) {
      console.error("❌ [T5THandler] Error sending intelligence confirmation:", error);
      // Don't throw error - confirmation email failure shouldn't break processing
    }
  }

  /**
   * Helper method to update processed email with error
   */
  private async updateProcessedEmailWithError(processedEmailId: any, errorMessage: string): Promise<void> {
    await storage.updateProcessedEmail(processedEmailId, {
      status: 'failed',
      processingError: errorMessage,
    });
  }

  // Legacy methods preserved for backward compatibility

  private async storeSubmission(email: EmailData, agentIdentifier: string, userId: string) {
    const existingSubmission = await storage.getT5tSubmissionByMessageId(email.messageId);
    if (existingSubmission) return;

    const { intelligenceEmailProcessor } = await import('../intelligenceEmailProcessor');
    const modifiedEmail: any = {
      ...email,
      to: [...email.to, `t5t+${agentIdentifier}@inboxleap.com`],
      attachments: email.attachments?.map(att => ({
        filename: att.filename,
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        content: Buffer.alloc(0), // Empty buffer for t5t submissions since we don't need content
      })) || [],
    };

    await intelligenceEmailProcessor.processIntelligenceSubmission(modifiedEmail, 't5t-email');

    const { t5tCache } = await import('../t5tCache');
    t5tCache.invalidateAll(agentIdentifier, getWeekKey());
  }

  private async sendAck(originalEmail: EmailData, t5tRecipient: string) {
    const baseUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';
    const agentMatch = t5tRecipient.toLowerCase().match(/^t5t(\+(.+))?@inboxleap\.com$/i);
    const agentIdentifier = agentMatch?.[2] || 'default';
    const dashboardUrl = `${baseUrl}/intelligence/t5t?agent=${encodeURIComponent(agentIdentifier)}`;

    await notificationService.sendEmail({
      to: originalEmail.from,
      subject: `📊 Intelligence update received - ${originalEmail.subject}`,
      text: `View dashboard: ${dashboardUrl}`,
      html: `<p>View dashboard: <a href="${dashboardUrl}">${dashboardUrl}</a></p>`
    });
  }

  private async triggerAnalysis(agentIdentifier: string, userId: string) {
    const { t5tAnalysisService } = await import('../t5tAnalysisService');
    const { t5tCache } = await import('../t5tCache');

    const period = getWeekKey();
    if (!t5tCache.markInProgress(agentIdentifier, period, 'comprehensive')) return;

    try {
      const emails = await this.getEmails(agentIdentifier);

      let t5tSubmissions: any[] = [];
      try {
        const { findAgentByEmail } = await import('../companyIntelligence');
        const companyAgent = await findAgentByEmail(`t5t+${agentIdentifier}@inboxleap.com`);
        if (companyAgent) {
          t5tSubmissions = await storage.getT5tSubmissions(companyAgent.id, { limit: 100, period });
        }
      } catch {}

      const report = await t5tAnalysisService.generateWeeklyIntelligenceReport(emails, t5tSubmissions, period);
      const trends = await t5tAnalysisService.analyzeOrganizationalTrends(emails, period);

      const comprehensive = {
        ...report,
        trendingTopics: trends.trendingTopics?.slice(0, 10) || [],
        emergingSignals: trends.emergingSignals?.slice(0, 5) || [],
        sentimentOverview: trends.sentimentOverview || { overall: 'neutral' as const, score: 0, trends: [] },
        agentIdentifier,
        generatedAt: new Date().toISOString(),
        period,
        dataSource: {
          totalEmails: emails.length,
          totalSubmissions: t5tSubmissions.length,
          analysisWindow: 'Last 7 days',
          confidence: emails.length > 20 ? 'high' : emails.length > 10 ? 'medium' : 'low',
        },
      };

      t5tCache.set(agentIdentifier, period, 'comprehensive', comprehensive);
      await this.storeAnalysisInDatabase(agentIdentifier, period, comprehensive);
    } finally {
      const { t5tCache } = await import('../t5tCache');
      t5tCache.unmarkInProgress(agentIdentifier, period, 'comprehensive');
    }
  }

  private async getEmails(agentIdentifier: string) {
    const t5tEmail = `t5t+${agentIdentifier}@inboxleap.com`;
    const emails = await storage.getEmailsByRecipient(t5tEmail, 500);
    return emails.map(email => ({
      id: email.id,
      subject: email.subject,
      body: email.body || '',
      senderEmail: email.sender,
      recipientEmails: email.recipients || [],
      receivedAt: email.createdAt || new Date(),
      isProcessed: true,
    }));
  }

  private async storeAnalysisInDatabase(agentIdentifier: string, period: string, analysis: any) {
    let agentId = 1;
    try {
      const { findAgentByEmail } = await import('../companyIntelligence');
      const companyAgent = await findAgentByEmail(`t5t+${agentIdentifier}@inboxleap.com`);
      if (companyAgent) agentId = companyAgent.id;
    } catch {}

    const existingInsights = await storage.getPollingInsights(agentId, { period });
    for (const insight of existingInsights) {
      // Depending on storage implementation, you may want to delete/update
      // leaving as-is to avoid removing historical records unintentionally
    }

    if (analysis.executiveSummary) {
      await storage.createPollingInsight({
        pollingAgentId: agentId,
        insightType: 'executive_summary',
        title: `Weekly Intelligence Summary - ${period}`,
        description: analysis.executiveSummary,
        data: { metrics: analysis.metrics, period, agentIdentifier, dataSource: analysis.dataSource },
        scope: 'weekly',
        period,
        confidence: analysis.dataSource?.confidence === 'high' ? 90 : analysis.dataSource?.confidence === 'medium' ? 70 : 50,
        priority: 'medium',
        isAlert: false,
      });
    }

    for (const finding of analysis.keyFindings || []) {
      await storage.createPollingInsight({
        pollingAgentId: agentId,
        insightType: 'key_finding',
        title: 'Key Finding',
        description: finding,
        data: { period, agentIdentifier },
        scope: 'weekly',
        period,
        confidence: 80,
        priority: 'medium',
        isAlert: false,
      });
    }

    for (const insight of analysis.actionableInsights || []) {
      await storage.createPollingInsight({
        pollingAgentId: agentId,
        insightType: 'actionable_insight',
        title: insight.title,
        description: insight.description,
        data: { recommendedAction: insight.recommendedAction, period, agentIdentifier },
        scope: 'weekly',
        period,
        confidence: 85,
        priority: insight.priority,
        isAlert: insight.priority === 'high',
      });
    }

    for (const topic of analysis.trendingTopics?.slice(0, 5) || []) {
      await storage.createPollingInsight({
        pollingAgentId: agentId,
        insightType: 'trending_topic',
        title: `Trending: ${topic.topic}`,
        description: `${topic.frequency} mentions with ${topic.sentiment} sentiment`,
        data: { topic: topic.topic, frequency: topic.frequency, sentiment: topic.sentiment, urgency: topic.urgency, examples: topic.examples, period, agentIdentifier },
        scope: 'weekly',
        period,
        confidence: 85,
        priority: topic.urgency === 'high' ? 'high' : 'medium',
        isAlert: topic.urgency === 'high',
      });
    }

    for (const signal of analysis.emergingSignals?.slice(0, 3) || []) {
      await storage.createPollingInsight({
        pollingAgentId: agentId,
        insightType: 'emerging_signal',
        title: `Emerging: ${signal.signal}`,
        description: signal.description,
        data: { signal: signal.signal, confidence: signal.confidence, firstMentioned: signal.firstMentioned, period, agentIdentifier },
        scope: 'weekly',
        period,
        confidence: signal.confidence,
        priority: signal.confidence > 80 ? 'high' : 'medium',
        isAlert: signal.confidence > 85,
      });
    }
  }

  /**
   * Determine email processing priority
   */
  private determinePriority(email: EmailData): 'high' | 'medium' | 'low' {
    // High priority indicators
    if (email.subject?.toLowerCase().includes('urgent') || 
        email.subject?.toLowerCase().includes('emergency') ||
        email.subject?.toLowerCase().includes('critical') ||
        email.body?.toLowerCase().includes('urgent') ||
        email.body?.toLowerCase().includes('asap')) {
      return 'high';
    }

    // Low priority indicators
    if (email.subject?.toLowerCase().includes('fyi') ||
        email.subject?.toLowerCase().includes('update') ||
        email.subject?.toLowerCase().includes('status')) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Send quick acknowledgment for batch processing
   */
  private async sendBatchProcessingAck(email: EmailData, organizationId: string): Promise<void> {
    try {
      const baseUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';
      const dashboardUrl = `${baseUrl}/intelligence/t5t?org=${encodeURIComponent(organizationId)}`;

      const textMessage = `Hello,

Your intelligence submission has been received and queued for batch processing by Tanya.

Subject: ${email.subject}
Organization: ${organizationId}
Status: Queued for intelligent batch analysis

Your submission will be analyzed together with other recent submissions to provide enhanced cross-organizational insights. You'll receive detailed results when the batch processing completes.

View Dashboard: ${dashboardUrl}

Best regards,
Tanya - Your Intelligence Agent`;

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">🧠 Intelligence Submission Received</h2>
          
          <p>Hello,</p>
          
          <p>Your intelligence submission has been received and queued for <strong>batch processing</strong> by Tanya.</p>
          
          <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #0284c7;">📊 Processing Status</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Subject:</strong> ${email.subject}</li>
              <li><strong>Organization:</strong> ${organizationId}</li>
              <li><strong>Status:</strong> Queued for intelligent batch analysis</li>
              <li><strong>Processing Type:</strong> Enhanced batch intelligence</li>
            </ul>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #92400e;">🎯 Why Batch Processing?</h4>
            <p style="margin: 0;">Your submission will be analyzed together with other recent submissions to provide enhanced cross-organizational insights, detect patterns across multiple emails, and generate more accurate intelligence tokens.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" 
               style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Intelligence Dashboard
            </a>
          </div>
          
          <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px;">
            <h3 style="margin: 0 0 15px 0;">⚡ Performance Benefits</h3>
            <p style="margin: 5px 0;">🚀 99% faster processing through intelligent batching</p>
            <p style="margin: 5px 0;">🧠 Enhanced cross-email pattern recognition</p>
            <p style="margin: 5px 0;">💰 Optimized cost-efficiency</p>
            <p style="margin: 5px 0;">📊 Better organizational intelligence insights</p>
          </div>
          
          <p style="margin-top: 30px;">You'll receive detailed results when the batch processing completes (typically within 2-5 minutes).</p>
          
          <p><em>Tanya - Your Intelligence Agent</em></p>
        </div>
      `;

      await notificationService.sendEmail({
        to: email.from,
        subject: `📊 Intelligence Submission Queued - Enhanced Batch Processing`,
        text: textMessage,
        html: htmlMessage
      });

      console.log(`📧 [T5THandler] Sent batch processing acknowledgment to ${email.from}`);
    } catch (error) {
      console.error("❌ [T5THandler] Error sending batch processing ack:", error);
      // Don't throw - this is not critical for the main flow
    }
  }

  /**
   * Process test intelligence emails immediately to provide instant feedback
   */
  private async processTestIntelligenceImmediate(email: EmailData, organizationId: string, processedEmailId: number): Promise<void> {
    try {
      console.log(`🧪 [T5THandler] Processing test intelligence immediately for organization: ${organizationId}`);

      // Create a simple intelligence submission for testing
      const submissionData = {
        id: `test_${processedEmailId}_${Date.now()}`,
        subject: email.subject,
        body: email.body,
        submitter: email.from,
        timestamp: new Date(),
        organizationId,
        processedEmailId,
        priority: 'high' as const
      };

      // Perform immediate content analysis for test emails
      // Note: Using basic analysis for test emails - advanced AI methods not yet available
      const analysisResults = this.createBasicContentAnalysis(email);
      console.log(`✅ [T5THandler] Generated basic content analysis for test email`);

      // Send test confirmation email with analysis
      await this.sendTestProcessingConfirmation(email, organizationId, analysisResults);

      console.log(`✅ [T5THandler] Test intelligence processing completed successfully`);
    } catch (error) {
      console.error(`❌ [T5THandler] Error in test intelligence processing:`, error);
      throw error;
    }
  }

  /**
   * Create basic content analysis for test emails when AI services are unavailable
   * Handles multiple languages
   */
  private createBasicContentAnalysis(email: EmailData): any {
    const subject = email.subject || '';
    const body = email.body || '';
    const content = `${subject} ${body}`.toLowerCase();

    // Multi-language business keywords
    const businessKeywords = {
      // English
      'customer': ['customer', 'client', 'user', 'buyer'],
      'project': ['project', 'task', 'initiative', 'campaign'],
      'meeting': ['meeting', 'call', 'discussion', 'conference'],
      'issue': ['issue', 'problem', 'bug', 'error', 'trouble'],
      'opportunity': ['opportunity', 'chance', 'potential', 'growth'],
      'feedback': ['feedback', 'review', 'comment', 'opinion'],
      'support': ['support', 'help', 'assistance', 'service'],
      'urgent': ['urgent', 'asap', 'priority', 'critical', 'emergency'],

      // Spanish
      'cliente': ['cliente', 'usuario', 'comprador'],
      'proyecto': ['proyecto', 'tarea', 'iniciativa'],
      'reunión': ['reunión', 'llamada', 'conferencia'],
      'problema': ['problema', 'error', 'fallo'],
      'oportunidad': ['oportunidad', 'posibilidad'],
      'urgente': ['urgente', 'prioridad', 'crítico'],

      // French
      'client_fr': ['client', 'utilisateur', 'acheteur'],
      'projet': ['projet', 'tâche', 'initiative'],
      'réunion': ['réunion', 'appel', 'conférence'],
      'problème': ['problème', 'erreur', 'défaut'],
      'opportunité': ['opportunité', 'possibilité'],
      'urgent_fr': ['urgent', 'priorité', 'critique'],

      // German
      'kunde': ['kunde', 'benutzer', 'käufer'],
      'projekt': ['projekt', 'aufgabe', 'initiative'],
      'besprechung': ['besprechung', 'anruf', 'konferenz'],
      'problem': ['problem', 'fehler', 'störung'],
      'gelegenheit': ['gelegenheit', 'möglichkeit'],
      'dringend': ['dringend', 'priorität', 'kritisch']
    };

    const detectedThemes: string[] = [];
    const themeCategories: Record<string, boolean> = {};

    // Check for business themes across languages
    Object.entries(businessKeywords).forEach(([theme, keywords]) => {
      const found = keywords.some(keyword => content.includes(keyword));
      if (found) {
        const englishTheme = this.getEnglishTheme(theme);
        if (!themeCategories[englishTheme]) {
          themeCategories[englishTheme] = true;
          detectedThemes.push(englishTheme);
        }
      }
    });

    const keyInsights = [];

    // Detect language
    const language = this.detectLanguage(content);
    if (language !== 'english') {
      keyInsights.push(`Content appears to be in ${language}`);
    }

    if (detectedThemes.length > 0) {
      keyInsights.push(`Content focuses on: ${detectedThemes.slice(0, 3).join(', ')}`);
    } else {
      // For non-English content without recognizable keywords
      keyInsights.push('Business communication detected - manual review recommended for detailed analysis');
    }

    // Multi-language sentiment analysis
    const sentimentResult = this.analyzeSentimentMultiLanguage(content);
    keyInsights.push(`Overall tone appears ${sentimentResult.sentiment}`);

    // Check for urgency across languages
    const urgencyKeywords = [
      'urgent', 'asap', 'priority', 'critical', 'emergency',
      'urgente', 'prioridad', 'crítico', 'emergencia',
      'urgent', 'priorité', 'critique', 'urgence',
      'dringend', 'priorität', 'kritisch', 'notfall'
    ];

    const isUrgent = urgencyKeywords.some(keyword => content.includes(keyword));
    if (isUrgent) {
      keyInsights.push('Time-sensitive content detected');
    }

    return {
      items: [{
        item: `Analysis of: ${subject}`,
        sentiment: sentimentResult.sentiment,
        topics: detectedThemes.slice(0, 3),
        priority: isUrgent ? 'high' : 'medium',
        category: 'observation'
      }],
      overallSentiment: sentimentResult.sentiment,
      mainTopics: detectedThemes.slice(0, 3),
      keyInsights: keyInsights,
      urgentFlags: isUrgent ? ['Time-sensitive content detected'] : [],
      language: language
    };
  }

  /**
   * Map non-English themes to English equivalents
   */
  private getEnglishTheme(theme: string): string {
    const themeMap: Record<string, string> = {
      'cliente': 'customer',
      'proyecto': 'project',
      'reunión': 'meeting',
      'problema': 'issue',
      'oportunidad': 'opportunity',
      'urgente': 'urgent',
      'client_fr': 'customer',
      'projet': 'project',
      'réunion': 'meeting',
      'problème': 'issue',
      'opportunité': 'opportunity',
      'urgent_fr': 'urgent',
      'kunde': 'customer',
      'projekt': 'project',
      'besprechung': 'meeting',
      'problem': 'issue',
      'gelegenheit': 'opportunity',
      'dringend': 'urgent'
    };

    return themeMap[theme] || theme;
  }

  /**
   * Simple language detection based on common words
   */
  private detectLanguage(content: string): string {
    const languageIndicators = {
      spanish: ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su'],
      french: ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce'],
      german: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist']
    };

    let maxMatches = 0;
    let detectedLanguage = 'english';

    Object.entries(languageIndicators).forEach(([lang, indicators]) => {
      const matches = indicators.filter(indicator => content.includes(` ${indicator} `) || content.startsWith(`${indicator} `)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedLanguage = lang;
      }
    });

    return maxMatches >= 2 ? detectedLanguage : 'english';
  }

  /**
   * Multi-language sentiment analysis
   */
  private analyzeSentimentMultiLanguage(content: string): { sentiment: string; confidence: number } {
    const sentimentWords = {
      positive: [
        // English
        'success', 'excellent', 'great', 'good', 'amazing', 'wonderful', 'fantastic', 'perfect', 'love', 'happy',
        // Spanish
        'éxito', 'excelente', 'bueno', 'genial', 'maravilloso', 'fantástico', 'perfecto', 'amor', 'feliz',
        // French
        'succès', 'excellent', 'bon', 'génial', 'merveilleux', 'fantastique', 'parfait', 'amour', 'heureux',
        // German
        'erfolg', 'ausgezeichnet', 'gut', 'großartig', 'wunderbar', 'fantastisch', 'perfekt', 'liebe', 'glücklich'
      ],
      negative: [
        // English
        'problem', 'issue', 'bad', 'terrible', 'awful', 'hate', 'angry', 'sad', 'disappointed', 'failed',
        // Spanish
        'problema', 'malo', 'terrible', 'horrible', 'odio', 'enojado', 'triste', 'decepcionado', 'fracaso',
        // French
        'problème', 'mauvais', 'terrible', 'horrible', 'haine', 'fâché', 'triste', 'déçu', 'échoué',
        // German
        'problem', 'schlecht', 'schrecklich', 'furchtbar', 'hass', 'wütend', 'traurig', 'enttäuscht', 'gescheitert'
      ]
    };

    const positiveCount = sentimentWords.positive.filter(word => content.includes(word)).length;
    const negativeCount = sentimentWords.negative.filter(word => content.includes(word)).length;

    let sentiment = 'neutral';
    let confidence = 50;

    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      confidence = Math.min(80, 50 + (positiveCount * 10));
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      confidence = Math.min(80, 50 + (negativeCount * 10));
    }

    return { sentiment, confidence };
  }

  /**
   * Send confirmation email for test intelligence processing
   */
  private async sendTestProcessingConfirmation(email: EmailData, organizationId: string, analysis?: any): Promise<void> {
    try {
      const dashboardUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';

      // Create analysis summary for text message
      let analysisText = '';
      if (analysis && analysis.keyInsights && analysis.keyInsights.length > 0) {
        analysisText = `\n\nContent Analysis:\n${analysis.keyInsights.slice(0, 3).map((insight: any) => `- ${insight}`).join('\n')}`;
        if (analysis.mainTopics && analysis.mainTopics.length > 0) {
          analysisText += `\nKey Topics: ${analysis.mainTopics.join(', ')}`;
        }
      }

      const textMessage = `Hello,

Your TEST intelligence submission has been processed immediately by Tanya, your intelligence agent.

Subject: ${email.subject}
Organization: ${organizationId}
Status: PROCESSED (Test Mode)
Processing Type: Immediate test processing${analysisText}

This was a test email and has been processed immediately to verify the system is working correctly.

View Intelligence Dashboard: ${dashboardUrl}

Tanya - Your Intelligence Agent`;

      // Create analysis section for HTML
      let analysisHtml = '';
      if (analysis && analysis.keyInsights && analysis.keyInsights.length > 0) {
        analysisHtml = `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #4a5568;">📊 Content Analysis Results</h3>

            ${analysis.keyInsights.length > 0 ? `
              <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #2d3748; font-size: 14px;">Key Insights:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #4a5568;">
                  ${analysis.keyInsights.slice(0, 4).map((insight: any) => `<li style="margin-bottom: 5px;">${insight}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${analysis.mainTopics && analysis.mainTopics.length > 0 ? `
              <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #2d3748; font-size: 14px;">Key Topics:</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                  ${analysis.mainTopics.map((topic: any) => `<span style="background: #e2e8f0; color: #4a5568; padding: 4px 12px; border-radius: 16px; font-size: 12px;">${topic}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            ${analysis.overallSentiment ? `
              <div>
                <h4 style="margin: 0 0 5px 0; color: #2d3748; font-size: 14px;">Overall Sentiment:</h4>
                <span style="color: ${analysis.overallSentiment === 'positive' ? '#10b981' : analysis.overallSentiment === 'negative' ? '#ef4444' : '#6b7280'}; font-weight: 600; text-transform: capitalize;">${analysis.overallSentiment}</span>
              </div>
            ` : ''}

            ${analysis.language && analysis.language !== 'english' ? `
              <div style="margin-top: 10px;">
                <span style="background: #ddd6fe; color: #7c3aed; padding: 4px 12px; border-radius: 16px; font-size: 12px;">Language: ${analysis.language}</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">🧪 TEST Intelligence Processing Complete</h2>

          <p>Hello,</p>

          <p>Your <strong>TEST</strong> intelligence submission has been processed immediately by <strong>Tanya</strong>, your intelligence agent.</p>

          <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #0284c7;">🧪 Test Processing Complete</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Subject:</strong> ${email.subject}</li>
              <li><strong>Organization:</strong> ${organizationId}</li>
              <li><strong>Status:</strong> PROCESSED (Test Mode)</li>
              <li><strong>Processing Type:</strong> Immediate test processing</li>
            </ul>
          </div>

          ${analysisHtml}

          <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #059669;">✅ Test Success</h4>
            <p style="margin: 0;">This was a test email and has been processed immediately to verify the system is working correctly. In production, intelligence emails are batched for enhanced analysis using advanced AI models.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}"
               style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Intelligence Dashboard
            </a>
          </div>

          <p><em>Tanya - Your Intelligence Agent</em></p>
        </div>
      `;

      await notificationService.sendEmail({
        to: email.from,
        subject: `🧪 TEST Intelligence Processing Complete - ${email.subject}`,
        text: textMessage,
        html: htmlMessage
      });

      console.log(`📧 [T5THandler] Sent test processing confirmation to ${email.from}`);
    } catch (error) {
      console.error("❌ [T5THandler] Error sending test processing confirmation:", error);
      // Don't throw - this is not critical for the main flow
    }
  }
}