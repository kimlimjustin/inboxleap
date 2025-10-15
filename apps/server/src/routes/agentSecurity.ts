import { Express } from 'express';
import { isAuthenticated } from '../googleAuth';
import { securityLayer, AgentSecurityConfig } from '../framework/SecurityLayer';

// Simple admin check - in production, implement proper role-based access
const isAdmin = (req: any, res: any, next: any) => {
  // For now, check if user email contains 'admin' or is from specific domains
  const adminDomains = ['inboxleap.com'];
  const userEmail = req.user?.email?.toLowerCase();
  
  if (userEmail && (
    userEmail.includes('admin') || 
    adminDomains.some(domain => userEmail.endsWith(`@${domain}`))
  )) {
    return next();
  }
  
  return res.status(403).json({ message: 'Admin access required' });
};

export function registerAgentSecurityRoutes(app: Express) {
  
  // Get security overview
  app.get('/api/admin/security/overview', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = await securityLayer.getSecurityStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting security overview:', error);
      res.status(500).json({ message: 'Failed to get security overview' });
    }
  });

  // Get specific agent security config
  app.get('/api/admin/security/agents/:agentName', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { agentName } = req.params;
      const config = securityLayer.getAgentConfig(agentName);
      
      if (!config) {
        return res.status(404).json({ message: 'Agent configuration not found' });
      }
      
      res.json(config);
    } catch (error) {
      console.error('Error getting agent security config:', error);
      res.status(500).json({ message: 'Failed to get agent security config' });
    }
  });

  // Update agent security config
  app.put('/api/admin/security/agents/:agentName', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { agentName } = req.params;
      const config: Partial<AgentSecurityConfig> = req.body;
      
      // Validate required fields
      if (!agentName || !config.policies) {
        return res.status(400).json({ message: 'Agent name and policies are required' });
      }
      
      // Get existing config or create new one
      const existingConfig = securityLayer.getAgentConfig(agentName);
      const newConfig: AgentSecurityConfig = {
        agentName,
        policies: config.policies,
        customSettings: config.customSettings || {},
        maxRequestsPerHour: config.maxRequestsPerHour || 100,
        trustedDomains: config.trustedDomains || [],
        blockedDomains: config.blockedDomains || [],
        requireTrust: config.requireTrust || false,
        allowSelfService: config.allowSelfService !== undefined ? config.allowSelfService : true,
        ...existingConfig // Preserve any existing settings not provided
      };
      
      await securityLayer.setAgentConfig(newConfig);
      
      res.json({
        message: 'Agent security configuration updated successfully',
        config: newConfig
      });
    } catch (error) {
      console.error('Error updating agent security config:', error);
      res.status(500).json({ message: 'Failed to update agent security config' });
    }
  });

  // Update agent policies only
  app.patch('/api/admin/security/agents/:agentName/policies', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { agentName } = req.params;
      const { policies } = req.body;
      
      if (!Array.isArray(policies)) {
        return res.status(400).json({ message: 'Policies must be an array' });
      }
      
      const success = await securityLayer.updateAgentPolicies(agentName, policies);
      
      if (!success) {
        return res.status(404).json({ message: 'Agent not found' });
      }
      
      res.json({
        message: 'Agent policies updated successfully',
        agentName,
        policies
      });
    } catch (error) {
      console.error('Error updating agent policies:', error);
      res.status(500).json({ message: 'Failed to update agent policies' });
    }
  });

  // Test security validation for an agent
  app.post('/api/admin/security/agents/:agentName/test', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { agentName } = req.params;
      const { email, context } = req.body;
      
      if (!email || !context) {
        return res.status(400).json({ message: 'Email and context are required for testing' });
      }
      
      // Create test email data
      const testEmail = {
        messageId: 'test-' + Date.now(),
        subject: email.subject || 'Test Email',
        from: email.from || 'test@example.com',
        to: email.to || ['agent@inboxleap.com'],
        cc: email.cc || [],
        bcc: email.bcc || [],
        body: email.body || 'Test email body',
        date: new Date(),
        inReplyTo: email.inReplyTo,
        references: email.references || [],
        threadId: email.threadId
      };
      
      // Create test context
      const testContext = {
        isTo: context.isTo !== undefined ? context.isTo : true,
        isCc: context.isCc !== undefined ? context.isCc : false,
        isBcc: context.isBcc !== undefined ? context.isBcc : false,
        recipients: context.recipients || testEmail.to,
        sender: context.sender || testEmail.from
      };
      
      const validationResult = await securityLayer.validateRequest(testEmail, testContext, agentName);
      
      res.json({
        message: 'Security validation test completed',
        agentName,
        testData: { email: testEmail, context: testContext },
        result: validationResult
      });
    } catch (error) {
      console.error('Error testing agent security:', error);
      res.status(500).json({ message: 'Failed to test agent security' });
    }
  });

  // Get available security policies
  app.get('/api/admin/security/policies', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = await securityLayer.getSecurityStats();
      res.json(stats.policies);
    } catch (error) {
      console.error('Error getting security policies:', error);
      res.status(500).json({ message: 'Failed to get security policies' });
    }
  });

  // Bulk update multiple agents
  app.patch('/api/admin/security/agents', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { agents } = req.body;
      
      if (!Array.isArray(agents)) {
        return res.status(400).json({ message: 'Agents must be an array' });
      }
      
      const results = [];
      
      for (const agentUpdate of agents) {
        try {
          if (agentUpdate.policies) {
            const success = await securityLayer.updateAgentPolicies(agentUpdate.agentName, agentUpdate.policies);
            results.push({
              agentName: agentUpdate.agentName,
              success,
              message: success ? 'Updated successfully' : 'Agent not found'
            });
          }
          
          if (agentUpdate.config) {
            const config: AgentSecurityConfig = {
              agentName: agentUpdate.agentName,
              ...agentUpdate.config
            };
            await securityLayer.setAgentConfig(config);
            results.push({
              agentName: agentUpdate.agentName,
              success: true,
              message: 'Configuration updated successfully'
            });
          }
        } catch (error) {
          results.push({
            agentName: agentUpdate.agentName,
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      res.json({
        message: 'Bulk agent update completed',
        results
      });
    } catch (error) {
      console.error('Error bulk updating agents:', error);
      res.status(500).json({ message: 'Failed to bulk update agents' });
    }
  });

  // Get security audit log (placeholder for future implementation)
  app.get('/api/admin/security/audit', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // TODO: Implement actual audit logging
      const auditLog = [
        {
          timestamp: new Date(),
          event: 'security_block',
          agent: 'todo',
          user: 'test@example.com',
          reason: 'Rate limit exceeded',
          details: { requestCount: 51, limit: 50 }
        },
        {
          timestamp: new Date(Date.now() - 60000),
          event: 'config_update',
          agent: 'alex',
          admin: req.user.email,
          reason: 'Updated trust requirements',
          details: { requireTrust: true }
        }
      ];
      
      res.json({
        message: 'Security audit log (sample data)',
        events: auditLog
      });
    } catch (error) {
      console.error('Error getting security audit log:', error);
      res.status(500).json({ message: 'Failed to get security audit log' });
    }
  });
}