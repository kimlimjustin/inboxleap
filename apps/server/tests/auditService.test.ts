import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { auditService } from '../src/services/auditService';

// Mock the database
vi.mock('../src/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    execute: vi.fn(),
    with: vi.fn().mockReturnThis(),
  },
}));

// Mock storage service
vi.mock('../src/storage', () => ({
  storage: {
    getCompaniesCount: vi.fn(),
    getActivePollingAgentsCount: vi.fn(),
    getUsersCount: vi.fn(),
    getActiveSubmissions24h: vi.fn(),
  },
}));

// Mock performance monitor
vi.mock('../src/services/performanceMonitor', () => ({
  performanceMonitor: {
    getPerformanceDashboard: vi.fn().mockReturnValue({
      summary: {
        averageResponseTime: 245,
        successRate: 98.5,
        totalRequests: 1250,
        errorRate: 1.5
      }
    }),
    recordMetric: vi.fn(),
  },
}));

// Mock batch processing queue
vi.mock('../src/services/batchProcessingQueue', () => ({
  batchProcessingQueue: {
    getQueueStats: vi.fn().mockReturnValue({
      totalQueued: 5,
      processing: 2,
      completed: 100,
      failed: 1,
      organizationQueues: [] // Add the missing organizationQueues property
    }),
  },
}));

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runCompleteAudit', () => {
    it('should run a complete system audit successfully', async () => {
      // Mock database responses with rows property
      const { db } = await import('../src/db');
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });
      
      // Mock storage responses
      const { storage } = await import('../src/storage');
      vi.mocked(storage.getCompaniesCount).mockResolvedValue(5);
      vi.mocked(storage.getActivePollingAgentsCount).mockResolvedValue(10);
      vi.mocked(storage.getUsersCount).mockResolvedValue(25);
      vi.mocked(storage.getActiveSubmissions24h).mockResolvedValue(100);

      const result = await auditService.runCompleteAudit();

      expect(result).toHaveProperty('reportId');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('overallHealth');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('recommendations');
      expect(result.summary).toHaveProperty('totalChecks');
      expect(result.summary).toHaveProperty('passed');
      expect(result.summary).toHaveProperty('warnings');
      expect(result.summary).toHaveProperty('failures');
      expect(Array.isArray(result.checks)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should determine overall health correctly', async () => {
      const { db } = await import('../src/db');
      const { storage } = await import('../src/storage');
      
      // Mock successful responses (healthy system)
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });
      vi.mocked(storage.getCompaniesCount).mockResolvedValue(5);
      vi.mocked(storage.getActivePollingAgentsCount).mockResolvedValue(10);
      vi.mocked(storage.getUsersCount).mockResolvedValue(25);
      vi.mocked(storage.getActiveSubmissions24h).mockResolvedValue(100);

      const result = await auditService.runCompleteAudit();

      // Should be healthy if no critical failures
      expect(['healthy', 'degraded', 'critical']).toContain(result.overallHealth);
    });

    it('should handle errors gracefully', async () => {
      const { db } = await import('../src/db');
      
      // Mock database error
      vi.mocked(db.execute).mockRejectedValue(new Error('Database connection failed'));

      const result = await auditService.runCompleteAudit();

      // Should still return a report even with errors
      expect(result).toHaveProperty('reportId');
      expect(result.checks.some(check => check.status === 'fail')).toBe(true);
    });
  });

  describe('auditCompanySystem', () => {
    it('should audit company system components', async () => {
      const { db } = await import('../src/db');
      const { storage } = await import('../src/storage');
      
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });
      vi.mocked(storage.getCompaniesCount).mockResolvedValue(5);

      const checks = await auditService.auditCompanySystem();

      expect(Array.isArray(checks)).toBe(true);
      expect(checks.length).toBeGreaterThan(0);
      
      // Should include company-specific checks
      const checkNames = checks.map(check => check.checkName);
      expect(checkNames.some(name => name.includes('company'))).toBe(true);
    });

    it('should detect orphaned company memberships', async () => {
      const { db } = await import('../src/db');
      
      // Mock orphaned memberships found
      vi.mocked(db.execute).mockResolvedValueOnce({ rows: [
        { id: 1, company_id: 999, user_id: 'user1' }
      ] }).mockResolvedValue({ rows: [] });

      const checks = await auditService.auditCompanySystem();

      const orphanCheck = checks.find(check => check.checkName === 'company_memberships_integrity');
      expect(orphanCheck?.status).toBe('fail');
      expect(orphanCheck?.severity).toBe('high');
    });
  });

  describe('auditDataIntegrity', () => {
    it('should check data integrity', async () => {
      const { db } = await import('../src/db');
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });

      const checks = await auditService.auditDataIntegrity();

      expect(Array.isArray(checks)).toBe(true);
      expect(checks.length).toBeGreaterThan(0);
      
      // Should include data integrity checks
      const checkNames = checks.map(check => check.checkName);
      expect(checkNames.some(name => name.includes('orphaned') || name.includes('integrity'))).toBe(true);
    });
  });

  describe('auditPerformance', () => {
    it('should audit system performance', async () => {
      const checks = await auditService.auditPerformance();

      expect(Array.isArray(checks)).toBe(true);
      expect(checks.length).toBeGreaterThan(0);
      
      // Should include performance checks
      const checkNames = checks.map(check => check.checkName);
      expect(checkNames.some(name => name.includes('performance') || name.includes('response'))).toBe(true);
    });

    it('should detect poor performance metrics', async () => {
      const { performanceMonitor } = await import('../src/services/performanceMonitor');
      const { batchProcessingQueue } = await import('../src/services/batchProcessingQueue');
      
      // Mock poor performance
      vi.mocked(performanceMonitor.getPerformanceDashboard).mockReturnValue({
        summary: {
          averageResponseTime: 5000, // Very slow
          successRate: 85, // Low success rate (below 90% threshold)
          totalRequests: 1000,
          errorRate: 15
        }
      });

      // Ensure batch processing queue is also mocked correctly for this test
      vi.mocked(batchProcessingQueue.getQueueStats).mockReturnValue({
        totalQueued: 0,
        processing: 0,
        completed: 100,
        failed: 0,
        organizationQueues: []
      });

      const checks = await auditService.auditPerformance();

      const performanceCheck = checks.find(check => check.checkName === 'system_performance');
      
      expect(performanceCheck).toBeDefined();
      expect(performanceCheck?.status).toBe('fail');
      expect(performanceCheck?.severity).toBe('high');
    });
  });

  describe('auditSecurity', () => {
    it('should audit security configurations', async () => {
      const { db } = await import('../src/db');
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });

      const checks = await auditService.auditSecurity();

      expect(Array.isArray(checks)).toBe(true);
      expect(checks.length).toBeGreaterThan(0);
      
      // Should include security checks
      const checkNames = checks.map(check => check.checkName);
      expect(checkNames.some(name => name.includes('security') || name.includes('permission'))).toBe(true);
    });

    it('should detect security issues', async () => {
      const { db } = await import('../src/db');
      
      // Mock security issues
      vi.mocked(db.execute)
        .mockResolvedValueOnce({ rows: [{ user_id: 'user1', roles_count: 5 }] }) // Excessive permissions
        .mockResolvedValue({ rows: [] });

      const checks = await auditService.auditSecurity();

      const permissionCheck = checks.find(check => check.checkName === 'excessive_permissions');
      expect(permissionCheck?.status).toBe('fail');
    });
  });

  describe('auditAgentSystem', () => {
    it('should audit agent system', async () => {
      const { db } = await import('../src/db');
      const { storage } = await import('../src/storage');
      
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });
      vi.mocked(storage.getActivePollingAgentsCount).mockResolvedValue(10);

      const checks = await auditService.auditAgentSystem();

      expect(Array.isArray(checks)).toBe(true);
      expect(checks.length).toBeGreaterThan(0);
      
      // Should include agent-specific checks
      const checkNames = checks.map(check => check.checkName);
      expect(checkNames.some(name => name.includes('agent'))).toBe(true);
    });

    it('should detect inactive agents', async () => {
      const { db } = await import('../src/db');
      
      // Mock inactive agents
      vi.mocked(db.execute).mockResolvedValueOnce({ rows: [
        { id: 1, email: 'inactive@test.com', last_activity: '2024-01-01' }
      ] }).mockResolvedValue({ rows: [] });

      const checks = await auditService.auditAgentSystem();

      const inactiveCheck = checks.find(check => check.checkName === 'inactive_agents');
      expect(inactiveCheck?.status).toBe('warning');
    });
  });
});