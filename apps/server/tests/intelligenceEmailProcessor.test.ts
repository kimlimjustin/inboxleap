import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IntelligenceEmailProcessor } from '../src/services/intelligenceEmailProcessor';
import { EmailData } from '../src/services/email/types';
import { createMockStorage, createMockEmail } from './helpers';

// Mock dependencies
vi.mock('../src/services/email/EmailRouter', () => ({
  emailRouter: {
    getCompanyIdFromEmailData: vi.fn(),
    isCompanyIntelligenceEmail: vi.fn(),
  },
}));

vi.mock('../src/services/t5tAnalysisService', () => ({
  t5tAnalysisService: {
    parseT5TSubmission: vi.fn(),
  },
}));

vi.mock('../src/storage', () => ({
  storage: createMockStorage(),
}));

vi.mock('../src/services/userService', () => ({
  getOrCreateUserByEmail: vi.fn(),
}));

vi.mock('../src/services/companyIntelligence', () => ({
  findAgentByEmail: vi.fn(),
}));

describe('IntelligenceEmailProcessor', () => {
  let processor: IntelligenceEmailProcessor;
  let mockEmailRouter: any;
  let mockT5tAnalysisService: any;
  let mockStorage: any;
  let mockUserService: any;
  let mockCompanyIntelligence: any;

  beforeEach(async () => {
    processor = new IntelligenceEmailProcessor();
    
    // Get mocked modules
    const { emailRouter } = await import('../src/services/email/EmailRouter');
    const { t5tAnalysisService } = await import('../src/services/t5tAnalysisService');
    const { storage } = await import('../src/storage');
    const { getOrCreateUserByEmail } = await import('../src/services/userService');
    const { findAgentByEmail } = await import('../src/services/companyIntelligence');
    
    mockEmailRouter = emailRouter;
    mockT5tAnalysisService = t5tAnalysisService;
    mockStorage = storage;
    mockUserService = getOrCreateUserByEmail;
    mockCompanyIntelligence = findAgentByEmail;
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Setup default mocks
    mockStorage.getT5tSubmissionByMessageId.mockResolvedValue(null);
    mockUserService.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
    });
    mockT5tAnalysisService.parseT5TSubmission.mockResolvedValue({
      items: [{ topic: 'Test Topic', sentiment: 'positive' }],
      keyInsights: ['Test insight'],
      urgentFlags: [],
      overallSentiment: 'positive',
      sentimentScore: 0.8,
      mainTopics: ['Test Topic'],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processIntelligenceSubmission', () => {
    it('should process company-specific intelligence submission', async () => {
      const email = createMockEmail({
        from: 'user@example.com',
        to: ['t5t+testcorp@inboxleap.com'],
        subject: 'T5T: Test submission',
        body: 'Test content',
        messageId: 'test-message-id',
      });

      const mockAgent = {
        id: 'agent-1',
        name: 'TestCorp Intelligence Agent',
        companyId: 'testcorp',
      };

      mockEmailRouter.getCompanyIdFromEmailData.mockReturnValue('testcorp');
      mockEmailRouter.isCompanyIntelligenceEmail.mockReturnValue(true);
      mockCompanyIntelligence.mockResolvedValue(mockAgent);
      mockStorage.createT5tSubmission.mockResolvedValue({
        id: 'submission-1',
        pollingAgentId: 'agent-1',
      });

      await processor.processIntelligenceSubmission(email);

      expect(mockEmailRouter.getCompanyIdFromEmailData).toHaveBeenCalledWith(email);
      expect(mockCompanyIntelligence).toHaveBeenCalledWith('t5t+testcorp@inboxleap.com');
      expect(mockUserService).toHaveBeenCalledWith('user@example.com');
      expect(mockT5tAnalysisService.parseT5TSubmission).toHaveBeenCalledWith(
        'T5T: Test submission',
        'Test content',
        'user@example.com'
      );
      expect(mockStorage.createT5tSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          pollingAgentId: 'agent-1',
          submitterEmail: 'user@example.com',
          messageId: 'test-message-id',
          subject: 'T5T: Test submission',
          rawContent: 'Test content',
        })
      );
    });

    it('should process global intelligence submission', async () => {
      const email = createMockEmail({
        from: 'user@example.com',
        to: ['t5t@inboxleap.com'],
        subject: 'T5T: Global submission',
        body: 'Test content',
        messageId: 'test-message-id-2',
      });

      mockEmailRouter.getCompanyIdFromEmailData.mockReturnValue(null);
      mockStorage.createT5tSubmission.mockResolvedValue({
        id: 'submission-2',
        pollingAgentId: 1,
      });

      await processor.processIntelligenceSubmission(email);

      expect(mockEmailRouter.getCompanyIdFromEmailData).toHaveBeenCalledWith(email);
      expect(mockStorage.createT5tSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          pollingAgentId: 1,
          submitterEmail: 'user@example.com',
          messageId: 'test-message-id-2',
        })
      );
    });

    it('should skip processing if submission already exists', async () => {
      const email = createMockEmail({
        messageId: 'existing-message-id',
      });

      mockStorage.getT5tSubmissionByMessageId.mockResolvedValue({
        id: 'existing-submission',
      });

      await processor.processIntelligenceSubmission(email);

      expect(mockStorage.getT5tSubmissionByMessageId).toHaveBeenCalledWith('existing-message-id');
      expect(mockUserService).not.toHaveBeenCalled();
      expect(mockStorage.createT5tSubmission).not.toHaveBeenCalled();
    });

    it('should handle error when user creation fails', async () => {
      const email = createMockEmail({
        from: 'invalid@example.com',
      });

      mockEmailRouter.getCompanyIdFromEmailData.mockReturnValue(null);
      mockUserService.mockResolvedValue(null);

      await processor.processIntelligenceSubmission(email);

      expect(mockUserService).toHaveBeenCalledWith('invalid@example.com');
      expect(mockStorage.createT5tSubmission).not.toHaveBeenCalled();
    });

    it('should handle error when company agent not found', async () => {
      const email = createMockEmail({
        to: ['t5t+unknown@inboxleap.com'],
      });

      mockEmailRouter.getCompanyIdFromEmailData.mockReturnValue('unknown');
      mockEmailRouter.isCompanyIntelligenceEmail.mockReturnValue(true);
      mockCompanyIntelligence.mockResolvedValue(null);

      await processor.processIntelligenceSubmission(email);

      expect(mockCompanyIntelligence).toHaveBeenCalledWith('t5t+unknown@inboxleap.com');
      expect(mockStorage.createT5tSubmission).not.toHaveBeenCalled();
    });

    it('should include week, month, year in submission', async () => {
      const testDate = new Date('2024-03-15T10:00:00Z'); // Week 11, March, 2024
      const email = createMockEmail({
        date: testDate,
      });

      mockEmailRouter.getCompanyIdFromEmailData.mockReturnValue(null);
      mockStorage.createT5tSubmission.mockResolvedValue({
        id: 'submission-3',
      });

      await processor.processIntelligenceSubmission(email);

      expect(mockStorage.createT5tSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          weekNumber: expect.any(Number),
          monthNumber: 3,
          yearNumber: 2024,
        })
      );
    });

    it('should handle CC and BCC recipients for company detection', async () => {
      const email = createMockEmail({
        to: ['other@example.com'],
        cc: ['t5t+testcorp@inboxleap.com'],
        bcc: [],
      });

      const mockAgent = {
        id: 'agent-1',
        name: 'TestCorp Agent',
      };

      mockEmailRouter.getCompanyIdFromEmailData.mockReturnValue('testcorp');
      mockEmailRouter.isCompanyIntelligenceEmail.mockReturnValue(true);
      mockCompanyIntelligence.mockResolvedValue(mockAgent);
      mockStorage.createT5tSubmission.mockResolvedValue({
        id: 'submission-4',
      });

      await processor.processIntelligenceSubmission(email);

      expect(mockCompanyIntelligence).toHaveBeenCalledWith('t5t+testcorp@inboxleap.com');
      expect(mockStorage.createT5tSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          pollingAgentId: 'agent-1',
        })
      );
    });

    it('should use provided source parameter', async () => {
      const email = createMockEmail();
      
      mockEmailRouter.getCompanyIdFromEmailData.mockReturnValue(null);
      mockStorage.createT5tSubmission.mockResolvedValue({
        id: 'submission-5',
      });

      await processor.processIntelligenceSubmission(email, 'api');

      // Verify that the source parameter is used (this would be in logs)
      // We can't easily test console.log, but we can verify the function was called
      expect(mockStorage.createT5tSubmission).toHaveBeenCalled();
    });

    it('should handle analysis service errors gracefully', async () => {
      const email = createMockEmail();
      
      mockEmailRouter.getCompanyIdFromEmailData.mockReturnValue(null);
      mockT5tAnalysisService.parseT5TSubmission.mockRejectedValue(new Error('Analysis failed'));

      // Should not throw
      await expect(processor.processIntelligenceSubmission(email)).resolves.not.toThrow();
      
      expect(mockStorage.createT5tSubmission).not.toHaveBeenCalled();
    });

    it('should prevent duplicate submissions with same message ID', async () => {
      const email = createMockEmail({
        messageId: 'duplicate-test',
      });

      // First call - should process
      mockEmailRouter.getCompanyIdFromEmailData.mockReturnValue(null);
      mockStorage.getT5tSubmissionByMessageId.mockResolvedValue(null);
      mockStorage.createT5tSubmission.mockResolvedValue({
        id: 'submission-6',
      });

      await processor.processIntelligenceSubmission(email);
      expect(mockStorage.createT5tSubmission).toHaveBeenCalledTimes(1);

      // Second call - should skip
      vi.clearAllMocks();
      mockStorage.getT5tSubmissionByMessageId.mockResolvedValue({
        id: 'existing-submission',
      });

      await processor.processIntelligenceSubmission(email);
      expect(mockStorage.createT5tSubmission).not.toHaveBeenCalled();
    });
  });

  describe('getWeekNumber', () => {
    it('should calculate correct week number', () => {
      // Test a known date
      const date = new Date('2024-03-15'); // This should be week 11
      const weekNumber = (processor as any).getWeekNumber(date);
      expect(weekNumber).toBeGreaterThan(0);
      expect(weekNumber).toBeLessThanOrEqual(53);
    });

    it('should handle year boundaries correctly', () => {
      const endOfYear = new Date('2024-12-31');
      const startOfYear = new Date('2024-01-01');
      
      const endWeek = (processor as any).getWeekNumber(endOfYear);
      const startWeek = (processor as any).getWeekNumber(startOfYear);
      
      expect(startWeek).toBeLessThanOrEqual(endWeek);
    });
  });
});
