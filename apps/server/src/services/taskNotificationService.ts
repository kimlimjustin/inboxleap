import { storage } from '../storage';
import { sendMail } from './mailer';

/**
 * Service for sending task-related notifications based on user preferences
 */
export class TaskNotificationService {

  /**
   * Send notification when a task is assigned to a user
   * @param taskId - ID of the task
   * @param assigneeUserId - ID of the user being assigned
   * @param assignerUserId - ID of the user who made the assignment
   */
  async notifyTaskAssignment(taskId: number, assigneeUserId: string, assignerUserId: string): Promise<void> {
    try {
      // Get assignee's notification preferences
      const preferences = await storage.getNotificationPreferences(assigneeUserId);
      
      // Skip if email notifications or task assignments are disabled
      if (!preferences?.emailNotifications || !preferences?.newTaskAlerts || !preferences?.taskAssignments) {
        console.log(`📧 [NOTIFICATION] Skipping task assignment notification for user ${assigneeUserId} (disabled)`);
        return;
      }

      // Get task details
      const task = await storage.getTask(taskId);
      if (!task) {
        console.error(`Task ${taskId} not found for notification`);
        return;
      }

      // Get project details
      const project = await storage.getProject(task.projectId);
      if (!project) {
        console.error(`Project ${task.projectId} not found for notification`);
        return;
      }

      // Get assignee and assigner details
      const [assignee, assigner] = await Promise.all([
        storage.getUser(assigneeUserId),
        storage.getUser(assignerUserId)
      ]);

      if (!assignee?.email) {
        console.error(`Assignee ${assigneeUserId} email not found for notification`);
        return;
      }

      const assignerName = assigner?.firstName || assigner?.email || 'Someone';
      
      const emailBody = this.generateTaskAssignmentEmailHTML(
        assignee.firstName || assignee.email!,
        task.title,
        task.description || '',
        project.name,
        task.priority,
        task.dueDate,
        assignerName
      );

      await sendMail({
        to: assignee.email,
        subject: `📋 New Task Assigned: ${task.title}`,
        html: emailBody,
      });

      console.log(`📧 [NOTIFICATION] Sent task assignment notification to ${assignee.email}`);
    } catch (error) {
      console.error('Error sending task assignment notification:', error);
    }
  }

  /**
   * Send notification when a task status changes
   * @param taskId - ID of the task
   * @param oldStatus - Previous status
   * @param newStatus - New status
   * @param changedByUserId - User who made the change
   */
  async notifyTaskStatusChange(taskId: number, oldStatus: string, newStatus: string, changedByUserId: string): Promise<void> {
    try {
      // Get task details
      const task = await storage.getTask(taskId);
      if (!task) {
        console.error(`Task ${taskId} not found for status change notification`);
        return;
      }

      // Get all assignees for this task
      const taskWithAssignees = await storage.getTasksWithAssignees(task.projectId);
      const currentTask = taskWithAssignees.find(t => t.id === taskId) as any;

      if (!currentTask?.assignees?.length) {
        console.log(`📧 [NOTIFICATION] No assignees found for task ${taskId}`);
        return;
      }

      // Get user who made the change
      const changedBy = await storage.getUser(changedByUserId);
      const changedByName = changedBy?.firstName || changedBy?.email || 'Someone';

      // Get project details
      const project = await storage.getProject(task.projectId);
      if (!project) {
        console.error(`Project ${task.projectId} not found for notification`);
        return;
      }

      // Send notification to each assignee (except the one who made the change)
      for (const assignee of currentTask.assignees) {
        if (assignee.user.id === changedByUserId) {
          continue; // Don't notify the person who made the change
        }

        // Check notification preferences
        const preferences = await storage.getNotificationPreferences(assignee.user.id);
        if (!preferences?.emailNotifications || !preferences?.taskStatusChanges) {
          continue;
        }

        if (!assignee.user.email) {
          continue;
        }

        const emailBody = this.generateTaskStatusChangeEmailHTML(
          assignee.user.firstName || assignee.user.email,
          task.title,
          oldStatus,
          newStatus,
          project.name,
          changedByName
        );

        await sendMail({
          to: assignee.user.email,
          subject: `📈 Task Status Updated: ${task.title}`,
          html: emailBody,
        });

        console.log(`📧 [NOTIFICATION] Sent task status change notification to ${assignee.user.email}`);
      }
    } catch (error) {
      console.error('Error sending task status change notification:', error);
    }
  }

