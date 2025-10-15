import { EmailData } from './email/types';
import { emailRouter } from './email/EmailRouter';
import { t5tAnalysisService } from './t5tAnalysisService';
import { storage } from '../storage';
import { getOrCreateUserByEmail } from './userService';

export class IntelligenceEmailProcessor {
  /**
   * Process incoming intelligence emails (T5T submissions)
   */
  async processIntelligenceSubmission(email: EmailData, source: string = 'email'): Promise<void> {
    try {
      console.log(`🧠 [INTEL] Processing intelligence submission from ${email.from}`);
      console.log(`🧠 [INTEL] Subject: "${email.subject}"`);
      console.log(`🧠 [INTEL] Source: ${source}`);
      
      // Determine which agent this submission is for
      const companyId = emailRouter.getCompanyIdFromEmailData(email);
      
      let targetAgent;
      
      if (companyId) {
        // Company-specific intelligence
        console.log(`🏢 [INTEL] Company-specific submission for: ${companyId}`);
        
        // Find the company intelligence agent
        const { findAgentByEmail } = await import('./companyIntelligence');
        const allRecipients = [...email.to, ...email.cc, ...email.bcc];
        
        for (const recipient of allRecipients) {
          if (emailRouter.isCompanyIntelligenceEmail(recipient)) {
            targetAgent = await findAgentByEmail(recipient);
            if (targetAgent) {
              console.log(`🎯 [INTEL] Found company agent: ${targetAgent.name} (ID: ${targetAgent.id})`);
              break;
            }
          }
        }
        
        if (!targetAgent) {
          console.error(`❌ [INTEL] No company intelligence agent found for ${companyId}`);
          return;
        }
      } else {
        // Global intelligence agent (fallback to ID 1 for backward compatibility)
        console.log(`🌐 [INTEL] Using global intelligence agent`);
        targetAgent = { id: 1, name: 'Global Intelligence Agent' };
      }
      
      // Check if this submission was already processed
      const existingSubmission = await storage.getT5tSubmissionByMessageId(email.messageId);
      if (existingSubmission) {
        console.log(`⚠️ [INTEL] Submission already processed: ${email.messageId}`);
        return;
      }
      
      // Get or create user for submitter
      const submitterUser = await getOrCreateUserByEmail(email.from);
      if (!submitterUser) {
        console.error(`❌ [INTEL] Failed to get/create user for ${email.from}`);
        return;
      }
      
      // Parse the T5T submission using AI
      console.log(`🤖 [INTEL] Analyzing T5T submission with AI...`);
      const analysis = await t5tAnalysisService.parseT5TSubmission(
        email.subject,
        email.body,
        email.from
      );
      
      console.log(`📊 [INTEL] Analysis complete:`, {
        itemsCount: analysis.items.length,
        sentiment: analysis.overallSentiment,
        sentimentScore: analysis.sentimentScore,
        mainTopics: analysis.mainTopics,
        urgentFlags: analysis.urgentFlags.length
      });
      
      // Calculate week/month/year for trend analysis
      const submissionDate = email.date || new Date();
      const weekNumber = this.getWeekNumber(submissionDate);
      const monthNumber = submissionDate.getMonth() + 1;
      const yearNumber = submissionDate.getFullYear();
      
      // Create T5T submission record
      const submission = await storage.createT5tSubmission({
        pollingAgentId: targetAgent.id,
        submitterUserId: submitterUser.id,
        submitterEmail: email.from,
        messageId: email.messageId,
        subject: email.subject,
        rawContent: email.body,
        parsedItems: {
          items: analysis.items,
          keyInsights: analysis.keyInsights,
          urgentFlags: analysis.urgentFlags
        },
        sentiment: analysis.overallSentiment,
        sentimentScore: analysis.sentimentScore,
        topics: analysis.mainTopics,
        priority: this.determinePriority(analysis),
        weekNumber,
        monthNumber,
        yearNumber,
        submissionDate,
        processedAt: new Date(),
        processingStatus: 'processed'
      });
      
      console.log(`✅ [INTEL] T5T submission created: ID ${submission.id}`);
      
      // If there are urgent flags, generate immediate insights
      if (analysis.urgentFlags.length > 0) {
        console.log(`🚨 [INTEL] Urgent flags detected, generating immediate insights...`);
        await this.generateUrgentInsights(targetAgent.id, submission, analysis.urgentFlags);
      }
      
      // Check if we should trigger aggregate analysis
      await this.checkAndTriggerAggregateAnalysis(targetAgent.id);
      
      console.log(`✅ [INTEL] Intelligence submission processing complete`);
      
    } catch (error) {
      console.error('❌ [INTEL] Error processing intelligence submission:', error);
      throw error;
    }
  }
  
