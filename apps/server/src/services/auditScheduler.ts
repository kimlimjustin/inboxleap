import { auditService, type AuditReport } from './auditService';
import { performanceMonitor } from './performanceMonitor';

/**
 * Automated audit scheduler
 * Runs audits on a schedule and handles alerting for critical issues
 */

interface ScheduledAuditConfig {
  enabled: boolean;
  fullAuditInterval: number; // milliseconds
  quickHealthInterval: number; // milliseconds
  alertThresholds: {
    criticalFailures: number;
    highFailures: number;
    warningFailures: number;
  };
  notificationSettings: {
    emailAlerts: boolean;
    slackWebhook?: string;
    webhookUrl?: string;
  };
}

export class AuditScheduler {
  private static instance: AuditScheduler | null = null;
  private isRunning = false;
  private fullAuditTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private lastAuditReport: AuditReport | null = null;
  
  private config: ScheduledAuditConfig = {
    enabled: true,
    fullAuditInterval: 4 * 60 * 60 * 1000, // 4 hours
    quickHealthInterval: 15 * 60 * 1000, // 15 minutes
    alertThresholds: {
      criticalFailures: 1, // Alert on any critical failure
      highFailures: 3, // Alert if more than 3 high severity failures
      warningFailures: 10 // Alert if more than 10 warnings
    },
    notificationSettings: {
      emailAlerts: false, // Disabled by default
      // slackWebhook: process.env.SLACK_AUDIT_WEBHOOK,
      // webhookUrl: process.env.AUDIT_WEBHOOK_URL
    }
  };

  static getInstance(): AuditScheduler {
    if (!AuditScheduler.instance) {
      AuditScheduler.instance = new AuditScheduler();
    }
    return AuditScheduler.instance;
  }

  /**
   * Start the audit scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📅 [AUDIT-SCHEDULER] Already running');
      return;
    }

    console.log('🚀 [AUDIT-SCHEDULER] Starting automated audit system');
    this.isRunning = true;

    // Run initial audit
    try {
      await this.runScheduledAudit();
    } catch (error) {
      console.error('❌ [AUDIT-SCHEDULER] Failed to run initial audit:', error);
    }

    // Schedule recurring audits
    if (this.config.enabled) {
      // Full audit schedule
      this.fullAuditTimer = setInterval(async () => {
        try {
          await this.runScheduledAudit();
        } catch (error) {
          console.error('❌ [AUDIT-SCHEDULER] Scheduled audit failed:', error);
          this.handleAuditFailure(error);
        }
      }, this.config.fullAuditInterval);

      // Quick health check schedule
      this.healthCheckTimer = setInterval(async () => {
        try {
          await this.runQuickHealthCheck();
        } catch (error) {
          console.error('❌ [AUDIT-SCHEDULER] Health check failed:', error);
        }
      }, this.config.quickHealthInterval);

      console.log(`✅ [AUDIT-SCHEDULER] Scheduled audits every ${this.config.fullAuditInterval / 60000} minutes`);
      console.log(`✅ [AUDIT-SCHEDULER] Health checks every ${this.config.quickHealthInterval / 60000} minutes`);
    }
  }

  /**
   * Stop the audit scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 [AUDIT-SCHEDULER] Stopping automated audit system');
    
    if (this.fullAuditTimer) {
      clearInterval(this.fullAuditTimer);
      this.fullAuditTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    this.isRunning = false;
  }

  /**
   * Run a full scheduled audit
   */
  private async runScheduledAudit(): Promise<void> {
    console.log('📋 [AUDIT-SCHEDULER] Running scheduled full audit');
    
    const startTime = Date.now();
    const auditReport = await auditService.runCompleteAudit();
    const duration = Date.now() - startTime;
    
    console.log(`📋 [AUDIT-SCHEDULER] Audit completed in ${duration}ms: ${auditReport.overallHealth}`);
    
    // Store the report for later reference
    this.lastAuditReport = auditReport;
    
    // Record performance metrics
    performanceMonitor.recordMetric('audit', 'scheduled_audit', duration, true, {
      overallHealth: auditReport.overallHealth,
      totalChecks: auditReport.summary.totalChecks,
      failures: auditReport.summary.failures,
      reportId: auditReport.reportId
    });
    
    // Check if alerts need to be sent
    await this.evaluateAndAlert(auditReport);
    
    // Log summary
    console.log(`📊 [AUDIT-SCHEDULER] Audit Summary:`, {
      health: auditReport.overallHealth,
      passed: auditReport.summary.passed,
      warnings: auditReport.summary.warnings,
      failures: auditReport.summary.failures,
      recommendations: auditReport.recommendations.length
    });
  }

  /**
   * Run a quick health check
   */
  private async runQuickHealthCheck(): Promise<void> {
    try {
      // Quick checks without full audit
      const performanceChecks = await auditService.auditPerformance();
      const securityChecks = await auditService.auditSecurity();
      
      const criticalIssues = [...performanceChecks, ...securityChecks]
        .filter(check => check.status === 'fail' && check.severity === 'critical');
        
      if (criticalIssues.length > 0) {
        console.log(`🚨 [AUDIT-SCHEDULER] Quick health check found ${criticalIssues.length} critical issues`);
        
        // Send immediate alert for critical issues
        await this.sendAlert({
          type: 'critical_health_check',
          message: `Quick health check found ${criticalIssues.length} critical issues`,
          issues: criticalIssues,
          timestamp: new Date()
        });
      } else {
        console.log('✅ [AUDIT-SCHEDULER] Quick health check passed');
      }
      
    } catch (error) {
      console.error('❌ [AUDIT-SCHEDULER] Quick health check failed:', error);
    }
  }

