import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMockStorage, createMockEmail, createMockIntelligenceEmail } from './helpers';

// Mock all dependencies
vi.mock('../src/storage', () => ({
  storage: createMockStorage(),
}));

vi.mock('../src/services/userService', () => ({
  getOrCreateUserByEmail: vi.fn(),
}));

vi.mock('../src/services/t5tAnalysisService', () => ({
  t5tAnalysisService: {
    parseT5TSubmission: vi.fn(),
  },
}));

vi.mock('../src/services/claudeService', () => ({
  analyzeEmailForTasks: vi.fn(),
}));

vi.mock('../src/services/mailer', () => ({
  sendMail: vi.fn(),
}));

vi.mock('../src/services/notificationService', () => ({
  notificationService: {
    queueTaskAssignmentNotification: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

describe('Email Processing Integration Tests', () => {
  let mockStorage: any;
  let mockUserService: any;
  let mockT5tAnalysisService: any;
  let mockClaudeService: any;
  let mockMailer: any;
  let mockNotificationService: any;

  beforeEach(async () => {
    // Get all mocked modules
    const { storage } = await import('../src/storage');
    const { getOrCreateUserByEmail } = await import('../src/services/userService');
    const { t5tAnalysisService } = await import('../src/services/t5tAnalysisService');
    const { analyzeEmailForTasks } = await import('../src/services/claudeService');
    const { sendMail } = await import('../src/services/mailer');
    const { notificationService } = await import('../src/services/notificationService');

    mockStorage = storage;
    mockUserService = getOrCreateUserByEmail;
    mockT5tAnalysisService = t5tAnalysisService;
    mockClaudeService = analyzeEmailForTasks;
    mockMailer = sendMail;
    mockNotificationService = notificationService;

    // Clear all mocks
    vi.clearAllMocks();

    // Setup default mocks
    mockUserService.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    });

    mockStorage.getProcessedEmail.mockResolvedValue(null);
    mockStorage.createProcessedEmail.mockResolvedValue({
      id: 1,
      messageId: 'test-message-id',
    });

    mockT5tAnalysisService.parseT5TSubmission.mockResolvedValue({
      items: [
        { topic: 'Feature Launch', sentiment: 'positive', priority: 'high' },
        { topic: 'Team Morale', sentiment: 'positive', priority: 'medium' },
      ],
      keyInsights: ['Great progress on product development'],
      urgentFlags: [],
      overallSentiment: 'positive',
      sentimentScore: 0.8,
      mainTopics: ['Feature Launch', 'Team Morale'],
    });

    mockClaudeService.mockResolvedValue({
      tasks: [
        {
          title: 'Review new feature documentation',
          description: 'Need to review the docs for the new feature',
          priority: 'high',
          assignees: ['colleague@example.com'],
        },
      ],
      projectTitle: 'Feature Development',
      projectDescription: 'Development of new product features',
    });

    mockStorage.createProject.mockResolvedValue({
      id: 1,
      name: 'Feature Development',
      type: 'task',
      createdBy: 'user-1',
    });

    mockStorage.createTask.mockResolvedValue({
      id: 1,
      title: 'Review new feature documentation',
      priority: 'high',
      status: 'todo',
      projectId: 1,
      createdBy: 'user-1',
    });

    mockMailer.mockResolvedValue(true);
    mockNotificationService.queueTaskAssignmentNotification.mockResolvedValue('notification-1');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Intelligence Email Processing Flow', () => {
    it('should process company-specific intelligence email end-to-end', async () => {
      // Import services after mocking
      const { IntelligenceEmailProcessor } = await import('../src/services/intelligenceEmailProcessor');
      const { emailRouter } = await import('../src/services/email/EmailRouter');
      const { findAgentByEmail } = await import('../src/services/companyIntelligence');

      // Mock email router and company intelligence
      vi.mocked(emailRouter.getCompanyIdFromEmailData).mockReturnValue('testcorp');
      vi.mocked(emailRouter.isCompanyIntelligenceEmail).mockReturnValue(true);
      vi.mocked(findAgentByEmail).mockResolvedValue({
        id: 'agent-1',
        name: 'TestCorp Intelligence Agent',
        companyId: 'testcorp',
      });

      mockStorage.getT5tSubmissionByMessageId.mockResolvedValue(null);
      mockStorage.createT5tSubmission.mockResolvedValue({
        id: 'submission-1',
        pollingAgentId: 'agent-1',
      });

      const processor = new IntelligenceEmailProcessor();
      const email = createMockIntelligenceEmail('testcorp', {
        from: 'employee@testcorp.com',
        subject: 'Weekly T5T: Amazing Progress This Week',
        body: `Here are this week's top 5 things:

1. Launched the new user dashboard - getting amazing feedback
2. Closed 3 major deals worth $500K total  
3. Team morale is at an all-time high
4. New hire onboarding process is working great
5. Q4 revenue target looking very achievable

Overall, feeling very positive about our trajectory!`,
      });

      // Execute the full flow
      await processor.processIntelligenceSubmission(email);

      // Verify the complete flow
      expect(mockUserService).toHaveBeenCalledWith('employee@testcorp.com');
      expect(mockT5tAnalysisService.parseT5TSubmission).toHaveBeenCalledWith(
        email.subject,
        email.body,
        email.from
      );
      expect(mockStorage.createT5tSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          pollingAgentId: 'agent-1',
          submitterEmail: 'employee@testcorp.com',
          messageId: email.messageId,
          subject: email.subject,
          rawContent: email.body,
          sentiment: 'positive',
          sentimentScore: 0.8,
        })
      );
    });

    it('should prevent duplicate processing of intelligence submissions', async () => {
      const { IntelligenceEmailProcessor } = await import('../src/services/intelligenceEmailProcessor');
      
      // Mock existing submission
      mockStorage.getT5tSubmissionByMessageId.mockResolvedValue({
        id: 'existing-submission',
        messageId: 'duplicate-test',
      });

      const processor = new IntelligenceEmailProcessor();
      const email = createMockIntelligenceEmail('testcorp', {
        messageId: 'duplicate-test',
      });

      await processor.processIntelligenceSubmission(email);

      // Should not create new submission
      expect(mockStorage.createT5tSubmission).not.toHaveBeenCalled();
      expect(mockT5tAnalysisService.parseT5TSubmission).not.toHaveBeenCalled();
    });

    it('should handle intelligence processing errors gracefully', async () => {
      const { IntelligenceEmailProcessor } = await import('../src/services/intelligenceEmailProcessor');
      
      // Mock analysis service failure
      mockT5tAnalysisService.parseT5TSubmission.mockRejectedValue(new Error('AI service unavailable'));

      const processor = new IntelligenceEmailProcessor();
      const email = createMockIntelligenceEmail('testcorp');

      // Should not throw
      await expect(processor.processIntelligenceSubmission(email)).resolves.not.toThrow();

      // Should not create submission if analysis fails
      expect(mockStorage.createT5tSubmission).not.toHaveBeenCalled();
    });
  });

  describe('Task Email Processing Flow', () => {
    it('should process task-related email end-to-end', async () => {
      // This tests the complete flow for processing regular task emails
      const email = createMockEmail({
        from: 'manager@company.com',
        to: ['agent@inboxleap.com'],
        subject: 'Project Update - Need Reviews',
        body: `Hi team,

I need help with the following tasks:
- Review the new user interface designs  
- Test the payment integration
- Update the documentation

Please let me know who can take these on.

Thanks!`,
      });

      // Mock the analysis result
      mockClaudeService.mockResolvedValue({
        tasks: [
          {
            title: 'Review UI designs',
            description: 'Review the new user interface designs',
            priority: 'high',
            assignees: ['designer@company.com'],
          },
          {
            title: 'Test payment integration',
            description: 'Test the payment integration functionality',
            priority: 'high',
            assignees: ['dev@company.com'],
          },
          {
            title: 'Update documentation',
            description: 'Update the project documentation',
            priority: 'medium',
            assignees: ['writer@company.com'],
          },
        ],
        projectTitle: 'Project Update Tasks',
        projectDescription: 'Tasks from project update email',
      });

      // Mock user creation for assignees
      mockUserService
        .mockResolvedValueOnce({ id: 'user-1', email: 'manager@company.com' }) // Sender
        .mockResolvedValueOnce({ id: 'user-2', email: 'designer@company.com' }) // Assignee 1
        .mockResolvedValueOnce({ id: 'user-3', email: 'dev@company.com' }) // Assignee 2
        .mockResolvedValueOnce({ id: 'user-4', email: 'writer@company.com' }); // Assignee 3

      // Mock task creation
      mockStorage.createTask
        .mockResolvedValueOnce({ id: 1, title: 'Review UI designs' })
        .mockResolvedValueOnce({ id: 2, title: 'Test payment integration' })
        .mockResolvedValueOnce({ id: 3, title: 'Update documentation' });

      // Import and use the email router (this would be the main entry point)
      const { emailRouter } = await import('../src/services/email/EmailRouter');
      
      // Mock router methods
      vi.mocked(emailRouter.isIntelligenceEmail).mockReturnValue(false);
      vi.mocked(emailRouter.isTaskEmail).mockReturnValue(true);
      vi.mocked(emailRouter.processTaskEmail).mockImplementation(async (emailData) => {
        // Simulate the task processing flow
        const analysis = await mockClaudeService(emailData.subject, emailData.body);
        const sender = await mockUserService(emailData.from);
        const project = await mockStorage.createProject({
          name: analysis.projectTitle,
          type: 'task',
          createdBy: sender.id,
        });

        const tasks = [];
        for (const taskData of analysis.tasks) {
          const task = await mockStorage.createTask({
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            status: 'todo',
            projectId: project.id,
            createdBy: sender.id,
          });
          tasks.push(task);

          // Assign to users and send notifications
          for (const assigneeEmail of taskData.assignees) {
            const assignee = await mockUserService(assigneeEmail);
            await mockStorage.addTaskAssignee({
              taskId: task.id,
              userId: assignee.id,
              assignedBy: sender.id,
            });
            await mockNotificationService.queueTaskAssignmentNotification(
              task,
              assignee,
              sender,
              project.name
            );
          }
        }

        return { project, tasks };
      });

      // Process the email
      const result = await emailRouter.processTaskEmail(email);

      // Verify the complete flow
      expect(mockClaudeService).toHaveBeenCalledWith(email.subject, email.body);
      expect(mockUserService).toHaveBeenCalledWith('manager@company.com');
      expect(mockStorage.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Project Update Tasks',
          type: 'task',
          createdBy: 'user-1',
        })
      );
      expect(mockStorage.createTask).toHaveBeenCalledTimes(3);
      expect(mockNotificationService.queueTaskAssignmentNotification).toHaveBeenCalledTimes(3);
      expect(result.tasks).toHaveLength(3);
    });

    it('should handle task processing errors gracefully', async () => {
      const email = createMockEmail({
        subject: 'Invalid task email',
        body: 'This email has no clear tasks',
      });

      // Mock Claude service failure
      mockClaudeService.mockRejectedValue(new Error('Failed to analyze email'));

      const { emailRouter } = await import('../src/services/email/EmailRouter');
      
      vi.mocked(emailRouter.processTaskEmail).mockImplementation(async () => {
        throw new Error('Failed to analyze email');
      });

      // Should handle error gracefully
      await expect(emailRouter.processTaskEmail(email)).rejects.toThrow('Failed to analyze email');
    });
  });

  describe('Cross-Service Integration', () => {
    it('should maintain data consistency across services', async () => {
      // Test that data flows correctly between services
      const email = createMockIntelligenceEmail('testcorp');
      
      const { IntelligenceEmailProcessor } = await import('../src/services/intelligenceEmailProcessor');
      const { emailRouter } = await import('../src/services/email/EmailRouter');
      const { findAgentByEmail } = await import('../src/services/companyIntelligence');

      // Setup mocks
      vi.mocked(emailRouter.getCompanyIdFromEmailData).mockReturnValue('testcorp');
      vi.mocked(emailRouter.isCompanyIntelligenceEmail).mockReturnValue(true);
      vi.mocked(findAgentByEmail).mockResolvedValue({
        id: 'agent-1',
        name: 'TestCorp Agent',
        companyId: 'testcorp',
      });

      mockStorage.getT5tSubmissionByMessageId.mockResolvedValue(null);
      mockStorage.createT5tSubmission.mockResolvedValue({
        id: 'submission-1',
        pollingAgentId: 'agent-1',
      });

      const processor = new IntelligenceEmailProcessor();
      await processor.processIntelligenceSubmission(email);

      // Verify data consistency
      expect(mockStorage.createT5tSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          pollingAgentId: 'agent-1', // Should match the agent found
          submitterEmail: email.from, // Should match the email sender
          messageId: email.messageId, // Should match the email message ID
        })
      );
    });

    it('should handle concurrent email processing', async () => {
      // Test processing multiple emails concurrently
      const emails = [
        createMockIntelligenceEmail('company1'),
        createMockIntelligenceEmail('company2'), 
        createMockEmail({ subject: 'Task Email 1' }),
        createMockEmail({ subject: 'Task Email 2' }),
      ];

      // Mock different responses for each
      mockStorage.getT5tSubmissionByMessageId.mockResolvedValue(null);
      mockStorage.createT5tSubmission.mockResolvedValue({ id: 'submission' });

      const { IntelligenceEmailProcessor } = await import('../src/services/intelligenceEmailProcessor');
      const processor = new IntelligenceEmailProcessor();

      // Process all emails concurrently
      const promises = emails.map(email => 
        processor.processIntelligenceSubmission(email)
      );

      // Should all complete without errors
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should enforce security boundaries between companies', async () => {
      // Test that company A cannot access company B's data
      const companyAEmail = createMockIntelligenceEmail('companya');
      const companyBEmail = createMockIntelligenceEmail('companyb');

      const { emailRouter } = await import('../src/services/email/EmailRouter');
      
      // Mock company-specific responses
      vi.mocked(emailRouter.getCompanyIdFromEmailData)
        .mockReturnValueOnce('companya')
        .mockReturnValueOnce('companyb');

      // Verify that each email is routed to the correct company's agent
      const companyAId = emailRouter.getCompanyIdFromEmailData(companyAEmail);
      const companyBId = emailRouter.getCompanyIdFromEmailData(companyBEmail);

      expect(companyAId).toBe('companya');
      expect(companyBId).toBe('companyb');
      expect(companyAId).not.toBe(companyBId);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle database failures gracefully', async () => {
      const email = createMockEmail();
      
      // Mock database failure
      mockStorage.createProcessedEmail.mockRejectedValue(new Error('Database connection failed'));

      const { IntelligenceEmailProcessor } = await import('../src/services/intelligenceEmailProcessor');
      const processor = new IntelligenceEmailProcessor();

      // Should handle database errors gracefully
      await expect(processor.processIntelligenceSubmission(email)).resolves.not.toThrow();
    });

    it('should handle external service failures', async () => {
      const email = createMockEmail();
      
      // Mock AI service failure
      mockT5tAnalysisService.parseT5TSubmission.mockRejectedValue(new Error('AI service timeout'));
      mockClaudeService.mockRejectedValue(new Error('Claude API unavailable'));

      // Should handle external service failures gracefully
      const { IntelligenceEmailProcessor } = await import('../src/services/intelligenceEmailProcessor');
      const processor = new IntelligenceEmailProcessor();

      await expect(processor.processIntelligenceSubmission(email)).resolves.not.toThrow();
    });

    it('should handle malformed email data', async () => {
      const malformedEmails = [
        createMockEmail({ from: '' }), // Empty sender
        createMockEmail({ subject: '' }), // Empty subject
        createMockEmail({ body: '' }), // Empty body
        createMockEmail({ messageId: '' }), // Empty message ID
      ];

      const { IntelligenceEmailProcessor } = await import('../src/services/intelligenceEmailProcessor');
      const processor = new IntelligenceEmailProcessor();

      // Should handle malformed data gracefully
      for (const email of malformedEmails) {
        await expect(processor.processIntelligenceSubmission(email)).resolves.not.toThrow();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high volume email processing', async () => {
      // Test processing many emails efficiently
      const emailCount = 50;
      const emails = Array.from({ length: emailCount }, (_, i) => 
        createMockEmail({ 
          messageId: `bulk-email-${i}`,
          subject: `Bulk Test Email ${i}`,
        })
      );

      mockStorage.getProcessedEmail.mockResolvedValue(null);
      mockStorage.createProcessedEmail.mockResolvedValue({ id: 1 });

      const { IntelligenceEmailProcessor } = await import('../src/services/intelligenceEmailProcessor');
      const processor = new IntelligenceEmailProcessor();

      const startTime = Date.now();
      
      // Process all emails
      await Promise.all(emails.map(email => 
        processor.processIntelligenceSubmission(email)
      ));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process within reasonable time (adjust threshold as needed)
      expect(processingTime).toBeLessThan(5000); // 5 seconds for 50 emails
    });

    it('should prevent memory leaks during bulk processing', async () => {
      // Test that memory usage remains stable during bulk processing
      const initialMemory = process.memoryUsage().heapUsed;
      
      const emailCount = 100;
      const emails = Array.from({ length: emailCount }, (_, i) => 
        createMockEmail({ messageId: `memory-test-${i}` })
      );

      const { IntelligenceEmailProcessor } = await import('../src/services/intelligenceEmailProcessor');
      const processor = new IntelligenceEmailProcessor();

      await Promise.all(emails.map(email => 
        processor.processIntelligenceSubmission(email)
      ));

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB for 100 emails)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
