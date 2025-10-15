import { IEmailAgent, EmailData, CommandResult } from '../types/interfaces';
import { storage } from '../storage';
import { getOrCreateUserByEmail } from '../services/userService';
import { claudeService } from '../services/claudeService';
import { notificationService } from '../services/agentNotificationService';
import { parseClaudeJsonResponseSafe } from '../utils/jsonParser';

/**
 * TodoAgent - Team Task Management Agent
 * 
 * Handles task-related emails sent to:
 * - todo@inboxleap.com
 * - todo@inboxleap.com  
 * - tasks@inboxleap.com
 * 
 * Responsibilities:
 * - Extract tasks from email content using Claude AI
 * - Create projects and assign team members
 * - Handle task status updates via reply emails
 * - Generate task board UI for team collaboration
 */
export class TodoAgent implements IEmailAgent {
  readonly agentName = 'TodoAgent';
  readonly agentType = 'team' as const;
  readonly description = 'Team task management agent that extracts tasks from emails and creates collaborative project boards';

  // Domain configuration - could be made configurable
  private readonly serviceDomain = 'inboxleap.com';

  /**
   * Define which email addresses this agent handles
   * Now includes custom instance emails from database
   */
  async getHandledEmails(): Promise<string[]> {
    const baseEmails = [
      `todo@${this.serviceDomain}`,
      `tasks@${this.serviceDomain}`,
    ];

    const normalizedEmails = new Map<string, string>();
    const addEmail = (email: string | undefined | null) => {
      if (!email) {
        return;
      }
      const lower = email.trim().toLowerCase();
      if (!lower) {
        return;
      }
      if (!normalizedEmails.has(lower)) {
        normalizedEmails.set(lower, email.trim());
      }
    };

    baseEmails.forEach(addEmail);

    try {
      const { agentInstanceService } = await import('../services/agentInstanceService');
      const instanceEmails = await agentInstanceService.getActiveEmailsForAgentType('todo');
      instanceEmails.forEach(addEmail);
    } catch (error) {
      console.warn('[TodoAgent] Unable to load active agent instance emails:', error);
    }

    try {
      const userAgentEmails = await storage.getAllActiveAgentEmails('todo');
      userAgentEmails.forEach(instance => addEmail(instance.emailAddress));

      const companyAgentEmails = await storage.getAllActiveCompanyAgentEmails('todo');
      companyAgentEmails.forEach(instance => addEmail(instance.emailAddress));
    } catch (error) {
      console.warn('[TodoAgent] Unable to load legacy agent emails:', error);
    }

    return Array.from(normalizedEmails.values());
  }

  /**
   * Check if this agent can handle the given email
   */
  async canHandle(email: EmailData): Promise<boolean> {
    const handledEmails = await this.getHandledEmails();
    const allRecipients = [...email.to, ...email.cc, ...email.bcc];
    
    // Check if any recipient matches our handled emails
    const canHandleEmail = allRecipients.some(recipient => 
      handledEmails.some(handled => 
        recipient.toLowerCase().includes(handled.toLowerCase())
      )
    );
    
    console.log(`🎯 [TodoAgent] Can handle email from ${email.from}? ${canHandleEmail}`);
    return canHandleEmail;
  }

