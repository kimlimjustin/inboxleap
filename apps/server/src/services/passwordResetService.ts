import { storage } from '../storage';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Service to handle password reset operations
 */
export class PasswordResetService {
  /**
   * Generate a secure password reset token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a password reset token for a user
   * @param email - User's email address
   * @returns The generated token or null if user doesn't exist
   */
  async createPasswordResetToken(email: string): Promise<string | null> {
    // Check if user exists
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return null;
    }

    // Only create reset tokens for system-created users or email auth users
    if (user.authProvider !== 'system' && user.authProvider !== 'email') {
      throw new Error('Password reset not available for OAuth users. Please sign in using your OAuth provider.');
    }

    // Generate secure token
    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

    // Create token in database
    await storage.createPasswordResetToken({
      userId: user.id,
      token,
      expiresAt,
      used: false,
      createdAt: new Date(),
    });

    return token;
  }

  /**
   * Verify a password reset token
   * @param token - The password reset token
   * @returns User ID if valid, null if invalid/expired
   */
  async verifyPasswordResetToken(token: string): Promise<string | null> {
    const resetToken = await storage.getPasswordResetToken(token);
    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return null;
    }
    return resetToken.userId;
  }

  /**
   * Reset password using a valid token
   * @param token - The password reset token
   * @param newPassword - The new password
   * @returns Success boolean
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    console.log(`🔑 [PASSWORD-RESET] Starting password reset with token: ${token.substring(0, 8)}...`);

    // Verify token is valid
    const resetToken = await storage.getPasswordResetToken(token);
    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      console.log(`❌ [PASSWORD-RESET] Invalid or expired token`);
      throw new Error('Invalid or expired reset token');
    }

    console.log(`✅ [PASSWORD-RESET] Valid token found for user: ${resetToken.userId}`);

    // Get user
    const user = await storage.getUser(resetToken.userId);
    if (!user) {
      console.log(`❌ [PASSWORD-RESET] User not found: ${resetToken.userId}`);
      throw new Error('User not found');
    }

    console.log(`👤 [PASSWORD-RESET] Found user: ${user.email}, currentAuthProvider: ${user.authProvider}`);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`🔐 [PASSWORD-RESET] Password hashed successfully`);

    // Update user's password and auth provider
    const updatedUser = await storage.updateUser(user.id, {
      password: hashedPassword,
      authProvider: 'email', // Convert all users to email auth when they set a password
    });

    console.log(`✅ [PASSWORD-RESET] User updated: ${user.email} -> authProvider: 'email', hasPassword: true`);

    // Mark token as used
    await storage.markPasswordResetTokenUsed(resetToken.id);
    console.log(`🗑️ [PASSWORD-RESET] Token marked as used`);

    return true;
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    await storage.deleteExpiredPasswordResetTokens();
  }

  /**
   * Check if a user can reset their password
   * @param email - User's email address
   * @returns True if the user can reset password, false otherwise
   */
  async canResetPassword(email: string): Promise<boolean> {
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return false;
    }

    // Users with 'system' auth provider (created by the system) can reset
    // Users with 'email' auth provider (signed up with email) can reset
    return user.authProvider === 'system' || user.authProvider === 'email';
  }

  /**
   * Get user information for password reset (safe info only)
   * @param email - User's email address
   * @returns Basic user info or null if user doesn't exist
   */
  async getUserInfoForReset(email: string): Promise<{ email: string; firstName: string | null; canReset: boolean } | null> {
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return null;
    }

    return {
      email: user.email!,
      firstName: user.firstName,
      canReset: await this.canResetPassword(email),
    };
  }
}

export const passwordResetService = new PasswordResetService();