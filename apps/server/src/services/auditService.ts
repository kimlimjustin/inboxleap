import { storage } from '../storage';
import { db, sql } from '../db';
import { performanceMonitor } from './performanceMonitor';
import { batchProcessingQueue } from './batchProcessingQueue';

/**
 * Comprehensive audit service for the InboxLeap platform
 * Provides automated checks for data integrity, system health, and performance
 */

export interface AuditResult {
  checkName: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations?: string[];
}

export interface AuditReport {
  reportId: string;
  generatedAt: Date;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    failures: number;
  };
  checks: AuditResult[];
  systemMetrics: any;
  recommendations: string[];
}

export class AuditService {
  private static instance: AuditService | null = null;

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Run complete system audit
   */
  async runCompleteAudit(): Promise<AuditReport> {
    const reportId = `audit_${Date.now()}`;
    const generatedAt = new Date();
    const checks: AuditResult[] = [];

    console.log(`🔍 [AUDIT] Starting complete system audit: ${reportId}`);

    try {
      // Run all audit categories
      const companyChecks = await this.auditCompanySystem();
      const dataIntegrityChecks = await this.auditDataIntegrity();
      const performanceChecks = await this.auditPerformance();
      const securityChecks = await this.auditSecurity();
      const agentChecks = await this.auditAgentSystem();
      
      checks.push(...companyChecks, ...dataIntegrityChecks, ...performanceChecks, ...securityChecks, ...agentChecks);

      // Calculate summary
      const summary = {
        totalChecks: checks.length,
        passed: checks.filter(c => c.status === 'pass').length,
        warnings: checks.filter(c => c.status === 'warning').length,
        failures: checks.filter(c => c.status === 'fail').length
      };

      // Determine overall health
      let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
      const criticalFailures = checks.filter(c => c.status === 'fail' && c.severity === 'critical').length;
      const highFailures = checks.filter(c => c.status === 'fail' && c.severity === 'high').length;
      
      if (criticalFailures > 0) {
        overallHealth = 'critical';
      } else if (highFailures > 0 || summary.failures > 5) {
        overallHealth = 'degraded';
      }

      // Collect recommendations
      const recommendations = checks
        .filter(c => c.recommendations && c.recommendations.length > 0)
        .flatMap(c => c.recommendations!)
        .filter((rec, index, arr) => arr.indexOf(rec) === index); // Remove duplicates

      // Get system metrics
      const systemMetrics = {
        batchProcessing: batchProcessingQueue.getQueueStats(),
        performance: performanceMonitor.getPerformanceDashboard().summary,
        timestamp: generatedAt
      };

      const report: AuditReport = {
        reportId,
        generatedAt,
        overallHealth,
        summary,
        checks,
        systemMetrics,
        recommendations
      };

      console.log(`✅ [AUDIT] Audit completed: ${summary.passed}/${summary.totalChecks} checks passed, ${summary.failures} failures`);

      return report;

    } catch (error) {
      console.error('🚨 [AUDIT] Critical error during audit:', error);
      
      return {
        reportId,
        generatedAt,
        overallHealth: 'critical',
        summary: { totalChecks: 0, passed: 0, warnings: 0, failures: 1 },
        checks: [{
          checkName: 'audit_system_failure',
          status: 'fail',
          message: 'Audit system itself failed to run',
          timestamp: generatedAt,
          severity: 'critical',
          details: error instanceof Error ? error.message : String(error),
          recommendations: ['Check audit service configuration', 'Verify database connectivity']
        }],
        systemMetrics: {},
        recommendations: ['Immediate system investigation required']
      };
    }
  }

