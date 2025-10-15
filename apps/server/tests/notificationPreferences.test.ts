import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createMockStorage, createMockUser, createMockTask, createMockProject } from './helpers';

// Mock dependencies BEFORE imports
vi.mock('../src/storage', () => ({
  storage: createMockStorage(),
}));

vi.mock('../src/services/mailer', () => ({
  sendMail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/googleAuth', () => ({
  isAuthenticated: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

// Import after mocking
import { registerNotificationRoutes } from '../src/routes/notifications';
import { taskNotificationService } from '../src/services/taskNotificationService';

describe('Notification Preferences API', () => {
  let app: express.Express;
  let mockStorage: any;
  let mockSendMail: any;

  beforeEach(async () => {
    // Create Express app with notification routes
    app = express();
    app.use(express.json());
    registerNotificationRoutes(app);

    // Get mocked modules
    const { storage } = await import('../src/storage');
    const { sendMail } = await import('../src/services/mailer');
    
    mockStorage = storage;
    mockSendMail = sendMail;

    // Clear all mocks
    vi.clearAllMocks();

    // Setup default mocks
    mockStorage.getNotificationPreferences.mockResolvedValue({
      id: 1,
      userId: 'test-user-id',
      emailNotifications: true,
      newTaskAlerts: true,
      projectUpdates: true,
      taskStatusChanges: true,
      taskAssignments: true,
      taskDueReminders: true,
      weeklyDigest: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockStorage.upsertNotificationPreferences.mockResolvedValue({
      id: 1,
      userId: 'test-user-id',
      emailNotifications: true,
      newTaskAlerts: true,
      projectUpdates: true,
      taskStatusChanges: true,
      taskAssignments: true,
      taskDueReminders: true,
      weeklyDigest: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/notifications/preferences', () => {
    it('should return user notification preferences', async () => {
      const response = await request(app)
        .get('/api/notifications/preferences')
        .expect(200);

      expect(response.body).toEqual({
        id: 1,
        userId: 'test-user-id',
        emailNotifications: true,
        newTaskAlerts: true,
        projectUpdates: true,
        taskStatusChanges: true,
        taskAssignments: true,
        taskDueReminders: true,
        weeklyDigest: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      expect(mockStorage.getNotificationPreferences).toHaveBeenCalledWith('test-user-id');
    });

    it('should return default preferences if none exist', async () => {
      mockStorage.getNotificationPreferences.mockResolvedValue(null);
      mockStorage.upsertNotificationPreferences.mockResolvedValue({
        id: 1,
        userId: 'test-user-id',
        emailNotifications: true,
        newTaskAlerts: true,
        projectUpdates: true,
        taskStatusChanges: true,
        taskAssignments: true,
        taskDueReminders: true,
        weeklyDigest: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get('/api/notifications/preferences')
        .expect(200);

      expect(response.body).toEqual({
        id: 1,
        userId: 'test-user-id',
        emailNotifications: true,
        newTaskAlerts: true,
        projectUpdates: true,
        taskStatusChanges: true,
        taskAssignments: true,
        taskDueReminders: true,
        weeklyDigest: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should handle database errors', async () => {
      mockStorage.getNotificationPreferences.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/notifications/preferences')
        .expect(500);
    });
  });

  describe('PATCH /api/notifications/preferences/:setting', () => {
    it('should update a specific notification setting', async () => {
      const response = await request(app)
        .patch('/api/notifications/preferences/newTaskAlerts')
        .send({ enabled: false })
        .expect(200);

      expect(mockStorage.upsertNotificationPreferences).toHaveBeenCalledWith({
        userId: 'test-user-id',
        newTaskAlerts: false,
      });

      expect(response.body).toEqual({
        message: 'newTaskAlerts disabled successfully',
        preferences: {
          id: 1,
          userId: 'test-user-id',
          emailNotifications: true,
          newTaskAlerts: true,
          projectUpdates: true,
          taskStatusChanges: true,
          taskAssignments: true,
          taskDueReminders: true,
          weeklyDigest: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }
      });
    });

    it('should validate setting name', async () => {
      await request(app)
        .patch('/api/notifications/preferences/invalidSetting')
        .send({ enabled: false })
        .expect(400);

      expect(mockStorage.upsertNotificationPreferences).not.toHaveBeenCalled();
    });

    it('should validate enabled value', async () => {
      await request(app)
        .patch('/api/notifications/preferences/newTaskAlerts')
        .send({ enabled: 'invalid' })
        .expect(400);

      expect(mockStorage.upsertNotificationPreferences).not.toHaveBeenCalled();
    });

    it('should handle missing enabled field', async () => {
      await request(app)
        .patch('/api/notifications/preferences/newTaskAlerts')
        .send({})
        .expect(400);

      expect(mockStorage.upsertNotificationPreferences).not.toHaveBeenCalled();
    });

    it('should handle database errors during update', async () => {
      mockStorage.upsertNotificationPreferences.mockRejectedValue(new Error('Database error'));

      await request(app)
        .patch('/api/notifications/preferences/newTaskAlerts')
        .send({ enabled: false })
        .expect(500);
    });

    it('should update all valid notification settings', async () => {
      const validSettings = [
        'emailNotifications',
        'newTaskAlerts',
        'projectUpdates',
        'taskStatusChanges',
        'taskAssignments',
        'taskDueReminders',
        'weeklyDigest'
      ];

      for (const setting of validSettings) {
        await request(app)
          .patch(`/api/notifications/preferences/${setting}`)
          .send({ enabled: false })
          .expect(200);

        expect(mockStorage.upsertNotificationPreferences).toHaveBeenCalledWith({
          userId: 'test-user-id',
          [setting]: false,
        });
      }
    });
  });
});

describe('Task Notification Service', () => {
  let mockStorage: any;
  let mockSendMail: any;

  beforeEach(async () => {
    // Get mocked modules
    const { storage } = await import('../src/storage');
    const { sendMail } = await import('../src/services/mailer');
    
    mockStorage = storage;
    mockSendMail = sendMail;

    // Clear all mocks
    vi.clearAllMocks();

    // Setup default mocks
    mockSendMail.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('notifyTaskAssignment', () => {
    const mockTask = createMockTask('project-1', 'assigner-id', {
      id: 1,
      title: 'Test Task Assignment',
      description: 'Test task description',
      priority: 'high',
      dueDate: new Date('2024-12-31'),
    });

    const mockProject = createMockProject('creator-id', {
      id: 1,
      name: 'Test Project',
    });

    const mockAssignee = createMockUser({
      id: 'assignee-id',
      email: 'assignee@example.com',
      firstName: 'John',
      lastName: 'Doe',
    });

    const mockAssigner = createMockUser({
      id: 'assigner-id',
      email: 'assigner@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    });

    beforeEach(() => {
      mockStorage.getTask.mockResolvedValue(mockTask);
      mockStorage.getProject.mockResolvedValue(mockProject);
      mockStorage.getUser.mockImplementation((userId: string) => {
        if (userId === 'assignee-id') return Promise.resolve(mockAssignee);
        if (userId === 'assigner-id') return Promise.resolve(mockAssigner);
        return Promise.resolve(null);
      });
    });

    it('should send notification when preferences allow it', async () => {
      mockStorage.getNotificationPreferences.mockResolvedValue({
        emailNotifications: true,
        newTaskAlerts: true,
        taskAssignments: true,
      });

      await taskNotificationService.notifyTaskAssignment(1, 'assignee-id', 'assigner-id');

      expect(mockStorage.getNotificationPreferences).toHaveBeenCalledWith('assignee-id');
      expect(mockSendMail).toHaveBeenCalledWith({
        to: 'assignee@example.com',
        subject: '📋 New Task Assigned: Test Task Assignment',
        html: expect.stringContaining('New Task Assigned'),
      });
    });

    it('should not send notification when email notifications are disabled', async () => {
      mockStorage.getNotificationPreferences.mockResolvedValue({
        emailNotifications: false,
        newTaskAlerts: true,
        taskAssignments: true,
      });

      await taskNotificationService.notifyTaskAssignment(1, 'assignee-id', 'assigner-id');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should not send notification when new task alerts are disabled', async () => {
      mockStorage.getNotificationPreferences.mockResolvedValue({
        emailNotifications: true,
        newTaskAlerts: false,
        taskAssignments: true,
      });

      await taskNotificationService.notifyTaskAssignment(1, 'assignee-id', 'assigner-id');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should not send notification when task assignments are disabled', async () => {
      mockStorage.getNotificationPreferences.mockResolvedValue({
        emailNotifications: true,
        newTaskAlerts: true,
        taskAssignments: false,
      });

      await taskNotificationService.notifyTaskAssignment(1, 'assignee-id', 'assigner-id');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should handle missing task', async () => {
      mockStorage.getTask.mockResolvedValue(null);

      await taskNotificationService.notifyTaskAssignment(999, 'assignee-id', 'assigner-id');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should handle missing project', async () => {
      mockStorage.getProject.mockResolvedValue(null);

      await taskNotificationService.notifyTaskAssignment(1, 'assignee-id', 'assigner-id');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should handle missing assignee email', async () => {
      const assigneeWithoutEmail = { ...mockAssignee, email: null };
      mockStorage.getUser.mockImplementation((userId: string) => {
        if (userId === 'assignee-id') return Promise.resolve(assigneeWithoutEmail);
        if (userId === 'assigner-id') return Promise.resolve(mockAssigner);
        return Promise.resolve(null);
      });

      await taskNotificationService.notifyTaskAssignment(1, 'assignee-id', 'assigner-id');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should handle email sending errors gracefully', async () => {
      mockStorage.getNotificationPreferences.mockResolvedValue({
        emailNotifications: true,
        newTaskAlerts: true,
        taskAssignments: true,
      });

      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      // Should not throw
      await expect(
        taskNotificationService.notifyTaskAssignment(1, 'assignee-id', 'assigner-id')
      ).resolves.not.toThrow();
    });
  });

  describe('notifyTaskStatusChange', () => {
    const mockTask = createMockTask('project-1', 'changer-id', {
      id: 1,
      title: 'Test Task Status Change',
      projectId: 1,
    });

    const mockProject = createMockProject('creator-id', {
      id: 1,
      name: 'Test Project',
    });

    const mockAssignees = [
      createMockUser({
        id: 'assignee-1',
        email: 'assignee1@example.com',
        firstName: 'John',
      }),
      createMockUser({
        id: 'assignee-2',
        email: 'assignee2@example.com',
        firstName: 'Jane',
      }),
      createMockUser({
        id: 'changer-id',
        email: 'changer@example.com',
        firstName: 'Changer',
      }),
    ];

    const mockTaskWithAssignees = {
      ...mockTask,
      assignees: mockAssignees,
    };

    beforeEach(() => {
      mockStorage.getTask.mockResolvedValue(mockTask);
      mockStorage.getProject.mockResolvedValue(mockProject);
      mockStorage.getTasksWithAssignees.mockResolvedValue([mockTaskWithAssignees]);
      mockStorage.getUser.mockImplementation((userId: string) => {
        const user = mockAssignees.find(u => u.id === userId);
        return Promise.resolve(user || null);
      });
    });

    it('should send notifications to assignees when preferences allow it', async () => {
      mockStorage.getNotificationPreferences.mockResolvedValue({
        emailNotifications: true,
        taskStatusChanges: true,
      });

      await taskNotificationService.notifyTaskStatusChange(1, 'pending', 'in-progress', 'changer-id');

      // Should not notify the person who made the change
      expect(mockStorage.getNotificationPreferences).toHaveBeenCalledWith('assignee-1');
      expect(mockStorage.getNotificationPreferences).toHaveBeenCalledWith('assignee-2');
      expect(mockStorage.getNotificationPreferences).not.toHaveBeenCalledWith('changer-id');

      // Should send emails to assignees (except the changer)
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(mockSendMail).toHaveBeenCalledWith({
        to: 'assignee1@example.com',
        subject: '📈 Task Status Updated: Test Task Status Change',
        html: expect.stringContaining('Task Status Updated'),
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        to: 'assignee2@example.com',
        subject: '📈 Task Status Updated: Test Task Status Change',
        html: expect.stringContaining('Task Status Updated'),
      });
    });

    it('should respect individual notification preferences', async () => {
      mockStorage.getNotificationPreferences.mockImplementation((userId: string) => {
        if (userId === 'assignee-1') {
          return Promise.resolve({
            emailNotifications: true,
            taskStatusChanges: true,
          });
        } else if (userId === 'assignee-2') {
          return Promise.resolve({
            emailNotifications: true,
            taskStatusChanges: false, // Disabled for this user
          });
        }
        return Promise.resolve(null);
      });

      await taskNotificationService.notifyTaskStatusChange(1, 'pending', 'in-progress', 'changer-id');

      // Should only send one email (to assignee-1)
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        to: 'assignee1@example.com',
        subject: '📈 Task Status Updated: Test Task Status Change',
        html: expect.stringContaining('Task Status Updated'),
      });
    });

    it('should handle task with no assignees', async () => {
      mockStorage.getTasksWithAssignees.mockResolvedValue([{
        ...mockTask,
        assignees: [],
      }]);

      await taskNotificationService.notifyTaskStatusChange(1, 'pending', 'in-progress', 'changer-id');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should handle missing task', async () => {
      mockStorage.getTask.mockResolvedValue(null);

      await taskNotificationService.notifyTaskStatusChange(999, 'pending', 'in-progress', 'changer-id');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockStorage.getNotificationPreferences.mockResolvedValue({
        emailNotifications: true,
        taskStatusChanges: true,
      });

      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      // Should not throw
      await expect(
        taskNotificationService.notifyTaskStatusChange(1, 'pending', 'in-progress', 'changer-id')
      ).resolves.not.toThrow();
    });
  });

  describe('sendTaskDueReminders', () => {
    it('should check for tasks due soon', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await taskNotificationService.sendTaskDueReminders();

      expect(consoleSpy).toHaveBeenCalledWith('📅 [NOTIFICATION] Checking for tasks due soon...');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/📅 \[NOTIFICATION\] Would check tasks due between/));

      consoleSpy.mockRestore();
    });
  });

  describe('HTML email generation', () => {
    it('should generate task assignment email HTML with all required elements', async () => {
      mockStorage.getNotificationPreferences.mockResolvedValue({
        emailNotifications: true,
        newTaskAlerts: true,
        taskAssignments: true,
      });

      mockStorage.getTask.mockResolvedValue(createMockTask('project-1', 'assigner-id', {
        id: 1,
        title: 'HTML Test Task',
        description: 'Test description for HTML email',
        priority: 'high',
        dueDate: new Date('2024-12-31'),
      }));

      mockStorage.getProject.mockResolvedValue(createMockProject('creator-id', {
        id: 1,
        name: 'HTML Test Project',
      }));

      mockStorage.getUser.mockImplementation((userId: string) => {
        if (userId === 'assignee-id') {
          return Promise.resolve(createMockUser({
            id: 'assignee-id',
            email: 'assignee@example.com',
            firstName: 'John',
          }));
        }
        if (userId === 'assigner-id') {
          return Promise.resolve(createMockUser({
            id: 'assigner-id',
            firstName: 'Jane',
          }));
        }
        return Promise.resolve(null);
      });

      await taskNotificationService.notifyTaskAssignment(1, 'assignee-id', 'assigner-id');

      expect(mockSendMail).toHaveBeenCalled();
      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      // Check for essential HTML elements
      expect(htmlContent).toContain('New Task Assigned');
      expect(htmlContent).toContain('HTML Test Task');
      expect(htmlContent).toContain('HTML Test Project');
      expect(htmlContent).toContain('Hi John');
      expect(htmlContent).toContain('Jane');
      expect(htmlContent).toContain('Test description for HTML email');
      expect(htmlContent).toContain('high');
      expect(htmlContent).toContain('InboxLeap');
    });

    it('should generate task status change email HTML with all required elements', async () => {
      const mockTask = createMockTask('project-1', 'changer-id', {
        id: 1,
        title: 'HTML Status Change Task',
        projectId: 1,
      });

      const mockProject = createMockProject('creator-id', {
        id: 1,
        name: 'HTML Status Project',
      });

      const mockAssignee = createMockUser({
        id: 'assignee-id',
        email: 'assignee@example.com',
        firstName: 'John',
      });

      const mockChanger = createMockUser({
        id: 'changer-id',
        firstName: 'Jane',
      });

      mockStorage.getTask.mockResolvedValue(mockTask);
      mockStorage.getProject.mockResolvedValue(mockProject);
      mockStorage.getTasksWithAssignees.mockResolvedValue([{
        ...mockTask,
        assignees: [mockAssignee],
      }]);
      mockStorage.getUser.mockImplementation((userId: string) => {
        if (userId === 'assignee-id') return Promise.resolve(mockAssignee);
        if (userId === 'changer-id') return Promise.resolve(mockChanger);
        return Promise.resolve(null);
      });
      mockStorage.getNotificationPreferences.mockResolvedValue({
        emailNotifications: true,
        taskStatusChanges: true,
      });

      await taskNotificationService.notifyTaskStatusChange(1, 'pending', 'completed', 'changer-id');

      expect(mockSendMail).toHaveBeenCalled();
      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      // Check for essential HTML elements
      expect(htmlContent).toContain('Task Status Updated');
      expect(htmlContent).toContain('HTML Status Change Task');
      expect(htmlContent).toContain('HTML Status Project');
      expect(htmlContent).toContain('Hi John');
      expect(htmlContent).toContain('Jane');
      expect(htmlContent).toContain('pending');
      expect(htmlContent).toContain('completed');
      expect(htmlContent).toContain('InboxLeap');
    });
  });
});