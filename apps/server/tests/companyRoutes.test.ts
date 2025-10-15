import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerCompanyRoutes } from '../src/routes/companies';

// Mock dependencies
vi.mock('../src/googleAuth', () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123' };
    next();
  })
}));

vi.mock('../src/services/companyRegistrationService', () => ({
  createSubCompany: vi.fn(),
  getCompanyHierarchy: vi.fn(),
}));

vi.mock('../src/services/companyIntelligence', () => ({
  quickCreateCompanyForAgent: vi.fn(),
}));

vi.mock('../src/storage', () => ({
  storage: {
    getCompanyMembershipsByUserId: vi.fn(),
    getCompany: vi.fn(),
  },
}));

describe('Company Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerCompanyRoutes(app);
    vi.clearAllMocks();
  });

  describe('POST /api/companies/:parentCompanyId/sub-companies', () => {
    it('should create sub-company successfully', async () => {
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      
      const mockResult = {
        company: {
          id: 2,
          name: 'Test Sub Company',
          description: 'Test description',
          domainRestrictions: { enabled: false, domains: [] },
          parentCompanyId: 1,
          companyType: 'subsidiary',
          createdBy: 'test-user-123',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        membership: {
          id: 1,
          userId: 'test-user-123',
          companyId: 2,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      };

      vi.mocked(createSubCompany).mockResolvedValue(mockResult);

      const requestData = {
        name: 'Test Sub Company',
        description: 'Test description',
        companyType: 'subsidiary',
        inheritParentSettings: false
      };

      const response = await request(app)
        .post('/api/companies/1/sub-companies')
        .send(requestData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.company.name).toBe('Test Sub Company');
      expect(response.body.data.company.parentCompanyId).toBe(1);
      expect(response.body.data.membership.role).toBe('admin');
      expect(createSubCompany).toHaveBeenCalledWith('test-user-123', 1, requestData);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/companies/1/sub-companies')
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Company name and type are required');
    });

    it('should validate company type', async () => {
      const response = await request(app)
        .post('/api/companies/1/sub-companies')
        .send({
          name: 'Test Company',
          companyType: 'invalid-type'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid company type. Valid options: subsidiary, division, project');
    });

    it('should handle sub-company creation errors', async () => {
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      
      vi.mocked(createSubCompany).mockRejectedValue(new Error('Parent company not found'));

      const response = await request(app)
        .post('/api/companies/999/sub-companies')
        .send({
          name: 'Test Company',
          companyType: 'subsidiary'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to create sub-company');
      expect(response.body.error).toBe('Parent company not found');
    });

    it('should handle invalid parent company ID', async () => {
      const response = await request(app)
        .post('/api/companies/invalid/sub-companies')
        .send({
          name: 'Test Company',
          companyType: 'subsidiary'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid parent company ID');
    });
  });

  describe('GET /api/companies/:companyId/hierarchy', () => {
    it('should return company hierarchy successfully', async () => {
      const { getCompanyHierarchy } = await import('../src/services/companyRegistrationService');
      
      const mockHierarchy = {
        rootCompany: {
          id: 1,
          name: 'Root Company',
          parentCompanyId: null,
          companyType: 'main',
          level: 0,
          path: '1'
        },
        hierarchy: [
          {
            id: 1,
            name: 'Root Company',
            parentCompanyId: null,
            companyType: 'main',
            level: 0,
            path: '1'
          },
          {
            id: 2,
            name: 'Sub Company',
            parentCompanyId: 1,
            companyType: 'subsidiary',
            level: 1,
            path: '1.2'
          }
        ],
        totalCompanies: 2,
        maxDepth: 1
      };

      vi.mocked(getCompanyHierarchy).mockResolvedValue(mockHierarchy);

      const response = await request(app)
        .get('/api/companies/1/hierarchy')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rootCompany.name).toBe('Root Company');
      expect(response.body.data.totalCompanies).toBe(2);
      expect(response.body.data.maxDepth).toBe(1);
      expect(response.body.data.hierarchy).toHaveLength(2);
    });

    it('should handle hierarchy retrieval errors', async () => {
      const { getCompanyHierarchy } = await import('../src/services/companyRegistrationService');
      
      vi.mocked(getCompanyHierarchy).mockRejectedValue(new Error('Company not found'));

      const response = await request(app)
        .get('/api/companies/999/hierarchy')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get company hierarchy');
      expect(response.body.error).toBe('Company not found');
    });

    it('should handle invalid company ID', async () => {
      const response = await request(app)
        .get('/api/companies/invalid/hierarchy')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid company ID');
    });
  });

  describe('GET /api/companies/:parentCompanyId/sub-companies', () => {
    it('should return sub-companies list successfully', async () => {
      const { storage } = await import('../src/storage');
      
      const mockMemberships = [
        {
          id: 1,
          userId: 'test-user-123',
          companyId: 2,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockCompanies = [
        {
          id: 2,
          name: 'Sub Company A',
          description: 'First sub-company',
          domainRestrictions: { enabled: false, domains: [] },
          parentCompanyId: 1,
          companyType: 'subsidiary',
          createdBy: 'test-user-123',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      vi.mocked(storage.getCompanyMembershipsByUserId).mockResolvedValue(mockMemberships);
      vi.mocked(storage.getCompany).mockImplementation(async (id) => {
        if (id === 1) {
          return {
            id: 1,
            name: 'Parent Company',
            description: 'Parent company',
            domainRestrictions: { enabled: false, domains: [] },
            parentCompanyId: null,
            companyType: 'main',
            createdBy: 'test-user-123',
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
        return mockCompanies.find(c => c.id === id);
      });

      const response = await request(app)
        .get('/api/companies/1/sub-companies')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.parentCompany.name).toBe('Parent Company');
      expect(response.body.data.subCompanies).toHaveLength(1);
      expect(response.body.data.subCompanies[0].name).toBe('Sub Company A');
      expect(response.body.data.totalSubCompanies).toBe(1);
    });

    it('should handle case when user has no access to parent company', async () => {
      const { storage } = await import('../src/storage');
      
      // Mock user has no memberships
      vi.mocked(storage.getCompanyMembershipsByUserId).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/companies/1/sub-companies')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No access to parent company');
    });

    it('should handle case when parent company does not exist', async () => {
      const { storage } = await import('../src/storage');
      
      const mockMemberships = [
        {
          id: 1,
          userId: 'test-user-123',
          companyId: 999,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        }
      ];

      vi.mocked(storage.getCompanyMembershipsByUserId).mockResolvedValue(mockMemberships);
      vi.mocked(storage.getCompany).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/companies/999/sub-companies')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Parent company not found');
    });
  });

  describe('POST /api/companies/quick-create', () => {
    it('should quick create company and agent successfully', async () => {
      const { quickCreateCompanyForAgent } = await import('../src/services/companyIntelligence');
      
      const mockResult = {
        agent: {
          id: 1,
          email: 'test-agent@example.com',
          name: 'Test Agent',
          description: 'Quick created agent',
          companyId: 1,
          createdBy: 'test-user-123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        emailAddress: 'test-agent@example.com',
        companyId: 1
      };

      vi.mocked(quickCreateCompanyForAgent).mockResolvedValue(mockResult);

      const requestData = {
        name: 'Quick Company',
        description: 'Quick created company',
        agentName: 'Test Agent',
        companyType: 'subsidiary'
      };

      const response = await request(app)
        .post('/api/companies/quick-create')
        .send(requestData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.agent.name).toBe('Test Agent');
      expect(response.body.data.emailAddress).toBe('test-agent@example.com');
      expect(response.body.data.companyId).toBe(1);
      expect(quickCreateCompanyForAgent).toHaveBeenCalledWith('test-user-123', requestData);
    });

    it('should handle case requiring parent company selection', async () => {
      const { quickCreateCompanyForAgent } = await import('../src/services/companyIntelligence');
      
      const mockResult = {
        requiresMainCompany: true,
        availableParents: [
          { id: 1, name: 'Company A', role: 'admin' },
          { id: 2, name: 'Company B', role: 'member' }
        ],
        message: 'You belong to multiple companies. Please specify which company should be the parent.'
      };

      vi.mocked(quickCreateCompanyForAgent).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/companies/quick-create')
        .send({
          name: 'Quick Company',
          agentName: 'Test Agent'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requiresMainCompany).toBe(true);
      expect(response.body.data.availableParents).toHaveLength(2);
      expect(response.body.data.message).toContain('multiple companies');
    });

    it('should validate required company name', async () => {
      const response = await request(app)
        .post('/api/companies/quick-create')
        .send({
          agentName: 'Test Agent'
          // Missing company name
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Company name is required');
    });

    it('should handle quick creation errors', async () => {
      const { quickCreateCompanyForAgent } = await import('../src/services/companyIntelligence');
      
      vi.mocked(quickCreateCompanyForAgent).mockRejectedValue(new Error('Creation failed'));

      const response = await request(app)
        .post('/api/companies/quick-create')
        .send({
          name: 'Quick Company',
          agentName: 'Test Agent'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to quick create company');
      expect(response.body.error).toBe('Creation failed');
    });

    it('should handle case when creation returns error message', async () => {
      const { quickCreateCompanyForAgent } = await import('../src/services/companyIntelligence');
      
      const mockResult = {
        message: 'User not found'
      };

      vi.mocked(quickCreateCompanyForAgent).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/companies/quick-create')
        .send({
          name: 'Quick Company',
          agentName: 'Test Agent'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('POST /api/companies/agent-level-create', () => {
    it('should create company for agent level successfully', async () => {
      const { quickCreateCompanyForAgent } = await import('../src/services/companyIntelligence');
      
      const mockResult = {
        agent: {
          id: 1,
          email: 'agent@example.com',
          name: 'Agent Level Test',
          description: null,
          companyId: 2,
          createdBy: 'test-user-123',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        emailAddress: 'agent@example.com',
        companyId: 2
      };

      vi.mocked(quickCreateCompanyForAgent).mockResolvedValue(mockResult);

      const requestData = {
        name: 'Agent Level Company',
        parentCompanyId: 1,
        companyType: 'division',
        agentName: 'Agent Level Test'
      };

      const response = await request(app)
        .post('/api/companies/agent-level-create')
        .send(requestData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Company and agent created successfully for agent-level setup');
      expect(response.body.data.agent.name).toBe('Agent Level Test');
      expect(response.body.data.companyId).toBe(2);
    });

    it('should validate required fields for agent-level creation', async () => {
      const response = await request(app)
        .post('/api/companies/agent-level-create')
        .send({
          name: 'Test Company'
          // Missing agentName
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Company name and agent name are required for agent-level creation');
    });

    it('should handle agent-level creation errors', async () => {
      const { quickCreateCompanyForAgent } = await import('../src/services/companyIntelligence');
      
      vi.mocked(quickCreateCompanyForAgent).mockRejectedValue(new Error('Agent creation failed'));

      const response = await request(app)
        .post('/api/companies/agent-level-create')
        .send({
          name: 'Test Company',
          agentName: 'Test Agent'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to create company for agent-level setup');
      expect(response.body.error).toBe('Agent creation failed');
    });
  });
});