  /**
   * Audit company system integrity
   */
  async auditCompanySystem(): Promise<AuditResult[]> {
    const checks: AuditResult[] = [];
    
    try {
      // Check for orphaned company memberships
      const orphanedMemberships = await this.checkOrphanedCompanyMemberships();
      checks.push({
        checkName: 'company_memberships_integrity',
        status: orphanedMemberships.count > 0 ? 'fail' : 'pass',
        message: orphanedMemberships.count > 0 
          ? `Found ${orphanedMemberships.count} orphaned company memberships`
          : 'All company memberships have valid references',
        timestamp: new Date(),
        severity: orphanedMemberships.count > 0 ? 'high' : 'low',
        details: orphanedMemberships,
        recommendations: orphanedMemberships.count > 0 
          ? ['Clean up orphaned memberships', 'Review user deletion processes']
          : undefined
      });

      // Check company hierarchy consistency
      const hierarchyIssues = await this.checkCompanyHierarchy();
      checks.push({
        checkName: 'company_hierarchy_consistency',
        status: hierarchyIssues.issues.length > 0 ? 'fail' : 'pass',
        message: hierarchyIssues.issues.length > 0 
          ? `Found ${hierarchyIssues.issues.length} company hierarchy issues`
          : 'Company hierarchy is consistent',
        timestamp: new Date(),
        severity: hierarchyIssues.issues.length > 0 ? 'medium' : 'low',
        details: hierarchyIssues,
        recommendations: hierarchyIssues.issues.length > 0 
          ? ['Fix circular references', 'Validate parent-child relationships']
          : undefined
      });

      // Check sub-companies without agents
      const unusedSubCompanies = await this.checkUnusedSubCompanies();
      checks.push({
        checkName: 'unused_subcompanies',
        status: unusedSubCompanies.count > 10 ? 'warning' : 'pass',
        message: unusedSubCompanies.count > 0 
          ? `Found ${unusedSubCompanies.count} sub-companies without any agents`
          : 'All sub-companies are being utilized',
        timestamp: new Date(),
        severity: 'low',
        details: unusedSubCompanies,
        recommendations: unusedSubCompanies.count > 10 
          ? ['Review unused sub-companies', 'Consider archiving inactive entities']
          : undefined
      });

      // Check duplicate company names
      const duplicateNames = await this.checkDuplicateCompanyNames();
      checks.push({
        checkName: 'duplicate_company_names',
        status: duplicateNames.duplicates.length > 0 ? 'fail' : 'pass',
        message: duplicateNames.duplicates.length > 0 
          ? `Found ${duplicateNames.duplicates.length} duplicate company names`
          : 'All company names are unique',
        timestamp: new Date(),
        severity: 'medium',
        details: duplicateNames,
        recommendations: duplicateNames.duplicates.length > 0 
          ? ['Rename duplicate companies', 'Implement stronger uniqueness validation']
          : undefined
      });

    } catch (error) {
      checks.push({
        checkName: 'company_audit_error',
        status: 'fail',
        message: 'Failed to audit company system',
        timestamp: new Date(),
        severity: 'high',
        details: error instanceof Error ? error.message : String(error),
        recommendations: ['Check database connectivity', 'Review company schema']
      });
    }

    return checks;
  }

  /**
   * Audit data integrity across all systems
   */
  async auditDataIntegrity(): Promise<AuditResult[]> {
    const checks: AuditResult[] = [];

    try {
      // Check polling agents without valid companies
      const orphanedAgents = await this.checkOrphanedPollingAgents();
      checks.push({
        checkName: 'orphaned_polling_agents',
        status: orphanedAgents.count > 0 ? 'fail' : 'pass',
        message: orphanedAgents.count > 0 
          ? `Found ${orphanedAgents.count} polling agents with invalid company references`
          : 'All polling agents have valid company references',
        timestamp: new Date(),
        severity: orphanedAgents.count > 0 ? 'high' : 'low',
        details: orphanedAgents,
        recommendations: orphanedAgents.count > 0 
          ? ['Fix agent company references', 'Review agent creation process']
          : undefined
      });

      // Check submissions without valid agents
      const orphanedSubmissions = await this.checkOrphanedSubmissions();
      checks.push({
        checkName: 'orphaned_submissions',
        status: orphanedSubmissions.count > 0 ? 'warning' : 'pass',
        message: orphanedSubmissions.count > 0 
          ? `Found ${orphanedSubmissions.count} submissions without valid agents`
          : 'All submissions have valid agent references',
        timestamp: new Date(),
        severity: 'medium',
        details: orphanedSubmissions,
        recommendations: orphanedSubmissions.count > 0 
          ? ['Clean up orphaned submissions', 'Review submission cleanup process']
          : undefined
      });

      // Check intelligence tokens consistency
      const tokenIssues = await this.checkIntelligenceTokens();
      checks.push({
        checkName: 'intelligence_tokens_consistency',
        status: tokenIssues.issues.length > 0 ? 'warning' : 'pass',
        message: tokenIssues.issues.length > 0 
          ? `Found ${tokenIssues.issues.length} intelligence token issues`
          : 'Intelligence tokens are consistent',
        timestamp: new Date(),
        severity: 'medium',
        details: tokenIssues,
        recommendations: tokenIssues.issues.length > 0 
          ? ['Review token generation process', 'Clean up invalid tokens']
          : undefined
      });

    } catch (error) {
      checks.push({
        checkName: 'data_integrity_audit_error',
        status: 'fail',
        message: 'Failed to audit data integrity',
        timestamp: new Date(),
        severity: 'high',
        details: error instanceof Error ? error.message : String(error),
        recommendations: ['Check database connectivity', 'Review data relationships']
      });
    }

    return checks;
  }