  /**
   * Evaluate audit results and send alerts if necessary
   */
  private async evaluateAndAlert(auditReport: AuditReport): Promise<void> {
    const criticalFailures = auditReport.checks.filter(c => 
      c.status === 'fail' && c.severity === 'critical'
    ).length;
    
    const highFailures = auditReport.checks.filter(c => 
      c.status === 'fail' && c.severity === 'high'
    ).length;
    
    const warningFailures = auditReport.summary.warnings;
    
    let shouldAlert = false;
    let alertLevel = 'info';
    let alertMessage = '';
    
    if (criticalFailures >= this.config.alertThresholds.criticalFailures) {
      shouldAlert = true;
      alertLevel = 'critical';
      alertMessage = `${criticalFailures} critical system failures detected`;
    } else if (highFailures >= this.config.alertThresholds.highFailures) {
      shouldAlert = true;
      alertLevel = 'high';
      alertMessage = `${highFailures} high-severity issues detected`;
    } else if (warningFailures >= this.config.alertThresholds.warningFailures) {
      shouldAlert = true;
      alertLevel = 'warning';
      alertMessage = `${warningFailures} warnings detected - system may need attention`;
    }
    
    if (shouldAlert) {
      await this.sendAlert({
        type: 'audit_alert',
        level: alertLevel,
        message: alertMessage,
        auditReport,
        timestamp: new Date()
      });
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlert(alertData: any): Promise<void> {
    console.log(`🚨 [AUDIT-SCHEDULER] ALERT: ${alertData.message}`);
    
    // Console logging is always enabled
    if (alertData.auditReport) {
      console.log('📋 [AUDIT-SCHEDULER] Failed checks:', 
        alertData.auditReport.checks.filter((c: any) => c.status === 'fail')
          .map((c: any) => ({ name: c.checkName, message: c.message, severity: c.severity }))
      );
    }
    
    // Additional notification channels (implement as needed)
    if (this.config.notificationSettings.emailAlerts) {
      await this.sendEmailAlert(alertData);
    }
    
    if (this.config.notificationSettings.slackWebhook) {
      await this.sendSlackAlert(alertData);
    }
    
    if (this.config.notificationSettings.webhookUrl) {
      await this.sendWebhookAlert(alertData);
    }
  }

  /**
   * Handle audit system failures
   */
  private handleAuditFailure(error: any): void {
    console.error('💥 [AUDIT-SCHEDULER] Audit system failure:', error);
    
    performanceMonitor.recordMetric('audit', 'audit_failure', 0, false, {
      error: error.message || String(error),
      timestamp: new Date().toISOString()
    });
    
    // Send critical alert about audit system itself failing
    this.sendAlert({
      type: 'audit_system_failure',
      level: 'critical',
      message: 'Audit system itself has failed - immediate attention required',
      error: error.message || String(error),
      timestamp: new Date()
    }).catch(alertError => {
      console.error('❌ [AUDIT-SCHEDULER] Failed to send audit failure alert:', alertError);
    });
  }

  /**
   * Get the last audit report
   */
  getLastAuditReport(): AuditReport | null {
    return this.lastAuditReport;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      lastAudit: this.lastAuditReport ? {
        reportId: this.lastAuditReport.reportId,
        generatedAt: this.lastAuditReport.generatedAt,
        overallHealth: this.lastAuditReport.overallHealth,
        summary: this.lastAuditReport.summary
      } : null,
      nextFullAudit: this.fullAuditTimer ? 
        new Date(Date.now() + this.config.fullAuditInterval) : null,
      nextHealthCheck: this.healthCheckTimer ? 
        new Date(Date.now() + this.config.quickHealthInterval) : null
    };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<ScheduledAuditConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isRunning) {
      console.log('🔄 [AUDIT-SCHEDULER] Restarting with new configuration');
      this.stop();
      this.start().catch(error => {
        console.error('❌ [AUDIT-SCHEDULER] Failed to restart with new config:', error);
      });
    }
  }

  // Placeholder implementations for notification channels
  private async sendEmailAlert(alertData: any): Promise<void> {
    // TODO: Implement email alerting
    console.log('📧 [AUDIT-SCHEDULER] Email alert (not implemented):', alertData.message);
  }

  private async sendSlackAlert(alertData: any): Promise<void> {
    // TODO: Implement Slack webhook
    console.log('💬 [AUDIT-SCHEDULER] Slack alert (not implemented):', alertData.message);
  }

  private async sendWebhookAlert(alertData: any): Promise<void> {
    // TODO: Implement webhook notification
    console.log('🔗 [AUDIT-SCHEDULER] Webhook alert (not implemented):', alertData.message);
  }
}

export const auditScheduler = AuditScheduler.getInstance();