import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./googleAuth";
import { storage } from "./storage";
import { s3EmailBackupProcessor } from "./services/s3EmailBackupProcessor";
import { t5tAnalysisService } from "./services/t5tAnalysisService";
import { t5tCache } from "./services/t5tCache";

// Import modular route handlers
import { registerHealthRoutes } from "./routes/health";
import { registerAuthRoutes } from "./routes/auth";
import { registerProjectTaskRoutes } from "./routes/projects";
import { registerEmailRoutes } from "./routes/email";
import { registerT5TRoutes } from "./routes/t5t";
import { registerCompanyIntelligenceRoutes } from "./routes/companyIntelligence";
import { registerPollingAgentsRoutes } from "./routes/pollingAgents";
import { registerCopilotRoutes } from "./routes/copilot";
import { registerAttachmentRoutes } from "./routes/attachments";
import { registerFAQRoutes } from "./routes/faq";
import { registerStatsRoutes } from "./routes/stats";
import { registerDocumentRoutes } from "./routes/documents";
import { registerTrustRoutes } from "./routes/trust";
import { registerAdminRoutes } from "./routes/admin";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerAgentSecurityRoutes } from "./routes/agentSecurity";
import { registerCompanyRoutes } from "./routes/companies";
import companyAgentEmailsRouter from "./routes/companyAgentEmails";
import userAgentEmailsRouter from "./routes/userAgentEmails";
import agentInstancesRouter from "./routes/agentInstances";
import companyInvitationsRouter from "./routes/companyInvitations";
import testEmailsRouter from "./routes/testEmails";
import identitiesRouter from "./routes/identities";
import { registerAuditRoutes } from "./routes/audit";
import { auditScheduler } from "./services/auditScheduler";
import { setupWebSocket } from "./routes/websocket";

// Helper functions for polling system
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoints (public)
  app.get('/', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'backend', path: '/' });
  });
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'healthy', path: '/health' });
  });

  // Enhanced health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      // Simple database test by querying users table
      await storage.getUser('test-health-check');
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'connected',
        environment: process.env.NODE_ENV || 'development'
      };
      
      res.status(200).json(health);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({ 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Register all route modules
  await registerAuthRoutes(app);
  registerStatsRoutes(app);
  registerProjectTaskRoutes(app);
  registerEmailRoutes(app);
  registerT5TRoutes(app);
  registerCompanyIntelligenceRoutes(app);
  registerPollingAgentsRoutes(app);
  registerCopilotRoutes(app);
  registerAttachmentRoutes(app);
  registerDocumentRoutes(app);
  registerFAQRoutes(app);
  registerTrustRoutes(app);
  registerAdminRoutes(app);
  registerNotificationRoutes(app);
  registerAgentSecurityRoutes(app);
  registerCompanyRoutes(app);
  app.use('/api/companies', companyAgentEmailsRouter);
  app.use('/api/user', userAgentEmailsRouter);
  app.use('/api/agent-instances', agentInstancesRouter);
  app.use('/api/companies', companyInvitationsRouter);
  app.use('/api/invitations', companyInvitationsRouter);
  app.use('/api/test', testEmailsRouter);
  app.use('/api/identities', identitiesRouter);
  registerAuditRoutes(app);

  // Setup WebSocket for real-time updates
  const server = setupWebSocket(app);
  
  // Start automated audit scheduler
  console.log('🔍 [SERVER] Initializing audit scheduler...');
  auditScheduler.start().catch(error => {
    console.error('❌ [SERVER] Failed to start audit scheduler:', error);
  });
  
  return server;
}