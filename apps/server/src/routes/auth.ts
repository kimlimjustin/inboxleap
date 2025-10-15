import { Express } from 'express';
import { storage } from '../storage';
import { setupAuth, isAuthenticated } from '../googleAuth';
import { User } from '@email-task-router/shared';
import { passwordResetService } from '../services/passwordResetService';

export async function registerAuthRoutes(app: Express) {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.put('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, email } = req.body;

      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "First name, last name, and email are required" });
      }

      // Get current user data
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user with new information
      const updatedUser = {
        ...currentUser,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        updatedAt: new Date(),
      };

      await storage.updateUser(userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });

      // Return updated user data
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Email authentication routes
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, name, confirmPassword } = req.body;

      // Validation
      if (!email || !password || !name) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Create user with email authentication
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Generate a unique user ID
      const userId = `email_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      // Import and use the new sign-up function
      const { signUpOrSignInUser } = await import('../services/userService');
      const user = await signUpOrSignInUser(email, {
        id: userId,
        firstName: name.split(' ')[0] || name,
        lastName: name.split(' ').slice(1).join(' ') || '',
        authProvider: 'email',
        password: hashedPassword
      });

      // Initialize identity for new user
      const { identityService } = await import('../services/identityService');
      let userIdentity = await identityService.getUserIdentity(user.id);

      if (!userIdentity) {
        // Create personal identity
        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User';
        userIdentity = await identityService.createUserIdentity(user.id, displayName);
        console.log(`✅ [AUTH] Created personal identity ${userIdentity.id} for user ${user.id}`);
      }

      // Set up session with identity
      (req as any).session.user = {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        authProvider: 'email'
      };
      (req as any).session.identityId = userIdentity.id;

      res.status(201).json({
        message: "Account created successfully",
        user: {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim()
        }
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post('/api/auth/signin', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      console.log(`🔐 [AUTH] Sign-in attempt for email: ${email}`);

      // Get user with password
      const user = await storage.getUserByEmailWithPassword(email);
      if (!user) {
        console.log(`❌ [AUTH] User not found: ${email}`);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      console.log(`👤 [AUTH] Found user: ${email}, authProvider: ${user.authProvider}, hasPassword: ${!!user.password}`);

      // Check if user has a password (for email auth or converted Google users)
      if (!user.password) {
        console.log(`❌ [AUTH] User ${email} has no password set`);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const bcrypt = await import('bcrypt');
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        console.log(`❌ [AUTH] Invalid password for ${email}`);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      console.log(`✅ [AUTH] Successful sign-in for ${email}`);

      // Initialize or get identity for user
      const { identityService } = await import('../services/identityService');
      let userIdentity = await identityService.getUserIdentity(user.id);

      if (!userIdentity) {
        // Create personal identity if it doesn't exist
        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User';
        userIdentity = await identityService.createUserIdentity(user.id, displayName);
        console.log(`✅ [AUTH] Created personal identity ${userIdentity.id} for user ${user.id}`);
      }

      // Set up session with identity
      (req as any).session.user = {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        authProvider: user.authProvider || 'email'
      };
      (req as any).session.identityId = userIdentity.id;

      res.json({
        message: "Signed in successfully",
        user: {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim()
        }
      });
    } catch (error) {
      console.error("❌ [AUTH] Signin error:", error);
      res.status(500).json({ message: "Failed to sign in" });
    }
  });

  app.post('/api/auth/signout', (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ message: "Failed to sign out" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Signed out successfully" });
    });
  });

  // Password reset routes
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user exists and can reset password
      const userInfo = await passwordResetService.getUserInfoForReset(email);
      if (!userInfo) {
        // Don't reveal if user exists or not for security
        return res.json({ message: "If an account with that email exists, a reset link has been sent." });
      }

      if (!userInfo.canReset) {
        return res.status(400).json({ 
          message: "Password reset is not available for your account type. Please sign in using Google." 
        });
      }

      // Generate reset token
      const token = await passwordResetService.createPasswordResetToken(email);
      if (!token) {
        return res.json({ message: "If an account with that email exists, a reset link has been sent." });
      }

      // Send password reset email
      try {
        const { sendMail } = await import('../services/mailer');
        const baseUrl = process.env.DASHBOARD_URL || process.env.BASE_URL || process.env.FRONTEND_URL || 'https://inboxleap.com';
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;
        
        const fromAddress = process.env.SERVICE_EMAIL || 'noreply@inboxleap.com';
        
        const subject = 'Password Reset - InboxLeap';
        
        const textContent = `
Hi there,

You requested a password reset for your InboxLeap account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 24 hours.

If you didn't request this password reset, you can safely ignore this email.

