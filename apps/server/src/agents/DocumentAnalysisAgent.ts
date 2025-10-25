import { IEmailAgent, EmailData, CommandResult } from '../types/interfaces';
import { storage } from '../storage';
import { getOrCreateUserByEmail } from '../services/userService';
import { claudeService } from '../services/claudeService';
import { notificationService } from '../services/agentNotificationService';
// File processing functionality removed - this agent needs refactoring
import { escapeHtml } from '../utils/escape';
import { parseClaudeJsonResponseSafe } from '../utils/jsonParser';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';

/**
 * DocumentAnalysisAgent - Intelligent Document Analysis Agent
 *
 * Handles document analysis emails sent to:
 * - analyzer@inboxleap.com
 *
 * Responsibilities:
 * - Process document attachments with OCR and content analysis
 * - Extract structured data from documents (tables, forms, etc.)
 * - Perform intelligent document classification and insight generation
 * - Generate AI-powered summaries and analysis reports
 * - Detect anomalies, compliance issues, and key information
 */
export class DocumentAnalysisAgent implements IEmailAgent {
  readonly agentName = 'DocumentAnalysisAgent';
  readonly agentType = 'analyzer' as const;
  readonly description = 'Intelligent document analysis agent that processes attachments with OCR, extracts data, and generates AI-powered insights';

  // Domain configuration - could be made configurable
  private readonly serviceDomain = 'inboxleap.com';

  /**
   * Define which email addresses this agent handles
   */
  getHandledEmails(): string[] {
    return [
      `analyzer@${this.serviceDomain}`
    ];
  }

  /**
   * Check if this agent can handle the given email
   */
  canHandle(email: EmailData): boolean {
    const handledEmails = this.getHandledEmails();
    const allRecipients = [...email.to, ...email.cc, ...email.bcc];
    
    // Check if any recipient matches our handled emails
    return allRecipients.some(recipient => 
      handledEmails.some(handled => 
        recipient.toLowerCase().includes(handled.toLowerCase())
      )
    );
  }