  /**
   * Send reminder notifications for tasks due soon
   */
  async sendTaskDueReminders(): Promise<void> {
    try {
      console.log('📅 [NOTIFICATION] Checking for tasks due soon...');
      
      // Get tasks due in the next 24 hours
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // This would need a new storage method to get tasks due between dates
      // For now, let's create a placeholder
      console.log(`📅 [NOTIFICATION] Would check tasks due between ${today.toISOString()} and ${tomorrow.toISOString()}`);
      
      // TODO: Implement getTasksDueBetween in storage and send reminders
    } catch (error) {
      console.error('Error sending task due reminders:', error);
    }
  }

  /**
   * Generate HTML email for task assignment notification
   */
  private generateTaskAssignmentEmailHTML(
    assigneeName: string,
    taskTitle: string,
    taskDescription: string,
    projectName: string,
    priority: string,
    dueDate: Date | null,
    assignerName: string
  ): string {
    const priorityColor = {
      low: '#10b981',
      medium: '#f59e0b', 
      high: '#ef4444'
    }[priority] || '#6b7280';

    const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString() : 'No due date';
    const appUrl = process.env.DASHBOARD_URL || process.env.APP_URL || 'https://inboxleap.com';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Task Assignment</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .task-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 16px; color: white; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
            .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📋 New Task Assigned</h1>
                <p>You have been assigned a new task</p>
            </div>
            
            <div class="content">
                <p>Hi ${assigneeName},</p>
                
                <p><strong>${assignerName}</strong> has assigned you a new task in the project <strong>${projectName}</strong>.</p>
                
                <div class="task-card">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <h3 style="margin: 0; color: #1f2937;">${taskTitle}</h3>
                        <span class="priority-badge" style="background-color: ${priorityColor};">${priority}</span>
                    </div>
                    
                    ${taskDescription ? `<p style="color: #6b7280; margin: 10px 0;">${taskDescription}</p>` : ''}
                    
                    <div style="margin-top: 15px; font-size: 14px; color: #6b7280;">
                        <p style="margin: 5px 0;"><strong>Project:</strong> ${projectName}</p>
                        <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDateStr}</p>
                        <p style="margin: 5px 0;"><strong>Assigned by:</strong> ${assignerName}</p>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <a href="${appUrl}" class="button">View Task</a>
                </div>
                
                <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                    You can manage your notification preferences in your account settings.
                </p>
            </div>
            
            <div class="footer">
                <p>This email was sent because you have task assignment notifications enabled.</p>
                <p>InboxLeap • Intelligent Email Collaboration</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate HTML email for task status change notification
   */
  private generateTaskStatusChangeEmailHTML(
    assigneeName: string,
    taskTitle: string,
    oldStatus: string,
    newStatus: string,
    projectName: string,
    changedByName: string
  ): string {
    const appUrl = process.env.DASHBOARD_URL || process.env.APP_URL || 'https://inboxleap.com';
    
    const statusColors = {
      pending: '#6b7280',
      'in-progress': '#f59e0b',
      completed: '#10b981',
      blocked: '#ef4444'
    } as any;

    const oldColor = statusColors[oldStatus] || '#6b7280';
    const newColor = statusColors[newStatus] || '#6b7280';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Status Updated</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .status-change { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; color: white; font-size: 14px; font-weight: bold; margin: 0 10px; }
            .arrow { color: #6b7280; font-size: 20px; margin: 0 10px; }
            .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
            .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📈 Task Status Updated</h1>
                <p>A task you're working on has been updated</p>
            </div>
            
            <div class="content">
                <p>Hi ${assigneeName},</p>
                
                <p><strong>${changedByName}</strong> updated the status of a task in <strong>${projectName}</strong>.</p>
                
                <h3 style="color: #1f2937; margin: 20px 0;">${taskTitle}</h3>
                
                <div class="status-change">
                    <p style="margin-bottom: 15px; color: #6b7280;">Status changed:</p>
                    <div style="display: flex; align-items: center; justify-content: center; flex-wrap: wrap;">
                        <span class="status-badge" style="background-color: ${oldColor};">${oldStatus}</span>
                        <span class="arrow">→</span>
                        <span class="status-badge" style="background-color: ${newColor};">${newStatus}</span>
                    </div>
                </div>
                
                <p style="color: #6b7280; font-size: 14px;">
                    <strong>Project:</strong> ${projectName}<br>
                    <strong>Updated by:</strong> ${changedByName}
                </p>
                
                <div style="text-align: center;">
                    <a href="${appUrl}" class="button">View Task</a>
                </div>
            </div>
            
            <div class="footer">
                <p>This email was sent because you have task status change notifications enabled.</p>
                <p>InboxLeap • Intelligent Email Collaboration</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

export const taskNotificationService = new TaskNotificationService();