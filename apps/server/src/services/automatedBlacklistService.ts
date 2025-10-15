import { storage } from '../storage';
import * as cron from 'node-cron';

/**
 * Automated service for blacklist/trust system monitoring and maintenance
 * Handles cleanup, rate limiting, abuse detection, and suspicious pattern monitoring
 */
export class AutomatedBlacklistService {
  private initialized = false;
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  
  // Rate limiting constants
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
  private readonly RATE_LIMIT_MAX_EMAILS = 5; // Max 5 trust emails per hour per sender
  private readonly RATE_LIMIT_MAX_BLOCKS = 10; // Max 10 blocks per hour per user

  /**
   * Initialize the automated blacklist service with scheduled tasks
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🤖 [BLACKLIST] Initializing automated blacklist service...');

    // Schedule cleanup tasks
    this.scheduleCleanupTasks();
    
    // Schedule monitoring tasks
    this.scheduleMonitoringTasks();
    
    // Run initial cleanup
    await this.performInitialCleanup();
    
    this.initialized = true;
    console.log('✅ [BLACKLIST] Automated blacklist service initialized');
  }

  /**
   * Schedule periodic cleanup tasks
   */
  private scheduleCleanupTasks(): void {
    // Clean up expired tokens every hour
    cron.schedule('0 * * * *', async () => {
      console.log('🧹 [BLACKLIST] Running hourly cleanup...');
      await this.cleanupExpiredTokens();
    });

    // Clean up old pending trust requests every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🧹 [BLACKLIST] Running daily trust relationship cleanup...');
      await this.cleanupOldPendingTrustRequests();
    });

    // Clean up rate limiting cache every hour
    cron.schedule('0 * * * *', () => {
      this.cleanupRateLimitCache();
    });
  }

  /**
   * Schedule monitoring and alerting tasks
   */
  private scheduleMonitoringTasks(): void {
    // Monitor suspicious patterns every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('🔍 [BLACKLIST] Running suspicious pattern monitoring...');
      await this.monitorSuspiciousPatterns();
    });

    // Generate weekly blacklist report every Monday at 9 AM
    cron.schedule('0 9 * * 1', async () => {
      console.log('📊 [BLACKLIST] Generating weekly blacklist report...');
      await this.generateWeeklyReport();
    });
  }

  /**
   * Run initial cleanup when service starts
   */
  private async performInitialCleanup(): Promise<void> {
    console.log('🏃 [BLACKLIST] Running initial cleanup...');
    await Promise.allSettled([
      this.cleanupExpiredTokens(),
      this.cleanupOldPendingTrustRequests()
    ]);
  }

  /**
   * Check rate limiting for trust confirmation emails
   * @param senderEmail - Email of the sender
   * @param actionType - Type of action ('email' or 'block')
   * @returns true if rate limit exceeded, false if within limits
   */
  checkRateLimit(senderEmail: string, actionType: 'email' | 'block' = 'email'): boolean {
    const key = `${senderEmail}:${actionType}`;
    const now = Date.now();
    const limit = actionType === 'email' ? this.RATE_LIMIT_MAX_EMAILS : this.RATE_LIMIT_MAX_BLOCKS;
    
    const entry = this.rateLimitMap.get(key);
    
    if (!entry || now > entry.resetTime) {
      // First request or window expired, reset counter
      this.rateLimitMap.set(key, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
      return false;
    }
    
    if (entry.count >= limit) {
      console.log(`⚠️ [RATE_LIMIT] ${senderEmail} exceeded ${actionType} rate limit (${entry.count}/${limit})`);
      return true; // Rate limit exceeded
    }
    
    // Increment counter
    entry.count++;
    return false;
  }

  /**
   * Clean up expired trust confirmation tokens
   */
  private async cleanupExpiredTokens(): Promise<void> {
    try {
      // Clean up password reset tokens that are expired or used
      const deletedPasswordTokens = await storage.cleanupExpiredPasswordResetTokens();
      
      // Clean up trust confirmation tokens that are expired or used
      const deletedTrustTokens = await storage.cleanupExpiredTrustConfirmationTokens();
      
      const totalDeleted = deletedPasswordTokens + deletedTrustTokens;
      
      if (totalDeleted > 0) {
        console.log(`🧹 [BLACKLIST] Cleaned up ${deletedPasswordTokens} password reset tokens and ${deletedTrustTokens} trust confirmation tokens`);
      }
    } catch (error) {
      console.error('❌ [BLACKLIST] Error cleaning up expired tokens:', error);
    }
  }

  /**
   * Clean up old pending trust requests (older than 30 days)
   */
  private async cleanupOldPendingTrustRequests(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldPendingRequests = await storage.getOldPendingTrustRequests(thirtyDaysAgo);

      for (const request of oldPendingRequests) {
        // Delete old pending trust requests that were never responded to
        await storage.deleteTrustRelationship(request.inviterUserId, request.targetUserId);
      }

      if (oldPendingRequests.length > 0) {
        console.log(`🧹 [BLACKLIST] Cleaned up ${oldPendingRequests.length} old pending trust requests`);
      }
    } catch (error) {
      console.error('❌ [BLACKLIST] Error cleaning up old pending trust requests:', error);
    }
  }

  /**
   * Clean up expired entries from rate limiting cache
   */
  private cleanupRateLimitCache(): void {
    const now = Date.now();
    let cleanedUp = 0;

    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(key);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      console.log(`🧹 [BLACKLIST] Cleaned up ${cleanedUp} expired rate limit entries`);
    }
  }

  /**
   * Monitor for suspicious patterns in blacklist usage
   */
  private async monitorSuspiciousPatterns(): Promise<void> {
    try {
      // Pattern 1: Users who have been blocked by many people (potential spammers)
      const suspiciousUsers = await this.findUsersBlockedByMany();
      
      // Pattern 2: Users who block many people (potential abuse)
      const overBlockers = await this.findUsersWhoBlockMany();
      
      // Pattern 3: Recent spike in blocking activity
      const blockingSpikes = await this.detectBlockingSpikes();

      // Log suspicious patterns
      if (suspiciousUsers.length > 0) {
        console.log(`🚨 [BLACKLIST] Found ${suspiciousUsers.length} users blocked by many people:`, 
          suspiciousUsers.map(u => `${u.email} (${u.blockCount} blocks)`));
      }

      if (overBlockers.length > 0) {
        console.log(`🚨 [BLACKLIST] Found ${overBlockers.length} users who block many people:`, 
          overBlockers.map(u => `${u.email} (${u.blockCount} blocked)`));
      }

      if (blockingSpikes.length > 0) {
        console.log(`🚨 [BLACKLIST] Detected blocking spikes:`, blockingSpikes);
      }

    } catch (error) {
      console.error('❌ [BLACKLIST] Error monitoring suspicious patterns:', error);
    }
  }

  /**
   * Find users who have been blocked by many different people
   */
  private async findUsersBlockedByMany(): Promise<Array<{ email: string; blockCount: number }>> {
    const BLOCK_THRESHOLD = 5; // Alert if blocked by 5+ different people

    try {
      const blockedUsers = await storage.getUsersBlockedByMany(BLOCK_THRESHOLD);
      return blockedUsers;
    } catch (error) {
      console.error('Error finding users blocked by many:', error);
      return [];
    }
  }

  /**
   * Find users who block many other people
   */
  private async findUsersWhoBlockMany(): Promise<Array<{ email: string; blockCount: number }>> {
    const BLOCK_THRESHOLD = 10; // Alert if they block 10+ different people

    try {
      const overBlockers = await storage.getUsersWhoBlockMany(BLOCK_THRESHOLD);
      return overBlockers;
    } catch (error) {
      console.error('Error finding users who block many:', error);
      return [];
    }
  }

  /**
   * Detect recent spikes in blocking activity
   */
  private async detectBlockingSpikes(): Promise<Array<{ date: string; blockCount: number }>> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentBlocks = await storage.getRecentBlockingActivity(sevenDaysAgo);
      
      // Group by date and look for spikes (more than 10 blocks per day)
      const dailyBlocks = new Map<string, number>();
      
      recentBlocks.forEach((block: any) => {
        const date = new Date(block.createdAt!).toISOString().split('T')[0];
        dailyBlocks.set(date, (dailyBlocks.get(date) || 0) + 1);
      });

      const spikes = Array.from(dailyBlocks.entries())
        .filter(([_, count]) => count > 10)
        .map(([date, blockCount]) => ({ date, blockCount }));

      return spikes;
    } catch (error) {
      console.error('Error detecting blocking spikes:', error);
      return [];
    }
  }

  /**
   * Generate weekly blacklist monitoring report
   */
  private async generateWeeklyReport(): Promise<void> {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [
        newBlocks,
        newTrusts,
        suspiciousUsers,
        overBlockers
      ] = await Promise.all([
        storage.getRecentBlockingActivity(weekAgo),
        storage.getRecentTrustActivity(weekAgo),
        this.findUsersBlockedByMany(),
        this.findUsersWhoBlockMany()
      ]);

      console.log(`📊 [BLACKLIST] Weekly Report (${weekAgo.toDateString()} - ${new Date().toDateString()})`);
      console.log(`   📈 New blocks: ${newBlocks.length}`);
      console.log(`   ✅ New trusts: ${newTrusts.length}`);
      console.log(`   🚨 Suspicious users: ${suspiciousUsers.length}`);
      console.log(`   ⚠️ Over-blockers: ${overBlockers.length}`);

      // Could send this report via email to admins in the future
    } catch (error) {
      console.error('❌ [BLACKLIST] Error generating weekly report:', error);
    }
  }

  /**
   * Validate email processing based on blacklist rules
   * @param senderEmail - Email of the sender
   * @param recipientEmails - Array of recipient emails
   * @returns Object with validation results and filtered recipients
   */
  async validateEmailProcessing(
    senderEmail: string, 
    recipientEmails: string[]
  ): Promise<{
    allowed: string[];
    blocked: string[];
    requiresConfirmation: string[];
    rateLimited: boolean;
  }> {
    const allowed: string[] = [];
    const blocked: string[] = [];
    const requiresConfirmation: string[] = [];

    // Check rate limiting for sender
    const rateLimited = this.checkRateLimit(senderEmail, 'email');
    if (rateLimited) {
      console.log(`⚠️ [BLACKLIST] Rate limited email processing for ${senderEmail}`);
      return { allowed, blocked, requiresConfirmation, rateLimited: true };
    }

    // Import trustConfirmationService to avoid circular dependency
    const { trustConfirmationService } = await import('./trustConfirmationService');

    for (const recipientEmail of recipientEmails) {
      try {
        // Check if recipient has blocked the sender
        const isBlocked = await trustConfirmationService.isUserBlocked(senderEmail, recipientEmail);
        if (isBlocked) {
          blocked.push(recipientEmail);
          continue;
        }

        // Check if this is first-time contact
        const isFirstTime = await trustConfirmationService.isFirstTimeContactBySender(senderEmail, recipientEmail);
        if (isFirstTime) {
          requiresConfirmation.push(recipientEmail);
        } else {
          allowed.push(recipientEmail);
        }
      } catch (error) {
        console.error(`❌ [BLACKLIST] Error validating ${recipientEmail}:`, error);
        // Fail safe - require confirmation on error
        requiresConfirmation.push(recipientEmail);
      }
    }

    return { allowed, blocked, requiresConfirmation, rateLimited: false };
  }

  /**
   * Get blacklist statistics
   */
  async getBlacklistStats(): Promise<{
    totalBlocks: number;
    totalTrusts: number;
    totalPending: number;
    recentActivity: { blocks: number; trusts: number };
  }> {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [
        totalStats,
        recentBlocks,
        recentTrusts
      ] = await Promise.all([
        storage.getTrustRelationshipStats(),
        storage.getRecentBlockingActivity(weekAgo),
        storage.getRecentTrustActivity(weekAgo)
      ]);

      return {
        totalBlocks: totalStats.blocks || 0,
        totalTrusts: totalStats.trusts || 0,
        totalPending: totalStats.pending || 0,
        recentActivity: {
          blocks: recentBlocks.length,
          trusts: recentTrusts.length
        }
      };
    } catch (error) {
      console.error('Error getting blacklist stats:', error);
      return {
        totalBlocks: 0,
        totalTrusts: 0,
        totalPending: 0,
        recentActivity: { blocks: 0, trusts: 0 }
      };
    }
  }
}

export const automatedBlacklistService = new AutomatedBlacklistService();