  /**
   * Audit system performance and batch processing
   */
  async auditPerformance(): Promise<AuditResult[]> {
    const checks: AuditResult[] = [];

    try {
      // Check batch processing queue health
      const queueStats = batchProcessingQueue.getQueueStats();
      const queueBacklog = queueStats.totalQueued;
      
      checks.push({
        checkName: 'batch_queue_health',
        status: queueBacklog > 1000 ? 'fail' : queueBacklog > 500 ? 'warning' : 'pass',
        message: `Batch processing queue has ${queueBacklog} emails queued`,
        timestamp: new Date(),
        severity: queueBacklog > 1000 ? 'high' : queueBacklog > 500 ? 'medium' : 'low',
        details: queueStats,
        recommendations: queueBacklog > 500 
          ? ['Increase batch processing frequency', 'Check for processing bottlenecks']
          : undefined
      });

      // Check performance metrics
      const performanceData = performanceMonitor.getPerformanceDashboard();
      const successRate = performanceData.summary.successRate;
      const avgResponseTime = performanceData.summary.averageResponseTime;

      checks.push({
        checkName: 'system_performance',
        status: successRate < 90 ? 'fail' : successRate < 95 ? 'warning' : 'pass',
        message: `System success rate: ${successRate}%, avg response time: ${avgResponseTime}ms`,
        timestamp: new Date(),
        severity: successRate < 90 ? 'high' : successRate < 95 ? 'medium' : 'low',
        details: performanceData.summary,
        recommendations: successRate < 95
          ? ['Investigate failed requests', 'Optimize processing pipeline']
          : undefined
      });

      // Check for stuck batches
      const stuckBatches = await this.checkStuckBatches();
      checks.push({
        checkName: 'stuck_batches',
        status: stuckBatches.count > 0 ? 'warning' : 'pass',
        message: stuckBatches.count > 0 
          ? `Found ${stuckBatches.count} potentially stuck batches`
          : 'No stuck batches detected',
        timestamp: new Date(),
        severity: 'medium',
        details: stuckBatches,
        recommendations: stuckBatches.count > 0 
          ? ['Review batch processing logic', 'Check for deadlocks']
          : undefined
      });

    } catch (error) {
      checks.push({
        checkName: 'performance_audit_error',
        status: 'fail',
        message: 'Failed to audit performance metrics',
        timestamp: new Date(),
        severity: 'high',
        details: error instanceof Error ? error.message : String(error),
        recommendations: ['Check performance monitoring service', 'Review metrics collection']
      });
    }

    return checks;
  }

