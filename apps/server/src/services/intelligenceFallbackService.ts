import { t5tAnalysisService } from './t5tAnalysisService';
import { storage } from '../storage';
import { notificationService } from './agentNotificationService';

interface FallbackProcessingOptions {
  reason: string;
  originalError?: Error;
  retryCount: number;
  maxRetries: number;
  emailData: {
    id: string;
    subject: string;
    body: string;
    submitter: string;
    timestamp: Date;
    organizationId: string;
    processedEmailId: number;
  };
}

export class IntelligenceFallbackService {
  
  /**
   * Process individual email when batch processing fails
   */
  async processIndividualFallback(options: FallbackProcessingOptions): Promise<boolean> {
    console.log(`🔄 [Fallback] Starting individual processing for email ${options.emailData.id}`);
    console.log(`🔄 [Fallback] Reason: ${options.reason} (Retry ${options.retryCount}/${options.maxRetries})`);

    try {
      const { emailData } = options;

      // Use the original individual processing logic
      const analysis = await t5tAnalysisService.parseT5TSubmission(
        emailData.subject,
        emailData.body,
        emailData.submitter
      );

      console.log(`✅ [Fallback] Individual analysis completed for email ${emailData.id}:`);
      console.log(`   - ${analysis.items.length} items extracted`);
      console.log(`   - ${analysis.keyInsights.length} key insights`);
      console.log(`   - ${analysis.urgentFlags.length} urgent flags`);

      // Store the individual analysis result
      await this.storeFallbackResult(emailData, analysis, options);

      // Send individual confirmation email
      await this.sendFallbackConfirmation(emailData, analysis, options);

      // Update processed email status
      await storage.updateProcessedEmail(emailData.processedEmailId, {
        status: 'processed'
      });

      console.log(`✅ [Fallback] Successfully processed email ${emailData.id} individually`);
      return true;

    } catch (error) {
      console.error(`❌ [Fallback] Individual processing failed for email ${options.emailData.id}:`, error);
      
      if (options.retryCount < options.maxRetries) {
        // Schedule another retry
        console.log(`🔄 [Fallback] Scheduling retry ${options.retryCount + 1} for email ${options.emailData.id}`);
        
        setTimeout(() => {
          this.processIndividualFallback({
            ...options,
            retryCount: options.retryCount + 1,
            originalError: error instanceof Error ? error : new Error(String(error))
          });
        }, Math.pow(2, options.retryCount) * 1000); // Exponential backoff
        
        return false;
      }

      // Final failure - mark as failed
      await this.handleFinalFailure(options.emailData, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Store fallback processing result
   */
  private async storeFallbackResult(emailData: any, analysis: any, options: FallbackProcessingOptions): Promise<void> {
    try {
      // Create individual intelligence tokens for this analysis
      const tokens = analysis.items.map((item: any, index: number) => ({
        id: `fallback_${emailData.id}_${index}_${Date.now()}`,
        organizationId: emailData.organizationId,
        text: item.item,
        topics: item.topics || [],
        sentiment: item.sentiment,
        category: item.category,
        priority: item.priority,
        confidence: 85, // Slightly lower confidence for fallback processing
        submitters: [emailData.submitter],
        frequency: 1,
        relatedEmailIds: [emailData.id],
        createdAt: new Date(),
        isActive: true
      }));

      // Store tokens in database
      for (const token of tokens) {
        await storage.createIntelligenceToken(token);
      }

      console.log(`💾 [Fallback] Stored ${tokens.length} intelligence tokens for email ${emailData.id}`);

    } catch (error) {
      console.error(`❌ [Fallback] Error storing fallback result:`, error);
      // Don't throw - the main processing succeeded
    }
  }

  /**
   * Send fallback confirmation email
   */
  private async sendFallbackConfirmation(emailData: any, analysis: any, options: FallbackProcessingOptions): Promise<void> {
    try {
      const baseUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';
      const dashboardUrl = `${baseUrl}/intelligence/t5t?org=${encodeURIComponent(emailData.organizationId)}`;

      const textMessage = `Hello,

Your intelligence submission has been processed successfully by Tanya (individual processing mode).

Subject: ${emailData.subject}
Items Analyzed: ${analysis.items.length}
Key Insights: ${analysis.keyInsights.length}
Processing Mode: Individual Analysis (Fallback)

Note: Your submission was processed individually due to: ${options.reason}

Key Insights:
${analysis.keyInsights.slice(0, 3).map((insight: string) => `• ${insight}`).join('\n')}

${analysis.urgentFlags.length > 0 ? `\n🚨 Urgent Items:\n${analysis.urgentFlags.map((flag: string) => `• ${flag}`).join('\n')}` : ''}

View Dashboard: ${dashboardUrl}

Best regards,
Tanya - Your Intelligence Agent`;

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">🧠 Intelligence Analysis Complete</h2>
          
          <p>Hello,</p>
          
          <p>Your intelligence submission has been processed successfully by <strong>Tanya</strong> (individual processing mode).</p>
          
          <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #0284c7;">📊 Analysis Results</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Subject:</strong> ${emailData.subject}</li>
              <li><strong>Items Analyzed:</strong> ${analysis.items.length}</li>
              <li><strong>Key Insights:</strong> ${analysis.keyInsights.length}</li>
              <li><strong>Processing Mode:</strong> Individual Analysis (Fallback)</li>
            </ul>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #92400e;">ℹ️ Processing Note</h4>
            <p style="margin: 0;">Your submission was processed individually due to: <em>${options.reason}</em></p>
          </div>

          ${analysis.keyInsights.length > 0 ? `
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0;">💡 Key Insights</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${analysis.keyInsights.slice(0, 5).map((insight: string) => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          ${analysis.urgentFlags.length > 0 ? `
          <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #dc2626;">🚨 Urgent Items</h4>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${analysis.urgentFlags.map((flag: string) => `<li>${flag}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
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
        to: emailData.submitter,
        subject: `📊 Intelligence Analysis Complete (Individual Processing)`,
        text: textMessage,
        html: htmlMessage
      });

      console.log(`📧 [Fallback] Sent individual processing confirmation to ${emailData.submitter}`);
    } catch (error) {
      console.error("❌ [Fallback] Error sending fallback confirmation:", error);
    }
  }

  /**
   * Handle final processing failure
   */
  private async handleFinalFailure(emailData: any, error: Error): Promise<void> {
    try {
      console.error(`💀 [Fallback] Final failure for email ${emailData.id}:`, error);

      // Update processed email status
      await storage.updateProcessedEmail(emailData.processedEmailId, {
        status: 'failed',
        processingError: error.message
      });

      // Send failure notification email
      await this.sendFailureNotification(emailData, error);

    } catch (notificationError) {
      console.error(`❌ [Fallback] Error handling final failure:`, notificationError);
    }
  }

  /**
   * Send failure notification to user
   */
  private async sendFailureNotification(emailData: any, error: Error): Promise<void> {
    try {
      const textMessage = `Hello,

We encountered an issue processing your intelligence submission to Tanya.

Subject: ${emailData.subject}
Error: Processing failed after multiple retry attempts

Our team has been notified and will investigate the issue. You can try resubmitting your intelligence data, or contact support if the problem persists.

We apologize for the inconvenience.

Best regards,
Tanya - Your Intelligence Agent`;

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">⚠️ Intelligence Processing Failed</h2>
          
          <p>Hello,</p>
          
          <p>We encountered an issue processing your intelligence submission to <strong>Tanya</strong>.</p>
          
          <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #dc2626;">📧 Submission Details</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Subject:</strong> ${emailData.subject}</li>
              <li><strong>Submitted:</strong> ${emailData.timestamp.toISOString()}</li>
              <li><strong>Status:</strong> Processing failed after multiple attempts</li>
            </ul>
          </div>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0;">🛠️ Next Steps</h3>
            <p style="margin: 5px 0;">• Our team has been notified and will investigate the issue</p>
            <p style="margin: 5px 0;">• You can try resubmitting your intelligence data</p>
            <p style="margin: 5px 0;">• Contact support if the problem persists</p>
          </div>
          
          <p>We apologize for the inconvenience and appreciate your patience.</p>
          
          <p><em>Tanya - Your Intelligence Agent</em></p>
        </div>
      `;

      await notificationService.sendEmail({
        to: emailData.submitter,
        subject: `⚠️ Intelligence Processing Failed - ${emailData.subject}`,
        text: textMessage,
        html: htmlMessage
      });

      console.log(`📧 [Fallback] Sent failure notification to ${emailData.submitter}`);
    } catch (error) {
      console.error("❌ [Fallback] Error sending failure notification:", error);
    }
  }

  /**
   * Check if individual processing should be used instead of batch
   */
  static shouldUseFallback(emailData: any): { useFallback: boolean; reason?: string } {
    // Check for high priority emails that need immediate processing
    if (emailData.priority === 'high') {
      return { useFallback: true, reason: 'High priority email requires immediate processing' };
    }

    // Check for very long emails that might exceed token limits
    const emailLength = emailData.subject.length + emailData.body.length;
    if (emailLength > 50000) { // Very long email
      return { useFallback: true, reason: 'Email too long for efficient batch processing' };
    }

    // Check for urgent keywords
    const urgentKeywords = ['emergency', 'critical', 'urgent', 'immediate', 'asap'];
    const hasUrgentKeywords = urgentKeywords.some(keyword => 
      emailData.subject.toLowerCase().includes(keyword) || 
      emailData.body.toLowerCase().includes(keyword)
    );

    if (hasUrgentKeywords) {
      return { useFallback: true, reason: 'Urgent content detected, requires immediate processing' };
    }

    return { useFallback: false };
  }
}

export const intelligenceFallbackService = new IntelligenceFallbackService();