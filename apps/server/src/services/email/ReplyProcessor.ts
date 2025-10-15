import { EmailData } from './types';
import { storage } from '../../storage';
import { claudeService } from '../claudeService';
import { getOrCreateUserByEmail } from '../userService';
import { sendMail } from '../mailer';
import { optOutManager } from './OptOutManager';

export class ReplyProcessor {
  /**
   * Process a reply email to update task statuses
   */
  async processReplyEmail(email: EmailData): Promise<void> {
    try {
      console.log(`🔄 [REPLY] Processing reply email from ${email.from}: ${email.subject}`);

      // Check if sender has opted out
      if (await optOutManager.isOptedOut(email.from)) {
        console.log(`📧 [REPLY] Sender ${email.from} has opted out, skipping processing`);
        return;
      }

      // Check if this is an opt-out request
      if (await optOutManager.processOptOutEmail(email)) {
        console.log(`📧 [REPLY] Processed opt-out request from ${email.from}`);
        return;
      }

      // Check if this email was already processed
      const existingProcessedEmail = await storage.getProcessedEmailByMessageId(email.messageId);
      if (existingProcessedEmail) {
        console.log(`⚠️  [REPLY] Email already processed, skipping: ${email.messageId}`);
        return;
      }

      // For project agents, we do NOT send reply emails back on thread replies per spec
      const shouldRespondOnReply = false;

      // Get or create user from sender email
      let user;
      try {
        user = await getOrCreateUserByEmail(email.from);
        console.log(`👤 [REPLY] Processing reply for user: ${email.from} (ID: ${user.id})`);
        
        // Verify user was created/found successfully
        if (!user || !user.id) {
          throw new Error(`Failed to get or create user for email: ${email.from}`);
        }
      } catch (error) {
        console.error(`🚨 [REPLY] Failed to get/create user for ${email.from}:`, error);
        throw error;
      }

      // First, try to find the original task or project being replied to
      let projectParticipants: string[] = [];
      let existingProject: any = null;
      
      // Try to find project by thread ID first
      if (email.threadId) {
        console.log(`🧵 [REPLY] Looking for project by thread ID: ${email.threadId}`);
        existingProject = await storage.findProjectByThreadId(email.threadId);
        if (existingProject) {
          console.log(`🔗 [REPLY] Found project by thread: "${existingProject.name}"`);
        }
      }
      
      // If we found a project, get its actual participants
      if (existingProject) {
        const participants = await storage.getProjectParticipants(existingProject.id);
        // Get user IDs from participants
        const userIds = participants.map(p => p.userId);
        // Get user objects for those IDs
        const participantUsers = await Promise.all(
          userIds.map(id => storage.getUser(id))
        );
        // Filter out null values and map to emails, ensuring no null emails
        projectParticipants = participantUsers
          .filter((u): u is NonNullable<typeof u> => u !== undefined && u.email !== null)
          .map(u => u.email as string);
        console.log(`👥 [REPLY] Fetched ${projectParticipants.length} project participants from database`);
      } else {
        // Fallback: use email recipients if no project found
        const serviceEmail = process.env.SERVICE_EMAIL || 'agent@inboxleap.com';
        const agentEmails = [
          'todo@inboxleap.com',
          't5t@inboxleap.com', 
          'polly@inboxleap.com',
          'sally@inboxleap.com',
          'marcus@inboxleap.com',
          'intelligence@inboxleap.com',
          serviceEmail
        ];
        
        projectParticipants = [...email.to, ...email.cc, ...email.bcc]
          .filter(e => !agentEmails.includes(e.toLowerCase()))
          .filter((e, index, arr) => arr.indexOf(e) === index);
        
        if (!projectParticipants.includes(email.from) && !agentEmails.includes(email.from.toLowerCase())) {
          projectParticipants.push(email.from);
        }
        console.log(`⚠️  [REPLY] No project found, using email recipients as participants (excluding agent emails)`);
      }

      console.log(`👥 [REPLY] Project participants: ${projectParticipants.join(', ')}`);

      // Get existing tasks from the project to avoid creating duplicates
      let existingTasks: any[] = [];
      if (existingProject) {
        existingTasks = await storage.getProjectTasks(existingProject.id);
        console.log(`📋 [REPLY] Found ${existingTasks.length} existing tasks in project to avoid duplicates`);
      }

      // Try to parse as new task creation first, but provide existing tasks context to AI
      console.log(`🔍 [REPLY] Checking for new task creation in reply...`);
      const newTasks = await claudeService.parseEmailToTasksWithContext(
        email.subject,
        email.body,
        projectParticipants,
        email.from,
        existingTasks
      );

      if (newTasks && newTasks.length > 0) {
        console.log(`✅ [REPLY] Found ${newTasks.length} new tasks in reply, creating them...`);
        
        // Create or update project for new tasks
        if (!existingProject) {
          const topic = email.subject.replace(/^re:\s*/i, '').trim() || 'Reply Tasks';
          
          try {
            console.log(`📁 [REPLY] Creating project with createdBy: ${user.id} for user: ${email.from}`);
            existingProject = await storage.createProject({
              name: topic,
              type: 'team',
              createdBy: user.id,
              topic: email.threadId,
            });
            console.log(`✅ [REPLY] Created new project: "${existingProject.name}" (ID: ${existingProject.id})`);
          } catch (error) {
            console.error(`🚨 [REPLY] Failed to create project for user ${user.id} (${email.from}):`, error);
            console.error(`🚨 [REPLY] User object:`, user);
            throw error;
          }

          // Add all participants to the new project
          for (const participantEmail of projectParticipants) {
            try {
              const participant = await getOrCreateUserByEmail(participantEmail);
              if (!participant || !participant.id) {
                console.error(`🚨 [REPLY] Failed to create participant for email: ${participantEmail}`);
                continue;
              }
              
              await storage.addProjectParticipant({
                projectId: existingProject.id,
                userId: participant.id,
                role: participantEmail === email.from ? 'creator' : 'participant',
              });
              console.log(`👥 [REPLY] Added participant: ${participantEmail} (ID: ${participant.id})`);
            } catch (error) {
              console.error(`🚨 [REPLY] Failed to add participant ${participantEmail}:`, error);
              // Continue with other participants
            }
          }
        }

        // Create the new tasks
        for (const taskData of newTasks) {
          const task = await storage.createTask({
            ...taskData,
            projectId: existingProject.id,
            createdBy: user.id,
          });

          // Add assignees
          if (taskData.assignees && taskData.assignees.length > 0) {
            for (const assigneeEmail of taskData.assignees) {
              try {
                const assignee = await getOrCreateUserByEmail(assigneeEmail);
                if (!assignee || !assignee.id) {
                  console.error(`🚨 [REPLY] Failed to create assignee for email: ${assigneeEmail}`);
                  continue;
                }
                
                await storage.addTaskAssignee({
                  taskId: task.id,
                  userId: assignee.id,
                });
                console.log(`📋 [REPLY] Added assignee: ${assigneeEmail} (ID: ${assignee.id}) to task: ${task.title}`);
              } catch (error) {
                console.error(`🚨 [REPLY] Failed to add assignee ${assigneeEmail}:`, error);
                // Continue with other assignees
              }
            }
          }
        }

        // Record this email as processed
        await storage.createProcessedEmail({
          messageId: email.messageId,
          subject: email.subject,
          sender: email.from,
          recipients: email.to,
          ccList: email.cc,
          bccList: email.bcc,
          body: email.body,
          status: 'processed',
          tasksCreated: newTasks.length,
          projectId: existingProject.id,
        });

        console.log(`✅ [REPLY] Created ${newTasks.length} new tasks from reply`);
        return;
      }

      // If no new tasks found, try to parse for task updates
      console.log(`🔍 [REPLY] No new tasks found, checking for task status updates...`);
      const taskUpdates = await this.parseReplyForTaskUpdates(email, existingProject?.id);

      if (taskUpdates && taskUpdates.length > 0) {
        console.log(`📝 [REPLY] Found ${taskUpdates.length} task updates in reply`);
        
        for (const update of taskUpdates) {
          try {
            await storage.updateTask(update.taskId, {
              status: update.newStatus,
              updatedAt: new Date(),
            });
            console.log(`✅ [REPLY] Updated task ${update.taskId} to status: ${update.newStatus}`);
          } catch (error) {
            console.error(`❌ [REPLY] Error updating task ${update.taskId}:`, error);
          }
        }

        // Record this email as processed
        await storage.createProcessedEmail({
          messageId: email.messageId,
          subject: email.subject,
          sender: email.from,
          recipients: email.to,
          ccList: email.cc,
          bccList: email.bcc,
          body: email.body,
          status: 'processed',
          tasksCreated: 0,
          projectId: existingProject?.id,
        });

        // Send confirmation of updates if configured and sender hasn't opted out
        if (shouldRespondOnReply && !await optOutManager.isOptedOut(email.from)) {
          await this.sendReplyConfirmation(email, taskUpdates, existingProject);
        }

        return;
      }

      // If we get here, it's likely just a regular reply/comment
      console.log(`💬 [REPLY] No actionable items found in reply, treating as comment/discussion`);
      
      // Still record as processed to avoid reprocessing
      await storage.createProcessedEmail({
        messageId: email.messageId,
        subject: email.subject,
        sender: email.from,
        recipients: email.to,
        ccList: email.cc,
        bccList: email.bcc,
        body: email.body,
        status: 'processed',
        tasksCreated: 0,
        projectId: existingProject?.id,
        processingError: 'No actionable items found',
      });

    } catch (error) {
      console.error("❌ [REPLY] Error processing reply email:", error);
      
      // Record as failed processing
      try {
        await storage.createProcessedEmail({
          messageId: email.messageId,
          subject: email.subject,
          sender: email.from,
          recipients: email.to,
          ccList: email.cc,
          bccList: email.bcc,
          body: email.body,
          status: 'failed',
          tasksCreated: 0,
          processingError: (error as any)?.message || 'Unknown error',
        });
      } catch (dbError) {
        console.error("❌ [REPLY] Error recording failed processing:", dbError);
      }
    }
  }

