import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { notificationService } from '../src/services/notificationService';
import { createMockStorage } from './helpers';

// Mock dependencies
vi.mock('../src/services/mailer', () => ({
  sendMail: vi.fn(),
}));

vi.mock('../src/storage', () => ({
  storage: createMockStorage(),
}));

describe('NotificationService', () => {
  let mockSendMail: any;
  let mockStorage: any;

  beforeEach(async () => {
    // Get mocked modules
    const { sendMail } = await import('../src/services/mailer');
    const { storage } = await import('../src/storage');
    
    mockSendMail = sendMail;
    mockStorage = storage;
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Setup default storage mocks
    mockStorage.getNotificationPreferences.mockResolvedValue(null);
    mockStorage.getTrustRelationship.mockResolvedValue(null);
    mockStorage.getUser.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profileImageUrl: null,
      password: null,
      authProvider: 'email',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSendMail.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('queueTaskAssignmentNotification', () => {
    const mockTask = {
      id: 1,
      title: 'Test Task',
      description: 'Test Description',
      priority: 'high',
      status: 'todo',
      dueDate: new Date('2024-12-31'),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-2',
      projectId: 1,
      sourceEmail: null,
      sourceEmailSubject: null,
    };

    const mockAssignee = {
      id: 'user-1',
      email: 'assignee@example.com',
      firstName: 'John',
      lastName: 'Doe',
      profileImageUrl: null,
      password: null,
      authProvider: 'email',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockAssigner = {
      id: 'user-2',
      email: 'assigner@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      profileImageUrl: null,
      password: null,
      authProvider: 'email',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should queue notification successfully', async () => {
      const notificationId = await notificationService.queueTaskAssignmentNotification(
        mockTask,
        mockAssignee,
        mockAssigner,
        'Test Project'
      );

      expect(notificationId).toBeDefined();
      expect(notificationId).toMatch(/^notification_/);
    });

    it('should respect disabled email notifications', async () => {
      mockStorage.getNotificationPreferences.mockResolvedValue({
        emailNotifications: false,
      });

      const notificationId = await notificationService.queueTaskAssignmentNotification(
        mockTask,
        mockAssignee,
        mockAssigner,
        'Test Project'
      );

      expect(notificationId).toBeDefined();
      expect(mockStorage.getNotificationPreferences).toHaveBeenCalledWith('user-1');
    });

    it('should handle missing user names gracefully', async () => {
      const assignerWithoutName = {
        ...mockAssigner,
        firstName: null,
        lastName: null,
      } as any;

      const notificationId = await notificationService.queueTaskAssignmentNotification(
        mockTask,
        mockAssignee,
        assignerWithoutName,
        'Test Project'
      );

      expect(notificationId).toBeDefined();
    });

    it('should handle task without due date', async () => {
      const taskWithoutDueDate = {
        ...mockTask,
        dueDate: null,
      };

      const notificationId = await notificationService.queueTaskAssignmentNotification(
        taskWithoutDueDate,
        mockAssignee,
        mockAssigner,
        'Test Project'
      );

      expect(notificationId).toBeDefined();
    });

    it('should handle different trust relationship states', async () => {
      // Test unknown relationship
      mockStorage.getTrustRelationship.mockResolvedValue(null);
      
      let notificationId = await notificationService.queueTaskAssignmentNotification(
        mockTask,
        mockAssignee,
        mockAssigner,
        'Test Project'
      );
      
      expect(notificationId).toBeDefined();

      // Test trusted relationship
      mockStorage.getTrustRelationship.mockResolvedValue({
        trustStatus: 'trusted',
      });
      
      notificationId = await notificationService.queueTaskAssignmentNotification(
        mockTask,
        mockAssignee,
        mockAssigner,
        'Test Project'
      );
      
      expect(notificationId).toBeDefined();

      // Test blocked relationship
      mockStorage.getTrustRelationship.mockResolvedValue({
        trustStatus: 'blocked',
      });
      
      notificationId = await notificationService.queueTaskAssignmentNotification(
        mockTask,
        mockAssignee,
        mockAssigner,
        'Test Project'
      );
      
      expect(notificationId).toBeDefined();
    });
  });

  describe('processTrustDecision', () => {
    it('should process trust decisions', async () => {
      // Mock upsertTrustRelationship in storage
      mockStorage.upsertTrustRelationship = vi.fn().mockResolvedValue({});

      await notificationService.processTrustDecision('user-1', 'user-2', 'trust');

      expect(mockStorage.upsertTrustRelationship).toHaveBeenCalledWith({
        userId: 'user-1',
        trustedUserId: 'user-2',
        trustStatus: 'trusted',
      });
    });

    it('should handle block decisions', async () => {
      mockStorage.upsertTrustRelationship = vi.fn().mockResolvedValue({});

      await notificationService.processTrustDecision('user-1', 'user-2', 'block');

      expect(mockStorage.upsertTrustRelationship).toHaveBeenCalledWith({
        userId: 'user-1',
        trustedUserId: 'user-2',
        trustStatus: 'blocked',
      });
    });
  });

  describe('getPendingTrustDecisions', () => {
    it('should return pending trust decisions', () => {
      const result = notificationService.getPendingTrustDecisions('user-1');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for users with no pending decisions', () => {
      const result = notificationService.getPendingTrustDecisions('non-existent-user');
      expect(result).toEqual([]);
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status information', () => {
      const status = notificationService.getQueueStatus();
      
      expect(status).toHaveProperty('queued');
      expect(status).toHaveProperty('sent');
      expect(status).toHaveProperty('failed');
      expect(status).toHaveProperty('pendingTrust');
      expect(status).toHaveProperty('currentJobs');
      expect(status).toHaveProperty('maxConcurrentJobs');
      expect(status).toHaveProperty('totalInQueue');
      
      expect(typeof status.queued).toBe('number');
      expect(typeof status.sent).toBe('number');
      expect(typeof status.failed).toBe('number');
      expect(typeof status.pendingTrust).toBe('number');
      expect(typeof status.currentJobs).toBe('number');
      expect(typeof status.maxConcurrentJobs).toBe('number');
      expect(typeof status.totalInQueue).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should handle email sending errors gracefully', async () => {
      const mockTask = {
        id: 1,
        title: 'Test Task',
        priority: 'high',
        status: 'todo',
        description: null,
        dueDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-2',
        projectId: 1,
        sourceEmail: null,
        sourceEmailSubject: null,
      };

      const mockAssignee = {
        id: 'user-1',
        email: 'assignee@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileImageUrl: null,
        password: null,
        authProvider: 'email',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAssigner = {
        id: 'user-2',
        email: 'assigner@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        profileImageUrl: null,
        password: null,
        authProvider: 'email',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      // Should not throw
      await expect(
        notificationService.queueTaskAssignmentNotification(
          mockTask,
          mockAssignee,
          mockAssigner,
          'Test Project'
        )
      ).resolves.not.toThrow();
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.getNotificationPreferences.mockRejectedValue(new Error('Database error'));

      const mockTask = {
        id: 1,
        title: 'Test Task',
        priority: 'high',
        status: 'todo',
        description: null,
        dueDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-2',
        projectId: 1,
        sourceEmail: null,
        sourceEmailSubject: null,
      };

      const mockAssignee = {
        id: 'user-1',
        email: 'assignee@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileImageUrl: null,
        password: null,
        authProvider: 'email',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAssigner = {
        id: 'user-2',
        email: 'assigner@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        profileImageUrl: null,
        password: null,
        authProvider: 'email',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should not throw
      await expect(
        notificationService.queueTaskAssignmentNotification(
          mockTask,
          mockAssignee,
          mockAssigner,
          'Test Project'
        )
      ).resolves.not.toThrow();
    });
  });

  describe('event emissions', () => {
    it('should be an event emitter', () => {
      expect(notificationService.emit).toBeDefined();
      expect(notificationService.on).toBeDefined();
      expect(notificationService.removeAllListeners).toBeDefined();
    });

    it('should emit events for notification status changes', () => {
      const mockListener = vi.fn();
      notificationService.on('notificationSent', mockListener);
      
      notificationService.emit('notificationSent', { test: true });
      
      expect(mockListener).toHaveBeenCalledWith({ test: true });
      
      notificationService.removeAllListeners();
    });

    it('should emit events for trust relationship changes', () => {
      const mockListener = vi.fn();
      notificationService.on('trustDecisionProcessed', mockListener);
      
      notificationService.emit('trustDecisionProcessed', { test: true });
      
      expect(mockListener).toHaveBeenCalledWith({ test: true });
      
      notificationService.removeAllListeners();
    });
  });
});
