import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import {
  companyAgentEmails,
  companyAgentSettings,
  userAgentEmails,
  type CompanyAgentEmail,
  type InsertCompanyAgentEmail,
  type CompanyAgentSettings,
  type InsertCompanyAgentSettings,
  type UserAgentEmail,
  type InsertUserAgentEmail,
} from '@email-task-router/shared';

export class AgentStorage {
  async createCompanyAgentEmail(emailData: InsertCompanyAgentEmail): Promise<CompanyAgentEmail> {
    try {
      const [agentEmail] = await db.insert(companyAgentEmails)
        .values(emailData)
        .returning();
      return agentEmail;
    } catch (error) {
      console.error('Error creating company agent email:', error);
      throw error;
    }
  }

  async getCompanyAgentEmails(companyId: number): Promise<CompanyAgentEmail[]> {
    try {
      return await db.select()
        .from(companyAgentEmails)
        .where(eq(companyAgentEmails.companyId, companyId))
        .orderBy(companyAgentEmails.agentType, companyAgentEmails.instanceName);
    } catch (error) {
      console.error('Error getting company agent emails:', error);
      return [];
    }
  }

  async getCompanyAgentEmail(companyId: number, agentType: string, instanceName?: string): Promise<CompanyAgentEmail | null> {
    try {
      const conditions = [
        eq(companyAgentEmails.companyId, companyId),
        eq(companyAgentEmails.agentType, agentType)
      ];
      
      if (instanceName) {
        conditions.push(eq(companyAgentEmails.instanceName, instanceName));
      }
      
      const [email] = await db.select()
        .from(companyAgentEmails)
        .where(and(...conditions))
        .orderBy(companyAgentEmails.createdAt);
      return email || null;
    } catch (error) {
      console.error('Error getting company agent email:', error);
      return null;
    }
  }

  async getCompanyAgentEmailByAddress(emailAddress: string): Promise<CompanyAgentEmail | null> {
    try {
      const [email] = await db.select()
        .from(companyAgentEmails)
        .where(eq(companyAgentEmails.emailAddress, emailAddress));
      return email || null;
    } catch (error) {
      console.error('Error getting company agent email by address:', error);
      return null;
    }
  }

  async getCompanyAgentEmailsForAgent(companyId: number, agentType: string): Promise<CompanyAgentEmail[]> {
    try {
      return await db.select()
        .from(companyAgentEmails)
        .where(and(
          eq(companyAgentEmails.companyId, companyId),
          eq(companyAgentEmails.agentType, agentType)
        ))
        .orderBy(companyAgentEmails.instanceName);
    } catch (error) {
      console.error('Error getting company agent emails for agent:', error);
      return [];
    }
  }

  async getAllGlobalAgentEmails(agentType: string): Promise<CompanyAgentEmail[]> {
    try {
      return await db.select()
        .from(companyAgentEmails)
        .where(and(
          eq(companyAgentEmails.agentType, agentType),
          eq(companyAgentEmails.allowGlobalEmails, true),
          eq(companyAgentEmails.isActive, true)
        ))
        .orderBy(companyAgentEmails.companyId, companyAgentEmails.instanceName);
    } catch (error) {
      console.error('Error getting global agent emails:', error);
      return [];
    }
  }

