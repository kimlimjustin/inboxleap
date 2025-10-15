import { Express } from 'express';
import { storage } from '../storage';

export function registerHealthRoutes(app: Express) {
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
}
