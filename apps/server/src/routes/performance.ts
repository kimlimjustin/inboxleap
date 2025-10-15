import { Router, type Router as ExpressRouter } from 'express';
import { performanceMonitor } from '../services/performanceMonitor';
import { batchProcessingQueue } from '../services/batchProcessingQueue';
import { isAuthenticated as requireAuth } from '../googleAuth';

const router: ExpressRouter = Router();

/**
 * Get performance dashboard data
 */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const dashboard = performanceMonitor.getPerformanceDashboard();
    const queueStats = batchProcessingQueue.getQueueStats();
    
    res.json({
      success: true,
      data: {
        ...dashboard,
        queueStatus: queueStats
      }
    });
  } catch (error) {
    console.error('Error getting performance dashboard:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get performance data' 
    });
  }
});

/**
 * Get agent-specific performance stats
 */
router.get('/agent/:agentName', requireAuth, async (req, res) => {
  try {
    const { agentName } = req.params;
    const timeWindow = parseInt(req.query.timeWindow as string) || 24 * 60 * 60 * 1000; // 24 hours default
    
    const stats = performanceMonitor.getAgentStats(agentName, timeWindow);
    
    res.json({
      success: true,
      data: {
        agent: agentName,
        timeWindow,
        stats
      }
    });
  } catch (error) {
    console.error('Error getting agent performance stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get agent performance data' 
    });
  }
});

/**
 * Get batch processing queue status
 */
router.get('/queue', requireAuth, async (req, res) => {
  try {
    const queueStats = batchProcessingQueue.getQueueStats();
    
    res.json({
      success: true,
      data: queueStats
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get queue status' 
    });
  }
});

/**
 * Force process all queues (emergency endpoint)
 */
router.post('/queue/force-process', requireAuth, async (req, res) => {
  try {
    console.log(`🚨 [Performance] Force processing all queues requested by user`);
    await batchProcessingQueue.forceProcessAll();
    
    res.json({
      success: true,
      message: 'Force processing initiated for all queues'
    });
  } catch (error) {
    console.error('Error force processing queues:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to force process queues' 
    });
  }
});

/**
 * Export performance metrics
 */
router.get('/export', requireAuth, async (req, res) => {
  try {
    const format = (req.query.format as string) || 'json';
    const timeWindow = parseInt(req.query.timeWindow as string) || undefined;
    
    const exportData = performanceMonitor.exportMetrics(format as 'json' | 'csv', timeWindow);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="performance_metrics.csv"');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="performance_metrics.json"');
    }
    
    res.send(exportData);
  } catch (error) {
    console.error('Error exporting performance data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export performance data' 
    });
  }
});

/**
 * Get system health status
 */
router.get('/health', async (req, res) => {
  try {
    const dashboard = performanceMonitor.getPerformanceDashboard();
    const queueStats = batchProcessingQueue.getQueueStats();
    
    // Determine system health based on metrics
    const criticalAlerts = dashboard.trends.performanceAlerts.filter(a => a.severity === 'high');
    const queueBacklog = queueStats.totalQueued > 1000; // More than 1000 emails queued
    const lowSuccessRate = dashboard.summary.successRate < 95;
    
    const isHealthy = criticalAlerts.length === 0 && !queueBacklog && !lowSuccessRate;
    
    res.json({
      success: true,
      healthy: isHealthy,
      status: isHealthy ? 'healthy' : 'degraded',
      checks: {
        criticalAlerts: criticalAlerts.length === 0,
        queueBacklog: !queueBacklog,
        successRate: !lowSuccessRate
      },
      metrics: {
        successRate: dashboard.summary.successRate,
        averageResponseTime: dashboard.summary.averageResponseTime,
        totalQueued: queueStats.totalQueued,
        processingCount: queueStats.processingCount,
        criticalAlertsCount: criticalAlerts.length
      }
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({ 
      success: false, 
      healthy: false,
      status: 'error',
      error: 'Failed to check system health' 
    });
  }
});

export default router;