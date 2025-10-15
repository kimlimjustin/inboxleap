import { db } from '../db';
import { identities, identityAccess, userSessionContext, users, companies, agentInstances, projects } from '@email-task-router/shared';
import { eq, and, or } from 'drizzle-orm';

export class IdentityService {
  /**
   * Get a user's personal identity
   */
  async getUserIdentity(userId: string) {
    const [identity] = await db
      .select()
      .from(identities)
      .where(eq(identities.userId, userId))
      .limit(1);

    return identity;
  }

  /**
   * Get all identities accessible to a user (personal + company identities)
   */
  async getUserAccessibleIdentities(userId: string) {
    // Get user's personal identity
    const personalIdentity = await this.getUserIdentity(userId);

    // Get company identities user has access to
    const companyIdentities = await db
      .select({
        id: identities.id,
        type: identities.type,
        userId: identities.userId,
        companyId: identities.companyId,
        displayName: identities.displayName,
        description: identities.description,
        createdAt: identities.createdAt,
        updatedAt: identities.updatedAt,
        // Access info
        role: identityAccess.role,
        canManageAgents: identityAccess.canManageAgents,
        canManageProjects: identityAccess.canManageProjects,
        canManageTasks: identityAccess.canManageTasks,
      })
      .from(identities)
      .innerJoin(identityAccess, eq(identities.id, identityAccess.identityId))
      .where(
        and(
          eq(identityAccess.userId, userId),
          eq(identityAccess.isActive, true),
          eq(identities.type, 'company')
        )
      );

    return {
      personal: personalIdentity,
      companies: companyIdentities,
      all: personalIdentity ? [personalIdentity, ...companyIdentities] : companyIdentities,
    };
  }

  /**
   * Get current identity context for a user
   */
  async getCurrentIdentity(userId: string) {
    const [context] = await db
      .select()
      .from(userSessionContext)
      .where(eq(userSessionContext.userId, userId))
      .limit(1);

    if (!context || !context.currentIdentityId) {
      // Default to user's personal identity
      return await this.getUserIdentity(userId);
    }

    const [identity] = await db
      .select()
      .from(identities)
      .where(eq(identities.id, context.currentIdentityId))
      .limit(1);

    return identity;
  }