  private async parseReplyForTaskUpdates(email: EmailData, projectId?: number): Promise<any[]> {
    try {
      // Get tasks from the project context if available
      let contextTasks: any[] = [];
      if (projectId) {
        contextTasks = await storage.getProjectTasks(projectId);
      }

      // Use Claude to parse task updates from the email
      const updates = await claudeService.parseReplyForTaskUpdates(
        email.subject,
        email.body,
        contextTasks
      );

      return updates || [];
    } catch (error) {
      console.error("❌ [REPLY] Error parsing task updates:", error);
      return [];
    }
  }

  private async sendReplyConfirmation(email: EmailData, taskUpdates: any[], project: any): Promise<void> {
    try {
      const updateSummary = taskUpdates.map(update => 
        `• Task "${update.taskTitle}" → ${update.newStatus}`
      ).join('\n');

      const subject = `✅ Task updates processed from: ${email.subject}`;
      const body = `Hello,

Your reply has been processed and the following task updates have been applied:

${updateSummary}

Project: ${project?.name || 'Unknown'}

Thank you for the update!

Best regards,
Your Task Management System`;

      await sendMail({
        to: email.from,
        subject,
        text: body,
        inReplyTo: email.messageId,
        references: email.references,
      });

      console.log(`✅ [REPLY] Sent confirmation email to ${email.from}`);
    } catch (error) {
      console.error("❌ [REPLY] Error sending confirmation:", error);
    }
  }
}

export const replyProcessor = new ReplyProcessor();
