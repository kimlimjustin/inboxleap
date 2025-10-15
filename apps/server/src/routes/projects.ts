import { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../googleAuth';
import { insertProjectSchema, insertTaskSchema } from '@email-task-router/shared';
import { wsManager } from '../services/websocketManager';
import { taskNotificationService } from '../services/taskNotificationService';

export function registerProjectTaskRoutes(app: Express) {
  const getAccessibleProjectIds = async (userId: string, identityId?: number | null) => {
    const projectIdSet = new Set<number>();

    if (identityId) {
      const identityProjects = await storage.getIdentityProjects(identityId);
      identityProjects.forEach(project => projectIdSet.add(project.id));
    }

    const userProjects = await storage.getUserProjects(userId);
    userProjects.forEach(project => projectIdSet.add(project.id));

    return Array.from(projectIdSet);
  };

  // Project routes
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(`📥 [PROJECTS] User ${req.user?.email} (${userId}) requesting projects`);

      // SIMPLE: Just get all projects where user is a participant
      const projects = await storage.getProjectsWhereUserIsParticipant(userId);

      console.log(`✅ [PROJECTS] Found ${projects.length} projects for user ${userId}`);

      // No caching
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });

      res.json({
        projects,
        _meta: {
          timestamp: Date.now(),
          userId: userId
        }
      });
    } catch (error) {
      console.error("❌ [PROJECTS] Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const identityId = req.session?.identityId;

      if (!identityId) {
        return res.status(400).json({ error: 'No identity selected. Please select an identity first.' });
      }

      const validatedData = insertProjectSchema.parse({
        ...req.body,
        createdBy: userId,
        identityId: identityId,
      });

      // Special handling for "Personal Tasks" to prevent duplicates
      if (validatedData.name === 'Personal Tasks' && validatedData.type === 'individual') {
        const existingProjects = await storage.getIdentityProjects(identityId);
        const existingPersonalProject = existingProjects.find(
          p => p.name === 'Personal Tasks' && p.type === 'individual'
        );

        if (existingPersonalProject) {
          return res.json(existingPersonalProject);
        }
      }

      const project = await storage.createProject(validatedData);
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.delete('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.id;
      
      // First, get the project to check if the user has permission to delete it
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check if user has permission to delete (project creator or admin participant)
      const isProjectCreator = project.createdBy === userId;
      const isParticipant = await storage.getProjectParticipant(projectId, userId);
      const isAdminParticipant = isParticipant && (isParticipant.role === 'owner' || isParticipant.role === 'admin');
      
      if (!isProjectCreator && !isAdminParticipant) {
        return res.status(403).json({ message: "Not authorized to delete this project" });
      }
      
      // Note: Personal Tasks projects can be deleted - a new one will be created automatically when needed
      
      // Delete the project (this will cascade delete all tasks, participants, etc.)
      await storage.deleteProject(projectId);
      
      // Use secure WebSocket manager for broadcasting project deletion
      await wsManager.broadcastToProjectUsers({
        type: 'project_deleted',
        data: { id: projectId }
      }, projectId);
      
      res.json({ message: "Project deleted successfully", id: projectId });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Task routes
  app.get('/api/projects/:projectId/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const userId = req.user.id;
      const companyId = req.companyId; // From extractCompanyContext middleware
      
      console.log(`🔍 [PROJECT-TASKS] Fetching tasks for project ${projectId}, user ${userId}, context: ${companyId || 'individual'}`);
      
      // First verify the user has access to this project
      const project = await storage.getProject(projectId);
      if (!project) {
        console.log(`❌ [PROJECT-TASKS] Project ${projectId} not found`);
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user has access to this project (either created it or is a participant)
      const isCreator = project.createdBy === userId;
      const isParticipant = await storage.isUserProjectParticipant(projectId, userId);

      if (!isCreator && !isParticipant) {
        console.log(`❌ [PROJECT-TASKS] User ${userId} has no access to project ${projectId}`);
        return res.status(403).json({ message: "Access denied to this project" });
      }
      
      const tasks = await storage.getTasksWithAssignees(projectId);
      console.log(`✅ [PROJECT-TASKS] Found ${tasks.length} tasks for project ${projectId}`);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get email chain for a project
  app.get('/api/projects/:projectId/emails', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const emails = await storage.getProjectEmails(projectId);
      res.json(emails);
    } catch (error) {
      console.error("Error fetching project emails:", error);
      res.status(500).json({ message: "Failed to fetch project emails" });
    }
  });

  // Get original email that created the project
  app.get('/api/projects/:projectId/original-email', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const originalEmail = await storage.getProjectOriginalEmail(projectId);
      
      if (!originalEmail) {
        return res.status(404).json({ message: "Original email not found" });
      }

      res.json({
        from: originalEmail.sender || 'Unknown Sender',
        date: originalEmail.createdAt ? new Date(originalEmail.createdAt).toLocaleString() : 'Unknown Date',
        subject: originalEmail.subject || 'No Subject',
        body: originalEmail.body || 'No content available'
      });
    } catch (error) {
      console.error("Error fetching project original email:", error);
      res.status(500).json({ message: "Failed to fetch original email" });
    }
  });

  // Project participants routes
  app.get('/api/project-participants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userProjects = await storage.getUserProjects(userId);
      
      const allParticipants = [];
      for (const project of userProjects) {
        const participants = await storage.getProjectParticipants(project.id);
        allParticipants.push(...participants);
      }
      
      res.json(allParticipants);
    } catch (error) {
      console.error("Error fetching project participants:", error);
      res.status(500).json({ message: "Failed to fetch project participants" });
    }
  });

  app.post('/api/projects/:projectId/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const projectId = parseInt(req.params.projectId);
      const validatedData = insertTaskSchema.parse({
        ...req.body,
        projectId,
        createdBy: userId,
      });
      const task = await storage.createTask(validatedData);
      
      // Get project info to check if it's an individual project
      const project = await storage.getProject(projectId);
      
      // Auto-assign to creator if it's an individual project or if explicitly requested
      if (project && (project.type === 'individual' || req.body.assignToMe === true)) {
        await storage.addTaskAssignee({
          taskId: task.id,
          userId: userId,
        });
      }
      
      // Use secure WebSocket manager for broadcasting
      await wsManager.broadcastToTaskUsers({
        type: 'task_update',
        data: task
      }, task.id);
      
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.patch('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const updates = req.body;
      const userId = req.user.id;
      
      // Get the current task to compare status changes
      const currentTask = await storage.getTask(taskId);
      if (!currentTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const task = await storage.updateTask(taskId, updates);
      
      // Send notification for status changes
      if (updates.status && updates.status !== currentTask.status) {
        try {
          await taskNotificationService.notifyTaskStatusChange(
            taskId, 
            currentTask.status, 
            updates.status, 
            userId
          );
        } catch (notificationError) {
          console.error('Error sending status change notification:', notificationError);
          // Don't fail the request if notification fails
        }
      }
      
      // Use secure WebSocket manager for broadcasting
      await wsManager.broadcastToTaskUsers({
        type: 'task_update',
        data: task
      }, task.id);
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.user.id;
      
      // First, get the task to check if the user has permission to delete it
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Check if user has permission to delete (task creator or project participant)
      const project = await storage.getProject(task.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const isTaskCreator = task.createdBy === userId;
      const isProjectCreator = project.createdBy === userId;
      const isParticipant = await storage.getProjectParticipant(task.projectId, userId);
      
      if (!isTaskCreator && !isProjectCreator && !isParticipant) {
        return res.status(403).json({ message: "Not authorized to delete this task" });
      }
      
      // Delete the task
      await storage.deleteTask(taskId);
      
      // Use secure WebSocket manager for broadcasting task deletion
      await wsManager.broadcastToTaskUsers({
        type: 'task_deleted',
        data: { id: taskId, projectId: task.projectId }
      }, taskId);
      
      res.json({ message: "Task deleted successfully", id: taskId });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  app.get('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tasks = await storage.getUserTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get('/api/tasks/assigned', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get ALL projects where user is a participant
      const projects = await storage.getProjectsWhereUserIsParticipant(userId);
      const projectIds = projects.map(p => p.id);

      if (projectIds.length === 0) {
        return res.json([]);
      }

      const allTasks = await Promise.all(
        projectIds.map(pid => storage.getTasksWithAssignees(pid))
      );

      const tasks = allTasks.flat().filter(task =>
        (task as any).assignees?.some((a: any) => a.userId === userId)
      );

      console.log(`✅ [TASKS] Fetched ${tasks.length} assigned tasks for user ${userId}`);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching assigned tasks:", error);
      res.status(500).json({ message: "Failed to fetch assigned tasks" });
    }
  });

  // Get tasks assigned by the current user
  app.get('/api/tasks/assigned-by-me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get ALL projects where user is a participant
      const projects = await storage.getProjectsWhereUserIsParticipant(userId);
      const projectIds = projects.map(p => p.id);

      if (projectIds.length === 0) {
        return res.json([]);
      }

      const allTasks = await Promise.all(
        projectIds.map(pid => storage.getTasksWithAssignees(pid))
      );

      const tasks = allTasks.flat().filter(task => task.createdBy === userId);

      console.log(`✅ [TASKS] Fetched ${tasks.length} tasks assigned by user ${userId}`);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks assigned by user:", error);
      res.status(500).json({ message: "Failed to fetch tasks assigned by user" });
    }
  });

  // Get tasks the user is monitoring
  app.get('/api/tasks/monitor', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get ALL projects where user is a participant
      const projects = await storage.getProjectsWhereUserIsParticipant(userId);
      const projectIds = projects.map(p => p.id);

      if (projectIds.length === 0) {
        return res.json([]);
      }

      const allTasks = await Promise.all(
        projectIds.map(pid => storage.getTasksWithAssignees(pid))
      );

      // Monitor tasks are those where user is a participant but not assigned
      const tasks = allTasks.flat().filter(task =>
        task.createdBy !== userId &&
        !(task as any).assignees?.some((a: any) => a.userId === userId)
      );

      console.log(`✅ [TASKS] Fetched ${tasks.length} monitor tasks for user ${userId}`);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching monitor tasks:", error);
      res.status(500).json({ message: "Failed to fetch monitor tasks" });
    }
  });

  // Get done/completed tasks for the user
  app.get('/api/tasks/done', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get ALL projects where user is a participant
      const projects = await storage.getProjectsWhereUserIsParticipant(userId);
      const projectIds = projects.map(p => p.id);

      if (projectIds.length === 0) {
        return res.json([]);
      }

      const allTasks = await Promise.all(
        projectIds.map(pid => storage.getTasksWithAssignees(pid))
      );

      const tasks = allTasks.flat().filter(task => task.status === 'done');

      console.log(`✅ [TASKS] Fetched ${tasks.length} done tasks for user ${userId}`);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching done tasks:", error);
      res.status(500).json({ message: "Failed to fetch done tasks" });
    }
  });

  // Get all tasks for the user (combines all task types)
  app.get('/api/tasks/all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get ALL projects where user is a participant
      const projects = await storage.getProjectsWhereUserIsParticipant(userId);
      const projectIds = projects.map(p => p.id);

      if (projectIds.length === 0) {
        return res.json([]);
      }

      const allTasks = await Promise.all(
        projectIds.map(pid => storage.getTasksWithAssignees(pid))
      );

      const tasks = allTasks.flat();

      console.log(`✅ [TASKS] Fetched ${tasks.length} total tasks for user ${userId}`);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching all tasks:", error);
      res.status(500).json({ message: "Failed to fetch all tasks" });
    }
  });

  // Add assignee to task
  app.post('/api/tasks/:id/assignees', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const { userId: assigneeUserId } = req.body;
      const assignerUserId = req.user.id;

      if (!assigneeUserId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Check if task exists
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Add the assignee
      await storage.addTaskAssignee({
        taskId,
        userId: assigneeUserId,
      });

      // Send notification to the newly assigned user
      if (assigneeUserId !== assignerUserId) {
        try {
          await taskNotificationService.notifyTaskAssignment(
            taskId,
            assigneeUserId,
            assignerUserId
          );
        } catch (notificationError) {
          console.error('Error sending task assignment notification:', notificationError);
          // Don't fail the request if notification fails
        }
      }

      // Broadcast update via WebSocket
      await wsManager.broadcastToTaskUsers({
        type: 'task_assignee_added',
        data: { taskId, userId: assigneeUserId }
      }, taskId);

      res.json({ message: "Assignee added successfully", taskId, userId: assigneeUserId });
    } catch (error) {
      console.error("Error adding task assignee:", error);
      res.status(500).json({ message: "Failed to add task assignee" });
    }
  });

  // Remove assignee from task
  app.delete('/api/tasks/:id/assignees/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const assigneeUserId = req.params.userId;

      // Check if task exists
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Remove the assignee
      await storage.removeTaskAssignee(taskId, assigneeUserId);

      // Broadcast update via WebSocket
      await wsManager.broadcastToTaskUsers({
        type: 'task_assignee_removed',
        data: { taskId, userId: assigneeUserId }
      }, taskId);

      res.json({ message: "Assignee removed successfully", taskId, userId: assigneeUserId });
    } catch (error) {
      console.error("Error removing task assignee:", error);
      res.status(500).json({ message: "Failed to remove task assignee" });
    }
  });
}
