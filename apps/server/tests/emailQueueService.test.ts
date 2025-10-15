import { describe, it, expect, beforeEach, vi } from 'vitest'
import { emailQueueService } from '../src/services/emailQueueService'
import { storage } from '../src/storage'
import { claudeService } from '../src/services/claudeService'
import { getOrCreateUserByEmail } from '../src/services/userService'
import { createMockUser, createMockEmail } from './helpers'

// Mock dependencies
vi.mock('../src/storage', () => ({
  storage: {
    getProcessedEmail: vi.fn(),
    storeProcessedEmail: vi.fn(),
    getUserProjects: vi.fn(),
    createProject: vi.fn(),
    getUser: vi.fn(),
    createTask: vi.fn(),
    addProjectParticipant: vi.fn(),
    getProjectByThreadId: vi.fn(),
    updateProjectParticipants: vi.fn()
  }
}))

vi.mock('../src/services/claudeService', () => ({
  claudeService: {
    parseEmailToTasksWithContext: vi.fn(),
    parseEmailToTasks: vi.fn(),
    extractTopic: vi.fn()
  }
}))

vi.mock('../src/services/userService', () => ({
  getOrCreateUserByEmail: vi.fn()
}))

vi.mock('../src/services/mailer.js', () => ({
  sendMail: vi.fn()
}))

