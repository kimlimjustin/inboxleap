import { storage } from '../../storage';
import { sendMail } from '../mailer.js';
import { EventEmitter } from 'events';
import type { EmailData, QueuedEmail } from '../queue/types';
import { claudeService } from '../claudeService';
import { getOrCreateUserByEmail } from '../userService';
import { isServiceEmail, isReplyEmail, determineImportance, determineAnalysisType } from '../utils/emailUtils';

export class AnalyzerHandler {
  constructor(private emitter: EventEmitter) {}

  async process(queuedEmail: QueuedEmail, processedEmail: any, analyzerRecipient: string) {
    const { email, userId } = queuedEmail;
    
    console.log(`🔬 [ANALYZER] Processing analyzer email:`);
    console.log(`   📨 To: ${analyzerRecipient}`);
    console.log(`   👤 From: ${email.from}`);
    console.log(`   📝 Subject: "${email.subject}"`);

    try {
      // Determine project type and participants (similar to Todo)
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
      
      console.log(`🔬 [ANALYZER] Project analysis:`);
      console.log(`   🏷️  Type: ${isTeamProject ? 'Team Analysis' : 'Individual Analysis'}`);
      console.log(`   👥 Participants: ${allParticipants.length} (${allParticipants.join(', ')})`);
      
      let project;
      
      if (isTeamProject) {
        // Similar to Todo team project logic
        if (this.isReplyEmail(email)) {
          if (email.threadId) {
            console.log(`🔬 [ANALYZER] Looking for existing project by thread ID: ${email.threadId}`);
            project = await storage.findProjectByThreadId(email.threadId);
            if (project) {
              console.log(`🔗 [ANALYZER] Found existing project by thread: "${project.name}"`);
            }
          }
          
          if (!project) {
            console.log(`🔍 [ANALYZER] Extracting topic from reply email...`);
            const topic = await claudeService.extractTopic(email.subject, email.body);
            console.log(`🏷️  [ANALYZER] Extracted topic: "${topic}"`);
            
            project = await storage.findProjectByTopicAndParticipants(topic, allParticipants);
            if (project) {
              console.log(`🔗 [ANALYZER] Found existing project by topic: "${project.name}"`);
            }
          }
        }
        
        if (!project) {
          console.log(`➕ [ANALYZER] Creating new team analysis project...`);
          const topic = await claudeService.extractTopic(email.subject, email.body);
          project = await storage.createProject({
            name: `Analysis: ${email.subject}`,
            type: 'team',
            topic,
            createdBy: userId,
          });

          // Add participants with appropriate permissions
          for (const participantEmail of allParticipants) {
            if (participantEmail !== email.from && !isServiceEmail(participantEmail)) {
              const participantUser = await getOrCreateUserByEmail(participantEmail);
              console.log(`👤 [ANALYZER] Processing participant: ${participantEmail}`);
              
              const canEdit = email.cc.includes(participantEmail);
              await storage.addProjectParticipant({
                projectId: project.id,
                userId: participantUser.id,
                role: canEdit ? 'editor' : 'viewer',
                canEdit,
              });
            }
          }
          console.log(`✅ [ANALYZER] Team analysis project created with ${allParticipants.length - 1} participants`);
        }
      } else {
        // Individual analysis project
        console.log(`🔬 [ANALYZER] Individual analysis for single user`);
        const topic = await claudeService.extractTopic(email.subject, email.body);
        project = await storage.createProject({
          name: `Analysis: ${email.subject}`,
          type: 'individual', 
          topic,
          createdBy: userId,
        });
        console.log(`✅ [ANALYZER] Individual analysis project created: "${project.name}"`);
      }

      // Instead of parsing tasks, we'll create analysis reports
      console.log(`🔬 [ANALYZER] Analyzing email content and attachments...`);
      const analysisStartTime = Date.now();
      
      // Generate analysis report using Claude
      const analysisReport = await this.generateAttachmentAnalysis(email, allParticipants);
      const analysisDuration = Date.now() - analysisStartTime;
      
      console.log(`🔬 [ANALYZER] Analysis complete:`);
      console.log(`   ⏱️  Duration: ${analysisDuration}ms`);
      console.log(`   📊 Findings: ${analysisReport.findings.length}`);
      
      // Create analysis tasks/reports 
      let reportsCreated = 0;
      for (const finding of analysisReport.findings) {
        console.log(`📊 [ANALYZER] Creating analysis report: "${finding.title}"`);
        await storage.createTask({
          projectId: project.id,
          title: finding.title,
          description: finding.analysis,
          priority: finding.importance || 'medium',
          status: 'completed', // Analysis reports are completed findings
          sourceEmail: email.from,
          sourceEmailSubject: email.subject,
          createdBy: userId,
        });
        reportsCreated++;
      }

      // Update processed email
      await storage.updateProcessedEmail(processedEmail.id, {
        status: 'processed',
        tasksCreated: reportsCreated,
        projectId: project.id,
      });

      console.log(`✅ [ANALYZER] Processing completed successfully:`);
      console.log(`   📊 Analysis reports created: ${reportsCreated}`);
      console.log(`   🎯 Project: "${project.name}"`);

      // Send analysis confirmation email
      if (reportsCreated > 0 && !this.isReplyEmail(email)) {
        try {
          await this.sendConfirmation(email, project, reportsCreated, analysisReport);
          console.log(`📧 [ANALYZER] Sent confirmation email to ${email.from}`);
        } catch (error) {
          console.error(`❌ [ANALYZER] Failed to send confirmation email:`, error);
        }
      }

      // Emit analysis creation event
      this.emitter.emit('analysisCreated', {
        queueId: queuedEmail.id,
        projectId: project.id,
        reportsCreated,
        subject: email.subject,
      });

    } catch (error) {
      console.error(`❌ [ANALYZER] Error processing analyzer email:`, error);
      await storage.updateProcessedEmail(processedEmail.id, {
        status: 'failed',
        processingError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private isReplyEmail(email: EmailData): boolean {
    return isReplyEmail(email.subject);
  }

  private async generateAttachmentAnalysis(email: EmailData, participants: string[]): Promise<any> {
    try {
      // For now, we'll analyze the email content 
      // TODO: Add actual attachment processing (PDF, images, docs, etc.)
      
      const analysisPrompt = `Analyze this email and any described attachments for insights:

Subject: ${email.subject}
From: ${email.from}
Body: ${email.body}

Participants: ${participants.join(', ')}

Generate analysis findings in this format:
- Key insights about the content
- Data patterns or trends mentioned
- Important documents or files referenced  
- Recommendations or next steps
- Risk assessments if applicable

Focus on providing actionable intelligence and detailed observations.`;

      // Use Claude to analyze the content
      const analysisText = await claudeService.sendMessage(analysisPrompt);
      
      // Parse the analysis into structured findings
      const findings = this.parseAnalysisFindings(analysisText, email);
      
      return {
        summary: `Analysis of "${email.subject}" completed with ${findings.length} key findings.`,
        findings,
        analyzedAt: new Date().toISOString(),
        attachmentCount: 0, // TODO: Count actual attachments
        participantCount: participants.length
      };
      
    } catch (error) {
      console.error(`🔬 [ANALYZER] Error generating analysis:`, error);
      
      // Fallback analysis
      return {
        summary: `Basic analysis of "${email.subject}" - attachment processing temporarily unavailable.`,
        findings: [
          {
            title: 'Email Content Analysis',
            analysis: `Analyzed email from ${email.from} regarding "${email.subject}". Content analysis and detailed insights will be available once attachment processing is fully operational.`,
            importance: 'medium',
            type: 'content-analysis'
          }
        ],
        analyzedAt: new Date().toISOString(),
        attachmentCount: 0,
        participantCount: participants.length
      };
    }
  }

  private parseAnalysisFindings(analysisText: string, email: EmailData): any[] {
    const findings = [];
    
    // Simple parsing - split by bullet points or numbered items
    const lines = analysisText.split('\n').filter(line => line.trim());
    
    let currentFinding = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Look for bullet points or key insights
      if (trimmed.match(/^[-•*]\s+/) || trimmed.match(/^\d+\.\s+/)) {
        if (currentFinding) {
          findings.push(currentFinding);
        }
        
        const title = trimmed.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '').substring(0, 100);
        currentFinding = {
          title,
          analysis: trimmed,
          importance: determineImportance(trimmed),
          type: determineAnalysisType(trimmed)
        };
      } else if (currentFinding && trimmed) {
        // Continue the current finding
        currentFinding.analysis += '\n' + trimmed;
      }
    }
    
    // Add the last finding
    if (currentFinding) {
      findings.push(currentFinding);
    }
    
    // If no structured findings found, create a general one
    if (findings.length === 0) {
      findings.push({
        title: `Analysis of ${email.subject}`,
        analysis: analysisText || 'Detailed analysis of the provided content.',
        importance: 'medium',
        type: 'general-analysis'
      });
    }
    
    return findings;
  }

  private async sendConfirmation(originalEmail: EmailData, project: any, reportsCreated: number, analysisReport: any) {
    try {
      const baseUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';
      
      // Determine project URL based on visibility rules (similar to Todo)
      const analyzerAgentEmails = ['analyzer@inboxleap.com'];
      const allRecipients = [...(originalEmail.to || []), ...(originalEmail.cc || []), ...(originalEmail.bcc || [])];
      const nonAgentCc = (originalEmail.cc || []).filter(r => !analyzerAgentEmails.includes(r.toLowerCase()));
      const isAgentInCc = (originalEmail.cc || []).some(r => analyzerAgentEmails.includes(r.toLowerCase()));
      const isAgentInBcc = (originalEmail.bcc || []).some(r => analyzerAgentEmails.includes(r.toLowerCase()));

      let replyRecipients: string[] = [originalEmail.from];
      if (isAgentInCc && nonAgentCc.length > 0) {
        replyRecipients = Array.from(new Set(nonAgentCc));
      }
      if (isAgentInBcc) {
        replyRecipients = [originalEmail.from];
      }

      const projectUrl = `${baseUrl}/project/${project.id}`;
      const subject = `🔬 ${reportsCreated} analysis reports generated from: ${originalEmail.subject}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f0f4f8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2563eb; margin: 0 0 10px 0;">🔬 Analysis Complete!</h2>
            <p style="color: #666; margin: 0;">Your content has been analyzed and detailed reports have been generated.</p>
          </div>
          
          <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 15px 0;">📊 Analysis Summary</h3>
            <ul style="color: #666; line-height: 1.6;">
              <li><strong>Reports Generated:</strong> ${reportsCreated}</li>
              <li><strong>Project:</strong> ${project.name}</li>
              <li><strong>Analysis Type:</strong> ${analysisReport.participantCount > 1 ? 'Team Analysis' : 'Individual Analysis'}</li>
              <li><strong>Attachments Analyzed:</strong> ${analysisReport.attachmentCount}</li>
            </ul>
          </div>
          
          <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 15px 0;">🎯 View Analysis Reports</h3>
            <p style="color: #666; margin: 0 0 15px 0;">Access your detailed analysis reports and insights:</p>
            <div style="text-align: center;">
              <a href="${projectUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                🔬 View Analysis Dashboard
              </a>
            </div>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 15px 0;">💡 Key Findings Preview</h3>
            <p style="color: #666; margin: 0 0 10px 0;"><strong>Analysis Summary:</strong></p>
            <p style="color: #666; margin: 0;">${analysisReport.summary}</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee;">
            <p>This analysis was generated by analyzer@inboxleap.com. View reports: ${projectUrl}</p>
            <p style="margin-top: 15px;">
              Don't want to receive these emails? 
              <a href="${baseUrl}/api/opt-out?email=${encodeURIComponent(originalEmail.from)}" style="color: #dc3545;">Unsubscribe</a>
            </p>
          </div>
        </div>
      `;

      const textContent = `
🔬 Analysis Complete

Your content has been analyzed and detailed reports have been generated.

📊 Analysis Summary:
• Reports Generated: ${reportsCreated}
• Project: ${project.name}
• Analysis Type: ${analysisReport.participantCount > 1 ? 'Team Analysis' : 'Individual Analysis'}
• Attachments Analyzed: ${analysisReport.attachmentCount}

🎯 View Analysis Reports:
${projectUrl}

💡 Key Findings Preview:
${analysisReport.summary}

---
View reports: ${projectUrl}

Don't want to receive these emails? Unsubscribe: ${baseUrl}/api/opt-out?email=${encodeURIComponent(originalEmail.from)}
      `;

      await sendMail({
        from: process.env.POSTMARK_FROM_EMAIL || process.env.SERVICE_EMAIL,
        to: replyRecipients,
        subject,
        text: textContent,
        html: htmlContent,
        inReplyTo: originalEmail.messageId,
        references: originalEmail.messageId ? [originalEmail.messageId] : undefined,
      });

      console.log(`🔬 [ANALYZER] Sent confirmation email to ${replyRecipients.join(', ')}`);

    } catch (error) {
      console.error(`🔬 [ANALYZER] Error sending confirmation:`, error);
    }
  }
}

