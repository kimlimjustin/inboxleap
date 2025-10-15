import { storage } from '../storage';
import { sendMail } from './mailer';
import { getOrCreateUserByEmail } from './userService';
import crypto from 'crypto';

/**
 * Service to handle trust confirmation for new users who get CC'd on emails
 */
export class TrustConfirmationService {

  /**
   * Check if a user has blocked another user from processing their emails
   * @param inviterEmail - Email of the user who is inviting (sender)
   * @param targetEmail - Email of the user being invited (CC'd)
   * @returns true if blocked, false if not blocked or not found
   */
  async isUserBlocked(inviterEmail: string, targetEmail: string): Promise<boolean> {
    try {
      const inviterUser = await storage.getUserByEmail(inviterEmail);
      const targetUser = await storage.getUserByEmail(targetEmail);

      if (!inviterUser || !targetUser) {
        return false; // Can't be blocked if one user doesn't exist
      }

      const trustRelationship = await storage.getTrustRelationship(targetUser.id, inviterUser.id);
      return trustRelationship?.trustStatus === 'blocked';
    } catch (error) {
      console.error('Error checking if user is blocked:', error);
      return false; // Fail open
    }
  }

  /**
   * Check if this is the first time a user is being contacted by a specific sender
   * @param senderEmail - Email of the sender
   * @param targetEmail - Email of the target user
   * @returns true if this is their first time being contacted by this sender
   */
  async isFirstTimeContactBySender(senderEmail: string, targetEmail: string): Promise<boolean> {
    try {
      const senderUser = await storage.getUserByEmail(senderEmail);
      const targetUser = await storage.getUserByEmail(targetEmail);

      if (!targetUser) {
        return true; // New user, definitely first time
      }

      if (!senderUser) {
        return true; // Sender doesn't exist, treat as first time
      }

      // Check if they have a trust relationship with this specific sender
      const trustRelationship = await storage.getTrustRelationship(targetUser.id, senderUser.id);
      return !trustRelationship; // First time if no relationship exists
    } catch (error) {
      console.error('Error checking if first time contact by sender:', error);
      return false; // Fail closed - assume they've been contacted
    }
  }

  /**
   * Send a trust confirmation email to a new user
   * @param inviterEmail - Email of the user who is inviting 
   * @param targetEmail - Email of the user being invited
   * @param projectName - Name of the project they're being added to
   * @param emailSubject - Subject of the original email
   */
  async sendTrustConfirmationEmail(
    inviterEmail: string, 
    targetEmail: string, 
    projectName: string, 
    emailSubject: string
  ): Promise<void> {
    try {
      // Check rate limiting using automated blacklist service
      const { automatedBlacklistService } = await import('./automatedBlacklistService');
      const rateLimited = automatedBlacklistService.checkRateLimit(inviterEmail, 'email');
      if (rateLimited) {
        console.log(`⚠️ [TRUST] Rate limited trust confirmation email for ${inviterEmail} to ${targetEmail}`);
        throw new Error('Rate limit exceeded for trust confirmation emails');
      }

      // Get or create users  
      const inviterUser = await getOrCreateUserByEmail(inviterEmail);
      const targetUser = await getOrCreateUserByEmail(targetEmail);

      // Generate secure tokens for trust/block actions
      const trustToken = crypto.randomBytes(32).toString('hex');
      const blockToken = crypto.randomBytes(32).toString('hex');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      // Store tokens in database instead of memory
      await Promise.all([
        storage.createTrustConfirmationToken({
          token: trustToken,
          action: 'trust',
          inviterUserId: inviterUser.id,
          targetUserId: targetUser.id,
          projectName,
          emailSubject,
          expiresAt,
        }),
        storage.createTrustConfirmationToken({
          token: blockToken,
          action: 'block', 
          inviterUserId: inviterUser.id,
          targetUserId: targetUser.id,
          projectName,
          emailSubject,
          expiresAt,
        })
      ]);

      const baseUrl = process.env.DASHBOARD_URL || process.env.APP_URL || 'https://inboxleap.com';
      const trustUrl = `${baseUrl}/api/trust/confirm?token=${trustToken}`;
      const blockUrl = `${baseUrl}/api/trust/confirm?token=${blockToken}`;

      const emailBody = this.generateTrustConfirmationEmailHTML(
        inviterEmail,
        targetEmail,
        projectName,
        emailSubject,
        trustUrl,
        blockUrl
      );

      await sendMail({
        to: targetEmail,
        subject: `InboxLeap: ${inviterEmail} wants to collaborate with you`,
        html: emailBody,
      });

      console.log(`📧 [TRUST] Sent trust confirmation email to ${targetUser.email} from ${inviterUser.email}`);
    } catch (error) {
      console.error('Error sending trust confirmation email:', error);
      throw error;
    }
  }