  /**
   * Audit security and access controls
   */
  async auditSecurity(): Promise<AuditResult[]> {
    const checks: AuditResult[] = [];

    try {
      // Check for users with excessive permissions
      const excessivePermissions = await this.checkExcessivePermissions();
      checks.push({
        checkName: 'excessive_permissions',
        status: excessivePermissions.count > 0 ? 'warning' : 'pass',
        message: excessivePermissions.count > 0 
          ? `Found ${excessivePermissions.count} users with potentially excessive permissions`
          : 'User permissions appear appropriate',
        timestamp: new Date(),
        severity: 'medium',
        details: excessivePermissions,
        recommendations: excessivePermissions.count > 0 
          ? ['Review admin role assignments', 'Implement least privilege principle']
          : undefined
      });

      // Check for inactive admin accounts
      const inactiveAdmins = await this.checkInactiveAdmins();
      checks.push({
        checkName: 'inactive_admin_accounts',
        status: inactiveAdmins.count > 0 ? 'warning' : 'pass',
        message: inactiveAdmins.count > 0 
          ? `Found ${inactiveAdmins.count} inactive admin accounts`
          : 'All admin accounts are active',
        timestamp: new Date(),
        severity: 'medium',
        details: inactiveAdmins,
        recommendations: inactiveAdmins.count > 0 
          ? ['Review inactive admin accounts', 'Consider deactivating unused privileges']
          : undefined
      });

      // Check email agent security
      const agentSecurity = await this.checkAgentEmailSecurity();
      checks.push({
        checkName: 'agent_email_security',
        status: agentSecurity.issues.length > 0 ? 'fail' : 'pass',
        message: agentSecurity.issues.length > 0 
          ? `Found ${agentSecurity.issues.length} agent email security issues`
          : 'Agent email security is properly configured',
        timestamp: new Date(),
        severity: agentSecurity.issues.length > 0 ? 'high' : 'low',
        details: agentSecurity,
        recommendations: agentSecurity.issues.length > 0 
          ? ['Review agent email configurations', 'Implement domain restrictions']
          : undefined
      });

    } catch (error) {
      checks.push({
        checkName: 'security_audit_error',
        status: 'fail',
        message: 'Failed to audit security settings',
        timestamp: new Date(),
        severity: 'high',
        details: error instanceof Error ? error.message : String(error),
        recommendations: ['Check security audit implementation', 'Review access controls']
      });
    }

    return checks;
  }

  /**
   * Audit agent system health
   */
  async auditAgentSystem(): Promise<AuditResult[]> {
    const checks: AuditResult[] = [];

    try {
      // Check for agents without recent activity
      const inactiveAgents = await this.checkInactiveAgents();
      checks.push({
        checkName: 'inactive_agents',
        status: 'pass', // This is informational
        message: `Found ${inactiveAgents.count} agents without recent activity`,
        timestamp: new Date(),
        severity: 'low',
        details: inactiveAgents,
        recommendations: inactiveAgents.count > 50 
          ? ['Review agent usage patterns', 'Consider archiving unused agents']
          : undefined
      });

      // Check agent configuration consistency
      const configIssues = await this.checkAgentConfigurations();
      checks.push({
        checkName: 'agent_configuration_consistency',
        status: configIssues.issues.length > 0 ? 'warning' : 'pass',
        message: configIssues.issues.length > 0 
          ? `Found ${configIssues.issues.length} agent configuration issues`
          : 'Agent configurations are consistent',
        timestamp: new Date(),
        severity: 'medium',
        details: configIssues,
        recommendations: configIssues.issues.length > 0 
          ? ['Standardize agent configurations', 'Review agent setup process']
          : undefined
      });

      // Check duplicate agent email addresses
      const duplicateEmails = await this.checkDuplicateAgentEmails();
      checks.push({
        checkName: 'duplicate_agent_emails',
        status: duplicateEmails.duplicates.length > 0 ? 'fail' : 'pass',
        message: duplicateEmails.duplicates.length > 0 
          ? `Found ${duplicateEmails.duplicates.length} duplicate agent email addresses`
          : 'All agent email addresses are unique',
        timestamp: new Date(),
        severity: 'high',
        details: duplicateEmails,
        recommendations: duplicateEmails.duplicates.length > 0 
          ? ['Fix duplicate email addresses', 'Implement email uniqueness validation']
          : undefined
      });

    } catch (error) {
      checks.push({
        checkName: 'agent_audit_error',
        status: 'fail',
        message: 'Failed to audit agent system',
        timestamp: new Date(),
        severity: 'high',
        details: error instanceof Error ? error.message : String(error),
        recommendations: ['Check agent system status', 'Review agent database schema']
      });
    }

    return checks;
  }

