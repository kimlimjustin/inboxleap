import { Express } from 'express';
import { isAuthenticated } from '../googleAuth';
import { auditService } from '../services/auditService';
import { auditDashboard } from '../services/auditDashboard';
import { auditScheduler } from '../services/auditScheduler';
import { z } from 'zod';

/**
 * Audit system API routes
 * Provides endpoints for running audits, viewing reports, and monitoring system health
 */
export function registerAuditRoutes(app: Express) {
  
  /**
   * Run complete system audit
   */
  app.post('/api/audit/run', isAuthenticated, async (req: any, res) => {
    try {
      console.log(`🔍 [AUDIT-API] Running complete audit requested by user: ${req.user.id}`);
      
      // Only allow admin users to run audits
      // TODO: Implement proper admin role checking
      
      const auditReport = await auditService.runCompleteAudit();
      
      res.json({
        success: true,
        data: auditReport
      });
      
    } catch (error: any) {
      console.error('Error running audit:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to run system audit',
        error: error.message
      });
    }
  });
  
  /**
   * Get audit report summary (lightweight)
   */
  app.get('/api/audit/summary', isAuthenticated, async (req: any, res) => {
    try {
      const auditReport = await auditService.runCompleteAudit();
      
      // Return just the summary without detailed check results
      const summary = {
        reportId: auditReport.reportId,
        generatedAt: auditReport.generatedAt,
        overallHealth: auditReport.overallHealth,
        summary: auditReport.summary,
        systemMetrics: auditReport.systemMetrics,
        criticalIssues: auditReport.checks.filter(c => 
          c.status === 'fail' && c.severity === 'critical'
        ).length,
        highPriorityIssues: auditReport.checks.filter(c => 
          c.status === 'fail' && c.severity === 'high'
        ).length,
        topRecommendations: auditReport.recommendations.slice(0, 5)
      };
      
      res.json({
        success: true,
        data: summary
      });
      
    } catch (error: any) {
      console.error('Error getting audit summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get audit summary',
        error: error.message
      });
    }
  });
  
  /**
   * Run specific audit category
   */
  app.post('/api/audit/category/:category', isAuthenticated, async (req: any, res) => {
    try {
      const category = req.params.category;
      
      const validCategories = ['company', 'data-integrity', 'performance', 'security', 'agents'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid audit category. Valid options: ${validCategories.join(', ')}`
        });
      }
      
      console.log(`🔍 [AUDIT-API] Running ${category} audit requested by user: ${req.user.id}`);

      let checks: any[] = [];

      switch (category) {
        case 'company':
          checks = await auditService.auditCompanySystem();
          break;
        case 'data-integrity':
          checks = await auditService.auditDataIntegrity();
          break;
        case 'performance':
          checks = await auditService.auditPerformance();
          break;
        case 'security':
          checks = await auditService.auditSecurity();
          break;
        case 'agents':
          checks = await auditService.auditAgentSystem();
          break;
      }

      const summary = {
        category,
        totalChecks: checks.length,
        passed: checks.filter((c: any) => c.status === 'pass').length,
        warnings: checks.filter((c: any) => c.status === 'warning').length,
        failures: checks.filter((c: any) => c.status === 'fail').length,
        generatedAt: new Date()
      };

      res.json({
        success: true,
        data: {
          summary,
          checks,
          recommendations: checks
            .filter((c: any) => c.recommendations && c.recommendations.length > 0)
            .flatMap((c: any) => c.recommendations!)
            .filter((rec: any, index: number, arr: any[]) => arr.indexOf(rec) === index)
        }
      });
      
    } catch (error: any) {
      console.error('Error running category audit:', error);
      res.status(500).json({
        success: false,
        message: `Failed to run ${req.params.category} audit`,
        error: error.message
      });
    }
  });
  
  /**
   * Get system health check (quick status)
   */
  app.get('/api/audit/health', async (req, res) => {
    try {
      // Quick health check without full audit
      const healthChecks = [
        {
          name: 'database_connection',
          status: 'pass', // TODO: Implement actual database ping
          message: 'Database connection is healthy'
        },
        {
          name: 'batch_processing',
          status: 'pass', // TODO: Check batch processing status
          message: 'Batch processing system is operational'
        }
      ];
      
      const overallHealthy = healthChecks.every(check => check.status === 'pass');
      
      res.json({
        success: true,
        healthy: overallHealthy,
        status: overallHealthy ? 'healthy' : 'degraded',
        checks: healthChecks,
        timestamp: new Date()
      });
      
    } catch (error: any) {
      console.error('Error checking system health:', error);
      res.status(500).json({
        success: false,
        healthy: false,
        status: 'error',
        error: error.message,
        timestamp: new Date()
      });
    }
  });
  
  /**
   * Get audit metrics over time (placeholder for future implementation)
   */
  app.get('/api/audit/metrics', isAuthenticated, async (req: any, res) => {
    try {
      // TODO: Implement audit history tracking
      const timeRange = req.query.timeRange || '7d';
      
      const mockMetrics = {
        timeRange,
        dataPoints: [
          {
            date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            overallHealth: 'healthy',
            totalChecks: 25,
            passed: 23,
            warnings: 2,
            failures: 0
          },
          {
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            overallHealth: 'degraded',
            totalChecks: 25,
            passed: 20,
            warnings: 4,
            failures: 1
          },
          {
            date: new Date(),
            overallHealth: 'healthy',
            totalChecks: 27,
            passed: 25,
            warnings: 2,
            failures: 0
          }
        ],
        trends: {
          healthImproving: true,
          avgChecksPassed: 22.7,
          commonIssues: [
            'inactive_agents',
            'unused_subcompanies',
            'excessive_permissions'
          ]
        }
      };
      
      res.json({
        success: true,
        data: mockMetrics
      });
      
    } catch (error: any) {
      console.error('Error getting audit metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get audit metrics',
        error: error.message
      });
    }
  });
  
  /**
   * Export audit report
   */
  app.get('/api/audit/export/:format', isAuthenticated, async (req: any, res) => {
    try {
      const format = req.params.format;
      
      if (!['json', 'csv'].includes(format)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid export format. Supported formats: json, csv'
        });
      }
      
      const auditReport = await auditService.runCompleteAudit();
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit_report_${auditReport.reportId}.json"`);
        res.json(auditReport);
      } else if (format === 'csv') {
        // Convert audit results to CSV format
        const csvHeaders = 'Check Name,Status,Severity,Message,Timestamp\n';
        const csvRows = auditReport.checks.map(check => 
          `"${check.checkName}","${check.status}","${check.severity}","${check.message}","${check.timestamp}"`
        ).join('\n');
        
        const csvContent = csvHeaders + csvRows;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit_report_${auditReport.reportId}.csv"`);
        res.send(csvContent);
      }
      
    } catch (error: any) {
      console.error('Error exporting audit report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export audit report',
        error: error.message
      });
    }
  });
  
  /**
   * Get comprehensive dashboard summary
   */
  app.get('/api/audit/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const dashboardData = await auditDashboard.getDashboardSummary();
      
      res.json({
        success: true,
        data: dashboardData
      });
      
    } catch (error: any) {
      console.error('Error getting audit dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get audit dashboard',
        error: error.message
      });
    }
  });
  
  /**
   * Get detailed health check for specific component
   */
  app.get('/api/audit/component/:component', isAuthenticated, async (req: any, res) => {
    try {
      const component = req.params.component;
      const healthCheck = await auditDashboard.getDetailedHealthCheck(component);
      
      res.json({
        success: true,
        data: healthCheck
      });
      
    } catch (error: any) {
      console.error('Error getting component health check:', error);
      res.status(500).json({
        success: false,
        message: `Failed to get health check for component: ${req.params.component}`,
        error: error.message
      });
    }
  });
  
  /**
   * Get system trends
   */
  app.get('/api/audit/trends', isAuthenticated, async (req: any, res) => {
    try {
      const timeRange = (req.query.timeRange as '24h' | '7d' | '30d') || '7d';
      const trends = await auditDashboard.getSystemTrends(timeRange);
      
      res.json({
        success: true,
        data: trends
      });
      
    } catch (error: any) {
      console.error('Error getting system trends:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get system trends',
        error: error.message
      });
    }
  });
  
  /**
   * Get audit scheduler status
   */
  app.get('/api/audit/scheduler/status', isAuthenticated, async (req: any, res) => {
    try {
      const status = auditScheduler.getStatus();
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error: any) {
      console.error('Error getting scheduler status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get scheduler status',
        error: error.message
      });
    }
  });
  
  /**
   * Update audit scheduler configuration
   */
  app.patch('/api/audit/scheduler/config', isAuthenticated, async (req: any, res) => {
    try {
      // TODO: Add admin role check
      
      const configSchema = z.object({
        enabled: z.boolean().optional(),
        fullAuditInterval: z.number().min(60000).optional(), // Min 1 minute
        quickHealthInterval: z.number().min(30000).optional(), // Min 30 seconds
        alertThresholds: z.object({
          criticalFailures: z.number().min(0),
          highFailures: z.number().min(0),
          warningFailures: z.number().min(0)
        }).optional()
      });
      
      const config = configSchema.parse(req.body);
      
      auditScheduler.updateConfig(config);
      
      res.json({
        success: true,
        message: 'Audit scheduler configuration updated',
        data: auditScheduler.getStatus()
      });
      
    } catch (error: any) {
      console.error('Error updating scheduler config:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration',
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: 'Failed to update scheduler configuration',
        error: error.message
      });
    }
  });
}