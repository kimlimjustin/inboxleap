import { storage } from '../storage.js';
import type { User } from '@email-task-router/shared';
import { isServiceEmail } from './utils/emailUtils';
import { identityService } from './identityService';

/**
 * Service to handle user operations with consistent ID management
 */

/**
 * Get or create a user by email, ensuring consistent ID usage
 * This handles the case where users might be created through different flows
 * (email processing, OAuth, manual creation) but need consistent IDs
 */
export async function getOrCreateUserByEmail(email: string, profile?: {
  id?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string | null;
}): Promise<User> {
  try {
    // Never create users for service emails
    if (isServiceEmail(email)) {
      throw new Error(`Cannot create user for service email: ${email}`);
    }
    
    // First check if user exists by email (this is the key fix!)
    let user = await storage.getUserByEmail(email);
    
    if (user) {
      // User exists - always return the existing user to maintain consistency
      // Update profile if provided and not already set
      if (profile && (profile.firstName || profile.lastName || profile.profileImageUrl !== undefined)) {
        // Only update if the new data is more complete
        const updates: any = {
          id: user.id, // Keep existing ID (this is crucial!)
          email: user.email,
        };
        
        if (profile.firstName && !user.firstName) updates.firstName = profile.firstName;
        if (profile.lastName && !user.lastName) updates.lastName = profile.lastName;
        if (profile.profileImageUrl !== undefined && !user.profileImageUrl) {
          updates.profileImageUrl = profile.profileImageUrl;
        }
        
        // Only update if there are actual changes
        if (Object.keys(updates).length > 2) { // more than just id and email
          user = await storage.updateUser(user.id, updates);
        }
      }
      
      console.log(`👤 [USER-SERVICE] Found existing user: ${user.email} with ID: ${user.id}`);
      return user;
    }
    
    // User doesn't exist, create new one
    // Generate a proper unique ID - never use email as ID to avoid conflicts
    const userId = profile?.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const firstName = profile?.firstName || email.split('@')[0];
    
    console.log(`➕ [USER-SERVICE] Creating new user: ${email} with ID: ${userId}`);
    
    // Ensure we have all required fields for user creation
    const newUserData = {
      id: userId,
      email,
      firstName,
      lastName: profile?.lastName || null,
      profileImageUrl: profile?.profileImageUrl || null,
      password: null,
      authProvider: profile?.id ? 'google' : 'system', // 'system' for auto-created users
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const newUser = await storage.createUser(newUserData);

    // Verify user was created successfully
    if (!newUser || !newUser.id) {
      throw new Error(`Failed to create user for email: ${email}`);
    }

    console.log(`✅ [USER-SERVICE] Successfully created user: ${newUser.email} with ID: ${newUser.id}`);

    // CRITICAL: Create personal identity for the new user
    try {
      console.log(`🆔 [USER-SERVICE] Creating personal identity for new user: ${newUser.email}`);
      const identity = await identityService.createUserIdentity(newUser.id, email);
      console.log(`✅ [USER-SERVICE] Created personal identity ID: ${identity.id} for user: ${newUser.email}`);
    } catch (identityError) {
      console.error(`❌ [USER-SERVICE] Failed to create identity for user ${newUser.email}:`, identityError);
      // Don't fail user creation if identity creation fails, but log it
    }

    return newUser;
    
  } catch (error) {
    console.error(`🚨 [USER-SERVICE] Error in getOrCreateUserByEmail for ${email}:`, error);
    throw error;
  }
}

/**
 * Normalize user ID to handle the case where we might have email or ID
 */
export async function normalizeUserId(userIdOrEmail: string): Promise<string | null> {
  // If it looks like an email, try to get the user by email
  if (userIdOrEmail.includes('@')) {
    const user = await storage.getUserByEmail(userIdOrEmail);
    return user?.id || null;
  }
  
  // Otherwise, verify the user exists by ID
  const user = await storage.getUser(userIdOrEmail);
  return user?.id || null;
}

/**
 * Get user by ID or email
 */
export async function getUserByIdOrEmail(idOrEmail: string): Promise<User | undefined> {
  if (idOrEmail.includes('@')) {
    return await storage.getUserByEmail(idOrEmail);
  }
  return await storage.getUser(idOrEmail);
}

/**
 * Handle user sign-up or sign-in, properly linking to existing system-created accounts
 * This is called when a user actually signs up via Google OAuth or email/password
 */
export async function signUpOrSignInUser(email: string, profile: {
  id: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string | null;
  authProvider: 'google' | 'email';
  password?: string;
}): Promise<User> {
  try {
    // Check if user already exists by email (could be system-created or already signed up)
    let existingUser = await storage.getUserByEmail(email);
    
    if (existingUser) {
      // User exists - update their information if it's a system-created account
      if (existingUser.authProvider === 'system') {
        console.log(`🔗 [USER-SERVICE] Linking system account to real sign-up: ${email}`);
        
        // Update the existing account with real sign-up information
        const updatedData = {
          id: existingUser.id, // Keep the existing ID to maintain foreign key relationships
          email: existingUser.email,
          firstName: profile.firstName || existingUser.firstName,
          lastName: profile.lastName || existingUser.lastName,
          profileImageUrl: profile.profileImageUrl !== undefined ? profile.profileImageUrl : existingUser.profileImageUrl,
          password: profile.password || existingUser.password,
          authProvider: profile.authProvider,
          updatedAt: new Date(),
        };
        
        const user = await storage.updateUser(existingUser.id, {
          firstName: profile.firstName || existingUser.firstName,
          lastName: profile.lastName || existingUser.lastName,
          profileImageUrl: profile.profileImageUrl !== undefined ? profile.profileImageUrl : existingUser.profileImageUrl,
          password: profile.password || existingUser.password,
          authProvider: profile.authProvider,
        });
        console.log(`✅ [USER-SERVICE] Successfully linked system account: ${user.email} with ID: ${user.id}`);
        return user;
      } else {
        // User already properly signed up - just update profile if needed
        console.log(`👤 [USER-SERVICE] User already signed up: ${email}`);
        return existingUser;
      }
    }
    
    // No existing user - create new account with proper OAuth/email ID
    console.log(`➕ [USER-SERVICE] Creating new signed-up user: ${email}`);
    
    const newUserData = {
      id: profile.id,
      email,
      firstName: profile.firstName || email.split('@')[0],
      lastName: profile.lastName || null,
      profileImageUrl: profile.profileImageUrl || null,
      password: profile.password || null,
      authProvider: profile.authProvider,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const newUser = await storage.createUser(newUserData);
    
    if (!newUser || !newUser.id) {
      throw new Error(`Failed to create signed-up user for email: ${email}`);
    }
    
    console.log(`✅ [USER-SERVICE] Successfully created signed-up user: ${newUser.email} with ID: ${newUser.id}`);
    return newUser;
    
  } catch (error) {
    console.error(`🚨 [USER-SERVICE] Error in signUpOrSignInUser for ${email}:`, error);
    throw error;
  }
}

/**
 * Migrate users who have email as their ID to proper unique IDs
 * This is a one-time migration function to fix existing data
 */
export async function migrateEmailIdUsers(): Promise<void> {
  try {
    console.log('🔄 [USER-SERVICE] Starting migration of users with email as ID...');

    // TODO: Implement proper migration logic when needed
    // For now, this is a placeholder for future database migration

    console.log('✅ [USER-SERVICE] Migration check completed (not implemented)');
  } catch (error) {
    console.error('🚨 [USER-SERVICE] Error during user migration:', error);
  }
}