  // Helper methods for specific checks
  private async checkOrphanedCompanyMemberships() {
    try {
      // Check for memberships with non-existent companies
      const orphanedMemberships = await sql`
        SELECT cm.id, cm.company_id, cm.user_id 
        FROM company_memberships cm 
        LEFT JOIN companies c ON cm.company_id = c.id 
        WHERE c.id IS NULL AND cm.is_active = true
      `;

      // Check for memberships with non-existent users  
      const orphanedUsers = await sql`
        SELECT cm.id, cm.company_id, cm.user_id 
        FROM company_memberships cm 
        LEFT JOIN users u ON cm.user_id = u.id 
        WHERE u.id IS NULL AND cm.is_active = true
      `;

      const allOrphaned = [...orphanedMemberships, ...orphanedUsers];
      
      return { 
        count: allOrphaned.length, 
        details: {
          orphanedCompanies: orphanedMemberships.length,
          orphanedUsers: orphanedUsers.length,
          entries: allOrphaned.slice(0, 10) // Limit for reporting
        }
      };
    } catch (error) {
      console.error('Error checking orphaned company memberships:', error);
      return { count: -1, details: { error: 'Database query failed' } };
    }
  }

  private async checkCompanyHierarchy() {
    try {
      const issues = [];
      
      // Check for circular references (company referencing itself as parent)
      const circularRefs = await sql`
        SELECT id, name, parent_company_id 
        FROM companies 
        WHERE id = parent_company_id
      `;
      
      if (circularRefs.length > 0) {
        issues.push({
          type: 'circular_reference',
          count: circularRefs.length,
          companies: circularRefs
        });
      }

      // Check for invalid parent references
      const invalidParents = await sql`
        SELECT c.id, c.name, c.parent_company_id 
        FROM companies c 
        LEFT JOIN companies p ON c.parent_company_id = p.id 
        WHERE c.parent_company_id IS NOT NULL AND p.id IS NULL
      `;
      
      if (invalidParents.length > 0) {
        issues.push({
          type: 'invalid_parent_reference',
          count: invalidParents.length,
          companies: invalidParents
        });
      }

      // Check for deep nesting (more than 5 levels)
      const deepNested = await sql`
        WITH RECURSIVE company_tree AS (
          SELECT id, name, parent_company_id, 1 as level
          FROM companies 
          WHERE parent_company_id IS NULL
          
          UNION ALL
          
          SELECT c.id, c.name, c.parent_company_id, ct.level + 1
          FROM companies c
          JOIN company_tree ct ON c.parent_company_id = ct.id
          WHERE ct.level < 10
        )
        SELECT id, name, level 
        FROM company_tree 
        WHERE level > 5
      `;
      
      if (deepNested.length > 0) {
        issues.push({
          type: 'deep_nesting',
          count: deepNested.length,
          companies: deepNested
        });
      }

      return { issues };
    } catch (error) {
      console.error('Error checking company hierarchy:', error);
      return { issues: [{ type: 'query_error', error: 'Database query failed' }] };
    }
  }

  private async checkUnusedSubCompanies() {
    try {
      // Find sub-companies with no polling agents and no recent activity
      const unusedSubCompanies = await sql`
        SELECT c.id, c.name, c.company_type, c.created_at,
               COUNT(pa.id) as agent_count,
               COUNT(cm.id) as member_count
        FROM companies c
        LEFT JOIN polling_agents pa ON c.id = pa.company_id AND pa.is_active = true
        LEFT JOIN company_memberships cm ON c.id = cm.company_id AND cm.is_active = true
        WHERE c.parent_company_id IS NOT NULL 
        AND c.created_at < NOW() - INTERVAL '30 days'
        GROUP BY c.id, c.name, c.company_type, c.created_at
        HAVING COUNT(pa.id) = 0 AND COUNT(cm.id) <= 1
        ORDER BY c.created_at DESC
      `;

      return {
        count: unusedSubCompanies.length,
        companies: unusedSubCompanies.slice(0, 20) // Limit for reporting
      };
    } catch (error) {
      console.error('Error checking unused sub-companies:', error);
      return { count: -1, companies: [], error: 'Database query failed' };
    }
  }

