import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auditDashboard } from '../src/services/auditDashboard';

// Mock audit scheduler
vi.mock('../src/services/auditScheduler', () => ({
  auditScheduler: {
    getLastAuditReport: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      isRunning: true
    })
  },
}));

// Mock audit service
vi.mock('../src/services/auditService', () => ({
  auditService: {
    auditCompanySystem: vi.fn(),
    auditAgentSystem: vi.fn(),
    auditPerformance: vi.fn(),
    auditSecurity: vi.fn(),
    auditDataIntegrity: vi.fn(),
  },
}));

// Mock performance monitor
vi.mock('../src/services/performanceMonitor', () => ({
  performanceMonitor: {
    getPerformanceDashboard: vi.fn().mockReturnValue({
      summary: {
        successRate: 98.5,
        averageResponseTime: 245
      }
    })
  },
}));

// Mock batch processing queue
vi.mock('../src/services/batchProcessingQueue', () => ({
  batchProcessingQueue: {
    getQueueStats: vi.fn().mockReturnValue({
      totalQueued: 5
    })
  },
}));

describe('AuditDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboardSummary', () => {
    it('should return dashboard summary with healthy system', async () => {
      const { auditScheduler } = await import('../src/services/auditScheduler');
      
      // Mock healthy audit report
      const mockReport = {
        reportId: 'audit_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: {
          totalChecks: 20,
          passed: 18,
          warnings: 2,
          failures: 0
        },
        checks: [],
        recommendations: ['Keep up the good work'],
        systemMetrics: {}
      };
      
      vi.mocked(auditScheduler.getLastAuditReport).mockReturnValue(mockReport);

      const dashboard = await auditDashboard.getDashboardSummary();

      expect(dashboard.systemHealth.status).toBe('healthy');
      expect(dashboard.systemHealth.score).toBeGreaterThan(80);
      expect(dashboard.quickStats).toBeDefined();
      expect(dashboard.recentIssues).toBeDefined();
      expect(dashboard.systemComponents).toBeDefined();
      expect(dashboard.recommendations).toEqual(['Keep up the good work']);
    });

    it('should return dashboard summary with degraded system', async () => {
      const { auditScheduler } = await import('../src/services/auditScheduler');
      
      // Mock degraded audit report
      const mockReport = {
        reportId: 'audit_124',
        generatedAt: new Date(),
        overallHealth: 'degraded' as const,
        summary: {
          totalChecks: 20,
          passed: 15,
          warnings: 3,
          failures: 2
        },
        checks: [
          {
            checkName: 'test_check',
            status: 'fail' as const,
            severity: 'high' as const,
            message: 'High severity issue',
            timestamp: new Date(),
            details: 'Test details'
          }
        ],
        recommendations: ['Fix high severity issues'],
        systemMetrics: {}
      };
      
      vi.mocked(auditScheduler.getLastAuditReport).mockReturnValue(mockReport);

      const dashboard = await auditDashboard.getDashboardSummary();

      expect(dashboard.systemHealth.status).toBe('degraded');
      expect(dashboard.systemHealth.score).toBeLessThan(85);
      expect(dashboard.recentIssues.high).toBe(1);
      expect(dashboard.recommendations).toContain('Fix high severity issues');
    });

    it('should return critical status when no audit report available', async () => {
      const { auditScheduler } = await import('../src/services/auditScheduler');
      
      vi.mocked(auditScheduler.getLastAuditReport).mockReturnValue(null);

      const dashboard = await auditDashboard.getDashboardSummary();

      expect(dashboard.systemHealth.status).toBe('critical');
      expect(dashboard.systemHealth.score).toBe(0);
    });

    it('should handle dashboard generation errors gracefully', async () => {
      const { auditScheduler } = await import('../src/services/auditScheduler');
      
      // Mock error
      vi.mocked(auditScheduler.getLastAuditReport).mockImplementation(() => {
        throw new Error('Dashboard error');
      });

      const dashboard = await auditDashboard.getDashboardSummary();

      expect(dashboard.systemHealth.status).toBe('critical');
      expect(dashboard.systemHealth.score).toBe(0);
      expect(dashboard.quickStats.totalCompanies).toBe(-1);
      expect(dashboard.recommendations).toContain('Dashboard system error - immediate investigation required');
    });
  });

  describe('getDetailedHealthCheck', () => {
    it('should return detailed health check for companies component', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockChecks = [
        {
          checkName: 'company_count',
          status: 'pass' as const,
          severity: 'medium' as const,
          message: 'Company count is normal',
          timestamp: new Date(),
          details: 'Found 5 companies'
        }
      ];
      
      vi.mocked(auditService.auditCompanySystem).mockResolvedValue(mockChecks);

      const healthCheck = await auditDashboard.getDetailedHealthCheck('companies');

      expect(healthCheck.component).toBe('companies');
      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.checks).toHaveLength(1);
      expect(healthCheck.checks[0].name).toBe('company_count');
      expect(healthCheck.metrics).toBeDefined();
      expect(Array.isArray(healthCheck.alerts)).toBe(true);
    });

    it('should return detailed health check for agents component', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockChecks = [
        {
          checkName: 'agent_activity',
          status: 'warning' as const,
          severity: 'medium' as const,
          message: 'Some agents are inactive',
          timestamp: new Date(),
          details: 'Found 2 inactive agents'
        }
      ];
      
      vi.mocked(auditService.auditAgentSystem).mockResolvedValue(mockChecks);

      const healthCheck = await auditDashboard.getDetailedHealthCheck('agents');

      expect(healthCheck.component).toBe('agents');
      expect(healthCheck.status).toBe('healthy'); // No critical failures
      expect(healthCheck.checks).toHaveLength(1);
      expect(healthCheck.checks[0].status).toBe('warning');
    });

    it('should return critical status for component with critical failures', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockChecks = [
        {
          checkName: 'critical_security_issue',
          status: 'fail' as const,
          severity: 'critical' as const,
          message: 'Critical security vulnerability detected',
          timestamp: new Date(),
          details: 'Immediate action required'
        }
      ];
      
      vi.mocked(auditService.auditSecurity).mockResolvedValue(mockChecks);

      const healthCheck = await auditDashboard.getDetailedHealthCheck('security');

      expect(healthCheck.component).toBe('security');
      expect(healthCheck.status).toBe('critical');
      expect(healthCheck.alerts).toHaveLength(1);
    });

    it('should handle unknown component gracefully', async () => {
      const healthCheck = await auditDashboard.getDetailedHealthCheck('unknown');

      expect(healthCheck.component).toBe('unknown');
      expect(healthCheck.status).toBe('critical');
      expect(healthCheck.checks).toHaveLength(1);
      expect(healthCheck.checks[0].status).toBe('fail');
      expect(healthCheck.checks[0].message).toContain('Unknown component');
    });

    it('should handle audit service errors', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      vi.mocked(auditService.auditPerformance).mockRejectedValue(new Error('Performance audit failed'));

      const healthCheck = await auditDashboard.getDetailedHealthCheck('performance');

      expect(healthCheck.component).toBe('performance');
      expect(healthCheck.status).toBe('critical');
      expect(healthCheck.checks[0].status).toBe('fail');
      expect(healthCheck.checks[0].message).toContain('Failed to run health check');
    });
  });

  describe('getSystemTrends', () => {
    it('should return system trends for 7d timeframe', async () => {
      const trends = await auditDashboard.getSystemTrends('7d');

      expect(trends.timeRange).toBe('7d');
      expect(trends.healthScore).toBeDefined();
      expect(trends.healthScore.current).toBeDefined();
      expect(trends.healthScore.trend).toBeDefined();
      expect(Array.isArray(trends.healthScore.dataPoints)).toBe(true);
      expect(trends.issuesTrend).toBeDefined();
      expect(trends.performanceTrend).toBeDefined();
    });

    it('should return system trends for 24h timeframe', async () => {
      const trends = await auditDashboard.getSystemTrends('24h');

      expect(trends.timeRange).toBe('24h');
      expect(trends.healthScore).toBeDefined();
    });

    it('should return system trends for 30d timeframe', async () => {
      const trends = await auditDashboard.getSystemTrends('30d');

      expect(trends.timeRange).toBe('30d');
      expect(trends.healthScore).toBeDefined();
    });

    it('should default to 7d timeframe when no parameter provided', async () => {
      const trends = await auditDashboard.getSystemTrends();

      expect(trends.timeRange).toBe('7d');
    });
  });

  describe('health score calculation', () => {
    it('should calculate health score correctly for perfect system', async () => {
      const { auditScheduler } = await import('../src/services/auditScheduler');
      
      const mockReport = {
        reportId: 'audit_perfect',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: {
          totalChecks: 20,
          passed: 20,
          warnings: 0,
          failures: 0
        },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      };
      
      vi.mocked(auditScheduler.getLastAuditReport).mockReturnValue(mockReport);

      const dashboard = await auditDashboard.getDashboardSummary();

      expect(dashboard.systemHealth.score).toBe(100);
      expect(dashboard.systemHealth.status).toBe('healthy');
    });

    it('should calculate health score correctly with warnings', async () => {
      const { auditScheduler } = await import('../src/services/auditScheduler');
      
      const mockReport = {
        reportId: 'audit_warnings',
        generatedAt: new Date(),
        overallHealth: 'degraded' as const,
        summary: {
          totalChecks: 20,
          passed: 15,
          warnings: 5,
          failures: 0
        },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      };
      
      vi.mocked(auditScheduler.getLastAuditReport).mockReturnValue(mockReport);

      const dashboard = await auditDashboard.getDashboardSummary();

      expect(dashboard.systemHealth.score).toBeLessThan(100);
      expect(dashboard.systemHealth.score).toBeGreaterThan(70);
    });

    it('should calculate health score correctly with failures', async () => {
      const { auditScheduler } = await import('../src/services/auditScheduler');
      
      const mockReport = {
        reportId: 'audit_failures',
        generatedAt: new Date(),
        overallHealth: 'critical' as const,
        summary: {
          totalChecks: 20,
          passed: 10,
          warnings: 5,
          failures: 5
        },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      };
      
      vi.mocked(auditScheduler.getLastAuditReport).mockReturnValue(mockReport);

      const dashboard = await auditDashboard.getDashboardSummary();

      expect(dashboard.systemHealth.score).toBeLessThan(70);
    });
  });
});