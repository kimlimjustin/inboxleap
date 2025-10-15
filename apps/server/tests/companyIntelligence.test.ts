import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as companyIntelligenceService from '../src/services/companyIntelligence'
import { storage } from '../src/storage'
import { createMockUser, createMockPollingAgent } from './helpers'

// Mock the storage module
vi.mock('../src/storage', () => ({
  storage: {
    getPollingAgentsForUser: vi.fn(),
    createPollingAgent: vi.fn(),
    addPollingAgentParticipant: vi.fn(),
    getAllPollingAgents: vi.fn()
  }
}))

describe('CompanyIntelligence Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setupCompanyIntelligence', () => {
    it('should create a new company intelligence agent', async () => {
      const user = createMockUser()
      const mockAgent = createMockPollingAgent('acme-corp', user.id, {
        name: 'Acme Corp - Tanya Intelligence',
        type: 't5t',
        organizationName: 'Acme Corp',
        organizationId: 'acme-corp',
        emailAddress: 't5t+acme-corp@inboxleap.com',
        organizationDescription: 'A test company for intelligence gathering'
      })
      
      vi.mocked(storage.getPollingAgentsForUser).mockResolvedValue([])
      vi.mocked(storage.createPollingAgent).mockResolvedValue(mockAgent)
      vi.mocked(storage.addPollingAgentParticipant).mockResolvedValue({} as any)

      const result = await companyIntelligenceService.setupCompanyIntelligence(
        user.id, 
        'Acme Corp', 
        'A test company for intelligence gathering'
      )

      expect(result.agent).toEqual(mockAgent)
      expect(result.emailAddress).toBe('t5t+acme-corp@inboxleap.com')
      expect(result.companyId).toBe('acme-corp')
      expect(storage.createPollingAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Acme Corp - Tanya Intelligence',
          type: 't5t',
          organizationName: 'Acme Corp',
          organizationId: 'acme-corp',
          emailAddress: 't5t+acme-corp@inboxleap.com',
          organizationDescription: 'A test company for intelligence gathering',
          createdBy: user.id,
          isActive: true,
          settings: expect.objectContaining({
            submissionFrequency: 'weekly',
            maxItems: 5,
            autoAnalysis: true,
            emailDomain: 'inboxleap.com',
            companySpecific: true
          })
        })
      )
      expect(storage.addPollingAgentParticipant).toHaveBeenCalledWith({
        pollingAgentId: mockAgent.id,
        userId: user.id,
        role: 'admin',
        canViewInsights: true,
        canViewDetailedAnalytics: true,
        isActive: true
      })
    })

    it('should return existing agent if company already set up', async () => {
      const user = createMockUser()
      const existingAgent = createMockPollingAgent('acme-corp', user.id, {
        organizationName: 'Acme Corp',
        organizationId: 'acme-corp',
        type: 't5t',
        emailAddress: 't5t+acme-corp@inboxleap.com'
      })
      
      vi.mocked(storage.getPollingAgentsForUser).mockResolvedValue([existingAgent])

      const result = await companyIntelligenceService.setupCompanyIntelligence(
        user.id, 
        'Acme Corp'
      )

      expect(result.agent).toEqual(existingAgent)
      expect(result.emailAddress).toBe('t5t+acme-corp@inboxleap.com')
      expect(result.companyId).toBe('acme-corp')
      expect(storage.createPollingAgent).not.toHaveBeenCalled()
    })

    it('should handle company names with special characters', async () => {
      const user = createMockUser()
      const mockAgent = createMockPollingAgent('acme-corp-llc', user.id, {
        type: 't5t',
        organizationName: 'Acme Corp & LLC',
        organizationId: 'acme-corp-llc',
        emailAddress: 't5t+acme-corp-llc@inboxleap.com'
      })
      
      vi.mocked(storage.getPollingAgentsForUser).mockResolvedValue([])
      vi.mocked(storage.createPollingAgent).mockResolvedValue(mockAgent)
      vi.mocked(storage.addPollingAgentParticipant).mockResolvedValue({} as any)

      const result = await companyIntelligenceService.setupCompanyIntelligence(
        user.id, 
        'Acme Corp & LLC'
      )

      expect(result.companyId).toBe('acme-corp-llc')
      expect(result.emailAddress).toBe('t5t+acme-corp-llc@inboxleap.com')
    })
  })

  describe('getUserCompanyIntelligence', () => {
    it('should return user\'s company intelligence agents with computed fields', async () => {
      const user = createMockUser()
      const mockAgents = [
        createMockPollingAgent('org-1', user.id, {
          type: 't5t',
          organizationId: 'org-1',
          organizationName: 'Organization 1',
          organizationDescription: 'First organization',
          emailAddress: 't5t+org-1@inboxleap.com'
        }),
        createMockPollingAgent('org-2', user.id, {
          type: 't5t',
          organizationId: 'org-2',
          organizationName: 'Organization 2',
          emailAddress: 't5t+org-2@inboxleap.com'
        })
      ]
      
      vi.mocked(storage.getPollingAgentsForUser).mockResolvedValue(mockAgents)

      const result = await companyIntelligenceService.getUserCompanyIntelligence(user.id)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(expect.objectContaining({
        ...mockAgents[0],
        companyId: 'org-1',
        companyName: 'Organization 1',
        companyDescription: 'First organization',
        isCompanySpecific: true
      }))
      expect(storage.getPollingAgentsForUser).toHaveBeenCalledWith(user.id)
    })

    it('should filter out non-company agents', async () => {
      const user = createMockUser()
      const mockAgents = [
        createMockPollingAgent('org-1', user.id, {
          type: 't5t',
          organizationId: 'org-1',
          organizationName: 'Organization 1'
        }),
        createMockPollingAgent('personal', user.id, {
          type: 'personal', // Not a company agent
          organizationId: null
        })
      ]
      
      vi.mocked(storage.getPollingAgentsForUser).mockResolvedValue(mockAgents)

      const result = await companyIntelligenceService.getUserCompanyIntelligence(user.id)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('t5t')
    })

    it('should return empty array if user has no company agents', async () => {
      const user = createMockUser()
      
      vi.mocked(storage.getPollingAgentsForUser).mockResolvedValue([])

      const result = await companyIntelligenceService.getUserCompanyIntelligence(user.id)

      expect(result).toEqual([])
    })
  })

  describe('findAgentByEmail', () => {
    it('should find agent by Tanya email address', async () => {
      const mockAgent = createMockPollingAgent('test-company', 'user-123', {
        type: 't5t',
        organizationId: 'test-company',
        emailAddress: 't5t+test-company@inboxleap.com'
      })
      
      vi.mocked(storage.getAllPollingAgents).mockResolvedValue([mockAgent])

      const result = await companyIntelligenceService.findAgentByEmail('t5t+test-company@inboxleap.com')

      expect(result).toEqual(mockAgent)
      expect(storage.getAllPollingAgents).toHaveBeenCalled()
    })

    it('should return null for non-Tanya email addresses', async () => {
      const result = await companyIntelligenceService.findAgentByEmail('regular@example.com')

      expect(result).toBeNull()
      expect(storage.getAllPollingAgents).not.toHaveBeenCalled()
    })

    it('should return null if agent not found', async () => {
      vi.mocked(storage.getAllPollingAgents).mockResolvedValue([])

      const result = await companyIntelligenceService.findAgentByEmail('t5t+nonexistent@inboxleap.com')

      expect(result).toBeNull()
    })

    it('should find agent by email address match', async () => {
      const mockAgent = createMockPollingAgent('test-company', 'user-123', {
        type: 't5t',
        organizationId: 'different-id',
        emailAddress: 't5t+test-company@inboxleap.com'
      })
      
      vi.mocked(storage.getAllPollingAgents).mockResolvedValue([mockAgent])

      const result = await companyIntelligenceService.findAgentByEmail('t5t+test-company@inboxleap.com')

      expect(result).toEqual(mockAgent)
    })
  })

  describe('validateCompanyName', () => {
    it('should return valid for good company names', () => {
      expect(companyIntelligenceService.validateCompanyName('Acme Corp').valid).toBe(true)
      expect(companyIntelligenceService.validateCompanyName('Test Company LLC').valid).toBe(true)
      expect(companyIntelligenceService.validateCompanyName('ABC-123').valid).toBe(true)
      expect(companyIntelligenceService.validateCompanyName('Company & Partners').valid).toBe(true)
      expect(companyIntelligenceService.validateCompanyName('Tech (2024)').valid).toBe(true)
    })

    it('should return invalid for bad company names', () => {
      expect(companyIntelligenceService.validateCompanyName('').valid).toBe(false)
      expect(companyIntelligenceService.validateCompanyName('A').valid).toBe(false) // too short
      expect(companyIntelligenceService.validateCompanyName('A'.repeat(101)).valid).toBe(false) // too long
      expect(companyIntelligenceService.validateCompanyName('Company@Email').valid).toBe(false) // invalid chars
      expect(companyIntelligenceService.validateCompanyName(null as any).valid).toBe(false) // null
      expect(companyIntelligenceService.validateCompanyName(123 as any).valid).toBe(false) // not string
    })

    it('should provide error messages for invalid names', () => {
      const emptyResult = companyIntelligenceService.validateCompanyName('')
      expect(emptyResult.valid).toBe(false)
      expect(emptyResult.error).toBe('Company name is required')
      
      const shortResult = companyIntelligenceService.validateCompanyName('A')
      expect(shortResult.valid).toBe(false)
      expect(shortResult.error).toBe('Company name must be at least 2 characters')
      
      const longResult = companyIntelligenceService.validateCompanyName('A'.repeat(101))
      expect(longResult.valid).toBe(false)
      expect(longResult.error).toBe('Company name must be less than 100 characters')
      
      const invalidCharsResult = companyIntelligenceService.validateCompanyName('Company@Email')
      expect(invalidCharsResult.valid).toBe(false)
      expect(invalidCharsResult.error).toBe('Company name contains invalid characters')
    })
  })

  describe('getCompanyIntelligenceInstructions', () => {
    it('should generate instructions for company intelligence', () => {
      const result = companyIntelligenceService.getCompanyIntelligenceInstructions(
        'Acme Corp', 
        't5t+acme-corp@inboxleap.com'
      )
      
      expect(result.emailAddress).toBe('t5t+acme-corp@inboxleap.com')
      expect(result.instructions).toBeInstanceOf(Array)
      expect(result.instructions.length).toBeGreaterThan(0)
      expect(result.sampleEmail).toContain('t5t+acme-corp@inboxleap.com')
      expect(result.sampleEmail).toContain('To:')
      expect(result.sampleEmail).toContain('Subject:')
    })

    it('should include email address in instructions', () => {
      const emailAddress = 't5t+special-company@inboxleap.com'
      const result = companyIntelligenceService.getCompanyIntelligenceInstructions(
        'Special Company',
        emailAddress
      )
      
      expect(result.emailAddress).toBe(emailAddress)
      expect(result.instructions.some(instruction => instruction.includes(emailAddress))).toBe(true)
      expect(result.sampleEmail).toContain(emailAddress)
    })

    it('should provide helpful instruction content', () => {
      const result = companyIntelligenceService.getCompanyIntelligenceInstructions(
        'Test Company',
        't5t+test@inboxleap.com'
      )
      
      expect(result.instructions.some(instruction => instruction.includes('top 5'))).toBe(true)
      expect(result.instructions.some(instruction => instruction.includes('weekly'))).toBe(true)
      expect(result.sampleEmail).toContain('Weekly T5T')
      expect(result.sampleEmail).toContain('1.')
      expect(result.sampleEmail).toContain('2.')
    })
  })
})
