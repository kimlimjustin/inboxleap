import { auditService, type AuditReport } from './auditService';
import { auditScheduler } from './auditScheduler';
import { performanceMonitor } from './performanceMonitor';
import { batchProcessingQueue } from './batchProcessingQueue';

/**
 * Audit Dashboard Service
 * Provides aggregated views and insights for system health monitoring
 */

export interface DashboardSummary {
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    score: number; // 0-100
    lastUpdated: Date;
  };
  quickStats: {
    totalCompanies: number;
    totalAgents: number;
    totalUsers: number;
    activeSubmissions24h: number;
  };
  recentIssues: {
    critical: number;
    high: number;
    medium: number;
    lastCriticalIssue?: Date;
  };
  systemComponents: {
    database: 'healthy' | 'degraded' | 'critical';
    batchProcessing: 'healthy' | 'degraded' | 'critical';
    auditSystem: 'healthy' | 'degraded' | 'critical';
    performance: 'healthy' | 'degraded' | 'critical';
  };
  upcomingMaintenance: any[];
  recommendations: string[];
}

export interface DetailedHealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'critical';
  checks: {
    name: string;
    status: 'pass' | 'warning' | 'fail';
    message: string;
    lastRun: Date;
    nextRun?: Date;
  }[];
  metrics: any;
  alerts: any[];
}

export class AuditDashboard {
  private static instance: AuditDashboard | null = null;

  static getInstance(): AuditDashboard {
    if (!AuditDashboard.instance) {
      AuditDashboard.instance = new AuditDashboard();
    }
    return AuditDashboard.instance;
  }

  /**
   * Get comprehensive dashboard summary
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      console.log('📊 [AUDIT-DASHBOARD] Generating dashboard summary...');

      // Get last audit report
      const lastAudit = auditScheduler.getLastAuditReport();
      
      // Calculate system health score
      const healthScore = this.calculateHealthScore(lastAudit);
      const systemStatus = this.determineSystemStatus(healthScore, lastAudit);

      // Get quick stats
      const quickStats = await this.getQuickStats();

      // Get recent issues summary
      const recentIssues = this.getRecentIssues(lastAudit);

      // Check system components
      const systemComponents = await this.checkSystemComponents();

      // Get recommendations
      const recommendations = this.getTopRecommendations(lastAudit);

      return {
        systemHealth: {
          status: systemStatus,
          score: healthScore,
          lastUpdated: lastAudit?.generatedAt || new Date()
        },
        quickStats,
        recentIssues,
        systemComponents,
        upcomingMaintenance: [], // Placeholder for future feature
        recommendations
      };

    } catch (error) {
      console.error('❌ [AUDIT-DASHBOARD] Error generating dashboard:', error);
      
      return {
        systemHealth: {
          status: 'critical',
          score: 0,
          lastUpdated: new Date()
        },
        quickStats: {
          totalCompanies: -1,
          totalAgents: -1,
          totalUsers: -1,
          activeSubmissions24h: -1
        },
        recentIssues: {
          critical: -1,
          high: -1,
          medium: -1
        },
        systemComponents: {
          database: 'critical',
          batchProcessing: 'critical',
          auditSystem: 'critical',
          performance: 'critical'
        },
        upcomingMaintenance: [],
        recommendations: ['Dashboard system error - immediate investigation required']
      };
    }
  }

  /**
   * Get detailed health check for specific component
   */
  async getDetailedHealthCheck(component: string): Promise<DetailedHealthCheck> {
    console.log(`🔬 [AUDIT-DASHBOARD] Getting detailed health check for: ${component}`);

    try {
      let checks = [];
      let metrics = {};
      
      switch (component) {
        case 'companies':
          checks = await auditService.auditCompanySystem();
          metrics = await this.getCompanyMetrics();
          break;
        case 'agents':
          checks = await auditService.auditAgentSystem();
          metrics = await this.getAgentMetrics();
          break;
        case 'performance':
          checks = await auditService.auditPerformance();
          metrics = performanceMonitor.getPerformanceDashboard();
          break;
        case 'security':
          checks = await auditService.auditSecurity();
          metrics = await this.getSecurityMetrics();
          break;
        case 'data-integrity':
          checks = await auditService.auditDataIntegrity();
          metrics = await this.getDataIntegrityMetrics();
          break;
        default:
          throw new Error(`Unknown component: ${component}`);
      }

      // Determine component status
      const criticalFailures = checks.filter(c => c.status === 'fail' && c.severity === 'critical').length;
      const highFailures = checks.filter(c => c.status === 'fail' && c.severity === 'high').length;
      
      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (criticalFailures > 0) {
        status = 'critical';
      } else if (highFailures > 0) {
        status = 'degraded';
      }

      return {
        component,
        status,
        checks: checks.map(check => ({
          name: check.checkName,
          status: check.status,
          message: check.message,
          lastRun: check.timestamp,
          nextRun: undefined // TODO: Calculate based on schedule
        })),
        metrics,
        alerts: checks.filter(c => c.status === 'fail')
      };

    } catch (error) {
      console.error(`❌ [AUDIT-DASHBOARD] Error getting health check for ${component}:`, error);
      
      return {
        component,
        status: 'critical',
        checks: [{
          name: 'health_check_error',
          status: 'fail',
          message: `Failed to run health check: ${error}`,
          lastRun: new Date()
        }],
        metrics: { error: 'Failed to collect metrics' },
        alerts: []
      };
    }
  }

