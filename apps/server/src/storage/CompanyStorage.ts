import { db } from '../db';
import { eq, and, desc, asc, isNull, sql } from 'drizzle-orm';
import {
  companies,
  companyMemberships,
  companyInvitations,
  companyDepartments,
  companyHierarchy,
  type Company,
  type InsertCompany,
  type CompanyMembership,
  type InsertCompanyMembership,
  type CompanyInvitation,
  type InsertCompanyInvitation,
  type CompanyDepartment,
  type InsertCompanyDepartment,
  type CompanyHierarchy,
  type InsertCompanyHierarchy,
} from '@email-task-router/shared';

export class CompanyStorage {
  async createCompany(companyData: InsertCompany): Promise<Company> {
    try {
      const [company] = await db.insert(companies)
        .values(companyData)
        .returning();
      return company;
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  }

  async getCompany(id: number): Promise<Company | undefined> {
    try {
      const [company] = await db.select()
        .from(companies)
        .where(eq(companies.id, id));
      return company;
    } catch (error) {
      console.error('Error getting company:', error);
      return undefined;
    }
  }

  async getCompanyByEmail(email: string): Promise<Company | undefined> {
    try {
      const [company] = await db.select()
        .from(companies)
        .where(eq(companies.emailAddress, email));
      return company;
    } catch (error) {
      console.error('Error getting company by email:', error);
      return undefined;
    }
  }

  async updateCompany(id: number, companyData: Partial<InsertCompany>): Promise<Company> {
    try {
      const [company] = await db.update(companies)
        .set({ ...companyData, updatedAt: new Date() })
        .where(eq(companies.id, id))
        .returning();
      return company;
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  }

  async deleteCompany(id: number): Promise<void> {
    try {
      await db.delete(companies).where(eq(companies.id, id));
    } catch (error) {
      console.error('Error deleting company:', error);
      throw error;
    }
  }

  async getSubCompanies(parentCompanyId: number): Promise<Company[]> {
    try {
      return await db.select()
        .from(companies)
        .where(eq(companies.parentCompanyId, parentCompanyId))
        .orderBy(asc(companies.name));
    } catch (error) {
      console.error('Error getting sub-companies:', error);
      return [];
    }
  }

  // Company membership operations
  async createCompanyMembership(membershipData: InsertCompanyMembership): Promise<CompanyMembership> {
    try {
      const [membership] = await db.insert(companyMemberships)
        .values(membershipData)
        .returning();
      return membership;
    } catch (error) {
      console.error('Error creating company membership:', error);
      throw error;
    }
  }

  async getCompanyMembership(companyId: number, userId: string): Promise<CompanyMembership | undefined> {
    try {
      const [membership] = await db.select()
        .from(companyMemberships)
        .where(and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.userId, userId),
          eq(companyMemberships.isActive, true)
        ));
      return membership;
    } catch (error) {
      console.error('Error getting company membership:', error);
      return undefined;
    }
  }

