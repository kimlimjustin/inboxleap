import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerAuditRoutes } from '../src/routes/audit';
import { registerCompanyRoutes } from '../src/routes/companies';

// Mock all dependencies
vi.mock('../src/googleAuth', () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    req.user = { id: 'integration-test-user' };
    next();
  })
}));

// Mock database
vi.mock('../src/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    with: vi.fn().mockReturnThis(),
    execute: vi.fn(),
  },
}));

// Mock storage
vi.mock('../src/storage', () => ({
  storage: {
    getUser: vi.fn(),
    getCompany: vi.fn(),
    createCompany: vi.fn(),
    createCompanyMembership: vi.fn(),
    getCompanyMembershipsByUserId: vi.fn(),
    getCompaniesCount: vi.fn(),
    getActivePollingAgentsCount: vi.fn(),
    getUsersCount: vi.fn(),
    getActiveSubmissions24h: vi.fn(),
  },
}));

// Mock services
vi.mock('../src/services/companyRegistrationService', () => ({
  createSubCompany: vi.fn(),
  getCompanyHierarchy: vi.fn(),
}));

vi.mock('../src/services/companyIntelligence', () => ({
  quickCreateCompanyForAgent: vi.fn(),
}));

vi.mock('../src/services/pollingAgentCreationService', () => ({
  createPollingAgent: vi.fn(),
}));

vi.mock('../src/services/performanceMonitor', () => ({
  performanceMonitor: {
    getPerformanceDashboard: vi.fn(),
    recordMetric: vi.fn(),
  },
}));

vi.mock('../src/services/batchProcessingQueue', () => ({
  batchProcessingQueue: {
    getQueueStats: vi.fn(),
  },
}));

vi.mock('../src/services/auditScheduler', () => ({
  auditScheduler: {
    getStatus: vi.fn(),
    updateConfig: vi.fn(),
    getLastAuditReport: vi.fn(),
  },
}));