  private async checkDuplicateCompanyNames() {
    try {
      const duplicateNames = await sql`
        SELECT LOWER(name) as name, COUNT(*) as count, 
               ARRAY_AGG(id) as company_ids,
               ARRAY_AGG(company_type) as types
        FROM companies 
        GROUP BY LOWER(name) 
        HAVING COUNT(*) > 1
        ORDER BY count DESC
      `;

      return { 
        duplicates: duplicateNames.map(row => ({
          name: row.name,
          count: row.count,
          companyIds: row.company_ids,
          types: row.types
        }))
      };
    } catch (error) {
      console.error('Error checking duplicate company names:', error);
      return { duplicates: [], error: 'Database query failed' };
    }
  }

  private async checkOrphanedPollingAgents() {
    try {
      // Check agents with company_id that references non-existent companies
      const orphanedByCompany = await sql`
        SELECT pa.id, pa.name, pa.company_id, pa.account_type
        FROM polling_agents pa
        LEFT JOIN companies c ON pa.company_id = c.id
        WHERE pa.company_id IS NOT NULL AND c.id IS NULL AND pa.is_active = true
      `;

      // Check agents with created_by that references non-existent users
      const orphanedByUser = await sql`
        SELECT pa.id, pa.name, pa.created_by
        FROM polling_agents pa
        LEFT JOIN users u ON pa.created_by = u.id
        WHERE u.id IS NULL AND pa.is_active = true
      `;

      return {
        count: orphanedByCompany.length + orphanedByUser.length,
        agents: {
          orphanedByCompany: orphanedByCompany,
          orphanedByUser: orphanedByUser
        }
      };
    } catch (error) {
      console.error('Error checking orphaned polling agents:', error);
      return { count: -1, agents: { error: 'Database query failed' } };
    }
  }

  private async checkOrphanedSubmissions() {
    try {
      const orphanedSubmissions = await sql`
        SELECT s.id, s.polling_agent_id, s.submitter_email, s.submission_date
        FROM t5t_submissions s
        LEFT JOIN polling_agents pa ON s.polling_agent_id = pa.id
        WHERE pa.id IS NULL
        ORDER BY s.submission_date DESC
        LIMIT 100
      `;

      return {
        count: orphanedSubmissions.length,
        submissions: orphanedSubmissions.slice(0, 20)
      };
    } catch (error) {
      console.error('Error checking orphaned submissions:', error);
      return { count: -1, submissions: [], error: 'Database query failed' };
    }
  }

  private async checkIntelligenceTokens() {
    try {
      const issues = [];

      // Check tokens with invalid organization IDs
      const invalidOrgTokens = await sql`
        SELECT COUNT(*) as count
        FROM intelligence_tokens it
        LEFT JOIN companies c ON it.organization_id = c.id::varchar
        WHERE c.id IS NULL AND it.is_active = true
      `;

      if (parseInt(invalidOrgTokens[0]?.count || '0') > 0) {
        issues.push({
          type: 'invalid_organization_references',
          count: parseInt(invalidOrgTokens[0].count),
          description: 'Intelligence tokens referencing non-existent organizations'
        });
      }

      // Check for tokens with extremely low confidence
      const lowConfidenceTokens = await sql`
        SELECT COUNT(*) as count
        FROM intelligence_tokens
        WHERE confidence < 10 AND is_active = true
      `;

      if (parseInt(lowConfidenceTokens[0]?.count || '0') > 100) {
        issues.push({
          type: 'low_confidence_tokens',
          count: parseInt(lowConfidenceTokens[0].count),
          description: 'Large number of intelligence tokens with very low confidence scores'
        });
      }

      return { issues };
    } catch (error) {
      console.error('Error checking intelligence tokens:', error);
      return { issues: [{ type: 'query_error', error: 'Database query failed' }] };
    }
  }

