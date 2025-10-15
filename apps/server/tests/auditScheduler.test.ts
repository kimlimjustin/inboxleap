import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { auditScheduler } from '../src/services/auditScheduler';

// Mock audit service
vi.mock('../src/services/auditService', () => ({
  auditService: {
    runCompleteAudit: vi.fn(),
    auditPerformance: vi.fn(),
    auditSecurity: vi.fn(),
  },
}));

// Mock performance monitor
vi.mock('../src/services/performanceMonitor', () => ({
  performanceMonitor: {
    recordMetric: vi.fn(),
  },
}));

// Mock timers
vi.useFakeTimers();

describe('AuditScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    // Stop scheduler to clean up
    auditScheduler.stop();
    vi.restoreAllMocks();
  });

  describe('start', () => {
    it('should start the audit scheduler successfully', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      // Mock successful audit
      vi.mocked(auditService.runCompleteAudit).mockResolvedValue({
        reportId: 'audit_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: {
          totalChecks: 10,
          passed: 9,
          warnings: 1,
          failures: 0
        },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      });

      await auditScheduler.start();
      
      const status = auditScheduler.getStatus();
      expect(status.isRunning).toBe(true);
      expect(auditService.runCompleteAudit).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      vi.mocked(auditService.runCompleteAudit).mockResolvedValue({
        reportId: 'audit_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: { totalChecks: 10, passed: 10, warnings: 0, failures: 0 },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      });

      await auditScheduler.start();
      const firstCallCount = vi.mocked(auditService.runCompleteAudit).mock.calls.length;
      
      await auditScheduler.start(); // Try to start again
      const secondCallCount = vi.mocked(auditService.runCompleteAudit).mock.calls.length;
      
      // Should not run audit again
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('should handle initial audit failure gracefully', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      // Mock audit failure
      vi.mocked(auditService.runCompleteAudit).mockRejectedValue(new Error('Audit failed'));

      await expect(auditScheduler.start()).resolves.not.toThrow();
      
      const status = auditScheduler.getStatus();
      expect(status.isRunning).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop the audit scheduler', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      vi.mocked(auditService.runCompleteAudit).mockResolvedValue({
        reportId: 'audit_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: { totalChecks: 10, passed: 10, warnings: 0, failures: 0 },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      });

      await auditScheduler.start();
      expect(auditScheduler.getStatus().isRunning).toBe(true);
      
      auditScheduler.stop();
      expect(auditScheduler.getStatus().isRunning).toBe(false);
    });

    it('should handle stop when not running', () => {
      expect(auditScheduler.getStatus().isRunning).toBe(false);
      
      // Should not throw
      expect(() => auditScheduler.stop()).not.toThrow();
    });
  });

  describe('updateConfig', () => {
    it('should update scheduler configuration', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      vi.mocked(auditService.runCompleteAudit).mockResolvedValue({
        reportId: 'audit_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: { totalChecks: 10, passed: 10, warnings: 0, failures: 0 },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      });

      await auditScheduler.start();
      
      const newConfig = {
        fullAuditInterval: 60000, // 1 minute
        quickHealthInterval: 30000, // 30 seconds
        alertThresholds: {
          criticalFailures: 1,
          highFailures: 2,
          warningFailures: 5
        }
      };

      auditScheduler.updateConfig(newConfig);
      
      const status = auditScheduler.getStatus();
      expect(status.config.fullAuditInterval).toBe(60000);
      expect(status.config.quickHealthInterval).toBe(30000);
    });

    it('should restart scheduler with new config when running', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      vi.mocked(auditService.runCompleteAudit).mockResolvedValue({
        reportId: 'audit_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: { totalChecks: 10, passed: 10, warnings: 0, failures: 0 },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      });

      await auditScheduler.start();
      expect(auditScheduler.getStatus().isRunning).toBe(true);
      
      auditScheduler.updateConfig({ fullAuditInterval: 30000 });
      
      // Should still be running with new config
      expect(auditScheduler.getStatus().isRunning).toBe(true);
      expect(auditScheduler.getStatus().config.fullAuditInterval).toBe(30000);
    });
  });

  describe('getStatus', () => {
    it('should return correct status when not running', () => {
      const status = auditScheduler.getStatus();
      
      expect(status.isRunning).toBe(false);
      expect(status.config).toBeDefined();
      expect(status.lastAudit).toBeNull();
      expect(status.nextFullAudit).toBeNull();
      expect(status.nextHealthCheck).toBeNull();
    });

    it('should return correct status when running', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockReport = {
        reportId: 'audit_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: { totalChecks: 10, passed: 10, warnings: 0, failures: 0 },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      };
      
      vi.mocked(auditService.runCompleteAudit).mockResolvedValue(mockReport);

      await auditScheduler.start();
      const status = auditScheduler.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.lastAudit).toBeDefined();
      expect(status.lastAudit?.reportId).toBe('audit_123');
      expect(status.lastAudit?.overallHealth).toBe('healthy');
    });
  });

  describe('scheduled audits', () => {
    it('should run scheduled full audits', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      vi.mocked(auditService.runCompleteAudit).mockResolvedValue({
        reportId: 'audit_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: { totalChecks: 10, passed: 10, warnings: 0, failures: 0 },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      });

      // Set short interval for testing
      auditScheduler.updateConfig({
        fullAuditInterval: 1000, // 1 second
        quickHealthInterval: 500   // 0.5 seconds
      });

      await auditScheduler.start();
      
      // Clear initial call
      vi.mocked(auditService.runCompleteAudit).mockClear();
      
      // Fast forward time
      await vi.advanceTimersByTimeAsync(1000);
      
      // Should have run scheduled audit
      expect(auditService.runCompleteAudit).toHaveBeenCalled();
    });

    it('should run quick health checks', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      vi.mocked(auditService.runCompleteAudit).mockResolvedValue({
        reportId: 'audit_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: { totalChecks: 10, passed: 10, warnings: 0, failures: 0 },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      });
      
      vi.mocked(auditService.auditPerformance).mockResolvedValue([]);
      vi.mocked(auditService.auditSecurity).mockResolvedValue([]);

      // Set short interval for testing
      auditScheduler.updateConfig({
        fullAuditInterval: 10000,  // 10 seconds
        quickHealthInterval: 1000  // 1 second
      });

      await auditScheduler.start();
      
      // Clear initial calls
      vi.clearAllMocks();
      
      // Fast forward time
      await vi.advanceTimersByTimeAsync(1000);
      
      // Should have run health checks
      expect(auditService.auditPerformance).toHaveBeenCalled();
      expect(auditService.auditSecurity).toHaveBeenCalled();
    });
  });

  describe('getLastAuditReport', () => {
    it('should return null when no audit has run', () => {
      const report = auditScheduler.getLastAuditReport();
      expect(report).toBeNull();
    });

    it('should return last audit report after audit runs', async () => {
      const { auditService } = await import('../src/services/auditService');
      
      const mockReport = {
        reportId: 'audit_123',
        generatedAt: new Date(),
        overallHealth: 'healthy' as const,
        summary: { totalChecks: 10, passed: 10, warnings: 0, failures: 0 },
        checks: [],
        recommendations: [],
        systemMetrics: {}
      };
      
      vi.mocked(auditService.runCompleteAudit).mockResolvedValue(mockReport);

      await auditScheduler.start();
      const report = auditScheduler.getLastAuditReport();
      
      expect(report).toBeDefined();
      expect(report?.reportId).toBe('audit_123');
    });
  });
});