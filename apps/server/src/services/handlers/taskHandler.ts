import { storage } from '../../storage';
import { sendMail } from '../mailer.js';
import { EventEmitter } from 'events';
import type { EmailData, QueuedEmail } from '../queue/types';
import { claudeService } from '../claudeService';
import { getOrCreateUserByEmail } from '../userService';
import { notificationService } from '../notificationService';
import { isServiceEmail, isReplyEmail } from '../utils/emailUtils';
import { trustConfirmationService } from '../trustConfirmationService';
import { agentInstanceService } from '../agentInstanceService';

export class TaskHandler {
  constructor(private emitter: EventEmitter) {}

  async process(queuedEmail: QueuedEmail, processedEmail: any) {
    const { email, userId } = queuedEmail;

    // Determine which identity to use based on the recipient email
    let identityId: number | null = null;
    let agentInstanceId: number | null = null;

    // Check all recipients to find which agent instance this email was sent to
    const allRecipients = [...email.to, ...email.cc, ...email.bcc];
    for (const recipient of allRecipients) {
      if (isServiceEmail(recipient)) {
        const instance = await agentInstanceService.getInstanceByEmailWithIdentity(recipient);
        if (instance) {
          identityId = instance.identityId;
          agentInstanceId = instance.id;
          console.log(`🔑 [IDENTITY] Email sent to ${recipient} -> Identity ${identityId}, Agent Instance ${agentInstanceId}`);
          break;
        }
      }
    }

    // If no identity found from agent instance, fall back to user's personal identity
    if (!identityId) {
      console.log(`⚠️  [IDENTITY] No agent instance found, using user's personal identity`);
      // The identity will be null and the project will use legacy userId field
    }

    // Determine project type and participants
    const serviceEmail = process.env.SERVICE_EMAIL || 'todo@yourservice.app';
    const allParticipants = [...email.to, ...email.cc, ...email.bcc]
      .filter(email => email !== serviceEmail) // Filter out main service email
      .filter(email => !isServiceEmail(email)) // Filter out all service emails
      .filter((email, index, arr) => arr.indexOf(email) === index); // Remove duplicates

    // For service emails, the sender should be included as a participant (if not a service email)
    if (!allParticipants.includes(email.from) && !isServiceEmail(email.from)) {
      allParticipants.push(email.from);
    }

    const isTeamProject = allParticipants.length > 1;
    
    console.log(`👥 [CLAUDE] Project analysis:`);
    console.log(`   🏷️  Type: ${isTeamProject ? 'Team' : 'Individual'}`);
    console.log(`   👥 Participants: ${allParticipants.length} (${allParticipants.join(', ')})`);
    
    let project;
    
    if (isTeamProject) {
      // Only look for existing team project if this is a reply email
      if (this.isReplyEmail(email)) {
        // First try to find existing project by thread ID
        if (email.threadId) {
          console.log(`🧵 [CLAUDE] Looking for existing project by thread ID: ${email.threadId}`);
          project = await storage.findProjectByThreadId(email.threadId);
          if (project) {
            console.log(`🔗 [CLAUDE] Found existing project by thread: "${project.name}"`);
          }
        }
        
        // If not found by thread, try by topic and participants
        if (!project) {
          console.log(`🔍 [CLAUDE] Extracting topic from reply email...`);
          const topic = await claudeService.extractTopic(email.subject, email.body);
          console.log(`🏷️  [CLAUDE] Extracted topic: "${topic}"`);
          
          project = await storage.findProjectByTopicAndParticipants(topic, allParticipants);
          if (project) {
            console.log(`🔗 [CLAUDE] Found existing project by topic: "${project.name}"`);
          }
        }
      }
      
      if (!project) {
        // Create new team project
        console.log(`➕ [CLAUDE] Creating new team project...`);
        const topic = await claudeService.extractTopic(email.subject, email.body);
        project = await storage.createProject({
          name: email.subject,
          type: 'team',
          topic,
          createdBy: userId,
          identityId: identityId || undefined,
          agentInstanceId: agentInstanceId || undefined,
        });

        // Add participants (with trust/blacklist checking)
        for (const participantEmail of allParticipants) {
          if (participantEmail !== email.from && !isServiceEmail(participantEmail)) {
            console.log(`👤 [CLAUDE] Processing participant: ${participantEmail}`);
            
            // Check if participant has blocked the sender
            const isBlocked = await trustConfirmationService.isUserBlocked(email.from, participantEmail);
            if (isBlocked) {
              console.log(`🚫 [TRUST] ${participantEmail} has blocked ${email.from} - skipping`);
              continue;
            }

            // Check if this is the first time this sender is contacting this participant
            const isFirstTimeContact = await trustConfirmationService.isFirstTimeContactBySender(email.from, participantEmail);
            if (isFirstTimeContact) {
              console.log(`🆕 [TRUST] First-time contact from ${email.from} to ${participantEmail}`);
              
              // Send trust confirmation email instead of immediately adding to project
              try {
                await trustConfirmationService.sendTrustConfirmationEmail(
                  email.from,
                  participantEmail,
                  project.name,
                  email.subject
                );
                console.log(`📧 [TRUST] Sent confirmation email to ${participantEmail}`);
              } catch (error) {
                console.error(`❌ [TRUST] Failed to send confirmation email to ${participantEmail}:`, error);
              }
              continue; // Don't add them to the project yet
            }

            // User exists and has either trusted or hasn't blocked - proceed normally
            const participantUser = await getOrCreateUserByEmail(participantEmail);
            
            const canEdit = email.cc.includes(participantEmail); // CC can edit, BCC cannot
            await storage.addProjectParticipant({
              projectId: project.id,
              userId: participantUser.id,
              role: canEdit ? 'editor' : 'viewer',
              canEdit,
            });
            
            console.log(`✅ [CLAUDE] Added ${participantEmail} to project`);
          }
        }
        console.log(`✅ [CLAUDE] Team project created with ${allParticipants.length - 1} participants`);
      } else {
        console.log(`🔗 [CLAUDE] Using existing team project: "${project.name}"`);
      }
    } else {
      // Individual project - create per email thread instead of single "Personal Tasks" project
      console.log(`📧 [CLAUDE] Processing individual email thread...`);
      
      // For individual emails, always look for existing project by thread ID first
      if (email.threadId) {
        console.log(`🧵 [CLAUDE] Looking for existing individual project by thread ID: ${email.threadId}`);
        project = await storage.findProjectByThreadId(email.threadId);
        if (project) {
          console.log(`🔗 [CLAUDE] Found existing individual project by thread: "${project.name}"`);
        }
      }
      
      // If not found by thread, try to find by subject for replies
      if (!project && this.isReplyEmail(email)) {
        console.log(`🔍 [CLAUDE] Looking for existing individual project by subject...`);
        const topic = await claudeService.extractTopic(email.subject, email.body);
        const userProjects = await storage.getUserProjects(userId);
        project = userProjects.find(p => 
          p.type === 'individual' && 
          p.topic === topic &&
          p.name.includes(email.subject.replace(/^(Re:|Fwd?:)\s*/i, '').substring(0, 50))
        );
        if (project) {
          console.log(`🔗 [CLAUDE] Found existing individual project by topic: "${project.name}"`);
        }
      }
      
      if (!project) {
        // Create new individual project for this email thread
        console.log(`➕ [CLAUDE] Creating new individual project for email thread...`);
        const topic = await claudeService.extractTopic(email.subject, email.body);
        const projectName = email.subject.length > 50
          ? email.subject.substring(0, 47) + '...'
          : email.subject;

        project = await storage.createProject({
          name: projectName,
          type: 'individual',
          topic,
          createdBy: userId,
          identityId: identityId || undefined,
          agentInstanceId: agentInstanceId || undefined,
        });

        console.log(`✅ [CLAUDE] Created individual project: "${project.name}"`);
      }
    }

    // Parse tasks from email using Claude
    console.log(`🤖 [CLAUDE] Calling Claude AI to parse tasks...`);
    const claudeStartTime = Date.now();
    const tasks = await claudeService.parseEmailToTasks(email.subject, email.body, allParticipants);
    const claudeDuration = Date.now() - claudeStartTime;
    
    console.log(`🤖 [CLAUDE] AI response received:`);
    console.log(`   ⏱️  Duration: ${claudeDuration}ms`);
    console.log(`   📋 Tasks found: ${tasks.length}`);
    
    let tasksCreated = 0;
    for (const taskData of tasks) {
      console.log(`➕ [CLAUDE] Creating task: "${taskData.title}"`);
      const task = await storage.createTask({
        projectId: project.id,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority || 'medium',
        status: taskData.status || 'pending',
        dueDate: taskData.dueDate,
        sourceEmail: email.from,
        sourceEmailSubject: email.subject,
        createdBy: userId,
      });

      // Handle assignees
      if (taskData.assignees && taskData.assignees.length > 0) {
        for (const assigneeIdentifier of taskData.assignees) {
          // Skip service emails
          if (isServiceEmail(assigneeIdentifier)) {
            console.log(`⚠️  [ASSIGNEE] Skipping service email: ${assigneeIdentifier}`);
            continue;
          }
          
          // Try to find user by email or create from email
          let assigneeUser = await getOrCreateUserByEmail(assigneeIdentifier).catch(() => null);
          
          if (!assigneeUser && !assigneeIdentifier.includes('@')) {
            // If not an email, try to match by name with existing participants
            const participantMatch = allParticipants.find(p => 
              !isServiceEmail(p) && (
                p.toLowerCase().includes(assigneeIdentifier.toLowerCase()) ||
                assigneeIdentifier.toLowerCase().includes(p.split('@')[0].toLowerCase())
              )
            );
            
            if (participantMatch) {
              assigneeUser = await getOrCreateUserByEmail(participantMatch);
            } else {
              console.log(`⚠️  [ASSIGNEE] Could not resolve assignee: ${assigneeIdentifier}`);
              continue;
            }
          }

          if (assigneeUser) {
            await storage.addTaskAssignee({
              taskId: task.id,
              userId: assigneeUser.id,
            });
            console.log(`👤 [ASSIGNEE] Assigned task "${task.title}" to ${assigneeUser.email}`);

            // Send task assignment notification
            try {
              const assigner = await storage.getUser(userId);
              if (assigner) {
                await notificationService.queueTaskAssignmentNotification(
                  task,
                  assigneeUser,
                  assigner,
                  project.name
                );
                console.log(`📧 [NOTIFICATION] Queued notification for ${assigneeUser.email}`);
              }
            } catch (notificationError) {
              console.error(`❌ [NOTIFICATION] Failed to queue notification:`, notificationError);
              // Don't fail the task creation if notification fails
            }
          }
        }
      }

      tasksCreated++;
    }

    // Update processed email
    await storage.updateProcessedEmail(processedEmail.id, {
      status: 'processed',
      tasksCreated,
      projectId: project.id,
    });

    console.log(`✅ [CLAUDE] Processing completed successfully:`);
    console.log(`   📋 Tasks created: ${tasksCreated}`);
    console.log(`   🎯 Project: "${project.name}"`);

    // Send confirmation email for first-time emails (not replies)
    console.log(`🔍 [CONFIRMATION] Checking conditions: tasksCreated=${tasksCreated}, isReply=${this.isReplyEmail(email)}, subject="${email.subject}"`);
    if (tasksCreated > 0 && !this.isReplyEmail(email)) {
      try {
        await this.sendTaskCreationConfirmation(email, project, tasksCreated);
        console.log(`📧 [CONFIRMATION] Sent confirmation email to ${email.from}`);
      } catch (error) {
        console.error(`❌ [CONFIRMATION] Failed to send confirmation email:`, error);
      }
    }

    // Emit task creation event for real-time updates
    this.emitter.emit('tasksCreated', {
      queueId: queuedEmail.id,
      projectId: project.id,
      tasksCreated,
      subject: email.subject,
    });
  }

