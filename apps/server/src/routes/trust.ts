import { Express } from 'express';
import { trustConfirmationService } from '../services/trustConfirmationService';
import { isAuthenticated } from '../googleAuth';

export function registerTrustRoutes(app: Express) {
  
  // Handle trust/block confirmation from email links
  app.get('/api/trust/confirm', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Invalid Link</title></head>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>❌ Invalid Link</h1>
            <p>The confirmation link is invalid or missing required parameters.</p>
          </body>
          </html>
        `);
      }

      const result = await trustConfirmationService.processConfirmation(token);

      if (result.success) {
        // Success page
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Preference Updated</title>
            <style>
              body { font-family: system-ui; padding: 40px; text-align: center; background: #f5f5f5; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .success { color: #10b981; }
              .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="success">✅ Preference Updated</h1>
              <p>${result.message}</p>
              <p><small>You can always change your collaboration preferences later by visiting your InboxLeap dashboard.</small></p>
              <a href="${process.env.DASHBOARD_URL || process.env.APP_URL || 'https://inboxleap.com'}" class="button">Go to InboxLeap</a>
            </div>
          </body>
          </html>
        `);
      } else {
        // Error page
        res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Link Error</title>
            <style>
              body { font-family: system-ui; padding: 40px; text-align: center; background: #f5f5f5; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .error { color: #ef4444; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="error">❌ Error</h1>
              <p>${result.message}</p>
              <p><small>If you continue to have issues, please contact support.</small></p>
            </div>
          </body>
          </html>
        `);
      }

    } catch (error) {
      console.error('Error processing trust confirmation:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Server Error</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>❌ Server Error</h1>
          <p>An error occurred while processing your request. Please try again later.</p>
        </body>
        </html>
      `);
    }
  });

  // Get user's blocked users list (authenticated route)
  app.get('/api/trust/blocked', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.email;
      const blockedUsers = await trustConfirmationService.getBlockedUsers(userEmail);
      
      res.json({ blockedUsers });
    } catch (error) {
      console.error('Error getting blocked users:', error);
      res.status(500).json({ message: 'Failed to get blocked users' });
    }
  });

  // Unblock a user (authenticated route)
  app.post('/api/trust/unblock', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.email;
      const { blockedEmail } = req.body;

      if (!blockedEmail) {
        return res.status(400).json({ message: 'Blocked email is required' });
      }

      await trustConfirmationService.unblockUser(userEmail, blockedEmail);
      
      res.json({ message: `Successfully unblocked ${blockedEmail}` });
    } catch (error) {
      console.error('Error unblocking user:', error);
      res.status(500).json({ message: 'Failed to unblock user' });
    }
  });

  // Block a user directly (authenticated route)
  app.post('/api/trust/block', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.email;
      const { emailToBlock } = req.body;

      if (!emailToBlock) {
        return res.status(400).json({ message: 'Email to block is required' });
      }

      // Use the trust confirmation service to create a blocked relationship
      // We'll simulate this by creating the trust relationship directly
      const { storage } = await import('../storage');
      const { getOrCreateUserByEmail } = await import('../services/userService');
      
      const user = await getOrCreateUserByEmail(userEmail);
      const userToBlock = await getOrCreateUserByEmail(emailToBlock);

      await storage.upsertTrustRelationship({
        userId: user.id,
        trustedUserId: userToBlock.id,
        trustStatus: 'blocked',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      res.json({ message: `Successfully blocked ${emailToBlock}` });
    } catch (error) {
      console.error('Error blocking user:', error);
      res.status(500).json({ message: 'Failed to block user' });
    }
  });

  // Get trust status with another user (authenticated route)
  app.get('/api/trust/status/:email', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.email;
      const { email } = req.params;

      const isBlocked = await trustConfirmationService.isUserBlocked(userEmail, email);
      
      res.json({ 
        email,
        isBlocked,
        status: isBlocked ? 'blocked' : 'allowed'
      });
    } catch (error) {
      console.error('Error getting trust status:', error);
      res.status(500).json({ message: 'Failed to get trust status' });
    }
  });
}