  async updateCompanyAgentEmail(id: number, updateData: Partial<InsertCompanyAgentEmail>): Promise<CompanyAgentEmail> {
    try {
      const [agentEmail] = await db.update(companyAgentEmails)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(companyAgentEmails.id, id))
        .returning();
      return agentEmail;
    } catch (error) {
      console.error('Error updating company agent email:', error);
      throw error;
    }
  }

  async deleteCompanyAgentEmail(id: number): Promise<void> {
    try {
      await db.delete(companyAgentEmails).where(eq(companyAgentEmails.id, id));
    } catch (error) {
      console.error('Error deleting company agent email:', error);
      throw error;
    }
  }

  generateDefaultAgentEmail(companyName: string, agentType: string, instanceName?: string): string {
    // Sanitize company name for email use
    const sanitizedCompanyName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
    
    // Sanitize instance name for email use
    const sanitizedInstanceName = instanceName 
      ? instanceName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)
      : '';
    
    const emailBase = sanitizedInstanceName 
      ? `${agentType}+${sanitizedCompanyName}-${sanitizedInstanceName}`
      : `${agentType}+${sanitizedCompanyName}`;
    
    return `${emailBase}@inboxleap.com`;
  }

  // Company Agent Settings methods
  async createCompanyAgentSettings(settingsData: InsertCompanyAgentSettings): Promise<CompanyAgentSettings> {
    try {
      const [settings] = await db.insert(companyAgentSettings)
        .values(settingsData)
        .returning();
      return settings;
    } catch (error) {
      console.error('Error creating company agent settings:', error);
      throw error;
    }
  }

  async getCompanyAgentSettings(companyId: number, agentType: string): Promise<CompanyAgentSettings | null> {
    try {
      const [settings] = await db.select()
        .from(companyAgentSettings)
        .where(and(
          eq(companyAgentSettings.companyId, companyId),
          eq(companyAgentSettings.agentType, agentType)
        ));
      return settings || null;
    } catch (error) {
      console.error('Error getting company agent settings:', error);
      return null;
    }
  }

  async updateCompanyAgentSettings(id: number, updateData: Partial<InsertCompanyAgentSettings>): Promise<CompanyAgentSettings> {
    try {
      const [settings] = await db.update(companyAgentSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(companyAgentSettings.id, id))
        .returning();
      return settings;
    } catch (error) {
      console.error('Error updating company agent settings:', error);
      throw error;
    }
  }

  async deleteCompanyAgentSettings(id: number): Promise<void> {
    try {
      await db.delete(companyAgentSettings).where(eq(companyAgentSettings.id, id));
    } catch (error) {
      console.error('Error deleting company agent settings:', error);
      throw error;
    }
  }

  // User Agent Email methods
  async createUserAgentEmail(emailData: InsertUserAgentEmail): Promise<UserAgentEmail> {
    try {
      const [agentEmail] = await db.insert(userAgentEmails)
        .values(emailData)
        .returning();
      return agentEmail;
    } catch (error) {
      console.error('Error creating user agent email:', error);
      throw error;
    }
  }

  async getUserAgentEmails(userId: string): Promise<UserAgentEmail[]> {
    try {
      return await db.select()
        .from(userAgentEmails)
        .where(eq(userAgentEmails.userId, userId))
        .orderBy(userAgentEmails.agentType, userAgentEmails.instanceName);
    } catch (error) {
      console.error('Error getting user agent emails:', error);
      return [];
    }
  }

  async getUserAgentEmail(userId: string, agentType: string, instanceName?: string): Promise<UserAgentEmail | null> {
    try {
      const conditions = [
        eq(userAgentEmails.userId, userId),
        eq(userAgentEmails.agentType, agentType)
      ];
      
      if (instanceName) {
        conditions.push(eq(userAgentEmails.instanceName, instanceName));
      }
      
      const [email] = await db.select()
        .from(userAgentEmails)
        .where(and(...conditions))
        .orderBy(userAgentEmails.createdAt);
      return email || null;
    } catch (error) {
      console.error('Error getting user agent email:', error);
      return null;
    }
  }

  async getUserAgentEmailById(id: number): Promise<UserAgentEmail | null> {
    try {
      const [email] = await db.select()
        .from(userAgentEmails)
        .where(eq(userAgentEmails.id, id));
      return email || null;
    } catch (error) {
      console.error('Error getting user agent email by id:', error);
      return null;
    }
  }

  async getUserAgentEmailByAddress(emailAddress: string): Promise<UserAgentEmail | null> {
    try {
      const [email] = await db.select()
        .from(userAgentEmails)
        .where(eq(userAgentEmails.emailAddress, emailAddress));
      return email || null;
    } catch (error) {
      console.error('Error getting user agent email by address:', error);
      return null;
    }
  }

  async getUserAgentEmailsForAgent(userId: string, agentType: string): Promise<UserAgentEmail[]> {
    try {
      return await db.select()
        .from(userAgentEmails)
        .where(and(
          eq(userAgentEmails.userId, userId),
          eq(userAgentEmails.agentType, agentType)
        ))
        .orderBy(userAgentEmails.instanceName);
    } catch (error) {
      console.error('Error getting user agent emails for agent:', error);
      return [];
    }
  }

  async updateUserAgentEmail(id: number, updateData: Partial<InsertUserAgentEmail>): Promise<UserAgentEmail> {
    try {
      const [email] = await db.update(userAgentEmails)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(userAgentEmails.id, id))
        .returning();
      return email;
    } catch (error) {
      console.error('Error updating user agent email:', error);
      throw error;
    }
  }

  async deleteUserAgentEmail(id: number): Promise<void> {
    try {
      await db.delete(userAgentEmails).where(eq(userAgentEmails.id, id));
    } catch (error) {
      console.error('Error deleting user agent email:', error);
      throw error;
    }
  }
}