  private async checkStuckBatches() {
    try {
      // This would check for batches that have been "processing" for too long
      // For now, return a placeholder since we don't have a specific batch tracking table
      const queueStats = batchProcessingQueue.getQueueStats();
      const stuckBatches = [];
      
      // Check if any organization queues have been processing for too long
      for (const orgQueue of queueStats.organizationQueues) {
        // Check if organization queue is stuck (has items but not processing)
        if (orgQueue.count > 0 && !orgQueue.processing) {
          // This is a simplified check - in a real system we'd track processing times
          stuckBatches.push({
            organizationId: orgQueue.organizationId,
            queuedCount: orgQueue.count,
            processing: orgQueue.processing,
            status: 'potentially_stuck'
          });
        }
      }

      return {
        count: stuckBatches.length,
        batches: stuckBatches
      };
    } catch (error) {
      console.error('Error checking stuck batches:', error);
      return { count: -1, batches: [], error: 'Unable to check batch status' };
    }
  }

  private async checkExcessivePermissions() {
    try {
      // Find users who are admin in many companies
      const excessiveAdmins = await sql`
        SELECT cm.user_id, u.email, COUNT(*) as admin_count,
               ARRAY_AGG(c.name) as company_names
        FROM company_memberships cm
        JOIN users u ON cm.user_id = u.id
        JOIN companies c ON cm.company_id = c.id
        WHERE cm.role = 'admin' AND cm.is_active = true
        GROUP BY cm.user_id, u.email
        HAVING COUNT(*) > 5
        ORDER BY admin_count DESC
      `;

      return {
        count: excessiveAdmins.length,
        users: excessiveAdmins.map(row => ({
          userId: row.user_id,
          email: row.email,
          adminCount: row.admin_count,
          companies: row.company_names
        }))
      };
    } catch (error) {
      console.error('Error checking excessive permissions:', error);
      return { count: -1, users: [], error: 'Database query failed' };
    }
  }

  private async checkInactiveAdmins() {
    try {
      // Find admin users with no recent polling agent activity
      const inactiveAdmins = await sql`
        SELECT DISTINCT cm.user_id, u.email, cm.company_id, c.name as company_name,
               cm.joined_at, MAX(pa.updated_at) as last_agent_activity
        FROM company_memberships cm
        JOIN users u ON cm.user_id = u.id
        JOIN companies c ON cm.company_id = c.id
        LEFT JOIN polling_agents pa ON pa.company_id = c.id AND pa.created_by = u.id
        WHERE cm.role = 'admin' AND cm.is_active = true
        GROUP BY cm.user_id, u.email, cm.company_id, c.name, cm.joined_at
        HAVING MAX(pa.updated_at) < NOW() - INTERVAL '90 days' OR MAX(pa.updated_at) IS NULL
        ORDER BY cm.joined_at DESC
      `;

      return {
        count: inactiveAdmins.length,
        admins: inactiveAdmins.slice(0, 20).map(row => ({
          userId: row.user_id,
          email: row.email,
          companyId: row.company_id,
          companyName: row.company_name,
          joinedAt: row.joined_at,
          lastAgentActivity: row.last_agent_activity
        }))
      };
    } catch (error) {
      console.error('Error checking inactive admins:', error);
      return { count: -1, admins: [], error: 'Database query failed' };
    }
  }

  private async checkAgentEmailSecurity() {
    try {
      const issues = [];

      // Check for agents without domain restrictions in company settings
      const unrestricted = await sql`
        SELECT pa.id, pa.name, pa.email_address, c.name as company_name
        FROM polling_agents pa
        JOIN companies c ON pa.company_id = c.id
        WHERE pa.account_type = 'company' 
        AND (pa.settings->>'isDomainRestricted')::boolean = false
        AND pa.is_active = true
      `;

      if (unrestricted.length > 0) {
        issues.push({
          type: 'unrestricted_company_agents',
          count: unrestricted.length,
          description: 'Company agents without domain restrictions',
          agents: unrestricted.slice(0, 10)
        });
      }

      // Check for duplicate email addresses
      const duplicateEmails = await sql`
        SELECT email_address, COUNT(*) as count, ARRAY_AGG(id) as agent_ids
        FROM polling_agents
        WHERE is_active = true
        GROUP BY email_address
        HAVING COUNT(*) > 1
      `;

      if (duplicateEmails.length > 0) {
        issues.push({
          type: 'duplicate_email_addresses',
          count: duplicateEmails.length,
          description: 'Multiple agents sharing the same email address',
          duplicates: duplicateEmails
        });
      }

      return { issues };
    } catch (error) {
      console.error('Error checking agent email security:', error);
      return { issues: [{ type: 'query_error', error: 'Database query failed' }] };
    }
  }