  /**
   * Process email for task extraction and project creation
   */
  async process(email: EmailData): Promise<CommandResult> {
    try {
      console.log(`🎯 [TodoAgent] Processing task email from ${email.from}: ${email.subject}`);

      // Skip system/collaboration invitation emails
      if (email.subject && (
        email.subject.includes('wants to collaborate with you') ||
        email.subject.includes('InboxLeap:') ||
        email.from.includes('no-reply@inboxleap.com') ||
        email.from.includes('noreply@')
      )) {
        console.log("⚠️ [TodoAgent] Skipping system/collaboration email");
        return {
          success: false,
          message: 'System email skipped'
        };
      }

      // Check if this email was already processed
      const existingEmail = await storage.getProcessedEmailByMessageId(email.messageId);
      if (existingEmail) {
        console.log("⚠️ [TodoAgent] Email already processed, skipping");
        return {
          success: false,
          message: 'Email already processed'
        };
      }

      // Get or create user from sender email
      const user = await getOrCreateUserByEmail(email.from);
      if (!user) {
        console.log(`⛔ [TodoAgent] User requires email verification: ${email.from}`);
        return {
          success: false,
          message: 'Email verification required for sender'
        };
      }

      // Get handled emails for filtering
      const handledEmails = await this.getHandledEmails();

      const normalizeEmail = (value: string): string => {
        if (!value) {
          return '';
        }
        const match = value.match(/<([^>]+)>/);
        const emailAddress = (match ? match[1] : value).trim().toLowerCase();
        return emailAddress;
      };

      const handledLookup = new Map<string, string>();
      handledEmails.forEach(emailAddress => {
        const normalized = normalizeEmail(emailAddress);
        if (normalized && !handledLookup.has(normalized)) {
          handledLookup.set(normalized, emailAddress.trim());
        }
      });

      const normalizedFrom = normalizeEmail(email.from);
      const allRecipientAddresses = [...email.to, ...email.cc, ...email.bcc];
      const normalizedRecipients = allRecipientAddresses
        .map(normalizeEmail)
        .filter(address => !!address);

      const matchedAgent = normalizedRecipients.find(address => handledLookup.has(address));
      const targetAgentEmail = matchedAgent
        ? handledLookup.get(matchedAgent) ?? matchedAgent
        : `todo@${this.serviceDomain}`;

      const participantSet = new Set<string>();
      if (normalizedFrom) {
        participantSet.add(normalizedFrom);
      }

      for (const recipient of normalizedRecipients) {
        if (!handledLookup.has(recipient)) {
          participantSet.add(recipient);
        }
      }

      if (participantSet.size === 0 && normalizedFrom) {
        participantSet.add(normalizedFrom);
      }

      const allParticipants = Array.from(participantSet);
      const teamMemberCount = allParticipants.filter(address => address !== normalizedFrom).length;
      const projectType: 'individual' | 'team' = teamMemberCount > 0 ? 'team' : 'individual';

      console.log('[TodoAgent] Target agent email:', targetAgentEmail);
      console.log('[TodoAgent] Detected participants:', allParticipants);
      console.log('[TodoAgent] Raw recipients:', { to: email.to, cc: email.cc, bcc: email.bcc });

      // Extract tasks and topic using Claude AI
      let tasks, topic;
      try {
        tasks = await claudeService.parseEmailToTasks(
          email.subject,
          email.body,
          allParticipants,
          email.from
        );
        topic = await claudeService.extractTopic(email.subject, email.body);
        console.log(`🤖 [TodoAgent] Claude AI extracted ${tasks.length} tasks and topic: "${topic}"`);
      } catch (claudeError) {
        console.error("❌ [TodoAgent] Claude AI service error:", claudeError);
        return {
          success: false,
          message: `Failed to process email with Claude AI: ${claudeError instanceof Error ? claudeError.message : String(claudeError)}`
        };
      }

      // Create or find project
      let project = await this.findOrCreateProject(topic, allParticipants, user.id, email, targetAgentEmail, projectType);

      // Create tasks
      let tasksCreated = 0;
      const createdTasks = [];
      for (const taskData of tasks) {
        const task = await storage.createTask({
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority || "medium",
          status: taskData.status || "pending",
          projectId: project.id,
          createdBy: user.id,
          dueDate: taskData.dueDate,
          sourceEmail: email.from,
          sourceEmailSubject: email.subject,
        });

        // Handle assignees
        if (taskData.assignees && taskData.assignees.length > 0) {
          await this.assignTaskToUsers(task.id, taskData.assignees, allParticipants);
        }

        createdTasks.push(task);
        tasksCreated++;
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
        tasksCreated: tasksCreated,
        projectId: project.id,
      });

      // Send confirmation email to sender
      await this.sendConfirmationEmail(email, project, createdTasks, email.from);

      // Send notifications to participants/assignees (excluding sender)
      await this.sendParticipantNotifications(createdTasks, email.from, project, allParticipants);

      console.log('[TodoAgent] Created project', project.name, `(${projectType})`, 'with', allParticipants.length, 'participants');

      return {
        success: true,
        message: `Successfully created ${tasksCreated} tasks in project "${project.name}"`,
        data: {
          projectId: project.id,
          tasksCreated,
          projectName: project.name
        }
      };

    } catch (error) {
      console.error("❌ [TodoAgent] Error processing email:", error);
      return {
        success: false,
        message: `Error processing task email: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle follow-up emails (task status updates, replies)
   */
  async handleFollowup(followup: EmailData): Promise<CommandResult> {
    try {
      console.log(`🔄 [TodoAgent] Processing follow-up email from ${followup.from}`);

      // Get user for authentication
      const user = await getOrCreateUserByEmail(followup.from);
      if (!user) {
        console.log(`⛔ [TodoAgent] User requires verification: ${followup.from}`);
        return {
          success: false,
          message: 'Email verification required for sender'
        };
      }

      // First, try to parse as task status updates using Claude AI
      const taskUpdates = await this.parseReplyForTaskUpdates(followup, user.id);
      
      if (taskUpdates.length > 0) {
        console.log(`📝 [TodoAgent] Found ${taskUpdates.length} task status updates`);
        
        // Apply task updates
        let updatedCount = 0;
        for (const update of taskUpdates) {
          try {
            await storage.updateTask(update.taskId, { status: update.newStatus as any });
            console.log(`✅ [TodoAgent] Updated task ${update.taskId}: "${update.taskTitle}" → ${update.newStatus}`);
            updatedCount++;
            
            // Send notification to assignees about status change
            await this.notifyTaskStatusUpdate(update.taskId, update.newStatus, followup.from);
          } catch (updateError) {
            console.error(`❌ [TodoAgent] Failed to update task ${update.taskId}:`, updateError);
          }
        }
        
        // Send confirmation email
        await this.sendReplyConfirmation(followup, updatedCount, user.id);
        
        return {
          success: true,
          message: `Successfully updated ${updatedCount} task(s)`,
          data: { tasksUpdated: updatedCount, updates: taskUpdates }
        };
      }

      // If no task updates found, check if it's a new task creation email
      console.log(`📝 [TodoAgent] No task updates found, treating as new task creation`);
      return await this.process(followup);

    } catch (error) {
      console.error("❌ [TodoAgent] Error processing follow-up:", error);
      return {
        success: false,
        message: `Error processing follow-up email: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Find existing project or create new one
   */
  private async findOrCreateProject(topic: string, participants: string[], userId: string, email: EmailData, targetAgentEmail?: string, projectType: 'individual' | 'team' = 'individual') {
    const normalizeEmail = (value: string): string => {
      if (!value) {
        return '';
      }
      const match = value.match(/<([^>]+)>/);
      const emailAddress = (match ? match[1] : value).trim().toLowerCase();
      return emailAddress;
    };

    const senderEmail = normalizeEmail(email.from);
    // Try to find existing project if this is a reply
    if (this.isReplyEmail(email)) {
      if (email.threadId) {
        const project = await storage.findProjectByThreadId(email.threadId);
        if (project) {
          console.log(`🔗 [TodoAgent] Found existing project by thread: "${project.name}"`);
          return project;
        }
      }

      // Try by topic and participants
      const topicKey = topic || email.threadId || '';
      if (topicKey) {
        const project = await storage.findProjectByTopicAndParticipants(topicKey, participants);
        if (project) {
          console.log(`[TodoAgent] Found existing project by topic: "${project.name}"`);
          return project;
        }
      }
    }

    // Use Claude AI to generate intelligent project name and context
    const intelligentProjectContext = await this.generateIntelligentProjectContext(
      email.subject,
      email.body,
      participants,
      email.from
    );

    // Look up agent instance and identity for the target email
    let identityId: number | null = null;
    let agentInstanceId: number | null = null;

    try {
      const { agentInstanceService } = await import('../services/agentInstanceService');
      const instance = await agentInstanceService.getInstanceByEmailWithIdentity((targetAgentEmail || email.to[0] || '').toLowerCase());
      if (instance) {
        identityId = instance.identityId ?? null;
        agentInstanceId = instance.id;
        console.log('[TodoAgent] Using agent instance', agentInstanceId, 'with identity', identityId ?? 'unknown');
      }
    } catch (error) {
      console.warn('[TodoAgent] Unable to resolve agent instance for email:', targetAgentEmail || email.to[0], error);
    }
    if (!identityId) {
      try {
        const { identityService } = await import('../services/identityService');
        const identity = await identityService.getUserIdentity(userId);
        if (identity) {
          identityId = identity.id;
          console.log('[TodoAgent] Defaulted project identity to user', userId, 'identity', identityId);
        }
      } catch (error) {
        console.warn('[TodoAgent] Unable to determine default identity for user', userId, error);
      }
    }

    // Create new project with intelligent context and source email tracking
    const projectTopic = email.threadId?.trim() || topic;
    const projectData = {
      name: intelligentProjectContext.name,
      type: projectType, // Use email header-based type instead of AI-generated
      createdBy: userId,
      identityId: identityId ?? undefined,
      agentInstanceId: agentInstanceId ?? undefined,
      sourceEmail: targetAgentEmail || email.to[0], // Track which agent instance this project belongs to
      sourceEmailSubject: email.subject,
      topic: projectTopic || undefined,
    };

    console.log('[TodoAgent] Creating project with data:', projectData);
    const project = await storage.createProject(projectData);

    // Add all participants to the project
    console.log(`👥 [TodoAgent] Adding ${participants.length} participants to project ${project.id}...`);
    for (const participantEmail of participants) {
      const participant = await getOrCreateUserByEmail(participantEmail);

      if (!participant) {
        console.log(`⚠️  [TodoAgent] Skipping unverified participant: ${participantEmail}`);
        continue;
      }

      const role = participantEmail === senderEmail ? 'owner' : 'editor';
      await storage.addProjectParticipant({
        projectId: project.id,
        userId: participant.id,
        role,
      });
      console.log(`✅ [TodoAgent] Added participant ${participantEmail} (ID: ${participant.id}) as ${role} to project ${project.id}`);
    }

    console.log(`✅ [TodoAgent] Created project "${project.name}" (${projectType}) with ${participants.length} participants`);
    return project;
  }

  /**
   * Assign task to users based on assignee identifiers
   */
  private async assignTaskToUsers(taskId: number, assignees: string[], allParticipants: string[]) {
    for (const assigneeIdentifier of assignees) {
      let assigneeUser = null;
      
      // Check if assigneeIdentifier is an email address
      if (assigneeIdentifier.includes('@')) {
        assigneeUser = await getOrCreateUserByEmail(assigneeIdentifier).catch(() => null);
      } else {
        // Find best participant match
        const participantMatch = this.findBestParticipantMatch(assigneeIdentifier, allParticipants);
        if (participantMatch) {
          assigneeUser = await getOrCreateUserByEmail(participantMatch);
          console.log(`🎯 [TodoAgent] Matched "${assigneeIdentifier}" to ${participantMatch}`);
        } else {
          console.log(`⚠️ [TodoAgent] Could not resolve assignee: ${assigneeIdentifier}`);
          continue;
        }
      }

      if (assigneeUser) {
        await storage.assignTask({
          taskId: taskId,
          userId: assigneeUser.id,
        });
        console.log(`👤 [TodoAgent] Assigned task to ${assigneeUser.email} (ID: ${assigneeUser.id})`);
      }
    }
  }

  /**
   * Find best participant match for assignee name
   */
  private findBestParticipantMatch(assigneeIdentifier: string, participants: string[]): string | null {
    // Simple matching logic - could be enhanced
    const identifier = assigneeIdentifier.toLowerCase();
    
    // Try exact match first
    for (const participant of participants) {
      if (participant.toLowerCase().includes(identifier)) {
        return participant;
      }
    }

    // Try partial matches
    for (const participant of participants) {
      const email = participant.toLowerCase();
      const namePart = email.split('@')[0];
      if (namePart.includes(identifier) || identifier.includes(namePart)) {
        return participant;
      }
    }

    return null;
  }

  /**
   * Check if email is a reply
   */
  private isReplyEmail(email: EmailData): boolean {
    return !!(email.inReplyTo || email.references?.length || 
              email.subject.toLowerCase().includes('re:') ||
              email.subject.toLowerCase().includes('fwd:'));
  }

  /**
   * Send confirmation email to sender with list of all tasks created
   */
  private async sendConfirmationEmail(email: EmailData, project: any, tasks: any[], senderEmail: string) {
    try {
      const baseUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';
      const tasksCreated = tasks.length;

      // Generate task list for sender
      const taskListText = tasks.map((task, index) =>
        `${index + 1}. ${task.title}
   Priority: ${task.priority}
   Status: ${task.status}
   ${task.description ? `Description: ${task.description}` : ''}
   ${task.dueDate ? `Due Date: ${task.dueDate.toDateString()}` : ''}`
      ).join('\n\n');

      const taskListHtml = tasks.map((task) => `
        <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 15px; margin: 10px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0284c7;">${task.title}</h4>
          ${task.description ? `<p style="margin: 5px 0; color: #64748b;">${task.description}</p>` : ''}
          <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
            <span style="background: ${task.priority === 'high' ? '#fecaca' : task.priority === 'medium' ? '#fef3c7' : '#d1fae5'}; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600;">${task.priority}</span>
            <span style="background: #e0e7ff; padding: 4px 10px; border-radius: 4px; font-size: 12px;">${task.status}</span>
            ${task.dueDate ? `<span style="color: #64748b; font-size: 12px;">📅 ${task.dueDate.toDateString()}</span>` : ''}
          </div>
        </div>
      `).join('');

      const textMessage = `
Hello,

Your task submission has been processed successfully by Todo, your team task management agent.

Project: ${project.name}
Tasks Created: ${tasksCreated}

Tasks:
${taskListText}

View Task Board: ${baseUrl}/todo?project=${project.id}

All assignees have been notified about their tasks.

Best regards,
Todo Task Agent
      `;

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">✅ Task Creation Confirmed</h2>

          <p>Hello,</p>

          <p>Your task submission has been processed successfully by <strong>Todo</strong>, your team task management agent.</p>

          <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #0284c7;">Project: ${project.name}</h3>
            <p style="margin: 0;"><strong>${tasksCreated} Task${tasksCreated > 1 ? 's' : ''} Created</strong></p>
          </div>

          <h3 style="color: #1e40af;">Tasks Created:</h3>
          ${taskListHtml}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/todo?project=${project.id}"
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Task Board
            </a>
          </div>

          <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px;">
            <h3 style="margin: 0 0 15px 0;">💡 Next Steps</h3>
            <p style="margin: 5px 0;">✅ All assignees have been notified about their tasks</p>
            <p style="margin: 5px 0;">📊 View real-time progress on the collaborative task board</p>
            <p style="margin: 5px 0;">📝 Reply to emails to update task status</p>
            <p style="margin: 5px 0;">👥 CC additional team members to add them to the project</p>
          </div>

          <p style="margin-top: 30px;"><em>Todo Task Agent</em></p>
        </div>
      `;

      await notificationService.sendEmail({
        to: senderEmail,
        subject: `✅ Tasks Created - ${project.name} (${tasksCreated} task${tasksCreated > 1 ? 's' : ''})`,
        text: textMessage,
        html: htmlMessage
      });

      console.log(`📧 [TodoAgent] Sent task creation confirmation to ${senderEmail} with ${tasksCreated} tasks`);
    } catch (error) {
      console.error("❌ [TodoAgent] Error sending confirmation email:", error);
    }
  }

  /**
   * Parse reply email for task status updates using Claude AI
   */
  private async parseReplyForTaskUpdates(email: EmailData, userId: string): Promise<Array<{ taskId: number, taskTitle: string, newStatus: string }>> {
    try {
      // Get user's recent tasks to provide context to Claude
      const userTasks = await storage.getTasksAssignedByUser(userId);
      
      if (userTasks.length === 0) {
        console.log(`📝 [TodoAgent] No existing tasks found for user ${email.from}`);
        return [];
      }

      console.log(`🔍 [TodoAgent] Using Claude AI to parse reply with ${userTasks.length} existing tasks for context`);
      
      // Use Claude AI to intelligently match task mentions to actual tasks
      const taskUpdates = await claudeService.parseReplyForTaskUpdates(
        email.subject,
        email.body,
        userTasks.map((task: any) => ({
          id: task.id,
          title: task.title,
          status: task.status
        }))
      );

      console.log(`🤖 [TodoAgent] Claude AI found ${taskUpdates.length} task updates`);
      return taskUpdates;

    } catch (error) {
      console.error("❌ [TodoAgent] Error parsing reply for task updates:", error);
      return [];
    }
  }

  /**
   * Send notification to task assignees about status updates
   */
  private async notifyTaskStatusUpdate(taskId: number, newStatus: string, updatedBy: string): Promise<void> {
    try {
      const baseUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';
      const task = await storage.getTask(taskId);
      if (!task) return;

      const assignees = await storage.getTaskAssignees(taskId);
      
      for (const assignee of assignees) {
        // Get user details for the assignee
        const user = await storage.getUser(assignee.userId);
        if (!user) continue;

        // Don't notify the person who made the update
        if (user.email === updatedBy) continue;

        try {
          await notificationService.sendEmail({
            to: user.email!,
            subject: `Task Status Updated: ${task.title}`,
            text: `Hello,

The task "${task.title}" has been updated:

Status: ${newStatus}
Updated by: ${updatedBy}
Project: Loading...

View details: ${baseUrl}/todo?project=${task.projectId}

Best regards,
Todo Task Agent`,
            html: `
              <h3>Task Status Updated</h3>
              <p>The task "<strong>${task.title}</strong>" has been updated:</p>
              <ul>
                <li><strong>Status:</strong> ${newStatus}</li>
                <li><strong>Updated by:</strong> ${updatedBy}</li>
                <li><strong>Project:</strong> Loading...</li>
              </ul>
              <p><a href="${baseUrl}/todo?project=${task.projectId}">View Task Details</a></p>
              <p><em>Todo Task Agent</em></p>
            `
          });

          console.log(`📧 [TodoAgent] Sent status update notification to ${user.email}`);
        } catch (notificationError) {
          console.error(`❌ [TodoAgent] Failed to notify ${user.email}:`, notificationError);
        }
      }
    } catch (error) {
      console.error("❌ [TodoAgent] Error sending task status notifications:", error);
    }
  }

  /**
   * Send reply confirmation email with rich HTML template
   */
  private async sendReplyConfirmation(email: EmailData, tasksUpdated: number, userId: string): Promise<void> {
    try {
      const baseUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';
      console.log(`📧 [TodoAgent] Preparing reply confirmation for ${email.from}, ${tasksUpdated} tasks updated`);

      // Get user's projects for context
      let projectLinks = '';
      try {
        const userProjects = await storage.getUserProjects(userId);
        if (userProjects.length > 0) {
          projectLinks = `
            <h3>Your Recent Projects</h3>
            <ul>
              ${userProjects.map((project: any) => 
                `<li><a href="${baseUrl}/todo?project=${project.id}">${project.name}</a></li>`
              ).join('')}
            </ul>
          `;
        }
      } catch (error) {
        console.error("❌ [TodoAgent] Error fetching user projects for confirmation:", error);
      }

      const subject = tasksUpdated > 0 
        ? `Task Updates Processed: ${tasksUpdated} task(s) updated`
        : 'Task Update Reply Processed';

      const textMessage = `Hello,

Your reply has been processed successfully by Todo, your team task management agent.

${tasksUpdated > 0 
  ? `Tasks Updated: ${tasksUpdated}
Task updates have been applied and assignees have been notified.`
  : 'No task updates were found in your reply, but it has been processed.'}

Reply to task notification emails to update specific tasks, or send new emails to create tasks.

Best regards,
Todo Task Agent`;

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Task Update Confirmation</h2>
          
          <p>Hello,</p>
          
          <p>Your reply has been processed successfully by <strong>Todo</strong>, your team task management agent.</p>
          
          ${tasksUpdated > 0 
            ? `<div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #0284c7;">✅ Tasks Updated: ${tasksUpdated}</h3>
                <p style="margin: 0;">Task updates have been applied and assignees have been notified.</p>
               </div>`
            : `<div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e;">No task updates were found in your reply, but it has been processed.</p>
               </div>`}

          ${projectLinks}
          
          <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px;">
            <h3 style="margin: 0 0 15px 0;">💡 Quick Tips</h3>
            <p style="margin: 5px 0;">📧 Reply to task notification emails to update specific tasks</p>
            <p style="margin: 5px 0;">📝 Send new emails to create tasks for your team</p>
            <p style="margin: 5px 0;">👥 CC team members to add them as assignees</p>
          </div>
          
          <p style="margin-top: 30px;"><em>Todo Task Agent</em></p>
        </div>
      `;

      await notificationService.sendEmail({
        to: email.from,
        subject,
        text: textMessage,
        html: htmlMessage
      });

      console.log(`📧 [TodoAgent] Sent reply confirmation to ${email.from}`);
    } catch (error) {
      console.error("❌ [TodoAgent] Error sending reply confirmation:", error);
    }
  }

  /**
   * Send notifications to participants about new project and their assigned tasks
   * Groups notifications by participant to avoid spam
   */
  private async sendParticipantNotifications(tasks: any[], createdBy: string, project: any, allParticipants: string[]): Promise<void> {
    try {
      const baseUrl = process.env.DASHBOARD_URL || 'https://inboxleap.com';

      // Get all participants except the sender
      const participantsToNotify = allParticipants.filter(p => p.toLowerCase() !== createdBy.toLowerCase());

      for (const participantEmail of participantsToNotify) {
        try {
          const participant = await getOrCreateUserByEmail(participantEmail);
          if (!participant || !participant.email) continue;

          // Find tasks assigned to this participant
          const assignedTasks = [];
          for (const task of tasks) {
            const assignees = await storage.getTaskAssignees(task.id);
            const isAssigned = assignees.some(a => a.userId === participant.id);
            if (isAssigned) {
              assignedTasks.push(task);
            }
          }

          // Generate task list for assigned tasks
          let assignedTasksSection = '';
          if (assignedTasks.length > 0) {
            const taskListHtml = assignedTasks.map((task) => `
              <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 15px; margin: 10px 0;">
                <h4 style="margin: 0 0 10px 0; color: #0284c7;">${task.title}</h4>
                ${task.description ? `<p style="margin: 5px 0; color: #64748b;">${task.description}</p>` : ''}
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
                  <span style="background: ${task.priority === 'high' ? '#fecaca' : task.priority === 'medium' ? '#fef3c7' : '#d1fae5'}; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600;">${task.priority}</span>
                  <span style="background: #e0e7ff; padding: 4px 10px; border-radius: 4px; font-size: 12px;">${task.status}</span>
                  ${task.dueDate ? `<span style="color: #64748b; font-size: 12px;">📅 ${task.dueDate.toDateString()}</span>` : ''}
                </div>
              </div>
            `).join('');

            const taskListText = assignedTasks.map((task, index) =>
              `${index + 1}. ${task.title}
   Priority: ${task.priority}
   Status: ${task.status}
   ${task.description ? `Description: ${task.description}` : ''}
   ${task.dueDate ? `Due Date: ${task.dueDate.toDateString()}` : ''}`
            ).join('\n\n');

            assignedTasksSection = `
<div style="margin: 20px 0;">
  <h3 style="color: #1e40af; margin-bottom: 10px;">📋 You are assigned to ${assignedTasks.length} task${assignedTasks.length > 1 ? 's' : ''}:</h3>
  ${taskListHtml}
</div>`;

            const textMessage = `
Hello,

You have been added to a new project: ${project.name}

Created by: ${createdBy}
Total tasks: ${tasks.length}

You are assigned to ${assignedTasks.length} task${assignedTasks.length > 1 ? 's' : ''}:

${taskListText}

View Project: ${baseUrl}/todo?project=${project.id}

Reply to this email with status updates or view the task board to collaborate with your team.

Best regards,
Todo Task Agent
            `;

            const htmlMessage = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">📬 New Project Notification</h2>

                <p>Hello,</p>

                <p>You have been added to a new project:</p>

                <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <h3 style="margin: 0 0 15px 0; color: #0284c7;">${project.name}</h3>
                  <p style="margin: 5px 0;"><strong>Created by:</strong> ${createdBy}</p>
                  <p style="margin: 5px 0;"><strong>Total tasks:</strong> ${tasks.length}</p>
                </div>

                ${assignedTasksSection}

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${baseUrl}/todo?project=${project.id}"
                     style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Task Board
                  </a>
                </div>

                <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px;">
                  <h3 style="margin: 0 0 15px 0;">💡 Quick Tips</h3>
                  <p style="margin: 5px 0;">📊 View all project tasks on the task board</p>
                  <p style="margin: 5px 0;">📝 Reply to emails to update task status</p>
                  <p style="margin: 5px 0;">👥 Collaborate with your team in real-time</p>
                </div>

                <p style="margin-top: 30px;"><em>Todo Task Agent</em></p>
              </div>
            `;

            await notificationService.sendEmail({
              to: participant.email,
              subject: `📬 New Project: ${project.name} - ${assignedTasks.length} task${assignedTasks.length > 1 ? 's' : ''} assigned`,
              text: textMessage,
              html: htmlMessage
            });

            console.log(`📧 [TodoAgent] Sent project notification to ${participant.email} (${assignedTasks.length} tasks assigned)`);
          } else {
            // Participant is part of project but no tasks assigned yet
            const textMessage = `
Hello,

You have been added to a new project: ${project.name}

Created by: ${createdBy}
Total tasks: ${tasks.length}

You are currently not assigned to any tasks but can view and collaborate on all project tasks.

View Project: ${baseUrl}/todo?project=${project.id}

Best regards,
Todo Task Agent
            `;

            const htmlMessage = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">📬 New Project Notification</h2>

                <p>Hello,</p>

                <p>You have been added to a new project:</p>

                <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <h3 style="margin: 0 0 15px 0; color: #0284c7;">${project.name}</h3>
                  <p style="margin: 5px 0;"><strong>Created by:</strong> ${createdBy}</p>
                  <p style="margin: 5px 0;"><strong>Total tasks:</strong> ${tasks.length}</p>
                </div>

                <p>You are currently not assigned to any tasks but can view and collaborate on all project tasks.</p>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${baseUrl}/todo?project=${project.id}"
                     style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Task Board
                  </a>
                </div>

                <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px;">
                  <h3 style="margin: 0 0 15px 0;">💡 Quick Tips</h3>
                  <p style="margin: 5px 0;">📊 View all project tasks on the task board</p>
                  <p style="margin: 5px 0;">👥 Collaborate with your team in real-time</p>
                  <p style="margin: 5px 0;">✉️ Send emails to create new tasks</p>
                </div>

                <p style="margin-top: 30px;"><em>Todo Task Agent</em></p>
              </div>
            `;

            await notificationService.sendEmail({
              to: participant.email,
              subject: `📬 Added to Project: ${project.name}`,
              text: textMessage,
              html: htmlMessage
            });

            console.log(`📧 [TodoAgent] Sent project notification to ${participant.email} (participant, no tasks assigned)`);
          }
        } catch (notificationError) {
          console.error(`❌ [TodoAgent] Failed to notify ${participantEmail}:`, notificationError);
        }
      }
    } catch (error) {
      console.error("❌ [TodoAgent] Error sending participant notifications:", error);
    }
  }

  /**
   * Generate intelligent project context using Claude AI
   */
  private async generateIntelligentProjectContext(
    subject: string, 
    body: string, 
    participants: string[], 
    sender: string
  ): Promise<{ name: string, description: string, type: 'team' | 'individual' | 'client' }> {
    try {
      const prompt = `Analyze this email to generate an intelligent project context:

Subject: ${subject}
Body: ${body}
Participants: ${participants.join(', ')}
Sender: ${sender}

Generate a project context with:
1. A concise, professional project name (max 50 chars) that captures the essence
2. A brief description (max 200 chars) explaining the project scope
3. Project type: "team" for multi-person collaboration, "individual" for personal tasks, "client" for external work

Consider:
- Industry context and terminology
- Project scope and complexity
- Team size and composition
- Professional naming conventions
- Avoid generic names like "General Tasks" or "Email Tasks"

Respond in JSON format:
{
  "name": "Intelligent project name here",
  "description": "Brief project description here", 
  "type": "team|individual|client"
}`;

      const response = await claudeService.sendMessage(prompt);
      
      const projectContext = parseClaudeJsonResponseSafe(response, {
        name: 'General Tasks',
        description: 'Email-based task management',
        type: 'team',
        teamMembers: participants
      });
      
      // Validate and ensure required fields
      if (!projectContext.name || !projectContext.description || !projectContext.type) {
        projectContext.name = projectContext.name || 'General Tasks';
        projectContext.description = projectContext.description || 'Email-based task management';
        projectContext.type = projectContext.type || 'team';
      }

      // Ensure type is valid
      if (!['team', 'individual', 'client'].includes(projectContext.type)) {
        projectContext.type = 'team';
      }

      console.log(`🧠 [TodoAgent] Claude AI generated project context: "${projectContext.name}" (${projectContext.type})`);
      return projectContext;
      
    } catch (error) {
      console.error("❌ [TodoAgent] Error generating intelligent project context:", error);
      
      // Fallback to simple context based on subject/topic
      const fallbackName = subject.length > 50 ? subject.substring(0, 47) + '...' : subject;
      
      return {
        name: fallbackName || 'Team Collaboration',
        description: `Project created from email: ${subject}`,
        type: participants.length > 1 ? 'team' : 'individual'
      };
    }
  }

  /**
   * Initialize agent (optional)
   */
  async initialize(): Promise<void> {
    console.log('🎯 TodoAgent initialized - Ready to handle team task management');
  }

  /**
   * Cleanup agent (optional)
   */
  async cleanup(): Promise<void> {
    console.log('🧹 TodoAgent cleanup complete');
  }
}