  /**
   * Get system trends over time
   */
  async getSystemTrends(timeRange: '24h' | '7d' | '30d' = '7d'): Promise<any> {
    // TODO: Implement trend analysis when audit history is stored
    const mockTrends = {
      timeRange,
      healthScore: {
        current: 85,
        trend: 'improving',
        dataPoints: [
          { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), score: 78 },
          { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), score: 82 },
          { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), score: 85 },
          { date: new Date(), score: 85 }
        ]
      },
      issuesTrend: {
        critical: { current: 0, change: 0 },
        high: { current: 1, change: -2 },
        medium: { current: 3, change: +1 }
      },
      performanceTrend: {
        averageResponseTime: { current: 245, change: -15 },
        successRate: { current: 98.5, change: +2.1 },
        throughput: { current: 1250, change: +50 }
      }
    };

    return mockTrends;
  }

  // Helper methods
  private calculateHealthScore(auditReport: AuditReport | null): number {
    if (!auditReport) return 0;

    const { summary } = auditReport;
    if (summary.totalChecks === 0) return 0;

    const passRate = summary.passed / summary.totalChecks;
    const warningPenalty = (summary.warnings * 0.05) / summary.totalChecks;
    const failurePenalty = (summary.failures * 0.15) / summary.totalChecks;
    
    const score = Math.max(0, passRate - warningPenalty - failurePenalty) * 100;
    return Math.round(score);
  }

  private determineSystemStatus(score: number, auditReport: AuditReport | null): 'healthy' | 'degraded' | 'critical' {
    if (!auditReport) return 'critical';

    const criticalFailures = auditReport.checks.filter(c => 
      c.status === 'fail' && c.severity === 'critical'
    ).length;

    if (criticalFailures > 0) return 'critical';
    if (score < 70) return 'critical';
    if (score < 85) return 'degraded';
    return 'healthy';
  }

  private async getQuickStats() {
    try {
      // These would be actual database queries in production
      return {
        totalCompanies: 0, // TODO: Implement actual count
        totalAgents: 0, // TODO: Implement actual count  
        totalUsers: 0, // TODO: Implement actual count
        activeSubmissions24h: 0 // TODO: Implement actual count
      };
    } catch (error) {
      return {
        totalCompanies: -1,
        totalAgents: -1,
        totalUsers: -1,
        activeSubmissions24h: -1
      };
    }
  }

  private getRecentIssues(auditReport: AuditReport | null) {
    if (!auditReport) {
      return {
        critical: -1,
        high: -1,
        medium: -1
      };
    }

    const critical = auditReport.checks.filter(c => c.status === 'fail' && c.severity === 'critical').length;
    const high = auditReport.checks.filter(c => c.status === 'fail' && c.severity === 'high').length;
    const medium = auditReport.checks.filter(c => c.status === 'fail' && c.severity === 'medium').length;

    // Find last critical issue
    const criticalIssues = auditReport.checks.filter(c => c.status === 'fail' && c.severity === 'critical');
    const lastCriticalIssue = criticalIssues.length > 0 ? 
      criticalIssues.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0].timestamp :
      undefined;

    return {
      critical,
      high,
      medium,
      lastCriticalIssue
    };
  }

  private async checkSystemComponents() {
    try {
      const queueStats = batchProcessingQueue.getQueueStats();
      const performanceData = performanceMonitor.getPerformanceDashboard();
      
      return {
        database: 'healthy' as const, // TODO: Implement actual database health check
        batchProcessing: queueStats.totalQueued > 1000 ? 'degraded' as const : 'healthy' as const,
        auditSystem: auditScheduler.getStatus().isRunning ? 'healthy' as const : 'critical' as const,
        performance: performanceData.summary.successRate > 95 ? 'healthy' as const : 'degraded' as const
      };
    } catch (error) {
      return {
        database: 'critical' as const,
        batchProcessing: 'critical' as const,
        auditSystem: 'critical' as const,
        performance: 'critical' as const
      };
    }
  }

  private getTopRecommendations(auditReport: AuditReport | null): string[] {
    if (!auditReport || auditReport.recommendations.length === 0) {
      return ['Run a complete system audit to get recommendations'];
    }

    return auditReport.recommendations.slice(0, 5);
  }

  private async getCompanyMetrics() {
    // TODO: Implement actual company metrics
    return {
      totalCompanies: 0,
      activeCompanies: 0,
      companiesWithAgents: 0,
      averageMembersPerCompany: 0
    };
  }

  private async getAgentMetrics() {
    // TODO: Implement actual agent metrics
    return {
      totalAgents: 0,
      activeAgents: 0,
      agentsByType: {},
      averageSubmissionsPerAgent: 0
    };
  }

  private async getSecurityMetrics() {
    // TODO: Implement actual security metrics
    return {
      usersWithMultipleAdminRoles: 0,
      agentsWithoutDomainRestrictions: 0,
      inactiveAdminAccounts: 0
    };
  }

  private async getDataIntegrityMetrics() {
    // TODO: Implement actual data integrity metrics
    return {
      orphanedRecords: 0,
      inconsistentReferences: 0,
      duplicateEntries: 0
    };
  }
}

export const auditDashboard = AuditDashboard.getInstance();