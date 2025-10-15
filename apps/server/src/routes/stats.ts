import { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../googleAuth';

export function registerStatsRoutes(app: Express) {
  // Dashboard stats
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
}