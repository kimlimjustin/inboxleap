import crypto from 'crypto';
import { db } from '../db.js';
import { users } from '@email-task-router/shared/src/schema.js';
import { eq, and, gt, lt } from 'drizzle-orm';
import { storage } from '../storage.js';
import nodemailer from 'nodemailer';

// Note: emailVerifications table is not yet defined in schema
// This service is incomplete and should not be used until the schema is updated
const emailVerifications = null as any;

export class EmailVerificationService {
  // Generate secure verification token
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create verification token for email
  async createVerificationToken(email: string): Promise<string> {
    const token = this.generateVerificationToken();
    const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerifications).values({
      email,
      verificationToken: token,
      tokenExpiration: expiration,
      isVerified: false,
    });

    console.log(`🔐 [VERIFICATION] Created verification token for: ${email}`);
    return token;
  }

  // Verify email with token
  async verifyEmail(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
    try {
      // Find valid verification token
      const [verification] = await db
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.verificationToken, token),
            eq(emailVerifications.isVerified, false),
            // Token not expired
            gt(emailVerifications.tokenExpiration, new Date())
          )
        )
        .limit(1);

      if (!verification) {
        return {
          success: false,
          error: 'Invalid or expired verification token'
        };
      }

      // Mark as verified
      await db
        .update(emailVerifications)
        .set({
          isVerified: true,
          verifiedAt: new Date(),
        })
        .where(eq(emailVerifications.id, verification.id));

      // Create verified user account
      const user = await storage.createUser({
        id: verification.email,
        email: verification.email,
        firstName: verification.email.split('@')[0],
        lastName: null,
        profileImageUrl: null,
        authProvider: 'email'
      });

      console.log(`✅ [VERIFICATION] Email verified and user created: ${verification.email}`);
      
      return {
        success: true,
        email: verification.email
      };

    } catch (error) {
      console.error('Error verifying email:', error);
      return {
        success: false,
        error: 'Verification failed'
      };
    }
  }

  // Check if email is verified
  async isEmailVerified(email: string): Promise<boolean> {
    const [verification] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.email, email),
          eq(emailVerifications.isVerified, true)
        )
      )
      .limit(1);

    return !!verification;
  }

  // Send verification email
  async sendVerificationEmail(email: string): Promise<boolean> {
    try {
      const token = await this.createVerificationToken(email);
      const verificationUrl = `${process.env.DASHBOARD_URL || process.env.APP_URL || 'https://inboxleap.com'}/api/auth/verify-email?token=${token}`;

      const serviceEmail = process.env.SERVICE_EMAIL || 'todo@inboxleap.com';
      const servicePassword = process.env.SERVICE_EMAIL_PASSWORD || process.env.GMAIL_EMAIL_PASSWORD;
      
      if (!servicePassword) {
        console.log('⚠️  [EMAIL-VERIFICATION] No email service configured, cannot send verification email');
        return false;
      }

      const transporter = nodemailer.createTransport({
        host: process.env.SERVICE_SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SERVICE_SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: serviceEmail,
          pass: servicePassword,
        },
      });

      await transporter.sendMail({
        to: email,
        from: serviceEmail,
        subject: '🔐 Verify your email address - InboxLeap',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h2 style="color: #2563eb;">Verify your email address</h2>
            <p>Hi there!</p>
            <p>Someone (hopefully you) tried to access InboxLeap with your email address. To complete the verification and secure your account, please click the link below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${verificationUrl}">${verificationUrl}</a>
            </p>
            
            <p style="color: #666; font-size: 14px;">
              This verification link will expire in 24 hours for security reasons.
            </p>
            
            <p style="color: #666; font-size: 14px;">
              If you didn't request this verification, you can safely ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              This is an automated email from InboxLeap. Please do not reply to this message.
            </p>
          </div>
        `,
        text: `
Hi there!

Someone (hopefully you) tried to access InboxLeap with your email address. To complete the verification and secure your account, please visit:

${verificationUrl}

This verification link will expire in 24 hours for security reasons.

If you didn't request this verification, you can safely ignore this email.

---
This is an automated email from InboxLeap. Please do not reply to this message.
        `
      });

      console.log(`📧 [VERIFICATION] Verification email sent to: ${email}`);
      return true;

    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  }

  // Clean up expired tokens (should be run periodically)
  async cleanupExpiredTokens(): Promise<number> {
    const result = await db
      .delete(emailVerifications)
      .where(
        and(
          eq(emailVerifications.isVerified, false),
          lt(emailVerifications.tokenExpiration, new Date())
        )
      );

    console.log(`🧹 [VERIFICATION] Cleaned up expired tokens`);
    return 0; // Cannot get row count from Drizzle delete operation
  }
}

export const emailVerificationService = new EmailVerificationService();