  /**
   * Switch user's current identity
   */
  async switchIdentity(userId: string, identityId: number) {
    // Verify user has access to this identity
    const hasAccess = await this.verifyIdentityAccess(userId, identityId);
    if (!hasAccess) {
      throw new Error('User does not have access to this identity');
    }

    // Update or create session context
    const [existing] = await db
      .select()
      .from(userSessionContext)
      .where(eq(userSessionContext.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(userSessionContext)
        .set({
          currentIdentityId: identityId,
          updatedAt: new Date(),
        })
        .where(eq(userSessionContext.userId, userId));
    } else {
      await db.insert(userSessionContext).values({
        userId,
        currentIdentityId: identityId,
        updatedAt: new Date(),
      });
    }

    return await this.getCurrentIdentity(userId);
  }

  /**
   * Verify if a user has access to an identity
   */
  async verifyIdentityAccess(userId: string, identityId: number): Promise<boolean> {
    const [identity] = await db
      .select()
      .from(identities)
      .where(eq(identities.id, identityId))
      .limit(1);

    if (!identity) {
      return false;
    }

    // User can access their own personal identity
    if (identity.type === 'user' && identity.userId === userId) {
      return true;
    }

    // Check if user has access to company identity
    if (identity.type === 'company') {
      const [access] = await db
        .select()
        .from(identityAccess)
        .where(
          and(
            eq(identityAccess.identityId, identityId),
            eq(identityAccess.userId, userId),
            eq(identityAccess.isActive, true)
          )
        )
        .limit(1);

      return !!access;
    }

    return false;
  }

  /**
   * Get identity permissions for a user
   */
  async getIdentityPermissions(userId: string, identityId: number) {
    const [identity] = await db
      .select()
      .from(identities)
      .where(eq(identities.id, identityId))
      .limit(1);

    if (!identity) {
      return null;
    }

    // Full permissions for personal identity
    if (identity.type === 'user' && identity.userId === userId) {
      return {
        canManageAgents: true,
        canManageProjects: true,
        canManageTasks: true,
        role: 'owner',
      };
    }

    // Get permissions for company identity
    if (identity.type === 'company') {
      const [access] = await db
        .select()
        .from(identityAccess)
        .where(
          and(
            eq(identityAccess.identityId, identityId),
            eq(identityAccess.userId, userId),
            eq(identityAccess.isActive, true)
          )
        )
        .limit(1);

      return access ? {
        canManageAgents: access.canManageAgents,
        canManageProjects: access.canManageProjects,
        canManageTasks: access.canManageTasks,
        role: access.role,
      } : null;
    }

    return null;
  }

  /**
   * Create a personal identity for a new user
   */
  async createUserIdentity(userId: string, displayName: string) {
    const [existing] = await db
      .select()
      .from(identities)
      .where(eq(identities.userId, userId))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [identity] = await db
      .insert(identities)
      .values({
        type: 'user',
        userId,
        displayName,
        description: `Personal identity for ${displayName}`,
      })
      .returning();

    // Create session context
    await db.insert(userSessionContext).values({
      userId,
      currentIdentityId: identity.id,
    });

    return identity;
  }

  /**
   * Create a company identity
   */
  async createCompanyIdentity(companyId: number, displayName: string, description?: string) {
    const [existing] = await db
      .select()
      .from(identities)
      .where(eq(identities.companyId, companyId))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [identity] = await db
      .insert(identities)
      .values({
        type: 'company',
        companyId,
        displayName,
        description: description || `Company identity for ${displayName}`,
      })
      .returning();

    return identity;
  }

  /**
   * Grant identity access to a user
   */
  async grantIdentityAccess(
    identityId: number,
    userId: string,
    role: string = 'member',
    permissions?: {
      canManageAgents?: boolean;
      canManageProjects?: boolean;
      canManageTasks?: boolean;
    }
  ) {
    const [existing] = await db
      .select()
      .from(identityAccess)
      .where(
        and(
          eq(identityAccess.identityId, identityId),
          eq(identityAccess.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing access
      const [updated] = await db
        .update(identityAccess)
        .set({
          role,
          canManageAgents: permissions?.canManageAgents ?? existing.canManageAgents,
          canManageProjects: permissions?.canManageProjects ?? existing.canManageProjects,
          canManageTasks: permissions?.canManageTasks ?? existing.canManageTasks,
          isActive: true,
        })
        .where(eq(identityAccess.id, existing.id))
        .returning();

      return updated;
    }

    // Create new access
    const [access] = await db
      .insert(identityAccess)
      .values({
        identityId,
        userId,
        role,
        canManageAgents: permissions?.canManageAgents ?? (role === 'admin'),
        canManageProjects: permissions?.canManageProjects ?? true,
        canManageTasks: permissions?.canManageTasks ?? true,
      })
      .returning();

    return access;
  }

  /**
   * Revoke identity access from a user
   */
  async revokeIdentityAccess(identityId: number, userId: string) {
    await db
      .update(identityAccess)
      .set({ isActive: false })
      .where(
        and(
          eq(identityAccess.identityId, identityId),
          eq(identityAccess.userId, userId)
        )
      );
  }

  /**
   * Get all agent instances for an identity
   */
  async getIdentityAgentInstances(identityId: number) {
    return await db
      .select()
      .from(agentInstances)
      .where(
        and(
          eq(agentInstances.identityId, identityId),
          eq(agentInstances.isActive, true)
        )
      );
  }

  /**
   * Get all projects for an identity
   */
  async getIdentityProjects(identityId: number) {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.identityId, identityId));
  }

  /**
   * Get identity by ID
   */
  async getIdentityById(identityId: number) {
    const [identity] = await db
      .select()
      .from(identities)
      .where(eq(identities.id, identityId))
      .limit(1);

    return identity;
  }

  /**
   * Get identity details with user/company info
   */
  async getIdentityDetails(identityId: number) {
    const identity = await this.getIdentityById(identityId);
    if (!identity) {
      return null;
    }

    if (identity.type === 'user' && identity.userId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, identity.userId))
        .limit(1);

      return { ...identity, user };
    }

    if (identity.type === 'company' && identity.companyId) {
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, identity.companyId))
        .limit(1);

      return { ...identity, company };
    }

    return identity;
  }

  /**
   * Get list of users with access to an identity
   */
  async getIdentityAccessList(identityId: number) {
    const accessList = await db
      .select({
        id: identityAccess.id,
        userId: identityAccess.userId,
        role: identityAccess.role,
        canManageAgents: identityAccess.canManageAgents,
        canManageProjects: identityAccess.canManageProjects,
        canManageTasks: identityAccess.canManageTasks,
        isActive: identityAccess.isActive,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(identityAccess)
      .leftJoin(users, eq(identityAccess.userId, users.id))
      .where(
        and(
          eq(identityAccess.identityId, identityId),
          eq(identityAccess.isActive, true)
        )
      );

    return accessList;
  }
}

export const identityService = new IdentityService();