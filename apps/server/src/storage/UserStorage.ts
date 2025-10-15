import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import {
  users,
  userLinkedAccounts,
  type User,
  type UpsertUser,
  type UserLinkedAccount,
  type InsertUserLinkedAccount,
} from '@email-task-router/shared';

export class UserStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        password: users.password,
        authProvider: users.authProvider,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          password: users.password,
          authProvider: users.authProvider,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });
      
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    try {
      const [user] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date()
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          password: users.password,
          authProvider: users.authProvider,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });
      
      return user;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          password: users.password,
          authProvider: users.authProvider,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      return user;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async createUserLinkedAccount(accountData: InsertUserLinkedAccount): Promise<UserLinkedAccount> {
    try {
      const [account] = await db.insert(userLinkedAccounts)
        .values(accountData)
        .returning();
      return account;
    } catch (error) {
      console.error('Error creating user linked account:', error);
      throw error;
    }
  }

  async getUserLinkedAccounts(userId: string): Promise<UserLinkedAccount[]> {
    try {
      return await db.select()
        .from(userLinkedAccounts)
        .where(eq(userLinkedAccounts.userId, userId))
        .orderBy(userLinkedAccounts.linkedAt);
    } catch (error) {
      console.error('Error getting user linked accounts:', error);
      return [];
    }
  }

  async getUserByProviderAccount(provider: string, providerAccountId: string): Promise<User | undefined> {
    try {
      const [result] = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          password: users.password,
          authProvider: users.authProvider,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .innerJoin(userLinkedAccounts, eq(userLinkedAccounts.userId, users.id))
        .where(and(
          eq(userLinkedAccounts.provider, provider),
          eq(userLinkedAccounts.providerAccountId, providerAccountId),
          eq(userLinkedAccounts.isActive, true)
        ))
        .limit(1);
      
      return result;
    } catch (error) {
      console.error('Error getting user by provider account:', error);
      return undefined;
    }
  }

  async updateLinkedAccountLastUsed(accountId: number): Promise<void> {
    try {
      await db.update(userLinkedAccounts)
        .set({ lastUsed: new Date() })
        .where(eq(userLinkedAccounts.id, accountId));
    } catch (error) {
      console.error('Error updating linked account last used:', error);
      throw error;
    }
  }
}