  /**
   * Process trust/block confirmation from email links
   * @param token - The confirmation token
   * @returns Success status and message
   */
  async processConfirmation(token: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get token from database instead of memory
      const tokenData = await storage.getValidTrustConfirmationToken(token);
      if (!tokenData) {
        return { success: false, message: 'Invalid or expired confirmation link' };
      }

      // Get users from token data
      const inviterUser = await storage.getUser(tokenData.inviterUserId);
      const targetUser = await storage.getUser(tokenData.targetUserId);

      if (!inviterUser || !targetUser) {
        return { success: false, message: 'User not found' };
      }

      // Check rate limiting for blocking actions
      if (tokenData.action === 'block') {
        const { automatedBlacklistService } = await import('./automatedBlacklistService');
        const rateLimited = automatedBlacklistService.checkRateLimit(targetUser.email!, 'block');
        if (rateLimited) {
          console.log(`⚠️ [TRUST] Rate limited blocking action for ${targetUser.email}`);
          return { success: false, message: 'Rate limit exceeded. Please try again later.' };
        }
      }

      // Create trust relationship
      const trustStatus = tokenData.action === 'trust' ? 'trusted' : 'blocked';
      await storage.upsertTrustRelationship({
        userId: targetUser.id, // User making the decision
        trustedUserId: inviterUser.id, // User they're deciding about
        trustStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mark token as used
      await storage.markTrustConfirmationTokenAsUsed(tokenData.id);

      const message = tokenData.action === 'trust' 
        ? `You've allowed ${inviterUser.email} to include you in InboxLeap collaborations.`
        : `You've blocked ${inviterUser.email} from including you in InboxLeap collaborations.`;

      console.log(`✅ [TRUST] ${targetUser.email} ${tokenData.action}ed ${inviterUser.email}`);
      return { success: true, message };

    } catch (error) {
      console.error('Error processing trust confirmation:', error);
      return { success: false, message: 'Failed to process confirmation' };
    }
  }

  /**
   * Get all users that a user has blocked
   * @param userEmail - Email of the user
   * @returns Array of blocked user emails
   */
  async getBlockedUsers(userEmail: string): Promise<string[]> {
    try {
      const user = await storage.getUserByEmail(userEmail);
      if (!user) {
        return [];
      }

      const trustRelationships = await storage.getUserTrustRelationships(user.id);
      const blockedUserIds = trustRelationships
        .filter(rel => rel.trustStatus === 'blocked')
        .map(rel => rel.trustedUserId);

      // Get user emails for blocked user IDs
      const blockedUsers = [];
      for (const userId of blockedUserIds) {
        const blockedUser = await storage.getUser(userId);
        if (blockedUser?.email) {
          blockedUsers.push(blockedUser.email);
        }
      }

      return blockedUsers;
    } catch (error) {
      console.error('Error getting blocked users:', error);
      return [];
    }
  }

  /**
   * Unblock a user
   * @param userEmail - Email of the user doing the unblocking
   * @param blockedEmail - Email of the user to unblock
   */
  async unblockUser(userEmail: string, blockedEmail: string): Promise<void> {
    try {
      const user = await storage.getUserByEmail(userEmail);
      const blockedUser = await storage.getUserByEmail(blockedEmail);

      if (!user || !blockedUser) {
        throw new Error('User not found');
      }

      // Remove the trust relationship (or update to trusted)
      await storage.upsertTrustRelationship({
        userId: user.id,
        trustedUserId: blockedUser.id,
        trustStatus: 'trusted',
        updatedAt: new Date(),
      });

      console.log(`🔓 [TRUST] ${userEmail} unblocked ${blockedEmail}`);
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  }

  // Token storage is now handled by database - these methods are deprecated
  // but kept for backwards compatibility during transition

  /**
   * Generate HTML for trust confirmation email
   */
  private generateTrustConfirmationEmailHTML(
    inviterEmail: string,
    targetEmail: string,
    projectName: string,
    emailSubject: string,
    trustUrl: string,
    blockUrl: string
  ): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>InboxLeap Collaboration Request</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .button-container { margin: 30px 0; text-align: center; }
            .button { display: inline-block; padding: 15px 30px; margin: 0 10px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; transition: all 0.3s; }
            .button-trust { background: #10b981; color: white; }
            .button-trust:hover { background: #059669; }
            .button-block { background: #ef4444; color: white; }
            .button-block:hover { background: #dc2626; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0; }
            .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #64748b; }
            .divider { height: 1px; background: #e2e8f0; margin: 30px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤝 Collaboration Request</h1>
                <p>Someone wants to include you in an InboxLeap project</p>
            </div>
            
            <div class="content">
                <p>Hi there!</p>
                
                <p><strong>${inviterEmail}</strong> has mentioned you in an email and wants to include you in a collaborative project on <strong>InboxLeap</strong>.</p>
                
                <div class="info-box">
                    <h3>📋 Project Details</h3>
                    <p><strong>Project:</strong> ${projectName}</p>
                    <p><strong>Email Subject:</strong> "${emailSubject}"</p>
                    <p><strong>From:</strong> ${inviterEmail}</p>
                </div>
                
                <h3>What is InboxLeap?</h3>
                <p>InboxLeap is an AI-powered email collaboration platform that turns emails into organized tasks and projects. When someone includes you in an email to our agents (like Todo for task management), it automatically creates shared projects and task boards.</p>
                
                <div class="divider"></div>
                
                <h3>🤔 Your Choice</h3>
                <p>You can choose whether you want to collaborate with <strong>${inviterEmail}</strong> on InboxLeap:</p>
                
                <div class="button-container">
                    <a href="${trustUrl}" class="button button-trust">✅ Yes, I want to collaborate</a>
                    <a href="${blockUrl}" class="button button-block">❌ No, please don't include me</a>
                </div>
                
                <div class="info-box">
                    <p><strong>If you choose "Yes":</strong> You'll be added to this project and any future projects where ${inviterEmail} includes you. You can always change this later.</p>
                    <p><strong>If you choose "No":</strong> You'll be removed from this project and ${inviterEmail} won't be able to include you in future InboxLeap projects.</p>
                </div>
                
                <p><small>This confirmation link will expire in 7 days. If you don't respond, you won't be added to any projects.</small></p>
            </div>
            
            <div class="footer">
                <p>This email was sent because ${inviterEmail} mentioned you in an email to InboxLeap.</p>
                <p>InboxLeap • Intelligent Email Collaboration</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

export const trustConfirmationService = new TrustConfirmationService();