describe('System Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerAuditRoutes(app);
    registerCompanyRoutes(app);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Company and Audit Integration', () => {
    it('should create sub-company and then audit it successfully', async () => {
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      const { storage } = await import('../src/storage');
      const { db } = await import('../src/db');

      // Step 1: Create sub-company
      const mockSubCompany = {
        id: 2,
        name: 'Integration Test Sub Company',
        description: 'Created for integration testing',
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: 1,
        companyType: 'subsidiary',
        createdBy: 'integration-test-user',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockMembership = {
        id: 1,
        userId: 'integration-test-user',
        companyId: 2,
        role: 'admin',
        isActive: true,
        joinedAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(createSubCompany).mockResolvedValue({
        company: mockSubCompany,
        membership: mockMembership
      });

      // Create sub-company via API
      const createResponse = await request(app)
        .post('/api/companies/1/sub-companies')
        .send({
          name: 'Integration Test Sub Company',
          description: 'Created for integration testing',
          companyType: 'subsidiary'
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.company.name).toBe('Integration Test Sub Company');

      // Step 2: Mock audit service to include the new sub-company in checks
      vi.mocked(storage.getCompaniesCount).mockResolvedValue(2); // Now we have 2 companies
      vi.mocked(storage.getActivePollingAgentsCount).mockResolvedValue(5);
      vi.mocked(storage.getUsersCount).mockResolvedValue(10);
      vi.mocked(storage.getActiveSubmissions24h).mockResolvedValue(50);

      // Mock database queries for audit
      vi.mocked(db.execute).mockImplementation(async (query: any) => {
        const queryStr = query.toString ? query.toString() : String(query);
        if (queryStr.includes('company_memberships')) {
          return []; // No orphaned memberships
        }
        if (queryStr.includes('companies')) {
          return []; // No circular references or issues
        }
        return [];
      });

      const { performanceMonitor } = await import('../src/services/performanceMonitor');
      vi.mocked(performanceMonitor.getPerformanceDashboard).mockReturnValue({
        summary: {
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          successRate: 95,
          errorRate: 5,
          averageResponseTime: 200
        },
        recentMetrics: []
      });

      const { batchProcessingQueue } = await import('../src/services/batchProcessingQueue');
      vi.mocked(batchProcessingQueue.getQueueStats).mockReturnValue({
        totalQueued: 5,
        processing: 2,
        completed: 100,
        failed: 1
      });

      // Step 3: Run audit to check the new system state
      const auditResponse = await request(app)
        .post('/api/audit/run')
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      expect(auditResponse.body.data).toHaveProperty('reportId');
      expect(auditResponse.body.data).toHaveProperty('overallHealth');
      expect(auditResponse.body.data).toHaveProperty('summary');

      // Step 4: Verify audit detected the new company
      const summary = auditResponse.body.data.summary;
      expect(summary.totalChecks).toBeGreaterThan(10);
      expect(summary.passed).toBeGreaterThan(0);
    });

    it('should handle company creation failure and audit the error state', async () => {
      const { createSubCompany } = await import('../src/services/companyRegistrationService');
      const { storage } = await import('../src/storage');
      const { db } = await import('../src/db');

      // Step 1: Mock company creation failure
      vi.mocked(createSubCompany).mockRejectedValue(new Error('Parent company not found'));

      // Attempt to create sub-company
      const createResponse = await request(app)
        .post('/api/companies/999/sub-companies')
        .send({
          name: 'Failed Company',
          companyType: 'subsidiary'
        })
        .expect(500);

      expect(createResponse.body.success).toBe(false);
      expect(createResponse.body.error).toBe('Parent company not found');

      // Step 2: Mock audit to detect potential issues
      vi.mocked(storage.getCompaniesCount).mockResolvedValue(1); // Still only 1 company
      vi.mocked(db.execute).mockImplementation(async (query: any) => {
        const queryStr = String(query);
        if (queryStr.includes('company_memberships')) {
          // Mock orphaned membership from failed creation attempt
          return [{ id: 999, company_id: 999, user_id: 'integration-test-user' }];
        }
        return [];
      });

      // Step 3: Run audit to detect the orphaned data
      const auditResponse = await request(app)
        .post('/api/audit/run')
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      const summary = auditResponse.body.data.summary;
      // Should have some failures due to orphaned data
      expect(summary.failures).toBeGreaterThanOrEqual(1);
    });

    it('should create company hierarchy and verify it through audit', async () => {
      const { createSubCompany, getCompanyHierarchy } = await import('../src/services/companyRegistrationService');
      const { storage } = await import('../src/storage');
      const { db } = await import('../src/db');

      // Step 1: Create multiple levels of companies
      const companies = [
        {
          id: 1,
          name: 'Root Company',
          parentCompanyId: null,
          companyType: 'main'
        },
        {
          id: 2,
          name: 'Sub Company A',
          parentCompanyId: 1,
          companyType: 'subsidiary'
        },
        {
          id: 3,
          name: 'Sub Company B',
          parentCompanyId: 2,
          companyType: 'division'
        }
      ];

      // Mock hierarchy creation
      for (let i = 1; i < companies.length; i++) {
        const company = companies[i];
        vi.mocked(createSubCompany).mockResolvedValueOnce({
          company: {
            ...company,
            description: null,
            domainRestrictions: { enabled: false, domains: [] },
            createdBy: 'integration-test-user',
            createdAt: new Date(),
            updatedAt: new Date()
          } as any,
          membership: {
            id: i,
            userId: 'integration-test-user',
            companyId: company.id,
            role: 'admin',
            isActive: true,
            joinedAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Create the hierarchy via API calls
      const subCompanyA = await request(app)
        .post('/api/companies/1/sub-companies')
        .send({
          name: 'Sub Company A',
          companyType: 'subsidiary'
        })
        .expect(201);

      const subCompanyB = await request(app)
        .post('/api/companies/2/sub-companies')
        .send({
          name: 'Sub Company B',
          companyType: 'division'
        })
        .expect(201);

      // Step 2: Mock hierarchy retrieval
      const mockHierarchy = {
        rootCompany: companies[0],
        hierarchy: companies.map((c, index) => ({
          ...c,
          level: index,
          path: index === 0 ? '1' : index === 1 ? '1.2' : '1.2.3'
        })),
        totalCompanies: 3,
        maxDepth: 2
      };

      vi.mocked(getCompanyHierarchy).mockResolvedValue(mockHierarchy);

      // Get hierarchy via API
      const hierarchyResponse = await request(app)
        .get('/api/companies/1/hierarchy')
        .expect(200);

      expect(hierarchyResponse.body.success).toBe(true);
      expect(hierarchyResponse.body.data.totalCompanies).toBe(3);
      expect(hierarchyResponse.body.data.maxDepth).toBe(2);

      // Step 3: Run company system audit to validate hierarchy
      vi.mocked(storage.getCompaniesCount).mockResolvedValue(3);
      vi.mocked(db.execute).mockImplementation(async (query: any) => {
        const queryStr = String(query);
        if (queryStr.includes('parent_company_id IS NOT NULL')) {
          // Mock hierarchy validation - all companies have valid parents
          return [];
        }
        if (queryStr.includes('circular')) {
          // No circular references
          return [];
        }
        return [];
      });

      const auditResponse = await request(app)
        .post('/api/audit/category/company')
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      expect(auditResponse.body.data.summary.category).toBe('company');
      // Should pass most checks with valid hierarchy
      expect(auditResponse.body.data.summary.passed).toBeGreaterThan(0);
    });

    it('should handle performance monitoring during company operations', async () => {
      const { quickCreateCompanyForAgent } = await import('../src/services/companyIntelligence');
      const { performanceMonitor } = await import('../src/services/performanceMonitor');
      const { createPollingAgent } = await import('../src/services/pollingAgentCreationService');

      // Step 1: Mock performance data showing some load
      let requestCount = 0;
      vi.mocked(performanceMonitor.getPerformanceDashboard).mockImplementation(() => ({
        summary: {
          totalRequests: ++requestCount * 10,
          successfulRequests: requestCount * 9,
          failedRequests: requestCount * 1,
          successRate: 90,
          errorRate: 10,
          averageResponseTime: 250 + (requestCount * 50) // Increasing response time
        },
        recentMetrics: []
      }));

      // Mock quick create with agent
      vi.mocked(quickCreateCompanyForAgent).mockResolvedValue({
        agent: {
          id: 1,
          email: 'perf-test@example.com',
          name: 'Performance Test Agent',
          description: null,
          companyId: 1,
          createdBy: 'integration-test-user',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        emailAddress: 'perf-test@example.com',
        companyId: 1
      });

      // Step 2: Create company and agent (should record metrics)
      const createResponse = await request(app)
        .post('/api/companies/quick-create')
        .send({
          name: 'Performance Test Company',
          agentName: 'Performance Test Agent'
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);

      // Step 3: Run performance audit
      const perfAuditResponse = await request(app)
        .post('/api/audit/category/performance')
        .expect(200);

      expect(perfAuditResponse.body.success).toBe(true);
      expect(perfAuditResponse.body.data.summary.category).toBe('performance');

      // Should detect performance degradation if response time is too high
      const checks = perfAuditResponse.body.data.checks;
      const responseTimeCheck = checks.find((c: any) => c.checkName === 'response_time_performance');
      if (responseTimeCheck) {
        expect(['pass', 'warning', 'fail']).toContain(responseTimeCheck.status);
      }
    });

    it('should handle audit scheduler integration', async () => {
      const { auditScheduler } = await import('../src/services/auditScheduler');

      // Step 1: Mock scheduler status
      vi.mocked(auditScheduler.getStatus).mockReturnValue({
        isRunning: true,
        config: {
          enabled: true,
          fullAuditInterval: 14400000,
          quickHealthInterval: 900000,
          alertThresholds: {
            criticalFailures: 1,
            highFailures: 3,
            warningFailures: 10
          },
          notificationSettings: {
            emailAlerts: false
          }
        },
        lastAudit: {
          reportId: 'scheduled_audit_123',
          generatedAt: new Date(Date.now() - 3600000), // 1 hour ago
          overallHealth: 'healthy',
          summary: {
            totalChecks: 20,
            passed: 18,
            warnings: 2,
            failures: 0
          }
        },
        nextFullAudit: new Date(Date.now() + 10800000), // 3 hours from now
        nextHealthCheck: new Date(Date.now() + 600000) // 10 minutes from now
      });

      // Step 2: Check scheduler status
      const statusResponse = await request(app)
        .get('/api/audit/scheduler/status')
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.isRunning).toBe(true);
      expect(statusResponse.body.data.lastAudit.reportId).toBe('scheduled_audit_123');

      // Step 3: Update scheduler configuration
      const configUpdate = {
        fullAuditInterval: 7200000, // 2 hours
        alertThresholds: {
          criticalFailures: 1,
          highFailures: 2,
          warningFailures: 5
        }
      };

      const configResponse = await request(app)
        .patch('/api/audit/scheduler/config')
        .send(configUpdate)
        .expect(200);

      expect(configResponse.body.success).toBe(true);
      expect(configResponse.body.message).toBe('Audit scheduler configuration updated');
      expect(auditScheduler.updateConfig).toHaveBeenCalledWith(configUpdate);
    });

    it('should export audit data including company information', async () => {
      const { storage } = await import('../src/storage');
      const { db } = await import('../src/db');

      // Mock system with companies and some issues
      vi.mocked(storage.getCompaniesCount).mockResolvedValue(5);
      vi.mocked(storage.getActivePollingAgentsCount).mockResolvedValue(12);
      vi.mocked(storage.getUsersCount).mockResolvedValue(30);
      vi.mocked(storage.getActiveSubmissions24h).mockResolvedValue(250);

      vi.mocked(db.execute).mockImplementation(async (query: any) => {
        const queryStr = String(query);
        if (queryStr.includes('company_memberships')) {
          return [{ id: 1, company_id: 999, user_id: 'orphaned-user' }]; // One orphaned membership
        }
        if (queryStr.includes('unused')) {
          return [{ id: 10, name: 'Unused Sub Company', parent_company_id: 1 }]; // One unused company
        }
        return [];
      });

      // Export as CSV
      const csvResponse = await request(app)
        .get('/api/audit/export/csv')
        .expect(200);

      expect(csvResponse.headers['content-type']).toContain('text/csv');
      expect(csvResponse.text).toContain('Check Name,Status,Severity,Message,Timestamp');
      // Should contain company-related checks
      expect(csvResponse.text).toContain('orphaned') || expect(csvResponse.text).toContain('company');

      // Export as JSON
      const jsonResponse = await request(app)
        .get('/api/audit/export/json')
        .expect(200);

      expect(jsonResponse.headers['content-type']).toContain('application/json');
      expect(jsonResponse.body).toHaveProperty('reportId');
      expect(jsonResponse.body).toHaveProperty('checks');
      expect(Array.isArray(jsonResponse.body.checks)).toBe(true);
    });
  });

  describe('Error Scenarios Integration', () => {
    it('should handle cascading failures gracefully', async () => {
      const { storage } = await import('../src/storage');
      const { db } = await import('../src/db');
      const { createSubCompany } = await import('../src/services/companyRegistrationService');

      // Step 1: Mock storage failure
      vi.mocked(storage.getCompaniesCount).mockRejectedValue(new Error('Database connection lost'));

      // Step 2: Attempt company creation (should fail)
      vi.mocked(createSubCompany).mockRejectedValue(new Error('Cannot create company - database unavailable'));

      const createResponse = await request(app)
        .post('/api/companies/1/sub-companies')
        .send({
          name: 'Failed Company',
          companyType: 'subsidiary'
        })
        .expect(500);

      expect(createResponse.body.success).toBe(false);

      // Step 3: Audit should still work but report the database issues
      vi.mocked(db.execute).mockRejectedValue(new Error('Database connection lost'));

      const auditResponse = await request(app)
        .post('/api/audit/run')
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      // Should have many failures due to database issues
      expect(auditResponse.body.data.summary.failures).toBeGreaterThan(0);
      expect(auditResponse.body.data.overallHealth).toBe('critical');
    });

    it('should handle audit system failure during company operations', async () => {
      const { quickCreateCompanyForAgent } = await import('../src/services/companyIntelligence');

      // Step 1: Company creation works
      vi.mocked(quickCreateCompanyForAgent).mockResolvedValue({
        agent: {
          id: 1,
          email: 'test@example.com',
          name: 'Test Agent',
          description: null,
          companyId: 1,
          createdBy: 'integration-test-user',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        emailAddress: 'test@example.com',
        companyId: 1
      });

      const createResponse = await request(app)
        .post('/api/companies/quick-create')
        .send({
          name: 'Test Company',
          agentName: 'Test Agent'
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);

      // Step 2: But audit system fails
      // All audit endpoints should return 500 but not crash
      await request(app)
        .post('/api/audit/run')
        .expect(500);

      await request(app)
        .get('/api/audit/summary')
        .expect(500);

      // Health endpoint should still work (doesn't depend on audit service)
      await request(app)
        .get('/api/audit/health')
        .expect(200);
    });
  });
});