  async getCompanyMemberships(companyId: number): Promise<CompanyMembership[]> {
    try {
      return await db.select()
        .from(companyMemberships)
        .where(and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.isActive, true)
        ))
        .orderBy(asc(companyMemberships.joinedAt));
    } catch (error) {
      console.error('Error getting company memberships:', error);
      return [];
    }
  }

  async getUserCompanyMemberships(userId: string): Promise<CompanyMembership[]> {
    try {
      return await db.select()
        .from(companyMemberships)
        .where(and(
          eq(companyMemberships.userId, userId),
          eq(companyMemberships.isActive, true)
        ))
        .orderBy(desc(companyMemberships.joinedAt));
    } catch (error) {
      console.error('Error getting user company memberships:', error);
      return [];
    }
  }

  async updateCompanyMembership(id: number, membershipData: Partial<InsertCompanyMembership>): Promise<CompanyMembership> {
    try {
      const [membership] = await db.update(companyMemberships)
        .set(membershipData)
        .where(eq(companyMemberships.id, id))
        .returning();
      return membership;
    } catch (error) {
      console.error('Error updating company membership:', error);
      throw error;
    }
  }

  async deleteCompanyMembership(id: number): Promise<void> {
    try {
      await db.delete(companyMemberships).where(eq(companyMemberships.id, id));
    } catch (error) {
      console.error('Error deleting company membership:', error);
      throw error;
    }
  }

  // Company invitation operations
  async createCompanyInvitation(invitationData: InsertCompanyInvitation): Promise<CompanyInvitation> {
    try {
      const [invitation] = await db.insert(companyInvitations)
        .values(invitationData)
        .returning();
      return invitation;
    } catch (error) {
      console.error('Error creating company invitation:', error);
      throw error;
    }
  }

  async getCompanyInvitation(id: number): Promise<CompanyInvitation | undefined> {
    try {
      const [invitation] = await db.select()
        .from(companyInvitations)
        .where(eq(companyInvitations.id, id));
      return invitation;
    } catch (error) {
      console.error('Error getting company invitation:', error);
      return undefined;
    }
  }

  async getCompanyInvitationByToken(token: string): Promise<CompanyInvitation | undefined> {
    try {
      const [invitation] = await db.select()
        .from(companyInvitations)
        .where(eq(companyInvitations.invitationToken, token));
      return invitation;
    } catch (error) {
      console.error('Error getting company invitation by token:', error);
      return undefined;
    }
  }

  async getCompanyInvitations(companyId: number): Promise<CompanyInvitation[]> {
    try {
      return await db.select()
        .from(companyInvitations)
        .where(eq(companyInvitations.companyId, companyId))
        .orderBy(desc(companyInvitations.createdAt));
    } catch (error) {
      console.error('Error getting company invitations:', error);
      return [];
    }
  }

  async getPendingCompanyInvitations(email: string): Promise<CompanyInvitation[]> {
    try {
      return await db.select()
        .from(companyInvitations)
        .where(and(
          eq(companyInvitations.inviteeEmail, email),
          eq(companyInvitations.status, 'pending'),
          isNull(companyInvitations.respondedAt)
        ))
        .orderBy(desc(companyInvitations.createdAt));
    } catch (error) {
      console.error('Error getting pending company invitations:', error);
      return [];
    }
  }

  async updateCompanyInvitation(id: number, invitationData: Partial<InsertCompanyInvitation>): Promise<CompanyInvitation> {
    try {
      const [invitation] = await db.update(companyInvitations)
        .set({ ...invitationData, updatedAt: new Date() })
        .where(eq(companyInvitations.id, id))
        .returning();
      return invitation;
    } catch (error) {
      console.error('Error updating company invitation:', error);
      throw error;
    }
  }

  async deleteCompanyInvitation(id: number): Promise<void> {
    try {
      await db.delete(companyInvitations).where(eq(companyInvitations.id, id));
    } catch (error) {
      console.error('Error deleting company invitation:', error);
      throw error;
    }
  }

  // Company department operations
  async createCompanyDepartment(departmentData: InsertCompanyDepartment): Promise<CompanyDepartment> {
    try {
      const [department] = await db.insert(companyDepartments)
        .values(departmentData)
        .returning();
      return department;
    } catch (error) {
      console.error('Error creating company department:', error);
      throw error;
    }
  }

  async getCompanyDepartments(companyId: number): Promise<CompanyDepartment[]> {
    try {
      return await db.select()
        .from(companyDepartments)
        .where(and(
          eq(companyDepartments.companyId, companyId),
          eq(companyDepartments.isActive, true)
        ))
        .orderBy(asc(companyDepartments.name));
    } catch (error) {
      console.error('Error getting company departments:', error);
      return [];
    }
  }

  async getCompanyDepartment(id: number): Promise<CompanyDepartment | undefined> {
    try {
      const [department] = await db.select()
        .from(companyDepartments)
        .where(eq(companyDepartments.id, id));
      return department;
    } catch (error) {
      console.error('Error getting company department:', error);
      return undefined;
    }
  }

  async updateCompanyDepartment(id: number, departmentData: Partial<InsertCompanyDepartment>): Promise<CompanyDepartment> {
    try {
      const [department] = await db.update(companyDepartments)
        .set(departmentData)
        .where(eq(companyDepartments.id, id))
        .returning();
      return department;
    } catch (error) {
      console.error('Error updating company department:', error);
      throw error;
    }
  }

  async deleteCompanyDepartment(id: number): Promise<void> {
    try {
      await db.delete(companyDepartments).where(eq(companyDepartments.id, id));
    } catch (error) {
      console.error('Error deleting company department:', error);
      throw error;
    }
  }

  // Company hierarchy operations
  async upsertCompanyHierarchy(hierarchyData: InsertCompanyHierarchy): Promise<CompanyHierarchy> {
    try {
      // First, try to find existing hierarchy relationship
      const existingHierarchy = await db.select()
        .from(companyHierarchy)
        .where(and(
          eq(companyHierarchy.companyId, hierarchyData.companyId),
          eq(companyHierarchy.employeeUserId, hierarchyData.employeeUserId)
        ))
        .limit(1);

      if (existingHierarchy.length > 0) {
        // Update existing
        const [updated] = await db.update(companyHierarchy)
          .set({
            managerUserId: hierarchyData.managerUserId,
            confidence: hierarchyData.confidence,
            source: hierarchyData.source,
            lastSeen: new Date()
          })
          .where(eq(companyHierarchy.id, existingHierarchy[0].id))
          .returning();
        return updated;
      } else {
        // Create new
        const [created] = await db.insert(companyHierarchy)
          .values({
            ...hierarchyData,
            lastSeen: new Date()
          })
          .returning();
        return created;
      }
    } catch (error) {
      console.error('Error upserting company hierarchy:', error);
      throw error;
    }
  }

  async getCompanyHierarchies(companyId: number): Promise<CompanyHierarchy[]> {
    try {
      return await db.select()
        .from(companyHierarchy)
        .where(eq(companyHierarchy.companyId, companyId))
        .orderBy(asc(companyHierarchy.employeeUserId));
    } catch (error) {
      console.error('Error getting company hierarchies:', error);
      return [];
    }
  }

  async getCompanyMemberCount(companyId: number): Promise<number> {
    try {
      const [result] = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(companyMemberships)
        .where(and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.isActive, true)
        ));
      return Number(result?.count) || 0;
    } catch (error) {
      console.error('Error getting company member count:', error);
      return 0;
    }
  }
}