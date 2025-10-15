import { db } from '../db';
import { agentInstances } from '@email-task-router/shared';
import { eq, and, sql } from 'drizzle-orm';
import type { AgentInstance, InsertAgentInstance } from '@email-task-router/shared';

export class AgentInstanceService {
  /**
   * Get instances for an identity
   */
  async getInstancesForIdentity(identityId: number, agentType: string): Promise<AgentInstance[]> {
    return await db.select()
      .from(agentInstances)
      .where(and(
        eq(agentInstances.identityId, identityId),
        eq(agentInstances.agentType, agentType),
        eq(agentInstances.isActive, true)
      ))
      .orderBy(agentInstances.createdAt);
  }

  /**
   * Get user instances (no auto-creation of default instances)
   */
  async getInstances(userId: string, agentType: string): Promise<AgentInstance[]> {
    return await db.select()
      .from(agentInstances)
      .where(and(
        eq(agentInstances.userId, userId),
        eq(agentInstances.agentType, agentType),
        eq(agentInstances.isActive, true)
      ))
      .orderBy(agentInstances.createdAt);
  }

  /**
   * Create a new instance for an identity
   */
  async createInstanceForIdentity(identityId: number, agentType: string, instanceName: string, customEmail?: string): Promise<AgentInstance> {
    // Get identity to extract userId for backward compatibility
    const { identityService } = await import('./identityService');
    const identity = await identityService.getIdentityById(identityId);
    if (!identity) {
      throw new Error(`Identity ${identityId} not found`);
    }

    let emailAddress: string;

    if (customEmail) {
      emailAddress = customEmail;
    } else if (agentType === 'todo') {
      // Todo always uses the shared inbox to simplify routing
      emailAddress = 'todo@inboxleap.com';
    } else if (agentType === 't5t') {
      // Check if this is the identity's first T5T instance
      const existingInstances = await this.getInstancesForIdentity(identityId, agentType);
      const isPrimaryName = instanceName === 'primary' || instanceName === 'personal-primary';

      if (existingInstances.length === 0 && isPrimaryName) {
        // First T5T instance tries to claim the shared inbox if available
        emailAddress = await this.generateDefaultEmail(agentType);
      } else {
        // Additional instances get custom emails with IDs
        emailAddress = this.generateCustomEmail(agentType);
      }
    } else {
      // Other agents always get custom emails
      emailAddress = this.generateCustomEmail(agentType);
    }

    // Check if email is already taken (except for shared default emails)
    if (emailAddress !== 'todo@inboxleap.com' && emailAddress !== 't5t@inboxleap.com') {
      await this.validateEmailUnique(emailAddress);
    }

    const instanceData: InsertAgentInstance = {
      identityId,
      userId: identity.userId, // Include userId for backward compatibility with DB constraint
      agentType,
      instanceName,
      emailAddress,
      isDefault: emailAddress === 'todo@inboxleap.com' || emailAddress === 't5t@inboxleap.com',
      isActive: true,
      customization: {
        predefinedParticipants: []
      }
    };

    try {
      const [created] = await db.insert(agentInstances)
        .values(instanceData)
        .returning();

      return created;
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : String(error);

      // If instance name already exists, append a unique suffix and retry
      if (message.includes('agent_instances_identity_agent_instance_unique') || message.includes('agent_instances_user_agent_instance_unique')) {
        console.log(`⚠️  Instance name "${instanceName}" already exists, generating unique name...`);
        const uniqueSuffix = Math.random().toString(36).substring(2, 8);
        const uniqueInstanceName = `${instanceName}-${uniqueSuffix}`;

        // Update instance data with unique name
        const uniqueInstanceData: InsertAgentInstance = {
          ...instanceData,
          instanceName: uniqueInstanceName,
        };

        try {
          const [created] = await db.insert(agentInstances)
            .values(uniqueInstanceData)
            .returning();

          console.log(`✅ Created instance with unique name: ${uniqueInstanceName}`);
          return created;
        } catch (retryError: any) {
          console.error('Error creating instance with unique name:', retryError);
          throw new Error(`Failed to create instance: ${retryError.message}`);
        }
      }

      if (message.includes('agent_instances_email_address_key')) {
        throw new Error('Email address is already in use');
      }

      throw error;
    }
  }