  /**
   * Calculate week number of the year
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
  
  /**
   * Determine priority based on analysis
   */
  private determinePriority(analysis: any): 'low' | 'medium' | 'high' {
    if (analysis.urgentFlags && analysis.urgentFlags.length > 0) {
      return 'high';
    }
    
    if (analysis.sentimentScore < -30) {
      return 'high';
    }
    
    if (analysis.sentimentScore < -10 || analysis.items.some((item: any) => item.priority === 'high')) {
      return 'medium';
    }
    
    return 'low';
  }
  
  /**
   * Generate immediate insights for urgent submissions
   */
  private async generateUrgentInsights(agentId: number, submission: any, urgentFlags: string[]): Promise<void> {
    try {
      for (const flag of urgentFlags) {
        await storage.createPollingInsight({
          pollingAgentId: agentId,
          insightType: 'urgent_alert',
          title: 'Urgent Issue Detected',
          description: flag,
          data: {
            submissionId: submission.id,
            submitterEmail: submission.submitterEmail,
            detectedAt: new Date().toISOString(),
            source: 'automated_analysis'
          },
          scope: 'immediate',
          period: `${new Date().getFullYear()}-W${this.getWeekNumber(new Date())}`,
          confidence: 90,
          priority: 'high',
          isAlert: true
        });
      }
      
      console.log(`🚨 [INTEL] Generated ${urgentFlags.length} urgent insights`);
    } catch (error) {
      console.error('❌ [INTEL] Error generating urgent insights:', error);
    }
  }
  
  /**
   * Check if we should trigger aggregate analysis based on submission count
   */
  private async checkAndTriggerAggregateAnalysis(agentId: number): Promise<void> {
    try {
      const currentPeriod = `${new Date().getFullYear()}-W${this.getWeekNumber(new Date())}`;
      
      // Get recent submissions count
      const recentSubmissions = await storage.getT5tSubmissions(agentId, {
        period: currentPeriod,
        limit: 100
      });
      
      // Trigger analysis if we have enough submissions (e.g., every 5 new submissions)
      if (recentSubmissions.length > 0 && recentSubmissions.length % 5 === 0) {
        console.log(`📊 [INTEL] Triggering aggregate analysis (${recentSubmissions.length} submissions)`);
        
        const insightTypes = ['trending_topics', 'sentiment_trend', 'emerging_signals'];
        
        for (const insightType of insightTypes) {
          const insights = await t5tAnalysisService.generateAggregateInsights(
            recentSubmissions.map(s => ({
              id: s.id,
              submitterEmail: s.submitterEmail,
              rawContent: s.rawContent,
              parsedItems: s.parsedItems,
              sentiment: s.sentiment || 'neutral',
              topics: Array.isArray(s.topics) ? s.topics : [],
              submissionDate: s.submissionDate,
              departmentName: undefined,
              teamName: undefined
            })),
            insightType,
            currentPeriod
          );
          
          // Save insights to database
          for (const insight of insights) {
            await storage.createPollingInsight({
              pollingAgentId: agentId,
              insightType: insight.type,
              title: insight.title,
              description: insight.description,
              data: insight.data,
              scope: 'weekly',
              period: currentPeriod,
              confidence: insight.confidence,
              priority: insight.priority,
              isAlert: insight.isAlert
            });
          }
        }
        
        console.log(`📈 [INTEL] Generated insights for ${insightTypes.length} types`);
      }
    } catch (error) {
      console.error('❌ [INTEL] Error checking/triggering aggregate analysis:', error);
    }
  }
}

export const intelligenceEmailProcessor = new IntelligenceEmailProcessor();