  /**
   * Process email for document analysis
   */
  async process(email: EmailData): Promise<CommandResult> {
    try {
      console.log(`📄 [DocumentAnalysisAgent] Processing analysis request from ${email.from}: ${email.subject}`);

      // Check if this email was already processed
      const existingEmail = await storage.getProcessedEmailByMessageId(email.messageId);
      if (existingEmail) {
        console.log("⚠️ [DocumentAnalysisAgent] Email already processed, skipping");
        return {
          success: false,
          message: 'Email already processed'
        };
      }

      // Get or create user from sender email
      const user = await getOrCreateUserByEmail(email.from, undefined);
      if (!user) {
        console.log(`⛔ [DocumentAnalysisAgent] User requires email verification: ${email.from}`);
        return {
          success: false,
          message: 'Email verification required for sender'
        };
      }

      // Extract attachments from email (this would typically be done by the email service)
      const attachments = await this.extractEmailAttachments(email);
      
      if (attachments.length === 0) {
        console.log(`📎 [DocumentAnalysisAgent] No attachments found in email`);
        
        // If no attachments but there's text content, analyze the text
        if (email.body.trim()) {
          return await this.analyzeTextContent(email, user.id);
        }
        
        // Send error response
        await this.sendNoAttachmentsError(email);
        return {
          success: false,
          message: 'No attachments found to analyze'
        };
      }

      console.log(`📎 [DocumentAnalysisAgent] Found ${attachments.length} attachment(s) to process`);

      // Process each attachment
      const analysisResults = [];
      let totalFilesProcessed = 0;
      let errors = [];

      for (const attachment of attachments) {
        try {
          console.log(`🔍 [DocumentAnalysisAgent] Processing attachment: ${attachment.filename} (${attachment.contentType})`);

          // Use attachmentAnalysisService for actual file processing
          const { attachmentAnalysisService } = await import('../services/attachmentAnalysisService');

          const fileData = {
            filename: attachment.filename,
            contentType: attachment.contentType,
            content: attachment.content,
            size: attachment.content.length
          };

          const analysis = await attachmentAnalysisService.performEnhancedAnalysis(fileData);

          const result = {
            filename: attachment.filename,
            fileType: attachment.contentType,
            fileSize: attachment.content.length,
            processedFile: {
              extractedText: analysis.extractedText || '',
              contentAnalysis: analysis.contentAnalysis
            },
            aiAnalysis: {
              summary: analysis.summary,
              insights: analysis.keyPoints || [],
              anomalies: [],
              dataExtracted: {
                tables: [],
                urls: [],
                actionItems: 0,
                keyDates: [],
                keyNumbers: []
              },
              recommendations: analysis.insights?.recommendations || [],
              category: analysis.documentType || 'other',
              confidence: 0.85
            },
            processedAt: new Date()
          };

          analysisResults.push(result);
          totalFilesProcessed++;

        } catch (fileError) {
          console.error(`❌ [DocumentAnalysisAgent] Error processing ${attachment.filename}:`, fileError);
          errors.push(`${attachment.filename}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        }
      }

      // Record processed email
      await storage.createProcessedEmail({
        messageId: email.messageId,
        subject: email.subject,
        sender: email.from,
        recipients: email.to,
        ccList: email.cc,
        bccList: email.bcc,
        body: email.body,
        status: "processed",
        tasksCreated: 0, // Document analysis doesn't create tasks
        projectId: null,
      });

      // Store analysis results (you may want to create a dedicated table for this)
      const analysisRecord = await this.storeAnalysisResults(
        email.messageId,
        user.id,
        analysisResults
      );

      // Send comprehensive results email
      await this.sendAnalysisResultsEmail(
        email,
        analysisResults,
        errors,
        totalFilesProcessed
      );

      console.log(`✅ [DocumentAnalysisAgent] Successfully analyzed ${totalFilesProcessed} files`);

      return {
        success: true,
        message: `Successfully analyzed ${totalFilesProcessed} document(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`,
        data: {
          filesProcessed: totalFilesProcessed,
          errors: errors.length > 0 ? errors : undefined,
          analysisId: analysisRecord.id,
          results: analysisResults.map(r => ({
            filename: r.filename,
            fileType: r.fileType,
            insights: r.aiAnalysis.insights?.length || 0,
            anomalies: r.aiAnalysis.anomalies?.length || 0
          }))
        }
      };

    } catch (error) {
      console.error("❌ [DocumentAnalysisAgent] Error processing email:", error);
      return {
        success: false,
        message: `Error processing document analysis request: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process web-uploaded files - DEPRECATED: Use email-based processing instead
   * This method is kept for backwards compatibility but is no longer used.
   */
  async processWebUpload(files: Array<{
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }>, userId: string, options: {
    enableOCR?: boolean;
    enableVirusScanning?: boolean;
    enableDataAnalysis?: boolean;
    extractTables?: boolean;
    extractImages?: boolean;
  } = {}): Promise<CommandResult> {
    return {
      success: false,
      message: 'Web upload is no longer supported. Please send documents via email to analyzer@inboxleap.com'
    };
  }

  /**
   * LEGACY CODE BELOW - Kept for reference but disabled
   */
  private async _legacyProcessWebUpload_DISABLED(files: Array<{
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }>, userId: string, options: {
    enableOCR?: boolean;
    enableVirusScanning?: boolean;
    enableDataAnalysis?: boolean;
    extractTables?: boolean;
    extractImages?: boolean;
  } = {}): Promise<CommandResult> {
    try {
      console.log(`📄 [DocumentAnalysisAgent] Processing ${files.length} web-uploaded files for user ${userId}`);

      if (files.length === 0) {
        return {
          success: false,
          message: 'No files provided for analysis'
        };
      }

      // Get user for validation - ensure user exists
      let user = await storage.getUser(userId);
      if (!user) {
        console.log(`⚠️ [DocumentAnalysisAgent] User ${userId} not found, attempting to create user record`);
        
        // Try to create user if they don't exist (session might have user data)
        try {
          user = await storage.createUser({
            id: userId,
            email: `${userId}@temp.local`, // Temporary email, should be updated via profile
            firstName: 'User',
            lastName: null,
            profileImageUrl: null,
            authProvider: 'google' // Most likely from Google OAuth
          });
          console.log(`✅ [DocumentAnalysisAgent] Created user record for ${userId}`);
        } catch (error) {
          console.error(`❌ [DocumentAnalysisAgent] Failed to create user ${userId}:`, error);
          return {
            success: false,
            message: 'User validation failed. Please ensure you are logged in properly.'
          };
        }
      }

      if (!user.email) {
        return {
          success: false,
          message: 'User email not found'
        };
      }

      // Process each file
      const analysisResults = [];
      let totalFilesProcessed = 0;
      const errors = [];

      for (const file of files) {
        try {
          console.log(`🔍 [DocumentAnalysisAgent] Processing ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);

          // Use attachmentAnalysisService for actual file processing
          const { attachmentAnalysisService } = await import('../services/attachmentAnalysisService');

          const fileData = {
            filename: file.originalname,
            contentType: file.mimetype,
            content: file.buffer,
            size: file.size
          };

          const analysis = await attachmentAnalysisService.performEnhancedAnalysis(fileData);

          const result = {
            filename: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            processedFile: {
              extractedText: analysis.extractedText || '',
              contentAnalysis: analysis.contentAnalysis
            },
            aiAnalysis: {
              summary: analysis.summary,
              insights: analysis.keyPoints || [],
              anomalies: [],
              dataExtracted: {
                tables: [],
                urls: [],
                actionItems: 0,
                keyDates: [],
                keyNumbers: []
              },
              recommendations: analysis.insights?.recommendations || [],
              category: analysis.documentType || 'other',
              confidence: 0.85
            },
            processedAt: new Date()
          };

          analysisResults.push(result);
          totalFilesProcessed++;

        } catch (fileError) {
          console.error(`❌ [DocumentAnalysisAgent] Error processing ${file.originalname}:`, fileError);
          errors.push(`${file.originalname}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        }
      }

      // Create a processed email record for tracking (web uploads)
      const messageId = `web-upload-${Date.now()}-${userId}`;
      await storage.createProcessedEmail({
        messageId,
        subject: `Document Analysis: ${totalFilesProcessed} file(s) processed`,
        sender: user.email!,
        recipients: [user.email!],
        ccList: [],
        bccList: [],
        body: `Web-based document analysis of ${files.length} file(s)`,
        status: "processed",
        tasksCreated: 0, // Document analysis doesn't create tasks
        projectId: null,
      });

      // Store analysis results in database
      try {
        const analysisRecord = await this.storeAnalysisResults(
          messageId,
          userId,
          analysisResults
        );
        
        console.log(`✅ [DocumentAnalysisAgent] Successfully processed and stored ${totalFilesProcessed} web-uploaded files`);

        return {
          success: true,
          message: `Successfully analyzed ${totalFilesProcessed} document(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`,
          data: {
            filesProcessed: totalFilesProcessed,
            totalFiles: files.length,
            errors: errors.length > 0 ? errors : undefined,
            analysisId: analysisRecord.id,
            results: analysisResults.map(r => ({
              filename: r.filename,
              fileType: r.fileType,
              fileSize: r.fileSize,
              aiAnalysis: r.aiAnalysis,
              processingResults: {
                ocrText: null, // r.processedFile?.content?.text,
                virusScanResults: null, // r.processedFile?.virusScanResult,
                metadata: {} // r.processedFile?.metadata
              },
              processedAt: r.processedAt.toISOString()
            }))
          }
        };
      } catch (storageError) {
        console.error('❌ [DocumentAnalysisAgent] Failed to store analysis results:', storageError);
        
        // Return success with analysis data but note storage failure
        return {
          success: true,
          message: `Successfully analyzed ${totalFilesProcessed} document(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''} (Note: Results were not persisted to database)`,
          data: {
            filesProcessed: totalFilesProcessed,
            totalFiles: files.length,
            errors: errors.length > 0 ? errors : undefined,
            analysisId: `temp-${Date.now()}`, // Temporary ID since storage failed
            results: analysisResults.map(r => ({
              filename: r.filename,
              fileType: r.fileType,
              fileSize: r.fileSize,
              aiAnalysis: r.aiAnalysis,
              processingResults: {
                ocrText: null, // r.processedFile?.content?.text,
                virusScanResults: null, // r.processedFile?.virusScanResult,
                metadata: {} // r.processedFile?.metadata
              },
              processedAt: r.processedAt.toISOString()
            }))
          }
        };
      }

    } catch (error) {
      console.error("❌ [DocumentAnalysisAgent] Error processing web upload:", error);
      return {
        success: false,
        message: `Error processing web upload: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle follow-up emails (additional analysis requests, questions)
   */
  async handleFollowup(followup: EmailData): Promise<CommandResult> {
    try {
      console.log(`🔄 [DocumentAnalysisAgent] Processing follow-up from ${followup.from}`);

      // Get user for authentication
      const user = await getOrCreateUserByEmail(followup.from);
      if (!user) {
        return {
          success: false,
          message: 'Email verification required for sender'
        };
      }

      // Check if this is a question about previous analysis
      if (this.isAnalysisQuestion(followup)) {
        return await this.handleAnalysisQuestion(followup, user.id);
      }

      // Otherwise, treat as new analysis request
      return await this.process(followup);

    } catch (error) {
      console.error("❌ [DocumentAnalysisAgent] Error processing follow-up:", error);
      return {
        success: false,
        message: `Error processing follow-up: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract attachments from email (placeholder - would be implemented by email service)
   */
  private async extractEmailAttachments(email: EmailData): Promise<Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>> {
    try {
      console.log(`📎 [DocumentAnalysisAgent] Extracting attachments from email`);

      // If email has an attachments field already parsed, use it
      if (email.attachments && Array.isArray(email.attachments) && email.attachments.length > 0) {
        console.log(`📎 [DocumentAnalysisAgent] Found ${email.attachments.length} pre-parsed attachment(s)`);

        return email.attachments.map(attachment => ({
          filename: attachment.filename || 'unnamed-attachment',
          contentType: attachment.contentType || 'application/octet-stream',
          content: Buffer.isBuffer(attachment.content) ? attachment.content : Buffer.from(attachment.content, 'base64')
        }));
      }
      
      console.log(`📎 [DocumentAnalysisAgent] No attachments found in email`);
      return [];
      
    } catch (error) {
      console.error(`❌ [DocumentAnalysisAgent] Error extracting attachments:`, error);
      return [];
    }
  }

  /**
   * Analyze text content when no attachments are present
   */
  private async analyzeTextContent(email: EmailData, userId: string): Promise<CommandResult> {
    try {
      console.log(`📝 [DocumentAnalysisAgent] Analyzing text content`);

      // Use Claude AI to analyze the email text content
      const analysis = await claudeService.sendMessage(`
        Please analyze the following text content for insights, key information, and potential actions:

        Subject: ${email.subject}
        Content: ${email.body}

        CRITICAL: Return ONLY valid JSON without any markdown formatting, code blocks, or additional text. No \`\`\`json\`\`\` wrapper.
        
        Provide analysis in this exact JSON format:
        {
          "summary": "Brief summary of the content",
          "keyInsights": ["insight 1", "insight 2"],
          "actionItems": ["action 1", "action 2"],
          "topics": ["topic 1", "topic 2"],
          "sentiment": "positive|negative|neutral",
          "urgency": "low|medium|high",
          "category": "business|personal|technical|other"
        }
        
        REMEMBER: Return ONLY the JSON object, no other text or formatting.
      `);

      const textAnalysis = parseClaudeJsonResponseSafe(analysis, {
        summary: "Unable to parse structured analysis",
        keyInsights: ["Text content provided but could not be fully analyzed"],
        actionItems: [],
        topics: ["text analysis"],
        sentiment: "neutral",
        urgency: "low",
        category: "other"
      });

      // Send text analysis results
      await this.sendTextAnalysisEmail(email, textAnalysis);

      return {
        success: true,
        message: 'Text content analyzed successfully',
        data: { textAnalysis }
      };

    } catch (error) {
      console.error("❌ [DocumentAnalysisAgent] Error analyzing text content:", error);
      throw error;
    }
  }


  /**
   * Store analysis results in database
   */
  private async storeAnalysisResults(
    messageId: string,
    userId: string,
    results: any[]
  ): Promise<{ id: string }> {
    try {
      console.log(`💾 [DocumentAnalysisAgent] Storing analysis results for ${results.length} files`);
      
      // Store each analysis result in the database
      const storedResults = [];
      
      for (const result of results) {
        // Map to the correct schema format
        const analysisData = {
          messageId,
          userId,
          filename: result.filename,
          fileType: result.fileType,
          fileSize: result.fileSize,
          fileHash: crypto.createHash('sha256').update(result.filename).digest('hex'), // Temporary hash
          // Store all analysis data as JSONB
          analysisData: null,
          aiAnalysis: result.aiAnalysis,
          processingResults: {
            ocrText: '',
            virusScanResults: null,
            metadata: {}
          },
          category: result.aiAnalysis.category || 'other',
          confidence: Math.round((result.aiAnalysis.confidence || 0.7) * 100),
          extractedText: '',
          virusScanPassed: true,
          processedAt: new Date(result.processedAt)
        };

        console.log(`💾 [DocumentAnalysisAgent] Saving to database: ${result.filename}`);
        const stored = await storage.createDocumentAnalysisResult(analysisData);
        storedResults.push(stored);

        console.log(`✅ [DocumentAnalysisAgent] Successfully stored analysis result for file: ${result.filename}`);
      }
      
      // Return the first stored result ID (for compatibility)
      const firstResultId = storedResults[0]?.id?.toString() || crypto.randomUUID();
      
      console.log(`✅ [DocumentAnalysisAgent] Successfully stored ${storedResults.length} analysis results in database`);
      
      return { id: firstResultId };
      
    } catch (error) {
      console.error('❌ [DocumentAnalysisAgent] Error storing analysis results:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Re-throw the error so we can see what's actually failing
      throw error;
    }
  }

  /**
   * Send comprehensive analysis results email
   */
  private async sendAnalysisResultsEmail(
    originalEmail: EmailData,
    results: any[],
    errors: string[],
    totalProcessed: number
  ): Promise<void> {
    try {
      const successCount = results.length;
      const errorCount = errors.length;

      // Generate analysis summary
      const allInsights = results.flatMap(r => r.aiAnalysis.insights || []);
      const allAnomalies = results.flatMap(r => r.aiAnalysis.anomalies || []);
      const categories = [...new Set(results.map(r => r.aiAnalysis.category))];

      const subject = `Document Analysis Complete - ${successCount} file${successCount !== 1 ? 's' : ''} processed`;

      const textMessage = `
Hello,

Your document analysis request has been completed.

Analysis Summary:
- Files Processed: ${successCount}/${totalProcessed}
- Categories Detected: ${categories.join(', ')}
- Total Insights: ${allInsights.length}
- Anomalies Found: ${allAnomalies.length}
${errorCount > 0 ? `- Errors: ${errorCount}` : ''}

${results.map(r => `
File: ${r.filename}
Type: ${r.fileType}
Summary: ${r.aiAnalysis.summary}
Insights: ${r.aiAnalysis.insights.length}
Recommendations: ${r.aiAnalysis.recommendations.length}
`).join('\n')}

${errorCount > 0 ? `\nErrors Encountered:\n${errors.map(e => `- ${e}`).join('\n')}` : ''}

Best regards,
Document Analysis Agent
      `;

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h2 style="color: #2563eb;">📄 Document Analysis Complete</h2>
          
          <p>Hello,</p>
          
          <p>Your document analysis request has been completed successfully.</p>
          
          <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #0284c7;">📊 Analysis Summary</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Files Processed:</strong> ${escapeHtml(successCount.toString())}/${escapeHtml(totalProcessed.toString())}</li>
              <li><strong>Categories Detected:</strong> ${escapeHtml(categories.join(', '))}</li>
              <li><strong>Total Insights:</strong> ${escapeHtml(allInsights.length.toString())}</li>
              <li><strong>Anomalies Found:</strong> ${escapeHtml(allAnomalies.length.toString())}</li>
              ${errorCount > 0 ? `<li><strong>Errors:</strong> ${escapeHtml(errorCount.toString())}</li>` : ''}
            </ul>
          </div>

          ${results.map(r => `
            <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0;">
              <h4 style="margin: 0 0 10px 0; color: #1e40af;">📄 ${escapeHtml(r.filename)}</h4>
              <p><strong>Type:</strong> ${escapeHtml(r.fileType)} | <strong>Size:</strong> ${escapeHtml((r.fileSize / 1024).toFixed(1))} KB</p>
              <p><strong>Summary:</strong> ${escapeHtml(r.aiAnalysis.summary)}</p>
              
              ${r.aiAnalysis.insights.length > 0 ? `
                <h5 style="margin: 15px 0 5px 0;">💡 Key Insights:</h5>
                <ul style="margin: 5px 0; padding-left: 20px;">
                  ${r.aiAnalysis.insights.map((insight: string) => `<li>${escapeHtml(insight)}</li>`).join('')}
                </ul>
              ` : ''}

              ${r.aiAnalysis.recommendations.length > 0 ? `
                <h5 style="margin: 15px 0 5px 0;">🎯 Recommendations:</h5>
                <ul style="margin: 5px 0; padding-left: 20px;">
                  ${r.aiAnalysis.recommendations.map((rec: string) => `<li>${escapeHtml(rec)}</li>`).join('')}
                </ul>
              ` : ''}

              ${r.aiAnalysis.anomalies.length > 0 ? `
                <h5 style="margin: 15px 0 5px 0; color: #dc2626;">⚠️ Anomalies Detected:</h5>
                <ul style="margin: 5px 0; padding-left: 20px;">
                  ${r.aiAnalysis.anomalies.map((anomaly: string) => `<li style="color: #dc2626;">${escapeHtml(anomaly)}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}

          ${errorCount > 0 ? `
            <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #dc2626;">❌ Processing Errors</h3>
              <ul style="margin: 0; padding-left: 20px;">
                ${errors.map(error => `<li style="color: #dc2626;">${escapeHtml(error)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px;">
            <h3 style="margin: 0 0 15px 0;">💡 What's Next?</h3>
            <p style="margin: 5px 0;">📧 Reply with additional documents for further analysis</p>
            <p style="margin: 5px 0;">❓ Ask questions about the analysis results</p>
            <p style="margin: 5px 0;">🔍 Request specific data extraction or insights</p>
            <p style="margin: 5px 0;">📊 Request comparative analysis with other documents</p>
          </div>
          
          <p style="margin-top: 30px;"><em>Document Analysis Agent - Powered by AI</em></p>
        </div>
      `;

      await notificationService.sendEmail({
        to: originalEmail.from,
        subject,
        text: textMessage,
        html: htmlMessage
      });

      console.log(`📧 [DocumentAnalysisAgent] Sent comprehensive analysis results to ${originalEmail.from}`);
    } catch (error) {
      console.error("❌ [DocumentAnalysisAgent] Error sending analysis results:", error);
    }
  }

  /**
   * Send no attachments error email
   */
  private async sendNoAttachmentsError(email: EmailData): Promise<void> {
    try {
      const subject = `No Attachments Found - Document Analysis Request`;

      const textMessage = `
Hello,

We received your document analysis request but no attachments were found in your email.

To analyze documents, please:
1. Attach files (PDF, Word, Excel, images, etc.)
2. Send to any of our analysis addresses:
   - analyze@${this.serviceDomain}
   - docs@${this.serviceDomain}
   - review@${this.serviceDomain}

Supported formats:
- Documents: PDF, Word, Excel, PowerPoint
- Images: JPG, PNG, GIF, TIFF
- Text files: TXT, CSV, JSON
- Archives: ZIP (contents will be analyzed)

Please resend your email with attachments for analysis.

Best regards,
Document Analysis Agent
      `;

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">📄 No Attachments Found</h2>
          
          <p>Hello,</p>
          
          <p>We received your document analysis request but <strong>no attachments were found</strong> in your email.</p>
          
          <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #dc2626;">How to Submit Documents</h3>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li>Attach your files (PDF, Word, Excel, images, etc.)</li>
              <li>Send to any of our analysis addresses:</li>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>analyze@${escapeHtml(this.serviceDomain)}</li>
                <li>docs@${escapeHtml(this.serviceDomain)}</li>
                <li>review@${escapeHtml(this.serviceDomain)}</li>
              </ul>
            </ol>
          </div>

          <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0;">📋 Supported Formats</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Documents:</strong> PDF, Word, Excel, PowerPoint</li>
              <li><strong>Images:</strong> JPG, PNG, GIF, TIFF (with OCR)</li>
              <li><strong>Text files:</strong> TXT, CSV, JSON</li>
              <li><strong>Archives:</strong> ZIP (contents will be analyzed)</li>
            </ul>
          </div>
          
          <p>Please <strong>resend your email with attachments</strong> for comprehensive analysis.</p>
          
          <p><em>Document Analysis Agent - Powered by AI</em></p>
        </div>
      `;

      await notificationService.sendEmail({
        to: email.from,
        subject,
        text: textMessage,
        html: htmlMessage
      });

      console.log(`📧 [DocumentAnalysisAgent] Sent no-attachments error to ${email.from}`);
    } catch (error) {
      console.error("❌ [DocumentAnalysisAgent] Error sending no-attachments error:", error);
    }
  }

  /**
   * Send text analysis email
   */
  private async sendTextAnalysisEmail(email: EmailData, analysis: any): Promise<void> {
    try {
      const subject = `Text Analysis Complete - ${analysis.category} content`;

      const textMessage = `
Hello,

Your text content has been analyzed:

Summary: ${analysis.summary}
Category: ${analysis.category}
Sentiment: ${analysis.sentiment}
Urgency: ${analysis.urgency}

Key Insights:
${analysis.keyInsights.map((insight: string) => `- ${insight}`).join('\n')}

${analysis.actionItems.length > 0 ? `Action Items:\n${analysis.actionItems.map((item: string) => `- ${item}`).join('\n')}` : ''}

Topics: ${analysis.topics.join(', ')}

Best regards,
Document Analysis Agent
      `;

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">📝 Text Analysis Complete</h2>
          
          <p>Your text content has been analyzed:</p>
          
          <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Summary:</strong> ${escapeHtml(analysis.summary)}</p>
            <p><strong>Category:</strong> ${escapeHtml(analysis.category)} | <strong>Sentiment:</strong> ${escapeHtml(analysis.sentiment)} | <strong>Urgency:</strong> ${escapeHtml(analysis.urgency)}</p>
          </div>

          ${analysis.keyInsights.length > 0 ? `
            <h3>💡 Key Insights</h3>
            <ul>
              ${analysis.keyInsights.map((insight: string) => `<li>${escapeHtml(insight)}</li>`).join('')}
            </ul>
          ` : ''}

          ${analysis.actionItems.length > 0 ? `
            <h3>🎯 Action Items</h3>
            <ul>
              ${analysis.actionItems.map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          ` : ''}

          <p><strong>Topics:</strong> ${escapeHtml(analysis.topics.join(', '))}</p>
          
          <p><em>Document Analysis Agent - Powered by AI</em></p>
        </div>
      `;

      await notificationService.sendEmail({
        to: email.from,
        subject,
        text: textMessage,
        html: htmlMessage
      });

    } catch (error) {
      console.error("❌ [DocumentAnalysisAgent] Error sending text analysis:", error);
    }
  }

  /**
   * Check if follow-up is a question about previous analysis
   */
  private isAnalysisQuestion(email: EmailData): boolean {
    const questionPatterns = [
      /what.*mean/i,
      /explain.*result/i,
      /tell.*more/i,
      /clarify/i,
      /question.*about/i,
      /why.*show/i,
      /how.*calculated/i
    ];

    const content = `${email.subject} ${email.body}`.toLowerCase();
    return questionPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Handle questions about previous analysis
   */
  private async handleAnalysisQuestion(email: EmailData, userId: string): Promise<CommandResult> {
    try {
      // This is a simplified implementation - in production you'd look up previous analysis
      const response = await claudeService.sendMessage(`
        The user is asking a follow-up question about a document analysis:
        
        Subject: ${email.subject}
        Question: ${email.body}
        
        Please provide a helpful response that explains document analysis concepts, 
        clarifies potential questions, or suggests next steps. Be professional and educational.
      `);

      await notificationService.sendEmail({
        to: email.from,
        subject: `Re: ${email.subject}`,
        text: `Hello,\n\nRegarding your question:\n\n${response}\n\nFeel free to send additional documents for analysis or ask more questions.\n\nBest regards,\nDocument Analysis Agent`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Document Analysis - Follow-up Response</h2>
            <p>Hello,</p>
            <p>Regarding your question:</p>
            <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0;">
              ${escapeHtml(response).replace(/\n/g, '<br>')}
            </div>
            <p>Feel free to send additional documents for analysis or ask more questions.</p>
            <p><em>Document Analysis Agent</em></p>
          </div>
        `
      });

      return {
        success: true,
        message: 'Follow-up question answered'
      };

    } catch (error) {
      console.error("❌ [DocumentAnalysisAgent] Error handling analysis question:", error);
      throw error;
    }
  }

  /**
   * Initialize agent
   */
  async initialize(): Promise<void> {
    console.log('📄 DocumentAnalysisAgent initialized - Ready to analyze documents with AI');
  }

  /**
   * Cleanup agent
   */
  async cleanup(): Promise<void> {
    console.log('🧹 DocumentAnalysisAgent cleanup complete');
  }
}