  /**
   * Create a new instance (legacy - uses userId)
   */
  async createInstance(userId: string, agentType: string, instanceName: string, customEmail?: string): Promise<AgentInstance> {
    let emailAddress: string;

    if (customEmail) {
      emailAddress = customEmail;
    } else if (agentType === 'todo') {
      // Todo always uses the shared inbox to simplify routing
      emailAddress = 'todo@inboxleap.com';
    } else if (agentType === 't5t') {
      // Check if this is the user's first Tanya instance
      const existingInstances = await this.getUserInstances(userId, agentType);
      const isPrimaryName = instanceName === 'primary' || instanceName === 'personal-primary';

      if (existingInstances.length === 0 && isPrimaryName) {
        // First Tanya instance tries to claim the shared inbox if available
        emailAddress = await this.generateDefaultEmail(agentType);
      } else {
        // Additional instances get custom emails with IDs
        emailAddress = this.generateCustomEmail(agentType);
      }
    } else {
      // Other agents always get custom emails
      emailAddress = this.generateCustomEmail(agentType);
    }

    // Check if email is already taken (except for shared default emails)
    if (emailAddress !== 'todo@inboxleap.com' && emailAddress !== 't5t@inboxleap.com') {
      await this.validateEmailUnique(emailAddress);
    }

    const instanceData: InsertAgentInstance = {
      userId,
      agentType,
      instanceName,
      emailAddress,
      isDefault: emailAddress === 'todo@inboxleap.com' || emailAddress === 't5t@inboxleap.com', // Mark default email as default
      isActive: true,
      customization: {
        predefinedParticipants: [] // Can be set later via updateInstanceCustomization
      }
    };

    try {
      const [created] = await db.insert(agentInstances)
        .values(instanceData)
        .returning();

      return created;
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : String(error);

      if (message.includes('agent_instances_user_agent_instance_unique')) {
        throw new Error('Instance name already exists for this agent');
      }

      if (message.includes('agent_instances_email_address_key')) {
        throw new Error('Email address is already in use');
      }

      throw error;
    }
  }

  /**
   * Get all instances for a user and agent type
   */
  async getUserInstances(userId: string, agentType: string): Promise<AgentInstance[]> {
    return await db.select()
      .from(agentInstances)
      .where(and(
        eq(agentInstances.userId, userId),
        eq(agentInstances.agentType, agentType),
        eq(agentInstances.isActive, true)
      ))
      .orderBy(agentInstances.createdAt);
  }

  /**
   * Update instance email address
   */
  async updateInstanceEmail(instanceId: number, newEmail: string): Promise<AgentInstance> {
    // Check if email is already taken (except for the current instance and shared default emails)
    if (newEmail !== 'todo@inboxleap.com' && newEmail !== 't5t@inboxleap.com') {
      await this.validateEmailUnique(newEmail, instanceId);
    }

    const [updated] = await db.update(agentInstances)
      .set({
        emailAddress: newEmail,
        isDefault: newEmail === 'todo@inboxleap.com' || newEmail === 't5t@inboxleap.com', // Update default flag
        updatedAt: sql`NOW()`
      })
      .where(eq(agentInstances.id, instanceId))
      .returning();

    if (!updated) {
      throw new Error('Instance not found');
    }

    return updated;
  }

  /**
   * Update instance customization (e.g., predefined participants)
   */
  async updateInstanceCustomization(instanceId: number, customization: Record<string, any>): Promise<AgentInstance> {
    const [updated] = await db.update(agentInstances)
      .set({
        customization,
        updatedAt: sql`NOW()`
      })
      .where(eq(agentInstances.id, instanceId))
      .returning();

    if (!updated) {
      throw new Error('Instance not found');
    }

    return updated;
  }

