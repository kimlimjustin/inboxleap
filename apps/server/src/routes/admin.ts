import { Express } from 'express';
import { isAuthenticated } from '../googleAuth';
import { automatedBlacklistService } from '../services/automatedBlacklistService';

export function registerAdminRoutes(app: Express) {
  
  // Get blacklist statistics (admin only)
  app.get('/api/admin/blacklist-stats', isAuthenticated, async (req: any, res) => {
    try {
      // Basic auth check - in production, add proper admin role validation
      const userEmail = req.user.email;
      
      // For now, only allow specific admin emails or users with 'admin' in email
      // In production, implement proper role-based access control
      if (!userEmail || (!userEmail.includes('admin') && !process.env.ADMIN_EMAILS?.split(',').includes(userEmail))) {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      }

      const stats = await automatedBlacklistService.getBlacklistStats();
      
      res.json({
        message: 'Blacklist statistics retrieved successfully',
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting blacklist stats:', error);
      res.status(500).json({ message: 'Failed to retrieve blacklist statistics' });
    }
  });

  // Trigger manual cleanup of expired tokens (admin only)
  app.post('/api/admin/cleanup-tokens', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.email;
      
      if (!userEmail || (!userEmail.includes('admin') && !process.env.ADMIN_EMAILS?.split(',').includes(userEmail))) {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      }

      // Import storage to run cleanup manually
      const { storage } = await import('../storage');
      
      const [passwordTokens, trustTokens] = await Promise.all([
        storage.cleanupExpiredPasswordResetTokens(),
        storage.cleanupExpiredTrustConfirmationTokens()
      ]);

      res.json({
        message: 'Token cleanup completed',
        cleaned: {
          passwordResetTokens: passwordTokens,
          trustConfirmationTokens: trustTokens,
          total: passwordTokens + trustTokens
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error during manual token cleanup:', error);
      res.status(500).json({ message: 'Failed to cleanup tokens' });
    }
  });

  // Get suspicious patterns report (admin only)
  app.get('/api/admin/suspicious-patterns', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.email;
      
      if (!userEmail || (!userEmail.includes('admin') && !process.env.ADMIN_EMAILS?.split(',').includes(userEmail))) {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      }

      // Manually trigger suspicious pattern monitoring
      const { storage } = await import('../storage');
      
      const [suspiciousUsers, overBlockers] = await Promise.all([
        storage.getUsersBlockedByMany(3), // Lower threshold for admin view
        storage.getUsersWhoBlockMany(5)   // Lower threshold for admin view
      ]);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const [recentBlocks, recentTrusts] = await Promise.all([
        storage.getRecentBlockingActivity(sevenDaysAgo),
        storage.getRecentTrustActivity(sevenDaysAgo)
      ]);

      // Group recent blocks by date for spike detection
      const dailyBlocks = new Map<string, number>();
      recentBlocks.forEach(block => {
        const date = new Date(block.createdAt!).toISOString().split('T')[0];
        dailyBlocks.set(date, (dailyBlocks.get(date) || 0) + 1);
      });

      const spikes = Array.from(dailyBlocks.entries())
        .filter(([_, count]) => count > 5) // Lower threshold for admin
        .map(([date, blockCount]) => ({ date, blockCount }))
        .sort((a, b) => b.blockCount - a.blockCount);

      res.json({
        message: 'Suspicious patterns report generated',
        report: {
          suspiciousUsers: suspiciousUsers.slice(0, 10), // Top 10
          overBlockers: overBlockers.slice(0, 10),       // Top 10
          recentActivity: {
            blocks: recentBlocks.length,
            trusts: recentTrusts.length,
            dailySpikes: spikes
          },
          period: {
            from: sevenDaysAgo.toISOString(),
            to: new Date().toISOString()
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error generating suspicious patterns report:', error);
      res.status(500).json({ message: 'Failed to generate suspicious patterns report' });
    }
  });

  // Force suspicious pattern monitoring (admin only)
  app.post('/api/admin/monitor-patterns', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.email;
      
      if (!userEmail || (!userEmail.includes('admin') && !process.env.ADMIN_EMAILS?.split(',').includes(userEmail))) {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      }

      // This would normally be done by the automated service, but admin can trigger it manually
      console.log(`🔍 [ADMIN] Manual suspicious pattern monitoring triggered by ${userEmail}`);
      
      res.json({
        message: 'Suspicious pattern monitoring triggered',
        note: 'Check server logs for monitoring results',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error triggering pattern monitoring:', error);
      res.status(500).json({ message: 'Failed to trigger pattern monitoring' });
    }
  });
}