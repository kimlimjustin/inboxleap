import { storage } from '../../storage';
import { sendMail } from '../mailer.js';
import { EventEmitter } from 'events';
import type { EmailData, QueuedEmail } from '../queue/types';
import { getOrCreateUserByEmail } from '../userService';
import { isServiceEmail } from '../utils/emailUtils';
import { analyzeAttachment, generateFallbackAnalysis } from '../analyzer/analyzerAnalysisService';

export class AnalyzerHandler {
  constructor(private emitter: EventEmitter) {}

  async process(queuedEmail: QueuedEmail, processedEmail: any, analyzerRecipient: string) {
    const { email, userId } = queuedEmail;
    
    console.log(`📎 [ANALYZER] Processing Analyzer email:`);
    console.log(`   📨 To: ${analyzerRecipient}`);
    console.log(`   👤 From: ${email.from}`);
    console.log(`   📝 Subject: "${email.subject}"`);

    try {
      // Determine project type and participants
      const serviceEmail = 'analyzer@inboxleap.com';
      const allParticipants = [...email.to, ...email.cc, ...email.bcc]
        .filter(email => email !== serviceEmail)
        .filter(email => !isServiceEmail(email))
        .filter((email, index, arr) => arr.indexOf(email) === index);
      
      // Add sender if not already included
      if (!allParticipants.includes(email.from) && !isServiceEmail(email.from)) {
        allParticipants.push(email.from);
      }
      
      const isTeamProject = allParticipants.length > 1;

      // Check if project already exists for this email thread
      let existingProject;
      if (email.threadId) {
        existingProject = await storage.findProjectByThreadId(email.threadId);
      }
      let project;

      if (existingProject) {
        console.log(`📎 [ANALYZER] Using existing project: ${existingProject.name} (ID: ${existingProject.id})`);
        project = existingProject;
      } else {
        // Generate project name from subject
        const projectName = email.subject.startsWith('Re:') 
          ? email.subject.substring(3).trim()
          : email.subject || 'Attachment Analysis Project';
        
        console.log(`📎 [ANALYZER] Creating new project: ${projectName}`);

        // Create new project
        project = await storage.createProject({
          name: projectName,
          type: isTeamProject ? 'team' : 'individual',
          createdBy: userId,
          topic: 'attachment-analysis'
        });

        // Add participants to the project
        for (const participantEmail of allParticipants) {
          const participantUser = await getOrCreateUserByEmail(participantEmail);
          await storage.addProjectParticipant({
            projectId: project.id,
            userId: participantUser.id,
            role: participantEmail === email.from ? 'owner' : 'editor',
            canEdit: true
          });
        }

        console.log(`📎 [ANALYZER] Created new project: ${project.name} (ID: ${project.id})`);
      }

      // Process attachments if any
      if (email.attachments && email.attachments.length > 0) {
        console.log(`📎 [ANALYZER] Processing ${email.attachments.length} attachments`);
        
        const savedAttachmentIds: number[] = [];
        
        for (const attachment of email.attachments) {
          try {
            console.log(`📎 [ANALYZER] Processing attachment: ${attachment.filename}`);
            
            // Save attachment to database with content
            const contentBase64 = attachment.content ? attachment.content.toString('base64') : null;
            
            const savedAttachment = await storage.createEmailAttachment({
              projectId: project.id,
              filename: attachment.filename,
              originalName: attachment.filename,
              contentType: attachment.contentType || 'application/octet-stream',
              size: attachment.size || 0,
              s3Key: null,
              localPath: null,
              content: contentBase64, // Store as base64 string
              emailMessageId: email.messageId,
              analysis: null // Will be populated by automatic analysis
            });
            
            console.log(`📎 [ANALYZER] Saved attachment with ${contentBase64 ? 'content' : 'no content'}: ${attachment.filename}`);
            savedAttachmentIds.push(savedAttachment.id);
            
          } catch (attachmentError) {
            console.error(`📎 [ANALYZER] Error processing attachment ${attachment.filename}:`, attachmentError);
          }
        }
        
        // Automatically trigger analysis for all saved attachments
        if (savedAttachmentIds.length > 0) {
          console.log(`📎 [ANALYZER] Automatically starting analysis for ${savedAttachmentIds.length} attachments`);
          try {
            await this.analyzeAttachments(
              project.id,
              savedAttachmentIds,
              email.messageId,
              userId,
              {
                subject: email.subject || '',
                body: email.body || ''
              }
            );
          } catch (analysisError) {
            console.error(`📎 [ANALYZER] Error during automatic analysis:`, analysisError);
          }
        }
      } else {
        console.log(`📎 [ANALYZER] No attachments found in email`);
      }

      // Update processed email with Analyzer analysis info
      await storage.updateProcessedEmail(processedEmail.id, {
        status: 'processed',
        projectId: project.id,
        tasksCreated: 0 // Analyzer doesn't create tasks, just analysis
      });

      // Send response email to participants
      await this.sendResponseEmail(email, project, allParticipants);

      console.log(`📎 [ANALYZER] Successfully processed Analyzer email for project ${project.id}`);
    } catch (error) {
      console.error(`📎 [ANALYZER] Error processing Analyzer email:`, error);
      throw error;
    }
  }