  /**
   * Get instance by email address (with identity information)
   */
  async getInstanceByEmailWithIdentity(emailAddress: string): Promise<(AgentInstance & { identityId: number | null }) | null> {
    const normalized = emailAddress.trim().toLowerCase();
    if (normalized === 'todo@inboxleap.com') {
      // The shared todo inbox is global and should not bind to a single identity
      return null;
    }

    const [instance] = await db.select()
      .from(agentInstances)
      .where(and(
        eq(agentInstances.emailAddress, emailAddress),
        eq(agentInstances.isActive, true)
      ))
      .limit(1);

    return instance || null;
  }

  /**
   * Get instance by email address
   */
  async getInstanceByEmail(emailAddress: string): Promise<AgentInstance | null> {
    const [instance] = await db.select()
      .from(agentInstances)
      .where(and(
        eq(agentInstances.emailAddress, emailAddress),
        eq(agentInstances.isActive, true)
      ))
      .limit(1);

    return instance || null;
  }

  /**
   * Delete an instance
   */
  async deleteInstance(instanceId: number): Promise<void> {
    const [instance] = await db.select()
      .from(agentInstances)
      .where(eq(agentInstances.id, instanceId))
      .limit(1);

    if (!instance) {
      throw new Error('Instance not found');
    }

    await db.update(agentInstances)
      .set({ isActive: false })
      .where(eq(agentInstances.id, instanceId));
  }

  /**
   * Get all active emails for an agent type (for TodoAgent.getHandledEmails())
   */
  async getActiveEmailsForAgentType(agentType: string): Promise<string[]> {
    const instances = await db.select({ emailAddress: agentInstances.emailAddress })
      .from(agentInstances)
      .where(and(
        eq(agentInstances.agentType, agentType),
        eq(agentInstances.isActive, true)
      ));

    return Array.from(new Set(instances.map(i => i.emailAddress)));
  }

  /**
   * Generate default email for agent type
   * Only the first user gets agent@inboxleap.com, others get generated emails
   */
  private async generateDefaultEmail(agentType: string): Promise<string> {
    const defaultEmail = `${agentType}@inboxleap.com`;
    
    // Check if the default email is already taken
    const existing = await db.select({ id: agentInstances.id })
      .from(agentInstances)
      .where(and(
        eq(agentInstances.emailAddress, defaultEmail),
        eq(agentInstances.isActive, true)
      ))
      .limit(1);

    if (existing.length === 0) {
      // Default email is available
      return defaultEmail;
    } else {
      // Default email is taken, generate a custom one
      return this.generateCustomEmail(agentType);
    }
  }

  /**
   * Generate custom email with unique ID
   */
  private generateCustomEmail(agentType: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 8);
    return `${agentType}+${timestamp}${random}@inboxleap.com`;
  }

  /**
   * Validate email is unique globally (except for todo@inboxleap.com)
   */
  private async validateEmailUnique(emailAddress: string, excludeInstanceId?: number): Promise<void> {
    // Only todo@inboxleap.com is allowed to be non-unique (special case)
    // Note: t5t@inboxleap.com is no longer allowed - all T5T emails must be user-specific
    if (emailAddress === 'todo@inboxleap.com') {
      return;
    }

    const conditions = [
      eq(agentInstances.emailAddress, emailAddress),
      eq(agentInstances.isActive, true)
    ];

    if (excludeInstanceId) {
      conditions.push(sql`${agentInstances.id} != ${excludeInstanceId}`);
    }

    const existing = await db.select({ id: agentInstances.id })
      .from(agentInstances)
      .where(and(...conditions))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Email address ${emailAddress} is already in use`);
    }
  }

  /**
   * Get an agent instance by ID
   */
  async getInstanceById(id: number): Promise<AgentInstance | undefined> {
    const results = await db.select()
      .from(agentInstances)
      .where(eq(agentInstances.id, id))
      .limit(1);
    
    return results[0];
  }
}

export const agentInstanceService = new AgentInstanceService();

