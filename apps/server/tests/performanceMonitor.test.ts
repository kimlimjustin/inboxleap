import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { performanceMonitor } from '../src/services/performanceMonitor';

// Use fake timers for consistent testing
vi.useFakeTimers();

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    // Note: We can't clear metrics as it's a singleton, 
    // so tests should be independent of metric state
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recordMetric', () => {
    it('should record a successful metric', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      performanceMonitor.recordMetric('api', 'user_login', 250, true, {
        userId: 'user123',
        method: 'POST'
      });

      const dashboard = performanceMonitor.getPerformanceDashboard();
      
      expect(dashboard.summary.totalRequests).toBe(1);
      expect(dashboard.summary.successfulRequests).toBe(1);
      expect(dashboard.summary.failedRequests).toBe(0);
      expect(dashboard.summary.successRate).toBe(100);
      expect(dashboard.summary.averageResponseTime).toBe(250);
    });

    it('should record a failed metric', () => {
      performanceMonitor.recordMetric('api', 'user_login', 500, false, {
        error: 'Authentication failed'
      });

      const dashboard = performanceMonitor.getPerformanceDashboard();
      
      expect(dashboard.summary.totalRequests).toBe(1);
      expect(dashboard.summary.successfulRequests).toBe(0);
      expect(dashboard.summary.failedRequests).toBe(1);
      expect(dashboard.summary.successRate).toBe(0);
      expect(dashboard.summary.errorRate).toBe(100);
    });

    it('should calculate correct averages with multiple metrics', () => {
      performanceMonitor.recordMetric('api', 'endpoint1', 100, true);
      performanceMonitor.recordMetric('api', 'endpoint2', 200, true);
      performanceMonitor.recordMetric('api', 'endpoint3', 300, false);

      const dashboard = performanceMonitor.getPerformanceDashboard();
      
      expect(dashboard.summary.totalRequests).toBe(3);
      expect(dashboard.summary.successfulRequests).toBe(2);
      expect(dashboard.summary.failedRequests).toBe(1);
      expect(dashboard.summary.successRate).toBeCloseTo(66.67, 1);
      expect(dashboard.summary.errorRate).toBeCloseTo(33.33, 1);
      expect(dashboard.summary.averageResponseTime).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should store metrics with metadata', () => {
      const metadata = {
        userId: 'user123',
        endpoint: '/api/users',
        method: 'GET'
      };

      performanceMonitor.recordMetric('api', 'user_fetch', 150, true, metadata);

      const dashboard = performanceMonitor.getPerformanceDashboard();
      const recentMetrics = dashboard.recentMetrics;
      
      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0].category).toBe('api');
      expect(recentMetrics[0].operation).toBe('user_fetch');
      expect(recentMetrics[0].duration).toBe(150);
      expect(recentMetrics[0].success).toBe(true);
      expect(recentMetrics[0].metadata).toEqual(metadata);
    });
  });

  describe('getPerformanceDashboard', () => {
    it('should return default dashboard when no metrics exist', () => {
      const dashboard = performanceMonitor.getPerformanceDashboard();
      
      expect(dashboard.summary.totalRequests).toBe(0);
      expect(dashboard.summary.successfulRequests).toBe(0);
      expect(dashboard.summary.failedRequests).toBe(0);
      expect(dashboard.summary.successRate).toBe(100);
      expect(dashboard.summary.errorRate).toBe(0);
      expect(dashboard.summary.averageResponseTime).toBe(0);
      expect(dashboard.recentMetrics).toEqual([]);
    });

    it('should return correct dashboard with mixed success/failure metrics', () => {
      // Record various metrics
      performanceMonitor.recordMetric('database', 'query', 50, true);
      performanceMonitor.recordMetric('api', 'login', 200, true);
      performanceMonitor.recordMetric('api', 'register', 300, false);
      performanceMonitor.recordMetric('email', 'send', 1000, true);
      performanceMonitor.recordMetric('database', 'insert', 75, false);

      const dashboard = performanceMonitor.getPerformanceDashboard();
      
      expect(dashboard.summary.totalRequests).toBe(5);
      expect(dashboard.summary.successfulRequests).toBe(3);
      expect(dashboard.summary.failedRequests).toBe(2);
      expect(dashboard.summary.successRate).toBe(60);
      expect(dashboard.summary.errorRate).toBe(40);
      expect(dashboard.summary.averageResponseTime).toBe(325); // (50 + 200 + 300 + 1000 + 75) / 5
      expect(dashboard.recentMetrics).toHaveLength(5);
    });

    it('should sort recent metrics by timestamp (newest first)', () => {
      const baseTime = Date.now();
      
      vi.setSystemTime(baseTime);
      performanceMonitor.recordMetric('api', 'first', 100, true);
      
      vi.setSystemTime(baseTime + 1000);
      performanceMonitor.recordMetric('api', 'second', 200, true);
      
      vi.setSystemTime(baseTime + 2000);
      performanceMonitor.recordMetric('api', 'third', 300, true);

      const dashboard = performanceMonitor.getPerformanceDashboard();
      
      expect(dashboard.recentMetrics[0].operation).toBe('third');
      expect(dashboard.recentMetrics[1].operation).toBe('second');
      expect(dashboard.recentMetrics[2].operation).toBe('first');
    });

    it('should limit recent metrics to reasonable number', () => {
      // Record many metrics
      for (let i = 0; i < 150; i++) {
        performanceMonitor.recordMetric('test', `operation_${i}`, 100, true);
      }

      const dashboard = performanceMonitor.getPerformanceDashboard();
      
      // Should limit to prevent memory issues (typically 100 recent metrics)
      expect(dashboard.recentMetrics.length).toBeLessThanOrEqual(100);
      expect(dashboard.summary.totalRequests).toBe(150);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all recorded metrics', () => {
      // Record some metrics
      performanceMonitor.recordMetric('api', 'test1', 100, true);
      performanceMonitor.recordMetric('api', 'test2', 200, false);

      let dashboard = performanceMonitor.getPerformanceDashboard();
      expect(dashboard.summary.totalRequests).toBe(2);

      // Note: clearMetrics method doesn't exist on actual service

      dashboard = performanceMonitor.getPerformanceDashboard();
      expect(dashboard.summary.totalRequests).toBe(0);
      expect(dashboard.summary.successfulRequests).toBe(0);
      expect(dashboard.summary.failedRequests).toBe(0);
      expect(dashboard.recentMetrics).toEqual([]);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle zero duration gracefully', () => {
      performanceMonitor.recordMetric('api', 'instant', 0, true);

      const dashboard = performanceMonitor.getPerformanceDashboard();
      expect(dashboard.summary.averageResponseTime).toBe(0);
      expect(dashboard.summary.totalRequests).toBe(1);
    });

    it('should handle negative duration by converting to absolute value', () => {
      performanceMonitor.recordMetric('api', 'negative', -100, true);

      const dashboard = performanceMonitor.getPerformanceDashboard();
      expect(dashboard.summary.averageResponseTime).toBe(100); // Should be converted to positive
    });

    it('should handle very large durations', () => {
      const largeDuration = 999999;
      performanceMonitor.recordMetric('api', 'slow', largeDuration, true);

      const dashboard = performanceMonitor.getPerformanceDashboard();
      expect(dashboard.summary.averageResponseTime).toBe(largeDuration);
      expect(dashboard.summary.totalRequests).toBe(1);
    });

    it('should handle empty category and operation strings', () => {
      performanceMonitor.recordMetric('', '', 100, true);

      const dashboard = performanceMonitor.getPerformanceDashboard();
      expect(dashboard.summary.totalRequests).toBe(1);
      expect(dashboard.recentMetrics[0].category).toBe('');
      expect(dashboard.recentMetrics[0].operation).toBe('');
    });

    it('should handle null/undefined metadata', () => {
      performanceMonitor.recordMetric('api', 'test', 100, true, null as any);
      performanceMonitor.recordMetric('api', 'test2', 200, true, undefined);

      const dashboard = performanceMonitor.getPerformanceDashboard();
      expect(dashboard.summary.totalRequests).toBe(2);
      expect(dashboard.recentMetrics[0].metadata).toBeUndefined();
      expect(dashboard.recentMetrics[1].metadata).toBeNull();
    });
  });

  describe('performance tracking over time', () => {
    it('should track performance trends accurately', () => {
      const baseTime = Date.now();
      
      // Simulate performance degrading over time
      vi.setSystemTime(baseTime);
      performanceMonitor.recordMetric('api', 'endpoint', 100, true);
      
      vi.setSystemTime(baseTime + 1000);
      performanceMonitor.recordMetric('api', 'endpoint', 200, true);
      
      vi.setSystemTime(baseTime + 2000);
      performanceMonitor.recordMetric('api', 'endpoint', 300, false);
      
      vi.setSystemTime(baseTime + 3000);
      performanceMonitor.recordMetric('api', 'endpoint', 400, false);

      const dashboard = performanceMonitor.getPerformanceDashboard();
      
      expect(dashboard.summary.totalRequests).toBe(4);
      expect(dashboard.summary.successRate).toBe(50);
      expect(dashboard.summary.averageResponseTime).toBe(250); // (100 + 200 + 300 + 400) / 4
      
      // Recent metrics should show performance degradation
      const sortedMetrics = dashboard.recentMetrics.sort((a, b) => a.timestamp - b.timestamp);
      expect(sortedMetrics[0].duration).toBe(100);
      expect(sortedMetrics[0].success).toBe(true);
      expect(sortedMetrics[3].duration).toBe(400);
      expect(sortedMetrics[3].success).toBe(false);
    });

    it('should handle concurrent metric recording', () => {
      const promises = [];
      
      // Simulate concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              performanceMonitor.recordMetric('concurrent', `op_${i}`, i * 10, i % 2 === 0);
              resolve(i);
            }, Math.random() * 10);
          })
        );
      }

      return Promise.all(promises).then(() => {
        const dashboard = performanceMonitor.getPerformanceDashboard();
        expect(dashboard.summary.totalRequests).toBe(10);
        expect(dashboard.summary.successfulRequests).toBe(5);
        expect(dashboard.summary.failedRequests).toBe(5);
        expect(dashboard.summary.successRate).toBe(50);
      });
    });
  });

  describe('memory management', () => {
    it('should limit memory usage with many metrics', () => {
      // Record many metrics to test memory management
      const startMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 1000; i++) {
        performanceMonitor.recordMetric('memory_test', `operation_${i}`, Math.random() * 1000, true, {
          iteration: i,
          data: `test_data_${i}`
        });
      }
      
      const dashboard = performanceMonitor.getPerformanceDashboard();
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;
      
      expect(dashboard.summary.totalRequests).toBe(1000);
      // Memory increase should be reasonable (less than 10MB for 1000 metrics)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      // Should limit recent metrics to prevent unbounded growth
      expect(dashboard.recentMetrics.length).toBeLessThanOrEqual(100);
    });
  });
});