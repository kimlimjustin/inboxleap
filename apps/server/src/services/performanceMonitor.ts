interface PerformanceMetric {
  timestamp: Date;
  agent: string;
  operation: string;
  duration: number;
  success: boolean;
  metadata?: any;
}

interface AgentPerformanceStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  operationsPerMinute: number;
  costEstimate: number;
  lastActivity: Date;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetricsToKeep = 10000;
  private readonly costPerAPICall = 0.02; // Rough estimate
  
  // Cost estimates per agent type
  private readonly agentCosts = {
    t5t: { individual: 0.03, batch: 0.0002 },
    todo: { individual: 0.02, batch: 0.005 },
    polly: { individual: 0.04, batch: 0.01 },
    analyzer: { individual: 0.08, batch: 0.02 },
    faq: { individual: 0.01, batch: 0.002 }
  };

  /**
   * Record a performance metric
   */
  recordMetric(agent: string, operation: string, duration: number, success: boolean, metadata?: any): void {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      agent,
      operation,
      duration,
      success,
      metadata
    };

    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetricsToKeep) {
      this.metrics = this.metrics.slice(-this.maxMetricsToKeep);
    }

    // Log significant events
    if (!success) {
      console.warn(`⚠️ [Performance] ${agent} ${operation} failed after ${duration}ms`);
    } else if (duration > 30000) { // More than 30 seconds
      console.warn(`⚠️ [Performance] ${agent} ${operation} took ${duration}ms (slow)`);
    }
  }

  /**
   * Get performance statistics for an agent
   */
  getAgentStats(agent: string, timeWindowMs: number = 24 * 60 * 60 * 1000): AgentPerformanceStats {
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    const agentMetrics = this.metrics.filter(m => 
      m.agent === agent && m.timestamp >= cutoffTime
    );

    if (agentMetrics.length === 0) {
      return {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        operationsPerMinute: 0,
        costEstimate: 0,
        lastActivity: new Date(0)
      };
    }

    const successful = agentMetrics.filter(m => m.success);
    const failed = agentMetrics.filter(m => !m.success);
    const durations = agentMetrics.map(m => m.duration);
    
    const totalDuration = agentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = totalDuration / agentMetrics.length;
    
    const timeSpanMs = Date.now() - cutoffTime.getTime();
    const operationsPerMinute = (agentMetrics.length / timeSpanMs) * 60 * 1000;

    // Estimate cost based on operation types
    const costEstimate = this.calculateCostEstimate(agentMetrics);

    return {
      totalOperations: agentMetrics.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      averageResponseTime: Math.round(averageResponseTime),
      minResponseTime: Math.min(...durations),
      maxResponseTime: Math.max(...durations),
      operationsPerMinute: Math.round(operationsPerMinute * 100) / 100,
      costEstimate,
      lastActivity: agentMetrics[agentMetrics.length - 1]?.timestamp || new Date(0)
    };
  }

  /**
   * Calculate cost estimate for metrics
   */
  private calculateCostEstimate(metrics: PerformanceMetric[]): number {
    return metrics.reduce((total, metric) => {
      const agentCost = this.agentCosts[metric.agent as keyof typeof this.agentCosts];
      if (!agentCost) return total + this.costPerAPICall;

      // Determine if it's batch or individual processing
      const isBatch = metric.metadata?.batchProcessing === true || 
                     metric.metadata?.batchSize > 1 ||
                     metric.operation.includes('batch');

      return total + (isBatch ? agentCost.batch : agentCost.individual);
    }, 0);
  }

  /**
   * Get comprehensive performance dashboard data
   */
  getPerformanceDashboard(): {
    summary: {
      totalOperations24h: number;
      successRate: number;
      averageResponseTime: number;
      estimatedDailyCost: number;
      costSavingsFromBatching: number;
    };
    agentStats: Record<string, AgentPerformanceStats>;
    trends: {
      hourlyOperations: Array<{ hour: string; operations: number; successRate: number }>;
      performanceAlerts: Array<{ agent: string; issue: string; severity: 'low' | 'medium' | 'high' }>;
    };
    batchingEfficiency: {
      batchProcessingRate: number;
      averageBatchSize: number;
      batchVsIndividualSavings: number;
    };
  } {
    const last24h = 24 * 60 * 60 * 1000;
    const recentMetrics = this.metrics.filter(m => 
      m.timestamp >= new Date(Date.now() - last24h)
    );

    // Summary statistics
    const totalOperations24h = recentMetrics.length;
    const successfulOps = recentMetrics.filter(m => m.success).length;
    const successRate = totalOperations24h > 0 ? (successfulOps / totalOperations24h) * 100 : 0;
    const averageResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length 
      : 0;
    const estimatedDailyCost = this.calculateCostEstimate(recentMetrics);

    // Calculate cost savings from batching
    const batchOps = recentMetrics.filter(m => 
      m.metadata?.batchProcessing === true || m.operation.includes('batch')
    );
    const individualOps = recentMetrics.filter(m => 
      !m.metadata?.batchProcessing && !m.operation.includes('batch')
    );
    
    const batchCostSavings = batchOps.reduce((savings, metric) => {
      const agentCost = this.agentCosts[metric.agent as keyof typeof this.agentCosts];
      if (!agentCost) return savings;
      
      const batchSize = metric.metadata?.batchSize || 1;
      const individualCost = agentCost.individual * batchSize;
      const batchCost = agentCost.batch;
      return savings + (individualCost - batchCost);
    }, 0);

    // Agent-specific stats
    const agents = [...new Set(this.metrics.map(m => m.agent))];
    const agentStats: Record<string, AgentPerformanceStats> = {};
    agents.forEach(agent => {
      agentStats[agent] = this.getAgentStats(agent);
    });

    // Hourly trends
    const hourlyOperations = this.getHourlyTrends(recentMetrics);

    // Performance alerts
    const performanceAlerts = this.generatePerformanceAlerts(agentStats);

    // Batching efficiency
    const batchMetrics = recentMetrics.filter(m => 
      m.metadata?.batchProcessing === true || m.operation.includes('batch')
    );
    const batchProcessingRate = recentMetrics.length > 0 
      ? (batchMetrics.length / recentMetrics.length) * 100 
      : 0;
    const averageBatchSize = batchMetrics.length > 0 
      ? batchMetrics.reduce((sum, m) => sum + (m.metadata?.batchSize || 1), 0) / batchMetrics.length
      : 0;

    return {
      summary: {
        totalOperations24h,
        successRate: Math.round(successRate * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime),
        estimatedDailyCost: Math.round(estimatedDailyCost * 100) / 100,
        costSavingsFromBatching: Math.round(batchCostSavings * 100) / 100
      },
      agentStats,
      trends: {
        hourlyOperations,
        performanceAlerts
      },
      batchingEfficiency: {
        batchProcessingRate: Math.round(batchProcessingRate * 100) / 100,
        averageBatchSize: Math.round(averageBatchSize * 100) / 100,
        batchVsIndividualSavings: Math.round(batchCostSavings * 100) / 100
      }
    };
  }

  /**
   * Get hourly trends for the last 24 hours
   */
  private getHourlyTrends(metrics: PerformanceMetric[]): Array<{ hour: string; operations: number; successRate: number }> {
    const hourlyData: Record<string, { operations: number; successful: number }> = {};
    
    // Initialize last 24 hours
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(Date.now() - i * 60 * 60 * 1000);
      const hourKey = hour.getHours().toString().padStart(2, '0');
      hourlyData[hourKey] = { operations: 0, successful: 0 };
    }

    // Fill with actual data
    metrics.forEach(metric => {
      const hourKey = metric.timestamp.getHours().toString().padStart(2, '0');
      if (hourlyData[hourKey]) {
        hourlyData[hourKey].operations++;
        if (metric.success) {
          hourlyData[hourKey].successful++;
        }
      }
    });

    return Object.entries(hourlyData).map(([hour, data]) => ({
      hour,
      operations: data.operations,
      successRate: data.operations > 0 ? (data.successful / data.operations) * 100 : 0
    }));
  }

  /**
   * Generate performance alerts
   */
  private generatePerformanceAlerts(agentStats: Record<string, AgentPerformanceStats>): Array<{ agent: string; issue: string; severity: 'low' | 'medium' | 'high' }> {
    const alerts: Array<{ agent: string; issue: string; severity: 'low' | 'medium' | 'high' }> = [];

    Object.entries(agentStats).forEach(([agent, stats]) => {
      // High failure rate
      const failureRate = stats.totalOperations > 0 
        ? (stats.failedOperations / stats.totalOperations) * 100 
        : 0;
      
      if (failureRate > 20) {
        alerts.push({
          agent,
          issue: `High failure rate: ${Math.round(failureRate)}%`,
          severity: 'high'
        });
      } else if (failureRate > 10) {
        alerts.push({
          agent,
          issue: `Elevated failure rate: ${Math.round(failureRate)}%`,
          severity: 'medium'
        });
      }

      // Slow response times
      if (stats.averageResponseTime > 30000) {
        alerts.push({
          agent,
          issue: `Slow response time: ${Math.round(stats.averageResponseTime)}ms average`,
          severity: 'high'
        });
      } else if (stats.averageResponseTime > 15000) {
        alerts.push({
          agent,
          issue: `Elevated response time: ${Math.round(stats.averageResponseTime)}ms average`,
          severity: 'medium'
        });
      }

      // No recent activity
      const hoursSinceLastActivity = (Date.now() - stats.lastActivity.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastActivity > 24 && stats.totalOperations > 0) {
        alerts.push({
          agent,
          issue: `No activity for ${Math.round(hoursSinceLastActivity)}+ hours`,
          severity: 'low'
        });
      }

      // High cost
      if (stats.costEstimate > 10) {
        alerts.push({
          agent,
          issue: `High daily cost: $${stats.costEstimate.toFixed(2)}`,
          severity: 'medium'
        });
      }
    });

    return alerts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Create a performance timing decorator
   */
  createTimer(agent: string, operation: string) {
    const startTime = Date.now();
    
    return {
      success: (metadata?: any) => {
        const duration = Date.now() - startTime;
        this.recordMetric(agent, operation, duration, true, metadata);
      },
      failure: (error?: Error, metadata?: any) => {
        const duration = Date.now() - startTime;
        this.recordMetric(agent, operation, duration, false, { 
          error: error?.message, 
          ...metadata 
        });
      }
    };
  }

  /**
   * Clear old metrics (cleanup)
   */
  cleanup(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoffTime = new Date(Date.now() - olderThanMs);
    const originalLength = this.metrics.length;
    
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
    
    const removedCount = originalLength - this.metrics.length;
    if (removedCount > 0) {
      console.log(`🧹 [Performance] Cleaned up ${removedCount} old metrics`);
    }
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(format: 'json' | 'csv' = 'json', timeWindowMs?: number): string {
    let metricsToExport = this.metrics;
    
    if (timeWindowMs) {
      const cutoffTime = new Date(Date.now() - timeWindowMs);
      metricsToExport = this.metrics.filter(m => m.timestamp >= cutoffTime);
    }

    if (format === 'csv') {
      const headers = 'timestamp,agent,operation,duration,success,metadata\n';
      const rows = metricsToExport.map(m => 
        `${m.timestamp.toISOString()},${m.agent},${m.operation},${m.duration},${m.success},"${JSON.stringify(m.metadata || {}).replace(/"/g, '""')}"`
      ).join('\n');
      
      return headers + rows;
    }

    return JSON.stringify(metricsToExport, null, 2);
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Automatic cleanup every hour
setInterval(() => {
  performanceMonitor.cleanup();
}, 60 * 60 * 1000);