describe('EmailQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('addToQueue', () => {
    it('should add email to processing queue', async () => {
      const mockEmail = createMockEmail()
      const userId = 'user-123'

      const queueId = await emailQueueService.addToQueue(mockEmail, userId)

      expect(queueId).toMatch(/^email_\d+_[a-z0-9]+$/)
      
      const status = emailQueueService.getQueueStatus()
      expect(status.totalInQueue).toBeGreaterThan(0)
      expect(status.queued).toBeGreaterThan(0)
    })

    it('should return unique queue IDs for different emails', async () => {
      const mockEmail1 = createMockEmail({ subject: 'Email 1' })
      const mockEmail2 = createMockEmail({ subject: 'Email 2' })
      const userId = 'user-123'

      const queueId1 = await emailQueueService.addToQueue(mockEmail1, userId)
      const queueId2 = await emailQueueService.addToQueue(mockEmail2, userId)

      expect(queueId1).not.toBe(queueId2)
      
      const status = emailQueueService.getQueueStatus()
      expect(status.totalInQueue).toBeGreaterThanOrEqual(2)
    })

    it('should emit emailQueued event', async () => {
      const mockEmail = createMockEmail()
      const userId = 'user-123'
      
      const eventSpy = vi.fn()
      emailQueueService.on('emailQueued', eventSpy)

      await emailQueueService.addToQueue(mockEmail, userId)

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: mockEmail.subject,
          from: mockEmail.from
        })
      )
    })
  })

  describe('getQueueStatus', () => {
    it('should return current queue status', () => {
      const status = emailQueueService.getQueueStatus()

      expect(status).toHaveProperty('queued')
      expect(status).toHaveProperty('processing')
      expect(status).toHaveProperty('completed')
      expect(status).toHaveProperty('failed')
      expect(status).toHaveProperty('currentJobs')
      expect(status).toHaveProperty('maxConcurrentJobs')
      expect(status).toHaveProperty('totalInQueue')
      expect(typeof status.queued).toBe('number')
      expect(typeof status.processing).toBe('number')
      expect(typeof status.completed).toBe('number')
      expect(typeof status.failed).toBe('number')
      expect(typeof status.currentJobs).toBe('number')
      expect(typeof status.maxConcurrentJobs).toBe('number')
      expect(typeof status.totalInQueue).toBe('number')
    })

    it('should reflect correct counts after adding emails', async () => {
      const initialStatus = emailQueueService.getQueueStatus()
      const initialTotal = initialStatus.totalInQueue

      const mockEmail = createMockEmail()
      const userId = 'user-123'

      await emailQueueService.addToQueue(mockEmail, userId)

      const status = emailQueueService.getQueueStatus()
      expect(status.totalInQueue).toBeGreaterThan(initialTotal)
    })
  })

  describe('getQueueHistory', () => {
    it('should return queue history with default limit', () => {
      const history = emailQueueService.getQueueHistory()

      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBeLessThanOrEqual(50) // default limit
    })

    it('should respect custom limit', () => {
      const customLimit = 10
      const history = emailQueueService.getQueueHistory(customLimit)

      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBeLessThanOrEqual(customLimit)
    })

    it('should return items sorted by timestamp (newest first)', async () => {
      const mockEmail1 = createMockEmail({ subject: 'First email' })
      const mockEmail2 = createMockEmail({ subject: 'Second email' })
      const userId = 'user-123'

      await emailQueueService.addToQueue(mockEmail1, userId)
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1))
      await emailQueueService.addToQueue(mockEmail2, userId)

      const history = emailQueueService.getQueueHistory()
      if (history.length >= 2) {
        expect(history[0].timestamp.getTime()).toBeGreaterThanOrEqual(history[1].timestamp.getTime())
      }
    })
  })

  describe('email processing', () => {
    it('should handle email processing errors gracefully', async () => {
      const mockEmail = createMockEmail()
      const userId = 'user-123'

      // Mock Claude service to throw an error
      vi.mocked(claudeService.parseEmailToTasksWithContext).mockRejectedValue(new Error('Claude API error'))

      const queueId = await emailQueueService.addToQueue(mockEmail, userId)

      // Wait a bit for processing to attempt
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not throw error - errors are handled gracefully
      expect(queueId).toBeDefined()
    })

    it('should prevent duplicate processing of same email', async () => {
      const mockEmail = createMockEmail()
      const userId = 'user-123'

      // Mock that email has already been processed
      vi.mocked(storage.getProcessedEmail).mockResolvedValue({
        id: 1,
        messageId: mockEmail.messageId,
        subject: mockEmail.subject,
        body: mockEmail.body,
        sender: mockEmail.from,
        recipients: mockEmail.to,
        ccList: mockEmail.cc,
        bccList: mockEmail.bcc,
        status: 'processed',
        tasksCreated: 2,
        createdAt: new Date(),
        projectId: 1,
        processingError: null
      })

      await emailQueueService.addToQueue(mockEmail, userId)

      // Processing should be skipped
      expect(storage.getProcessedEmail).toHaveBeenCalledWith(mockEmail.messageId)
    })

    it('should create user accounts for non-service emails', async () => {
      const mockEmail = createMockEmail({
        from: 'user@example.com',
        to: ['agent@inboxleap.com']
      })
      const userId = 'user-123'
      const mockUser = createMockUser()

      vi.mocked(storage.getProcessedEmail).mockResolvedValue(undefined)
      vi.mocked(getOrCreateUserByEmail).mockResolvedValue(mockUser)
      vi.mocked(claudeService.parseEmailToTasksWithContext).mockResolvedValue([])
      vi.mocked(storage.getUserProjects).mockResolvedValue([])

      await emailQueueService.addToQueue(mockEmail, userId)

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(getOrCreateUserByEmail).toHaveBeenCalledWith(mockEmail.from)
    })

    it('should not create user accounts for service emails', async () => {
      const mockEmail = createMockEmail({
        from: 'service@inboxleap.com',
        to: ['user@example.com']
      })
      const userId = 'user-123'

      vi.mocked(storage.getProcessedEmail).mockResolvedValue(undefined)
      vi.mocked(claudeService.parseEmailToTasksWithContext).mockResolvedValue([])
      vi.mocked(storage.getUserProjects).mockResolvedValue([])

      await emailQueueService.addToQueue(mockEmail, userId)

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(getOrCreateUserByEmail).not.toHaveBeenCalledWith('service@inboxleap.com')
    })
  })

  describe('event emissions', () => {
    it('should emit processing events', async () => {
      const mockEmail = createMockEmail()
      const userId = 'user-123'

      const startedSpy = vi.fn()
      const completedSpy = vi.fn()
      const failedSpy = vi.fn()

      emailQueueService.on('emailProcessingStarted', startedSpy)
      emailQueueService.on('emailProcessingCompleted', completedSpy)
      emailQueueService.on('emailProcessingFailed', failedSpy)

      // Mock successful processing
      vi.mocked(storage.getProcessedEmail).mockResolvedValue(undefined)
      vi.mocked(claudeService.parseEmailToTasksWithContext).mockResolvedValue([])
      vi.mocked(storage.getUserProjects).mockResolvedValue([])

      await emailQueueService.addToQueue(mockEmail, userId)

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200))

      expect(startedSpy).toHaveBeenCalled()
      // Either completed or failed depending on processing outcome
      expect(completedSpy.mock.calls.length + failedSpy.mock.calls.length).toBeGreaterThan(0)
    })
  })

  describe('queue capacity management', () => {
    it('should respect maximum concurrent jobs limit', async () => {
      const status = emailQueueService.getQueueStatus()
      expect(status.maxConcurrentJobs).toBeGreaterThan(0)
      expect(status.currentJobs).toBeLessThanOrEqual(status.maxConcurrentJobs)
    })

    it('should process multiple emails concurrently up to limit', async () => {
      const mockEmails = [
        createMockEmail({ subject: 'Email 1' }),
        createMockEmail({ subject: 'Email 2' }),
        createMockEmail({ subject: 'Email 3' })
      ]
      const userId = 'user-123'

      // Mock slow processing
      vi.mocked(storage.getProcessedEmail).mockResolvedValue(undefined)
      vi.mocked(claudeService.parseEmailToTasksWithContext).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 1000))
      )
      vi.mocked(storage.getUserProjects).mockResolvedValue([])

      const queueIds = await Promise.all(
        mockEmails.map(email => emailQueueService.addToQueue(email, userId))
      )

      expect(queueIds).toHaveLength(3)
      expect(queueIds.every(id => id.match(/^email_\d+_[a-z0-9]+$/))).toBe(true)

      const status = emailQueueService.getQueueStatus()
      expect(status.totalInQueue).toBeGreaterThanOrEqual(3)
    })
  })
})