  private async analyzeAttachments(
    projectId: number,
    attachmentIds: number[],
    messageId: string,
    userId: string,
    emailContext: { subject: string; body: string }
  ): Promise<void> {
    console.log(`📎 [ANALYZER] Starting analysis for ${attachmentIds.length} attachments in project ${projectId}`);
    
    let analyzedCount = 0;
    let totalInsights = 0;
    
    for (const attachmentId of attachmentIds) {
      try {
        const attachment = await storage.getEmailAttachment(attachmentId);
        if (!attachment) {
          console.error(`📎 [ANALYZER] Attachment ${attachmentId} not found`);
          continue;
        }
        
        if (attachment.analysis) {
          console.log(`📎 [ANALYZER] Attachment ${attachmentId} already analyzed, skipping`);
          continue;
        }
        
        console.log(`📎 [ANALYZER] Analyzing attachment: ${attachment.filename} (${attachment.contentType})`);

        // Perform analysis based on content type and actual content
        const analysis = await this.performLLMAnalysis(attachment, emailContext);

        // Save analysis results to both tables
        // 1. Update the email_attachments table (for project context)
        await storage.updateEmailAttachmentAnalysis(attachmentId, analysis);

        // 2. Save to document_analysis_results table (for analyzer page)
        await storage.createDocumentAnalysisResult({
          messageId: messageId,
          userId: userId,
          filename: attachment.filename,
          fileType: attachment.contentType,
          fileSize: attachment.size,
          aiAnalysis: analysis,
          processedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        analyzedCount++;
        totalInsights += analysis.keyPoints?.length || 0;

        console.log(`📎 [ANALYZER] Completed analysis for ${attachment.filename}`);
        
      } catch (analysisError) {
        console.error(`📎 [ANALYZER] Error analyzing attachment ${attachmentId}:`, analysisError);
      }
    }
    
    console.log(`📎 [ANALYZER] Analysis complete: ${analyzedCount} attachments analyzed, ${totalInsights} insights extracted`);
  }
  
  private async performLLMAnalysis(attachment: any, emailContext: { subject: string; body: string }): Promise<any> {
    try {
      return await analyzeAttachment(attachment, emailContext);
    } catch (error) {
      console.error(`dY"Z [ANALYZER] Error in attachment analysis:`, error);
      return generateFallbackAnalysis(attachment);
    }
  }

  private async sendResponseEmail(email: EmailData, project: any, participants: string[]) {
    try {
      const attachmentCount = email.attachments?.length || 0;
      const dashboardLink = `${process.env.DASHBOARD_URL || 'https://inboxleap.com'}/teams/analyzer?project=${project.id}`;
      
      let responseBody = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #FF6B35;">📎 Analyzer - Attachment Analysis Complete</h2>
  
  <p>Hello! I've successfully processed your email with attachments. Here's what I found:</p>
  
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #FF6B35;">📊 Analysis Summary</h3>
    <ul>
      <li><strong>Project:</strong> ${project.name}</li>
      <li><strong>Attachments Found:</strong> ${attachmentCount}</li>
      <li><strong>Team Members:</strong> ${participants.length}</li>
      <li><strong>Analysis Status:</strong> Ready for detailed review</li>
    </ul>
  </div>
  
  ${attachmentCount > 0 ? `
  <p><strong>Next Steps:</strong></p>
  <ol>
    <li>Visit your <a href="${dashboardLink}" style="color: #FF6B35; text-decoration: none;">Analyzer Dashboard</a> to view detailed attachment analysis</li>
    <li>Click "Analyze Attachments" to extract insights from your documents</li>
    <li>Review extracted key points, summaries, and document types</li>
  </ol>
  ` : `
  <p>No attachments were found in this email. To use Analyzer for attachment analysis, please include documents, images, or other files in your email.</p>
  `}
  
  <div style="margin-top: 30px; padding: 20px; background: #e8f4fd; border-radius: 8px;">
    <p style="margin: 0;"><strong>🎯 Pro Tip:</strong> Send emails with PDFs, images, documents, or spreadsheets to analyzer@inboxleap.com for automatic analysis and insights extraction!</p>
  </div>
  
  <p style="margin-top: 30px;">
    <a href="${dashboardLink}" style="display: inline-block; background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">View Analysis Dashboard</a>
  </p>
  
  <p style="font-size: 12px; color: #666; margin-top: 30px;">
    This analysis was generated by Analyzer, your attachment analysis agent. 
    <br>Reply to this email to ask questions or request additional analysis.
  </p>
</body>
</html>`;

      // Send to all participants
      for (const participant of participants) {
        await sendMail({
          from: process.env.POSTMARK_FROM_EMAIL || process.env.SERVICE_EMAIL,
          to: [participant],
          subject: `📎 [Analyzer] Attachment Analysis: ${project.name}`,
          html: responseBody,
          text: responseBody.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
        });
      }

      console.log(`📎 [ANALYZER] Sent response email to ${participants.length} participants`);
    } catch (error) {
      console.error(`📎 [ANALYZER] Error sending response email:`, error);
    }
  }
}