  private async checkInactiveAgents() {
    try {
      const inactiveAgents = await sql`
        SELECT pa.id, pa.name, pa.email_address, pa.created_at,
               COUNT(s.id) as submission_count,
               MAX(s.submission_date) as last_submission
        FROM polling_agents pa
        LEFT JOIN t5t_submissions s ON pa.id = s.polling_agent_id
        WHERE pa.is_active = true AND pa.created_at < NOW() - INTERVAL '30 days'
        GROUP BY pa.id, pa.name, pa.email_address, pa.created_at
        HAVING COUNT(s.id) = 0 OR MAX(s.submission_date) < NOW() - INTERVAL '60 days'
        ORDER BY pa.created_at DESC
      `;

      return {
        count: inactiveAgents.length,
        agents: inactiveAgents.slice(0, 50).map(row => ({
          id: row.id,
          name: row.name,
          emailAddress: row.email_address,
          createdAt: row.created_at,
          submissionCount: row.submission_count,
          lastSubmission: row.last_submission
        }))
      };
    } catch (error) {
      console.error('Error checking inactive agents:', error);
      return { count: -1, agents: [], error: 'Database query failed' };
    }
  }

  private async checkAgentConfigurations() {
    try {
      const issues = [];

      // Check for agents with invalid settings
      const invalidSettings = await sql`
        SELECT id, name, settings
        FROM polling_agents
        WHERE is_active = true
        AND (settings IS NULL OR settings = '{}' OR settings->>'submissionFrequency' IS NULL)
      `;

      if (invalidSettings.length > 0) {
        issues.push({
          type: 'invalid_settings',
          count: invalidSettings.length,
          description: 'Agents with missing or invalid configuration settings',
          agents: invalidSettings.slice(0, 10)
        });
      }

      // Check for inconsistent email domain patterns
      const inconsistentDomains = await sql`
        SELECT 
          SUBSTRING(email_address FROM '@(.*)') as domain,
          COUNT(*) as count,
          ARRAY_AGG(DISTINCT account_type) as account_types
        FROM polling_agents
        WHERE is_active = true
        GROUP BY SUBSTRING(email_address FROM '@(.*)')
        HAVING COUNT(DISTINCT account_type) > 1
      `;

      if (inconsistentDomains.length > 0) {
        issues.push({
          type: 'inconsistent_domain_usage',
          count: inconsistentDomains.length,
          description: 'Email domains used for both individual and company accounts',
          domains: inconsistentDomains
        });
      }

      return { issues };
    } catch (error) {
      console.error('Error checking agent configurations:', error);
      return { issues: [{ type: 'query_error', error: 'Database query failed' }] };
    }
  }

  private async checkDuplicateAgentEmails() {
    try {
      const duplicateEmails = await sql`
        SELECT email_address, COUNT(*) as count,
               ARRAY_AGG(id) as agent_ids,
               ARRAY_AGG(name) as agent_names,
               ARRAY_AGG(account_type) as account_types
        FROM polling_agents
        WHERE is_active = true
        GROUP BY email_address
        HAVING COUNT(*) > 1
        ORDER BY count DESC
      `;

      return {
        duplicates: duplicateEmails.map(row => ({
          emailAddress: row.email_address,
          count: row.count,
          agentIds: row.agent_ids,
          agentNames: row.agent_names,
          accountTypes: row.account_types
        }))
      };
    } catch (error) {
      console.error('Error checking duplicate agent emails:', error);
      return { duplicates: [], error: 'Database query failed' };
    }
  }
}

export const auditService = AuditService.getInstance();