  private isReplyEmail(email: EmailData): boolean {
    return isReplyEmail(email.subject);
  }

  private async sendTaskCreationConfirmation(originalEmail: EmailData, project: any, tasksCreated: number): Promise<void> {
    
    // Determine which agent email to use based on the recipient
    const taskAgentEmails = [
      'todo@inboxleap.com',
      'todo@inboxleap.com',
      'tasks@inboxleap.com'
    ];
    
    // Find which agent email was in the original recipients
    const allRecipients = [...(originalEmail.to || []), ...(originalEmail.cc || []), ...(originalEmail.bcc || [])];
    const agentEmail = allRecipients.find(email => 
      taskAgentEmails.some(agent => email.toLowerCase().includes(agent.toLowerCase()))
    ) || 'todo@inboxleap.com'; // Default to todo

    console.log(`📧 [CONFIRMATION] Sending from agent alias: ${agentEmail}`);

    // Determine reply recipients based on visibility rules
    const isAgentInCc = (originalEmail.cc || []).some(r => taskAgentEmails.some(agent => r.toLowerCase().includes(agent)));
    const isAgentInBcc = (originalEmail.bcc || []).some(r => taskAgentEmails.some(agent => r.toLowerCase().includes(agent)));
    const nonAgentCc = (originalEmail.cc || []).filter(r => !taskAgentEmails.some(agent => r.toLowerCase().includes(agent)));

    let replyRecipients: string[] = [originalEmail.from];

    // If multiple people are associated and the agent is CC'ed, reply to everyone in CC (excluding the agent)
    if (isAgentInCc && nonAgentCc.length > 0) {
      replyRecipients = Array.from(new Set(nonAgentCc));
      console.log(`👥 [CONFIRMATION] Agent was CC'ed. Replying to CC list: ${replyRecipients.join(', ')}`);
    }

    // If the agent is BCC'ed, reply only to the sender
    if (isAgentInBcc) {
      replyRecipients = [originalEmail.from];
      console.log(`🕶️ [CONFIRMATION] Agent was BCC'ed. Replying only to sender: ${originalEmail.from}`);
    }

    // Generate project link
    const baseUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';
    const projectUrl = `${baseUrl}/project/${project.id}`;
    
    const subject = `✅ ${tasksCreated} tasks created from: ${originalEmail.subject}`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #28a745; margin: 0 0 10px 0;">✅ Tasks Created Successfully!</h2>
            <p style="color: #666; margin: 0;">Your email has been processed and tasks have been created by ${agentEmail}.</p>
          </div>
          
          <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 15px 0;">📋 Summary</h3>
            <ul style="color: #666; line-height: 1.6;">
              <li><strong>Tasks Created:</strong> ${tasksCreated}</li>
              <li><strong>Project:</strong> ${project.name}</li>
              <li><strong>From Email:</strong> ${originalEmail.subject}</li>
              <li><strong>Processed by:</strong> ${agentEmail}</li>
            </ul>
          </div>
          
          <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 15px 0;">🎯 View Your Tasks</h3>
            <p style="color: #666; margin: 0 0 15px 0;">Click the link below to view and manage your tasks in the project board:</p>
            <div style="text-align: center;">
              <a href="${projectUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                📋 View Project Board
              </a>
            </div>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 15px 0;">💡 Tips</h3>
            <ul style="color: #666; line-height: 1.6; margin: 0;">
              <li>Reply to this email to update task statuses</li>
              <li>Send follow-up emails to ${agentEmail} to add more tasks</li>
              <li>CC others to add team members to the project</li>
            </ul>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>This confirmation was sent by ${agentEmail}. View project: ${projectUrl}</p>
          </div>
        </div>
      `;

    const textContent = `
✅ ${tasksCreated} tasks created from: ${originalEmail.subject}

📋 Summary:
• Tasks Created: ${tasksCreated}
• Project: ${project.name}
• From Email: ${originalEmail.subject}
• Processed by: ${agentEmail}

🎯 View Your Tasks:
Visit your project board: ${projectUrl}

💡 Tips:
• Reply to this email to update task statuses
• Send follow-up emails to ${agentEmail} to add more tasks
• CC others to add team members to the project

---
View project: ${projectUrl}
      `;

    // Send via centralized mailer using Postmark/service email as sender
    await sendMail({
      from: process.env.POSTMARK_FROM_EMAIL || process.env.SERVICE_EMAIL,
      to: replyRecipients,
      subject,
      text: textContent,
      html: htmlContent,
      inReplyTo: originalEmail.messageId,
      references: originalEmail.messageId ? [originalEmail.messageId] : undefined,
    });

    console.log(`📧 [CONFIRMATION] Sent confirmation email to ${replyRecipients.join(', ')}`);
  }
}
