import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerAuditRoutes } from '../src/routes/audit';

// Mock dependencies
vi.mock('../src/googleAuth', () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    // Mock user authentication
    req.user = { id: 'test-user-123' };
    next();
  })
}));

vi.mock('../src/services/auditService', () => ({
  auditService: {
    runCompleteAudit: vi.fn(),
    auditCompanySystem: vi.fn(),
    auditDataIntegrity: vi.fn(),
    auditPerformance: vi.fn(),
    auditSecurity: vi.fn(),
    auditAgentSystem: vi.fn(),
  },
}));

vi.mock('../src/services/auditDashboard', () => ({
  auditDashboard: {
    getDashboardSummary: vi.fn(),
    getDetailedHealthCheck: vi.fn(),
    getSystemTrends: vi.fn(),
  },
}));

vi.mock('../src/services/auditScheduler', () => ({
  auditScheduler: {
    getStatus: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

describe('Audit Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerAuditRoutes(app);
    vi.clearAllMocks();
  });

  describe('POST /api/audit/run', () => {
    it('should run complete audit successfully', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockReport = {
        reportId: 'audit_test_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: {
          totalChecks: 25,
          passed: 23,
          warnings: 2,
          failures: 0
        },
        checks: [],
        recommendations: ['System is healthy'],
        systemMetrics: {}
      };

      vi.mocked(auditService.runCompleteAudit).mockResolvedValue(mockReport);

      const response = await request(app)
        .post('/api/audit/run')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reportId).toBe('audit_test_123');
      expect(response.body.data.overallHealth).toBe('healthy');
      expect(auditService.runCompleteAudit).toHaveBeenCalled();
    });

    it('should handle audit service errors', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      vi.mocked(auditService.runCompleteAudit).mockRejectedValue(new Error('Audit failed'));

      const response = await request(app)
        .post('/api/audit/run')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to run system audit');
      expect(response.body.error).toBe('Audit failed');
    });
  });

  describe('GET /api/audit/summary', () => {
    it('should return audit summary successfully', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockReport = {
        reportId: 'audit_summary_123',
        generatedAt: new Date(),
        overallHealth: 'degraded' as const,
        summary: {
          totalChecks: 25,
          passed: 20,
          warnings: 3,
          failures: 2
        },
        checks: [
          {
            checkName: 'test_check',
            status: 'fail' as const,
            severity: 'critical' as const,
            message: 'Critical issue',
            timestamp: new Date(),
            details: 'Test details'
          },
          {
            checkName: 'test_check_2',
            status: 'fail' as const,
            severity: 'high' as const,
            message: 'High priority issue',
            timestamp: new Date(),
            details: 'Test details 2'
          }
        ],
        recommendations: ['Fix critical issues', 'Review high priority items'],
        systemMetrics: {}
      };

      vi.mocked(auditService.runCompleteAudit).mockResolvedValue(mockReport);

      const response = await request(app)
        .get('/api/audit/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reportId).toBe('audit_summary_123');
      expect(response.body.data.overallHealth).toBe('degraded');
      expect(response.body.data.criticalIssues).toBe(1);
      expect(response.body.data.highPriorityIssues).toBe(1);
      expect(response.body.data.topRecommendations).toHaveLength(2);
    });

    it('should handle summary generation errors', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      vi.mocked(auditService.runCompleteAudit).mockRejectedValue(new Error('Summary failed'));

      const response = await request(app)
        .get('/api/audit/summary')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get audit summary');
    });
  });

  describe('POST /api/audit/category/:category', () => {
    it('should run company audit successfully', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockChecks = [
        {
          checkName: 'company_count',
          status: 'pass' as const,
          severity: 'medium' as const,
          message: 'Company count is normal',
          timestamp: new Date(),
          details: 'Found 5 companies',
          recommendations: ['Monitor company growth']
        }
      ];

      vi.mocked(auditService.auditCompanySystem).mockResolvedValue(mockChecks);

      const response = await request(app)
        .post('/api/audit/category/company')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.category).toBe('company');
      expect(response.body.data.summary.totalChecks).toBe(1);
      expect(response.body.data.summary.passed).toBe(1);
      expect(response.body.data.checks).toHaveLength(1);
      expect(response.body.data.recommendations).toContain('Monitor company growth');
    });

    it('should run data-integrity audit successfully', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockChecks = [
        {
          checkName: 'orphaned_records',
          status: 'warning' as const,
          severity: 'medium' as const,
          message: 'Found orphaned records',
          timestamp: new Date(),
          details: 'Found 3 orphaned records'
        }
      ];

      vi.mocked(auditService.auditDataIntegrity).mockResolvedValue(mockChecks);

      const response = await request(app)
        .post('/api/audit/category/data-integrity')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.category).toBe('data-integrity');
      expect(response.body.data.summary.warnings).toBe(1);
    });

    it('should return 400 for invalid category', async () => {
      const response = await request(app)
        .post('/api/audit/category/invalid-category')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid audit category');
    });

    it('should handle category audit errors', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      vi.mocked(auditService.auditSecurity).mockRejectedValue(new Error('Security audit failed'));

      const response = await request(app)
        .post('/api/audit/category/security')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to run security audit');
    });
  });

  describe('GET /api/audit/health', () => {
    it('should return system health check', async () => {
      const response = await request(app)
        .get('/api/audit/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.healthy).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(Array.isArray(response.body.checks)).toBe(true);
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/audit/metrics', () => {
    it('should return audit metrics with default timeRange', async () => {
      const response = await request(app)
        .get('/api/audit/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeRange).toBe('7d');
      expect(Array.isArray(response.body.data.dataPoints)).toBe(true);
      expect(response.body.data.trends).toBeDefined();
    });

    it('should return audit metrics with custom timeRange', async () => {
      const response = await request(app)
        .get('/api/audit/metrics?timeRange=30d')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeRange).toBe('30d');
    });
  });

  describe('GET /api/audit/export/:format', () => {
    it('should export audit report as JSON', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockReport = {
        reportId: 'export_test_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: { totalChecks: 10, passed: 10, warnings: 0, failures: 0 },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      };

      vi.mocked(auditService.runCompleteAudit).mockResolvedValue(mockReport);

      const response = await request(app)
        .get('/api/audit/export/json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.reportId).toBe('export_test_123');
    });

    it('should export audit report as CSV', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockReport = {
        reportId: 'export_csv_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: { totalChecks: 1, passed: 1, warnings: 0, failures: 0 },
        checks: [
          {
            checkName: 'test_check',
            status: 'pass' as const,
            severity: 'low' as const,
            message: 'Test passed',
            timestamp: new Date()
          }
        ],
        recommendations: [],
        systemMetrics: {}
      };

      vi.mocked(auditService.runCompleteAudit).mockResolvedValue(mockReport);

      const response = await request(app)
        .get('/api/audit/export/csv')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('Check Name,Status,Severity,Message,Timestamp');
    });

    it('should return 400 for invalid export format', async () => {
      const response = await request(app)
        .get('/api/audit/export/xml')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid export format. Supported formats: json, csv');
    });
  });

  describe('GET /api/audit/dashboard', () => {
    it('should return dashboard summary', async () => {
      const { auditDashboard } = await import('../src/services/auditDashboard');
      
      const mockDashboard = {
        systemHealth: {
          status: 'healthy' as const,
          score: 95,
          lastUpdated: new Date()
        },
        quickStats: {
          totalCompanies: 5,
          totalAgents: 10,
          totalUsers: 25,
          activeSubmissions24h: 100
        },
        recentIssues: {
          critical: 0,
          high: 1,
          medium: 2
        },
        systemComponents: {
          database: 'healthy' as const,
          batchProcessing: 'healthy' as const,
          auditSystem: 'healthy' as const,
          performance: 'degraded' as const
        },
        upcomingMaintenance: [],
        recommendations: ['System performing well']
      };

      vi.mocked(auditDashboard.getDashboardSummary).mockResolvedValue(mockDashboard);

      const response = await request(app)
        .get('/api/audit/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.systemHealth.status).toBe('healthy');
      expect(response.body.data.systemHealth.score).toBe(95);
      expect(response.body.data.quickStats.totalCompanies).toBe(5);
    });
  });

  describe('GET /api/audit/component/:component', () => {
    it('should return detailed health check for component', async () => {
      const { auditDashboard } = await import('../src/services/auditDashboard');
      
      const mockHealthCheck = {
        component: 'performance',
        status: 'degraded' as const,
        checks: [
          {
            name: 'response_time',
            status: 'warning' as const,
            message: 'Response time is elevated',
            lastRun: new Date()
          }
        ],
        metrics: {
          averageResponseTime: 500,
          successRate: 95
        },
        alerts: []
      };

      vi.mocked(auditDashboard.getDetailedHealthCheck).mockResolvedValue(mockHealthCheck);

      const response = await request(app)
        .get('/api/audit/component/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.component).toBe('performance');
      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.checks).toHaveLength(1);
    });
  });

  describe('GET /api/audit/trends', () => {
    it('should return system trends with default timeRange', async () => {
      const { auditDashboard } = await import('../src/services/auditDashboard');
      
      const mockTrends = {
        timeRange: '7d',
        healthScore: {
          current: 85,
          trend: 'improving',
          dataPoints: []
        },
        issuesTrend: {
          critical: { current: 0, change: 0 },
          high: { current: 1, change: -1 },
          medium: { current: 2, change: 1 }
        },
        performanceTrend: {
          averageResponseTime: { current: 245, change: -15 }
        }
      };

      vi.mocked(auditDashboard.getSystemTrends).mockResolvedValue(mockTrends);

      const response = await request(app)
        .get('/api/audit/trends')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeRange).toBe('7d');
      expect(response.body.data.healthScore.current).toBe(85);
    });

    it('should return system trends with custom timeRange', async () => {
      const { auditDashboard } = await import('../src/services/auditDashboard');
      
      vi.mocked(auditDashboard.getSystemTrends).mockResolvedValue({
        timeRange: '24h',
        healthScore: { current: 90, trend: 'stable', dataPoints: [] },
        issuesTrend: { critical: { current: 0, change: 0 }, high: { current: 0, change: 0 }, medium: { current: 1, change: 0 } },
        performanceTrend: { averageResponseTime: { current: 200, change: 0 } }
      });

      const response = await request(app)
        .get('/api/audit/trends?timeRange=24h')
        .expect(200);

      expect(response.body.data.timeRange).toBe('24h');
      expect(auditDashboard.getSystemTrends).toHaveBeenCalledWith('24h');
    });
  });

  describe('GET /api/audit/scheduler/status', () => {
    it('should return scheduler status', async () => {
      const { auditScheduler } = await import('../src/services/auditScheduler');
      
      const mockStatus = {
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
        lastAudit: null,
        nextFullAudit: new Date(Date.now() + 14400000),
        nextHealthCheck: new Date(Date.now() + 900000)
      };

      vi.mocked(auditScheduler.getStatus).mockReturnValue(mockStatus);

      const response = await request(app)
        .get('/api/audit/scheduler/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isRunning).toBe(true);
      expect(response.body.data.config.enabled).toBe(true);
    });
  });

  describe('PATCH /api/audit/scheduler/config', () => {
    it('should update scheduler configuration successfully', async () => {
      const { auditScheduler } = await import('../src/services/auditScheduler');
      
      const mockUpdatedStatus = {
        isRunning: true,
        config: {
          enabled: true,
          fullAuditInterval: 7200000, // 2 hours
          quickHealthInterval: 600000,  // 10 minutes
          alertThresholds: {
            criticalFailures: 1,
            highFailures: 2,
            warningFailures: 5
          },
          notificationSettings: {
            emailAlerts: false
          }
        },
        lastAudit: null,
        nextFullAudit: null,
        nextHealthCheck: null
      };

      vi.mocked(auditScheduler.getStatus).mockReturnValue(mockUpdatedStatus);

      const updateData = {
        fullAuditInterval: 7200000,
        quickHealthInterval: 600000,
        alertThresholds: {
          criticalFailures: 1,
          highFailures: 2,
          warningFailures: 5
        }
      };

      const response = await request(app)
        .patch('/api/audit/scheduler/config')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Audit scheduler configuration updated');
      expect(response.body.data.config.fullAuditInterval).toBe(7200000);
      expect(auditScheduler.updateConfig).toHaveBeenCalledWith(updateData);
    });

    it('should validate configuration schema', async () => {
      const invalidConfig = {
        fullAuditInterval: 30000, // Too short (less than 1 minute)
        quickHealthInterval: 15000, // Too short (less than 30 seconds)
        alertThresholds: {
          criticalFailures: -1 // Negative value
        }
      };

      const response = await request(app)
        .patch('/api/audit/scheduler/config')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid configuration');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });
  });
});