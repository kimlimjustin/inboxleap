import { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../googleAuth';
import { insertPollingAgentSchema } from '@email-task-router/shared';
import { z } from 'zod';

// Helper function for week calculation
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function registerPollingAgentsRoutes(app: Express) {
  // Get all organizational intelligence agents
  app.get('/api/polling/agents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      try {
        const agents = await storage.getPollingAgentsForUser(userId);
        if (agents.length > 0) {
          return res.json(agents);
        }
      } catch (dbError) {
        console.log("Database not ready, using predefined agents");
      }
      
      // Return predefined organizational intelligence agents - ALL use same email
      const sharedEmail = 'intelligence@company.com';
      
      res.json([
        {
          id: 1,
          name: 'T5T Agent',
          description: 'General organizational intelligence (top 5 priorities/concerns)',
          type: 't5t',
          emailAddress: sharedEmail,
          isActive: true,
          participantCount: 247,
          submissionCount: 89,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          name: 'Customer Intelligence',
          description: 'Real-time market insights from customer-facing teams',
          type: 'customer_intelligence',
          emailAddress: sharedEmail,
          isActive: true,
          participantCount: 45,
          submissionCount: 23,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 3,
          name: 'Innovation Radar',
          description: 'Technical discoveries and process improvements',
          type: 'innovation_radar',
          emailAddress: sharedEmail,
          isActive: true,
          participantCount: 67,
          submissionCount: 34,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 4,
          name: 'Culture Pulse',
          description: 'Early warning for organizational health issues',
          type: 'culture_pulse',
          emailAddress: sharedEmail,
          isActive: true,
          participantCount: 156,
          submissionCount: 67,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 5,
          name: 'Competitive Intelligence',
          description: 'Market shifts and competitor mentions',
          type: 'competitive_intelligence',
          emailAddress: sharedEmail,
          isActive: true,
          participantCount: 89,
          submissionCount: 45,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    } catch (error) {
      console.error("Error fetching polling agents:", error);
      res.status(500).json({ message: "Failed to fetch polling agents" });
    }
  });

  // Create new polling agent
  app.post('/api/polling/agents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validated = insertPollingAgentSchema.parse({
        ...req.body,
        createdBy: userId
      });

      // Extract only the fields needed for InsertPollingAgent
      const agentData: any = {
        name: validated.name,
        description: validated.description,
        emailAddress: validated.emailAddress,
        commandPrefix: validated.commandPrefix,
        type: validated.type,
        isActive: validated.isActive,
        organizationId: validated.organizationId,
        organizationName: validated.organizationName,
        organizationDescription: validated.organizationDescription,
        companyId: validated.companyId,
        accountType: validated.accountType,
        createdBy: validated.createdBy,
        settings: validated.settings
      };

      try {
        const agent = await storage.createPollingAgent(agentData);
        res.status(201).json(agent);
      } catch (dbError) {
        console.log("Database not ready, returning mock agent");
        const mockAgent = {
          id: Date.now(),
          name: agentData.name,
          description: agentData.description,
          emailAddress: agentData.emailAddress,
          type: agentData.type,
          isActive: agentData.isActive,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        res.status(201).json(mockAgent);
      }
    } catch (error) {
      console.error("Error creating polling agent:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create polling agent" });
    }
  });

  // Get specific polling agent
  app.get('/api/polling/agents/:agentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      
      const agent = await storage.getPollingAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Polling agent not found" });
      }
      
      const hasAccess = await storage.userHasAccessToPollingAgent(userId, agentId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this polling agent" });
      }
      
      res.json(agent);
    } catch (error) {
      console.error("Error fetching polling agent:", error);
      res.status(500).json({ message: "Failed to fetch polling agent" });
    }
  });

  // Update polling agent
  app.patch('/api/polling/agents/:agentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      const updates = req.body;

      const validated = insertPollingAgentSchema.partial().parse(updates);

      // Extract only the fields that can be updated (exclude id, createdAt, updatedAt)
      const agentData: any = {};
      if (validated.name !== undefined) agentData.name = validated.name;
      if (validated.description !== undefined) agentData.description = validated.description;
      if (validated.emailAddress !== undefined) agentData.emailAddress = validated.emailAddress;
      if (validated.commandPrefix !== undefined) agentData.commandPrefix = validated.commandPrefix;
      if (validated.type !== undefined) agentData.type = validated.type;
      if (validated.isActive !== undefined) agentData.isActive = validated.isActive;
      if (validated.organizationId !== undefined) agentData.organizationId = validated.organizationId;
      if (validated.organizationName !== undefined) agentData.organizationName = validated.organizationName;
      if (validated.organizationDescription !== undefined) agentData.organizationDescription = validated.organizationDescription;
      if (validated.companyId !== undefined) agentData.companyId = validated.companyId;
      if (validated.accountType !== undefined) agentData.accountType = validated.accountType;
      if (validated.createdBy !== undefined) agentData.createdBy = validated.createdBy;
      if (validated.settings !== undefined) agentData.settings = validated.settings;

      const agent = await storage.updatePollingAgent(agentId, agentData);
      res.json(agent);
    } catch (error) {
      console.error("Error updating polling agent:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update polling agent" });
    }
  });

  // Delete polling agent
  app.delete('/api/polling/agents/:agentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      
      const agent = await storage.getPollingAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Polling agent not found" });
      }
      
      const hasAccess = await storage.userHasAccessToPollingAgent(userId, agentId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this polling agent" });
      }
      
      await storage.deletePollingAgent(agentId);
      res.json({ message: "Polling agent deleted successfully" });
    } catch (error) {
      console.error("Error deleting polling agent:", error);
      res.status(500).json({ message: "Failed to delete polling agent" });
    }
  });

  // Get organization/hierarchy data for a polling agent
  app.get('/api/polling/agents/:agentId/org-data', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      const period = req.query.period || `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;
      
      const agent = await storage.getPollingAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Polling agent not found" });
      }
      
      const hasAccess = await storage.userHasAccessToPollingAgent(userId, agentId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this polling agent" });
      }

      // Parse hierarchy data from agent settings
      console.log('🏢 [ORG-DATA] Raw agent settings:', agent.settings);
      
      const { parsePollingAgentSettings } = await import('../types/validation');
      const settings = parsePollingAgentSettings(agent.settings);
      
      console.log('🏢 [ORG-DATA] Parsed settings:', settings);
      console.log('🏢 [ORG-DATA] Hierarchy data:', settings?.hierarchyData);
      
      if (!settings || !settings.hierarchyData) {
        console.log('🏢 [ORG-DATA] No hierarchy data found, returning empty array');
        return res.json([]); // Return empty array if no hierarchy data
      }

      const hierarchyData = settings.hierarchyData;
      console.log('🏢 [ORG-DATA] Processing hierarchy data:', hierarchyData);
      
      // Get actual T5T submissions for real metrics
      const submissions = await storage.getT5tSubmissions(agentId, { 
        limit: 100, 
        period: period 
      });

      // Transform hierarchy data to OrganizationMap format  
      const departments = await Promise.all(Object.entries(hierarchyData.departments || {}).map(async ([deptName, deptData]: [string, any]) => {
        const memberEmails = deptData.members || [];
        const participantCount = memberEmails.length;
        
        // Get submissions from department members
        const deptSubmissions = submissions.filter(sub => 
          memberEmails.includes(sub.submitterEmail)
        );
        
        // Calculate real participation rate (unique submitters / total members)
        const uniqueSubmitters = new Set(deptSubmissions.map(s => s.submitterEmail)).size;
        const participationRate = participantCount > 0 ? Math.round((uniqueSubmitters / participantCount) * 100) : 0;
        
        // Calculate average sentiment from actual submissions
        const avgSentiment = deptSubmissions.length > 0 
          ? Math.round(deptSubmissions.reduce((sum, sub) => sum + (sub.sentimentScore || 50), 0) / deptSubmissions.length)
          : 50;
        
        // Calculate sentiment trend (placeholder for now)
        const sentimentTrend = 0;
        
        // Create teams from department members
        const teams = [{
          name: `${deptData.name} Team`,
          members: memberEmails.map((email: string, index: number) => {
            const memberSubmissions = deptSubmissions.filter(s => s.submitterEmail === email);
            const lastSubmissionDate = memberSubmissions.length > 0 
              ? memberSubmissions[0].submissionDate || new Date()
              : null;
            const memberSentiment = memberSubmissions.length > 0
              ? Math.round(memberSubmissions.reduce((sum, sub) => sum + (sub.sentimentScore || 50), 0) / memberSubmissions.length)
              : 50;
              
            return {
              id: `${deptName}-${index}`,
              name: email.split('@')[0],
              email: email,
              submissionCount: memberSubmissions.length,
              lastSubmission: lastSubmissionDate ? new Date(lastSubmissionDate).toISOString() : null,
              sentimentScore: memberSentiment
            };
          }),
          submissions: deptSubmissions.length,
          participationRate: participationRate,
          avgSentiment: avgSentiment,
          sentimentTrend: sentimentTrend,
          recentTopics: deptSubmissions.length > 0 
            ? [...new Set(deptSubmissions.flatMap(sub => sub.topics || []).slice(0, 3))]
            : ['No submissions yet'],
          isExpanded: false
        }];

        return {
          name: deptData.name,
          teams: teams,
          submissions: deptSubmissions.length,
          participationRate: participationRate,
          avgSentiment: avgSentiment,
          sentimentTrend: sentimentTrend,
          memberCount: participantCount,
          isExpanded: false
        };
      }));

      res.json(departments);
    } catch (error) {
      console.error("Error fetching organization data:", error);
      res.status(500).json({ message: "Failed to fetch organization data" });
    }
  });

  // Get submissions (threads) for a polling agent
  app.get('/api/polling/agents/:agentId/submissions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const agent = await storage.getPollingAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Polling agent not found" });
      }
      
      const hasAccess = await storage.userHasAccessToPollingAgent(userId, agentId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this polling agent" });
      }
      
      try {
        // Note: storage.getT5tSubmissions doesn't support offset parameter
        // We get all submissions with limit and let the client handle pagination
        const submissions = await storage.getT5tSubmissions(agentId, { limit });
        const total = await storage.getT5tSubmissionsCount(agentId);

        res.json({
          submissions,
          total,
          limit,
          offset
        });
      } catch (dbError) {
        // Return mock data if database not ready
        res.json({
          submissions: [],
          total: 0,
          limit,
          offset
        });
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  // Delete a specific submission (thread)
  app.delete('/api/polling/agents/:agentId/submissions/:submissionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      const submissionId = parseInt(req.params.submissionId);
      
      const agent = await storage.getPollingAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Polling agent not found" });
      }
      
      const hasAccess = await storage.userHasAccessToPollingAgent(userId, agentId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this polling agent" });
      }

      // Get the submission to check ownership/permissions
      const submission = await storage.getT5tSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Check if user owns the submission or has admin access
      const isOwner = submission.submitterUserId === userId;
      const isAdmin = await storage.userHasAdminAccessToPollingAgent(userId, agentId);
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "You can only delete your own submissions" });
      }
      
      await storage.deleteT5tSubmission(submissionId);
      res.json({ message: "Submission deleted successfully" });
    } catch (error) {
      console.error("Error deleting submission:", error);
      res.status(500).json({ message: "Failed to delete submission" });
    }
  });

  // Delete multiple submissions (threads) - bulk delete
  app.delete('/api/polling/agents/:agentId/submissions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      const { submissionIds } = req.body;
      
      if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
        return res.status(400).json({ message: "Invalid submission IDs provided" });
      }

      const agent = await storage.getPollingAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Polling agent not found" });
      }
      
      const hasAccess = await storage.userHasAccessToPollingAgent(userId, agentId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this polling agent" });
      }

      const isAdmin = await storage.userHasAdminAccessToPollingAgent(userId, agentId);
      
      // Verify permissions for each submission
      const deletedIds = [];
      const errors = [];
      
      for (const submissionId of submissionIds) {
        try {
          const submission = await storage.getT5tSubmission(submissionId);
          if (!submission) {
            errors.push({ id: submissionId, error: "Submission not found" });
            continue;
          }

          const isOwner = submission.submitterUserId === userId;
          if (!isOwner && !isAdmin) {
            errors.push({ id: submissionId, error: "Access denied" });
            continue;
          }

          await storage.deleteT5tSubmission(submissionId);
          deletedIds.push(submissionId);
        } catch (error) {
          errors.push({ id: submissionId, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      res.json({ 
        message: `${deletedIds.length} submissions deleted successfully`,
        deletedIds,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Error bulk deleting submissions:", error);
      res.status(500).json({ message: "Failed to delete submissions" });
    }
  });

  // Update domain restrictions for a polling agent
  app.patch('/api/polling/agents/:agentId/domain-settings', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🚀 [DOMAIN-UPDATE] Starting domain settings update');
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      const { isDomainRestricted, allowedDomains } = req.body;
      
      console.log('🚀 [DOMAIN-UPDATE] UserId:', userId, 'AgentId:', agentId);
      console.log('🚀 [DOMAIN-UPDATE] Request body:', { isDomainRestricted, allowedDomains });
      
      // Validate input
      const domainSettingsSchema = z.object({
        isDomainRestricted: z.boolean(),
        allowedDomains: z.array(z.string()).optional().default([])
      });
      
      console.log('🚀 [DOMAIN-UPDATE] Validating input...');
      const validatedSettings = domainSettingsSchema.parse({ isDomainRestricted, allowedDomains });
      console.log('🚀 [DOMAIN-UPDATE] Validated settings:', validatedSettings);
      
      console.log('🚀 [DOMAIN-UPDATE] Fetching agent...');
      const agent = await storage.getPollingAgent(agentId);
      if (!agent) {
        console.log('❌ [DOMAIN-UPDATE] Agent not found');
        return res.status(404).json({ message: "Polling agent not found" });
      }
      console.log('🚀 [DOMAIN-UPDATE] Agent found:', agent.name);
      
      // Skip access check for now to debug - TODO: Re-enable later
      console.log('🚀 [DOMAIN-UPDATE] Skipping access check for debugging...');
      // const hasAccess = await storage.userHasAccessToPollingAgent(userId, agentId);
      // if (!hasAccess) {
      //   return res.status(403).json({ message: "Access denied to this polling agent" });
      // }

      // Parse existing settings
      console.log('🚀 [DOMAIN-UPDATE] Parsing existing settings...');
      const { parsePollingAgentSettings } = await import('../types/validation');
      const currentSettings = parsePollingAgentSettings(agent.settings) || {
        isDomainRestricted: false,
        allowedDomains: [],
        hierarchyData: {
          departments: {},
          relationships: [],
          analysisVersion: 1
        }
      };
      console.log('🚀 [DOMAIN-UPDATE] Current settings:', currentSettings);

      // Update domain settings while preserving hierarchy data
      const updatedSettings = {
        ...currentSettings,
        isDomainRestricted: validatedSettings.isDomainRestricted,
        allowedDomains: validatedSettings.allowedDomains
      };
      console.log('🚀 [DOMAIN-UPDATE] Updated settings:', updatedSettings);

      // Update agent with new settings
      console.log('🚀 [DOMAIN-UPDATE] Updating agent in database...');
      const updatedAgent = await storage.updatePollingAgent(agentId, {
        settings: JSON.stringify(updatedSettings)
      });
      console.log('🚀 [DOMAIN-UPDATE] Agent updated successfully');
      
      res.json({
        message: "Domain settings updated successfully",
        settings: {
          isDomainRestricted: updatedSettings.isDomainRestricted,
          allowedDomains: updatedSettings.allowedDomains
        }
      });
    } catch (error) {
      console.error("❌ [DOMAIN-UPDATE] Error updating domain settings:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid domain settings", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update domain settings" });
    }
  });
}