Best regards,
The InboxLeap Team
        `.trim();

        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #0066cc; margin: 0 0 10px 0;">🔑 Password Reset Request</h2>
              <p style="color: #666; margin: 0;">We received a request to reset your InboxLeap password</p>
            </div>
            
            <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
              <p style="color: #333; line-height: 1.6; margin: 0 0 20px 0;">
                Click the button below to reset your password. This link will expire in 24 hours.
              </p>
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="${resetUrl}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  🔑 Reset Password
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px; margin: 20px 0 0 0;">
                If the button doesn't work, copy and paste this link in your browser:<br>
                <a href="${resetUrl}" style="color: #0066cc; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p>If you didn't request this password reset, you can safely ignore this email.</p>
              <p>This email was sent by InboxLeap</p>
            </div>
          </div>
        `;

        const emailSent = await sendMail({
          from: `"InboxLeap" <${fromAddress}>`,
          to: email,
          subject,
          text: textContent,
          html: htmlContent,
        });

        if (emailSent) {
          console.log(`✅ Password reset email sent to ${email}`);
        } else {
          console.error(`❌ Failed to send password reset email to ${email}`);
        }
        
      } catch (error) {
        console.error('Error sending password reset email:', error);
        // Don't fail the request if email sending fails
      }

      // Always return success message to prevent email enumeration
      res.json({ message: "If an account with that email exists, a reset link has been sent." });

    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password, confirmPassword } = req.body;

      // Validation
      if (!token || !password || !confirmPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Verify token and reset password
      const success = await passwordResetService.resetPassword(token, password);
      
      if (!success) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      res.json({ message: "Password reset successfully. You can now sign in with your new password." });

    } catch (error) {
      console.error("Reset password error:", error);
      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get('/api/auth/verify-reset-token/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      const userId = await passwordResetService.verifyPasswordResetToken(token);
      
      if (!userId) {
        return res.status(400).json({ valid: false, message: "Invalid or expired reset token" });
      }

      res.json({ valid: true, message: "Token is valid" });

    } catch (error) {
      console.error("Verify reset token error:", error);
      res.status(500).json({ valid: false, message: "Failed to verify token" });
    }
  });

  // Account linking routes
  
  // Get all linked accounts for current user
  app.get('/api/auth/linked-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const linkedAccounts = await storage.getUserLinkedAccounts(userId);
      
      // Don't expose sensitive provider account IDs in response
      const safeLinkedAccounts = linkedAccounts.map(account => ({
        id: account.id,
        provider: account.provider,
        email: account.email,
        linkedAt: account.linkedAt,
        lastUsed: account.lastUsed,
        isActive: account.isActive
      }));
      
      res.json(safeLinkedAccounts);
    } catch (error) {
      console.error("Get linked accounts error:", error);
      res.status(500).json({ message: "Failed to get linked accounts" });
    }
  });

  // Link Google account to current email-based user
  app.post('/api/auth/link-google', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: "Authorization code is required" });
      }

      // Exchange code for tokens
      const { exchangeCodeForTokens, fetchGoogleProfile } = await import('../googleAuth');
      const tokens = await exchangeCodeForTokens(code);
      const profile = await fetchGoogleProfile(tokens.access_token);

      // Check if this Google account is already linked to another user
      const existingUser = await storage.getUserByEmail(profile.email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ 
          message: "This Google account is already linked to another user" 
        });
      }

      // Check if user already has a Google account linked
      const existingGoogleLink = await storage.getLinkedAccountByProvider(userId, 'google');
      if (existingGoogleLink) {
        return res.status(400).json({ 
          message: "You already have a Google account linked" 
        });
      }

      // Create the linked account
      await storage.createUserLinkedAccount({
        userId,
        provider: 'google',
        providerAccountId: profile.id,
        email: profile.email,
        isActive: true,
        linkedAt: new Date(),
        lastUsed: new Date(),
      });

      // Update user's profile with Google info if not already set
      const currentUser = await storage.getUser(userId);
      if (currentUser) {
        await storage.updateUser(userId, {
          firstName: currentUser.firstName || profile.given_name,
          lastName: currentUser.lastName || profile.family_name,
          profileImageUrl: currentUser.profileImageUrl || profile.picture,
        });
      }

      res.json({ message: "Google account linked successfully" });
    } catch (error) {
      console.error("Link Google account error:", error);
      res.status(500).json({ message: "Failed to link Google account" });
    }
  });

  // Link email/password to current Google-based user
  app.post('/api/auth/link-email', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { password, confirmPassword } = req.body;

      if (!password || !confirmPassword) {
        return res.status(400).json({ message: "Password and confirmation are required" });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Check if user already has email auth linked
      const existingEmailLink = await storage.getLinkedAccountByProvider(userId, 'email');
      if (existingEmailLink) {
        return res.status(400).json({ 
          message: "You already have email authentication set up" 
        });
      }

      // Hash the password
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user with password
      const currentUser = await storage.getUser(userId);
      if (currentUser) {
        await storage.updateUser(userId, {
          password: hashedPassword,
        });
      }

      // Create the linked account
      await storage.createUserLinkedAccount({
        userId,
        provider: 'email',
        providerAccountId: null, // Email auth doesn't use external provider ID
        email: currentUser?.email || '',
        isActive: true,
        linkedAt: new Date(),
        lastUsed: new Date(),
      });

      res.json({ message: "Email authentication linked successfully" });
    } catch (error) {
      console.error("Link email account error:", error);
      res.status(500).json({ message: "Failed to link email authentication" });
    }
  });

  // Unlink an authentication method
  app.delete('/api/auth/unlink/:provider', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { provider } = req.params;

      if (!['google', 'email'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider" });
      }

      // Check if user has multiple auth methods (prevent locking out)
      const linkedAccounts = await storage.getUserLinkedAccounts(userId);
      if (linkedAccounts.length <= 1) {
        return res.status(400).json({ 
          message: "Cannot unlink the only authentication method" 
        });
      }

      // Unlink the account
      const linkedAccount = await storage.getLinkedAccountByProvider(userId, provider);
      if (linkedAccount) {
        await storage.deleteLinkedAccount(linkedAccount.id);
      }

      // If unlinking email, clear the password
      if (provider === 'email') {
        const currentUser = await storage.getUser(userId);
        if (currentUser) {
          await storage.updateUser(userId, {
            password: null,
          });
        }
      }

      res.json({ message: `${provider} authentication unlinked successfully` });
    } catch (error) {
      console.error("Unlink account error:", error);
      res.status(500).json({ message: "Failed to unlink account" });
    }
  });
}
