import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSubCompanyWithIntelligence, quickCreateCompanyForAgent } from '../src/services/companyIntelligence';

// Mock dependencies
vi.mock('../src/storage', () => ({
  storage: {
    getCompanyMembershipsByUserId: vi.fn(),
    getUser: vi.fn(),
    getCompany: vi.fn(),
    createCompany: vi.fn(),
    createCompanyMembership: vi.fn(),
  },
}));

vi.mock('../src/services/companyRegistrationService', () => ({
  createSubCompany: vi.fn(),
}));

vi.mock('../src/services/pollingAgentCreationService', () => ({
  createPollingAgent: vi.fn(),
}));

describe('CompanyIntelligenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSubCompanyWithIntelligence', () => {
    it('should create sub-company and agent successfully', async () => {
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      const { createPollingAgent } = await import('../src/services/pollingAgentCreationService');
      
      // Mock successful sub-company creation
      const mockCompany = {
        id: 2,
        name: 'Test Sub Company',
        description: 'AI-generated description',
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: 1,
        companyType: 'subsidiary',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockMembership = {
        id: 1,
        userId: 'user123',
        companyId: 2,
        role: 'admin',
        isActive: true,
        joinedAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(createSubCompany).mockResolvedValue({
        company: mockCompany,
        membership: mockMembership
      });

      // Mock successful agent creation
      const mockAgent = {
        id: 1,
        email: 'test-agent@example.com',
        name: 'Test Agent',
        description: 'AI-generated agent',
        companyId: 2,
        createdBy: 'user123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(createPollingAgent).mockResolvedValue({
        agent: mockAgent,
        emailAddress: 'test-agent@example.com'
      });

      const result = await createSubCompanyWithIntelligence('user123', 1, {
        companyName: 'Test Sub Company',
        companyDescription: 'AI-generated description',
        companyType: 'subsidiary',
        agentName: 'Test Agent',
        agentDescription: 'AI-generated agent'
      });

      expect(result.success).toBe(true);
      expect(result.company).toEqual(mockCompany);
      expect(result.agent).toEqual(mockAgent);
      expect(result.agentEmailAddress).toBe('test-agent@example.com');
      expect(createSubCompany).toHaveBeenCalledWith('user123', 1, {
        name: 'Test Sub Company',
        description: 'AI-generated description',
        companyType: 'subsidiary'
      });
      expect(createPollingAgent).toHaveBeenCalledWith({
        name: 'Test Agent',
        description: 'AI-generated agent',
        companyId: 2,
        createdBy: 'user123'
      });
    });

    it('should handle sub-company creation failure', async () => {
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      
      vi.mocked(createSubCompany).mockRejectedValue(new Error('Company creation failed'));

      const result = await createSubCompanyWithIntelligence('user123', 1, {
        companyName: 'Test Company',
        companyType: 'subsidiary'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Company creation failed');
      expect(result.company).toBeUndefined();
      expect(result.agent).toBeUndefined();
    });

    it('should handle agent creation failure after successful company creation', async () => {
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      const { createPollingAgent } = await import('../src/services/pollingAgentCreationService');
      
      // Mock successful company creation
      const mockCompany = {
        id: 2,
        name: 'Test Company',
        description: null,
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: 1,
        companyType: 'subsidiary',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(createSubCompany).mockResolvedValue({
        company: mockCompany,
        membership: {
          id: 1,
          userId: 'user123',
          companyId: 2,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Mock agent creation failure
      vi.mocked(createPollingAgent).mockRejectedValue(new Error('Agent creation failed'));

      const result = await createSubCompanyWithIntelligence('user123', 1, {
        companyName: 'Test Company',
        companyType: 'subsidiary',
        agentName: 'Test Agent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent creation failed');
      expect(result.company).toEqual(mockCompany);
      expect(result.agent).toBeUndefined();
    });

    it('should work without agent creation when agentName not provided', async () => {
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      
      const mockCompany = {
        id: 2,
        name: 'Test Company',
        description: null,
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: 1,
        companyType: 'subsidiary',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(createSubCompany).mockResolvedValue({
        company: mockCompany,
        membership: {
          id: 1,
          userId: 'user123',
          companyId: 2,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      });

      const result = await createSubCompanyWithIntelligence('user123', 1, {
        companyName: 'Test Company',
        companyType: 'subsidiary'
        // No agentName provided
      });

      expect(result.success).toBe(true);
      expect(result.company).toEqual(mockCompany);
      expect(result.agent).toBeUndefined();
      expect(result.agentEmailAddress).toBeUndefined();
    });
  });

  describe('quickCreateCompanyForAgent', () => {
    it('should create company and agent when user has no companies', async () => {
      const { storage } = await import('../src/storage');
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      const { createPollingAgent } = await import('../src/services/pollingAgentCreationService');

      // Mock user has no company memberships
      vi.mocked(storage.getCompanyMembershipsByUserId).mockResolvedValue([]);

      // Mock company creation as main company (no parent)
      vi.mocked(storage.createCompany).mockResolvedValue({
        id: 1,
        name: 'User Company',
        description: null,
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: null,
        companyType: 'main',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      vi.mocked(storage.createCompanyMembership).mockResolvedValue({
        id: 1,
        userId: 'user123',
        companyId: 1,
        role: 'admin',
        isActive: true,
        joinedAt: new Date(),
        updatedAt: new Date()
      });

      // Mock agent creation
      vi.mocked(createPollingAgent).mockResolvedValue({
        agent: {
          id: 1,
          email: 'test-agent@example.com',
          name: 'Test Agent',
          description: null,
          companyId: 1,
          createdBy: 'user123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        emailAddress: 'test-agent@example.com'
      });

      const result = await quickCreateCompanyForAgent('user123', {
        name: 'User Company',
        agentName: 'Test Agent'
      });

      expect(result.agent).toBeDefined();
      expect(result.emailAddress).toBe('test-agent@example.com');
      expect(result.companyId).toBe(1);
      expect(result.requiresMainCompany).toBeUndefined();
    });

    it('should create sub-company when user has one company', async () => {
      const { storage } = await import('../src/storage');
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      const { createPollingAgent } = await import('../src/services/pollingAgentCreationService');

      // Mock user has one company membership
      vi.mocked(storage.getCompanyMembershipsByUserId).mockResolvedValue([{
        id: 1,
        userId: 'user123',
        companyId: 1,
        role: 'admin',
        isActive: true,
        joinedAt: new Date(),
        updatedAt: new Date()
      }]);

      // Mock sub-company creation
      vi.mocked(createSubCompany).mockResolvedValue({
        company: {
          id: 2,
          name: 'Sub Company',
          description: null,
          domainRestrictions: { enabled: false, domains: [] },
          parentCompanyId: 1,
          companyType: 'subsidiary',
          createdBy: 'user123',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        membership: {
          id: 2,
          userId: 'user123',
          companyId: 2,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Mock agent creation
      vi.mocked(createPollingAgent).mockResolvedValue({
        agent: {
          id: 1,
          email: 'sub-agent@example.com',
          name: 'Sub Agent',
          description: null,
          companyId: 2,
          createdBy: 'user123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        emailAddress: 'sub-agent@example.com'
      });

      const result = await quickCreateCompanyForAgent('user123', {
        name: 'Sub Company',
        companyType: 'subsidiary',
        agentName: 'Sub Agent'
      });

      expect(result.agent).toBeDefined();
      expect(result.emailAddress).toBe('sub-agent@example.com');
      expect(result.companyId).toBe(2);
      expect(createSubCompany).toHaveBeenCalledWith('user123', 1, {
        name: 'Sub Company',
        companyType: 'subsidiary'
      });
    });

    it('should require parent selection when user has multiple companies', async () => {
      const { storage } = await import('../src/storage');

      // Mock user has multiple company memberships
      vi.mocked(storage.getCompanyMembershipsByUserId).mockResolvedValue([
        {
          id: 1,
          userId: 'user123',
          companyId: 1,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          userId: 'user123',
          companyId: 2,
          role: 'member',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      // Mock getting company details for selection
      vi.mocked(storage.getCompany).mockImplementation(async (id) => ({
        id: id as number,
        name: `Company ${id}`,
        description: null,
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: null,
        companyType: 'main',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const result = await quickCreateCompanyForAgent('user123', {
        name: 'New Company',
        agentName: 'New Agent'
      });

      expect(result.requiresMainCompany).toBe(true);
      expect(result.availableParents).toHaveLength(2);
      expect(result.message).toContain('multiple companies');
      expect(result.agent).toBeUndefined();
    });

    it('should use specified parent company when provided', async () => {
      const { storage } = await import('../src/storage');
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      const { createPollingAgent } = await import('../src/services/pollingAgentCreationService');

      // Mock user memberships (multiple companies)
      vi.mocked(storage.getCompanyMembershipsByUserId).mockResolvedValue([
        {
          id: 1,
          userId: 'user123',
          companyId: 1,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          userId: 'user123',
          companyId: 2,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      // Mock sub-company creation with specific parent
      vi.mocked(createSubCompany).mockResolvedValue({
        company: {
          id: 3,
          name: 'Specific Sub Company',
          description: null,
          domainRestrictions: { enabled: false, domains: [] },
          parentCompanyId: 2, // Specific parent
          companyType: 'division',
          createdBy: 'user123',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        membership: {
          id: 3,
          userId: 'user123',
          companyId: 3,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      });

      vi.mocked(createPollingAgent).mockResolvedValue({
        agent: {
          id: 1,
          email: 'specific-agent@example.com',
          name: 'Specific Agent',
          description: null,
          companyId: 3,
          createdBy: 'user123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        emailAddress: 'specific-agent@example.com'
      });

      const result = await quickCreateCompanyForAgent('user123', {
        name: 'Specific Sub Company',
        parentCompanyId: 2, // Specify parent
        companyType: 'division',
        agentName: 'Specific Agent'
      });

      expect(result.agent).toBeDefined();
      expect(result.companyId).toBe(3);
      expect(createSubCompany).toHaveBeenCalledWith('user123', 2, {
        name: 'Specific Sub Company',
        companyType: 'division'
      });
    });

    it('should handle errors gracefully', async () => {
      const { storage } = await import('../src/storage');

      // Mock storage error
      vi.mocked(storage.getCompanyMembershipsByUserId).mockRejectedValue(new Error('Database error'));

      const result = await quickCreateCompanyForAgent('user123', {
        name: 'Test Company',
        agentName: 'Test Agent'
      });

      expect(result.agent).toBeUndefined();
      expect(result.message).toContain('Database error');
    });

    it('should work without agent creation when agentName not provided', async () => {
      const { storage } = await import('../src/storage');

      // Mock user has no companies
      vi.mocked(storage.getCompanyMembershipsByUserId).mockResolvedValue([]);

      vi.mocked(storage.createCompany).mockResolvedValue({
        id: 1,
        name: 'User Company',
        description: null,
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: null,
        companyType: 'main',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      vi.mocked(storage.createCompanyMembership).mockResolvedValue({
        id: 1,
        userId: 'user123',
        companyId: 1,
        role: 'admin',
        isActive: true,
        joinedAt: new Date(),
        updatedAt: new Date()
      });

      const result = await quickCreateCompanyForAgent('user123', {
        name: 'User Company'
        // No agentName provided
      });

      expect(result.companyId).toBe(1);
      expect(result.agent).toBeUndefined();
      expect(result.emailAddress).toBeUndefined();
    });
  });
});