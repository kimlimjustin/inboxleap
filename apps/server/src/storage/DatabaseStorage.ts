import { db } from '../db';
import { eq, and, desc, asc, sql, isNull, not, or, inArray } from 'drizzle-orm';
import {
  users,
  projects,
  tasks,
  taskAssignees,
  emailCredentials,
  processedEmails,
  projectParticipants,
  userTrustRelationships,
  notificationPreferences,
  pollingAgents,
  t5tSubmissions,
  pollingInsights,
  intelligenceTokens,
  userDepartments,
  pollingAgentParticipants,
  emailOptOuts,
  emailAttachments,
  faqOrganizations,
  sopDocuments,
  faqEntries,
  passwordResetTokens,
  trustConfirmationTokens,
  userLinkedAccounts,
  companies,
  companyMemberships,
  companyInvitations,
  companyDepartments,
  companyHierarchy,
  companyAgentEmails,
  companyAgentSettings,
  userAgentEmails,
  documentAnalysisResults,
  type User,
  type UpsertUser,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type TaskAssignee,
  type InsertTaskAssignee,
  type EmailCredentials,
  type InsertEmailCredentials,
  type ProcessedEmail,
  type InsertProcessedEmail,
  type ProjectParticipant,
  type InsertProjectParticipant,
  type UserTrustRelationship,
  type InsertUserTrustRelationship,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type PollingAgent,
  type InsertPollingAgent,
  type T5tSubmission,
  type InsertT5tSubmission,
  type PollingInsight,
  type InsertPollingInsight,
  type UserDepartment,
  type InsertUserDepartment,
  type PollingAgentParticipant,
  type InsertPollingAgentParticipant,
  type EmailOptOut,
  type InsertEmailOptOut,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type TrustConfirmationToken,
  type InsertTrustConfirmationToken,
  type UserLinkedAccount,
  type InsertUserLinkedAccount,
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
  type CompanyAgentEmail,
  type InsertCompanyAgentEmail,
  type CompanyAgentSettings,
  type InsertCompanyAgentSettings,
  type UserAgentEmail,
  type InsertUserAgentEmail,
  type FAQOrganization,
  type InsertFAQOrganization,
  type SOPDocument,
  type InsertSOPDocument,
  type FAQEntry,
  type InsertFAQEntry,
} from '@email-task-router/shared';
import { IStorage } from './interfaces';
import { UserStorage } from './UserStorage';
import { ProjectStorage } from './ProjectStorage';
import { CompanyStorage } from './CompanyStorage';
import { AgentStorage } from './AgentStorage';
import { identityService } from '../services/identityService';

export class DatabaseStorage implements IStorage {
  private userStorage = new UserStorage();
  private projectStorage = new ProjectStorage();
  private companyStorage = new CompanyStorage();
  private agentStorage = new AgentStorage();

  // User operations - delegated to UserStorage
  async getUser(id: string): Promise<User | undefined> {
    return this.userStorage.getUser(id);
  }

  async createUser(userData: UpsertUser): Promise<User> {
    return this.userStorage.createUser(userData);
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    return this.userStorage.updateUser(id, userData);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.userStorage.getUserByEmail(email);
  }

  async createUserLinkedAccount(accountData: InsertUserLinkedAccount): Promise<UserLinkedAccount> {
    return this.userStorage.createUserLinkedAccount(accountData);
  }

  async getUserLinkedAccounts(userId: string): Promise<UserLinkedAccount[]> {
    return this.userStorage.getUserLinkedAccounts(userId);
  }

  async getUserByProviderAccount(provider: string, providerAccountId: string): Promise<User | undefined> {
    return this.userStorage.getUserByProviderAccount(provider, providerAccountId);
  }

  async updateLinkedAccountLastUsed(accountId: number): Promise<void> {
    return this.userStorage.updateLinkedAccountLastUsed(accountId);
  }

  // Project operations - delegated to ProjectStorage
  async createProject(projectData: InsertProject): Promise<Project> {
    return this.projectStorage.createProject(projectData);
  }

  async getUserProjects(userId: string, companyId?: number): Promise<Project[]> {
    return this.projectStorage.getUserProjects(userId, companyId);
  }

  async getIdentityProjects(identityId: number): Promise<Project[]> {
    return this.projectStorage.getIdentityProjects(identityId);
  }

  async getProjectsWhereUserIsParticipant(userId: string): Promise<Project[]> {
    return this.projectStorage.getProjectsWhereUserIsParticipant(userId);
  }

  // TEMPORARY: Get all projects created by user (bypass identity filtering)
  async getProjectsByCreator(userId: string): Promise<Project[]> {
    return this.projectStorage.getProjectsByCreator(userId);
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projectStorage.getProject(id);
  }

  async findProjectByThreadId(threadId: string): Promise<Project | null> {
    return this.projectStorage.findProjectByThreadId(threadId);
  }

  async findProjectByTopicAndParticipants(topic: string, participants: string[]): Promise<Project | null> {
    return this.projectStorage.findProjectByTopicAndParticipants(topic, participants);
  }

  async getProjectTasks(projectId: number): Promise<Task[]> {
    return this.projectStorage.getProjectTasks(projectId);
  }

  async updateProject(id: number, projectData: Partial<InsertProject>): Promise<Project> {
    return this.projectStorage.updateProject(id, projectData);
  }

  async deleteProject(id: number): Promise<void> {
    return this.projectStorage.deleteProject(id);
  }

  async addProjectParticipant(participantData: InsertProjectParticipant): Promise<ProjectParticipant> {
    const participant = await this.projectStorage.addProjectParticipant(participantData);

    try {
      const project = await this.projectStorage.getProject(participantData.projectId);

      if (project?.identityId) {
        const identityRole = participantData.role === 'owner' ? 'admin' : 'member';

        await identityService.grantIdentityAccess(
          project.identityId,
          participantData.userId,
          identityRole,
          {
            canManageProjects: identityRole === 'admin',
            canManageTasks: true,
            canManageAgents: identityRole === 'admin',
          }
        );
      }
    } catch (error) {
      console.warn('[Storage] Failed to ensure identity access for project participant', {
        projectId: participantData.projectId,
        userId: participantData.userId,
        error,
      });
    }

    return participant;
  }

  async getProjectParticipants(projectId: number): Promise<ProjectParticipant[]> {
    return this.projectStorage.getProjectParticipants(projectId);
  }

  async removeProjectParticipant(projectId: number, userId: string): Promise<void> {
    return this.projectStorage.removeProjectParticipant(projectId, userId);
  }

  async isUserProjectParticipant(projectId: number, userId: string): Promise<boolean> {
    return this.projectStorage.isUserProjectParticipant(projectId, userId);
  }

  // Task operations - delegated to ProjectStorage (tasks are part of projects)
  async createTask(taskData: InsertTask): Promise<Task> {
    return this.projectStorage.createTask(taskData);
  }

  async getTasks(projectId: number): Promise<Task[]> {
    return this.projectStorage.getTasks(projectId);
  }

  async getTask(id: number): Promise<Task | undefined> {
    return this.projectStorage.getTask(id);
  }

  async updateTask(id: number, taskData: Partial<InsertTask>): Promise<Task> {
    return this.projectStorage.updateTask(id, taskData);
  }

  async deleteTask(id: number): Promise<void> {
    return this.projectStorage.deleteTask(id);
  }

  async assignTask(assignmentData: InsertTaskAssignee): Promise<TaskAssignee> {
    return this.projectStorage.assignTask(assignmentData);
  }

  async getTaskAssignees(taskId: number): Promise<TaskAssignee[]> {
    return this.projectStorage.getTaskAssignees(taskId);
  }

  async unassignTask(taskId: number, userId: string): Promise<void> {
    return this.projectStorage.unassignTask(taskId, userId);
  }

  // User task query operations - delegated to ProjectStorage
  async getUserAssignedTasks(userId: string, companyId?: number): Promise<Task[]> {
    return this.projectStorage.getUserAssignedTasks(userId, companyId);
  }

  async getTasksAssignedByUser(userId: string, companyId?: number): Promise<Task[]> {
    return this.projectStorage.getTasksAssignedByUser(userId, companyId);
  }

  async getUserMonitorTasks(userId: string, companyId?: number): Promise<Task[]> {
    return this.projectStorage.getUserMonitorTasks(userId, companyId);
  }

  async getUserDoneTasks(userId: string, companyId?: number): Promise<Task[]> {
    return this.projectStorage.getUserDoneTasks(userId, companyId);
  }

  async getTasksWithAssignees(projectId: number): Promise<Task[]> {
    return this.projectStorage.getTasksWithAssignees(projectId);
  }

  async getProjectEmails(projectId: number): Promise<ProcessedEmail[]> {
    return this.projectStorage.getProjectEmails(projectId);
  }

  // Company operations - delegated to CompanyStorage
  async createCompany(companyData: InsertCompany): Promise<Company> {
    return this.companyStorage.createCompany(companyData);
  }

  async getCompany(id: number): Promise<Company | undefined> {
    return this.companyStorage.getCompany(id);
  }

  async getCompanyByEmail(email: string): Promise<Company | undefined> {
    return this.companyStorage.getCompanyByEmail(email);
  }

  async updateCompany(id: number, companyData: Partial<InsertCompany>): Promise<Company> {
    return this.companyStorage.updateCompany(id, companyData);
  }

  async deleteCompany(id: number): Promise<void> {
    return this.companyStorage.deleteCompany(id);
  }

  async createCompanyMembership(membershipData: InsertCompanyMembership): Promise<CompanyMembership> {
    return this.companyStorage.createCompanyMembership(membershipData);
  }

  async getCompanyMembership(companyId: number, userId: string): Promise<CompanyMembership | undefined> {
    return this.companyStorage.getCompanyMembership(companyId, userId);
  }

  async getCompanyMemberships(companyId: number): Promise<CompanyMembership[]> {
    return this.companyStorage.getCompanyMemberships(companyId);
  }

  async getUserCompanyMemberships(userId: string): Promise<CompanyMembership[]> {
    return this.companyStorage.getUserCompanyMemberships(userId);
  }

  async updateCompanyMembership(id: number, membershipData: Partial<InsertCompanyMembership>): Promise<CompanyMembership> {
    return this.companyStorage.updateCompanyMembership(id, membershipData);
  }

  async deleteCompanyMembership(id: number): Promise<void> {
    return this.companyStorage.deleteCompanyMembership(id);
  }

  async createCompanyInvitation(invitationData: InsertCompanyInvitation): Promise<CompanyInvitation> {
    return this.companyStorage.createCompanyInvitation(invitationData);
  }

  async getCompanyInvitation(id: number): Promise<CompanyInvitation | undefined> {
    return this.companyStorage.getCompanyInvitation(id);
  }

  async getCompanyInvitationByToken(token: string): Promise<CompanyInvitation | undefined> {
    return this.companyStorage.getCompanyInvitationByToken(token);
  }

  async getCompanyInvitations(companyId: number): Promise<CompanyInvitation[]> {
    return this.companyStorage.getCompanyInvitations(companyId);
  }

  async getPendingCompanyInvitations(email: string): Promise<CompanyInvitation[]> {
    return this.companyStorage.getPendingCompanyInvitations(email);
  }

  async updateCompanyInvitation(id: number, invitationData: Partial<InsertCompanyInvitation>): Promise<CompanyInvitation> {
    return this.companyStorage.updateCompanyInvitation(id, invitationData);
  }

  async deleteCompanyInvitation(id: number): Promise<void> {
    return this.companyStorage.deleteCompanyInvitation(id);
  }

  async createCompanyDepartment(departmentData: InsertCompanyDepartment): Promise<CompanyDepartment> {
    return this.companyStorage.createCompanyDepartment(departmentData);
  }

  async getCompanyDepartments(companyId: number): Promise<CompanyDepartment[]> {
    return this.companyStorage.getCompanyDepartments(companyId);
  }

  async getCompanyDepartment(id: number): Promise<CompanyDepartment | undefined> {
    return this.companyStorage.getCompanyDepartment(id);
  }

  async updateCompanyDepartment(id: number, departmentData: Partial<InsertCompanyDepartment>): Promise<CompanyDepartment> {
    return this.companyStorage.updateCompanyDepartment(id, departmentData);
  }

  async deleteCompanyDepartment(id: number): Promise<void> {
    return this.companyStorage.deleteCompanyDepartment(id);
  }

  async upsertCompanyHierarchy(hierarchyData: InsertCompanyHierarchy): Promise<CompanyHierarchy> {
    return this.companyStorage.upsertCompanyHierarchy(hierarchyData);
  }

  async getCompanyHierarchies(companyId: number): Promise<CompanyHierarchy[]> {
    return this.companyStorage.getCompanyHierarchies(companyId);
  }

  async getSubCompanies(parentCompanyId: number): Promise<Company[]> {
    return this.companyStorage.getSubCompanies(parentCompanyId);
  }

  async getCompanyMemberCount(companyId: number): Promise<number> {
    return this.companyStorage.getCompanyMemberCount(companyId);
  }

  // Agent operations - delegated to AgentStorage
  async createCompanyAgentEmail(emailData: InsertCompanyAgentEmail): Promise<CompanyAgentEmail> {
    return this.agentStorage.createCompanyAgentEmail(emailData);
  }

  async getCompanyAgentEmails(companyId: number): Promise<CompanyAgentEmail[]> {
    return this.agentStorage.getCompanyAgentEmails(companyId);
  }

  async getCompanyAgentEmail(companyId: number, agentType: string, instanceName?: string): Promise<CompanyAgentEmail | null> {
    return this.agentStorage.getCompanyAgentEmail(companyId, agentType, instanceName);
  }

  async getCompanyAgentEmailByAddress(emailAddress: string): Promise<CompanyAgentEmail | null> {
    return this.agentStorage.getCompanyAgentEmailByAddress(emailAddress);
  }

  async getCompanyAgentEmailsForAgent(companyId: number, agentType: string): Promise<CompanyAgentEmail[]> {
    return this.agentStorage.getCompanyAgentEmailsForAgent(companyId, agentType);
  }

  async getAllGlobalAgentEmails(agentType: string): Promise<CompanyAgentEmail[]> {
    return this.agentStorage.getAllGlobalAgentEmails(agentType);
  }

  async updateCompanyAgentEmail(id: number, updateData: Partial<InsertCompanyAgentEmail>): Promise<CompanyAgentEmail> {
    return this.agentStorage.updateCompanyAgentEmail(id, updateData);
  }

  async deleteCompanyAgentEmail(id: number): Promise<void> {
    return this.agentStorage.deleteCompanyAgentEmail(id);
  }

  generateDefaultAgentEmail(companyName: string, agentType: string, instanceName?: string): string {
    return this.agentStorage.generateDefaultAgentEmail(companyName, agentType, instanceName);
  }

  async createCompanyAgentSettings(settingsData: InsertCompanyAgentSettings): Promise<CompanyAgentSettings> {
    return this.agentStorage.createCompanyAgentSettings(settingsData);
  }

  async getCompanyAgentSettings(companyId: number, agentType: string): Promise<CompanyAgentSettings | null> {
    return this.agentStorage.getCompanyAgentSettings(companyId, agentType);
  }

  async updateCompanyAgentSettings(id: number, updateData: Partial<InsertCompanyAgentSettings>): Promise<CompanyAgentSettings> {
    return this.agentStorage.updateCompanyAgentSettings(id, updateData);
  }

  async deleteCompanyAgentSettings(id: number): Promise<void> {
    return this.agentStorage.deleteCompanyAgentSettings(id);
  }

  // User Agent Email operations
  async createUserAgentEmail(emailData: InsertUserAgentEmail): Promise<UserAgentEmail> {
    return this.agentStorage.createUserAgentEmail(emailData);
  }

  async getUserAgentEmails(userId: string): Promise<UserAgentEmail[]> {
    return this.agentStorage.getUserAgentEmails(userId);
  }

  async getUserAgentEmail(userId: string, agentType: string, instanceName?: string): Promise<UserAgentEmail | null> {
    return this.agentStorage.getUserAgentEmail(userId, agentType, instanceName);
  }

  async getUserAgentEmailById(id: number): Promise<UserAgentEmail | null> {
    return this.agentStorage.getUserAgentEmailById(id);
  }

  async getUserAgentEmailByAddress(emailAddress: string): Promise<UserAgentEmail | null> {
    return this.agentStorage.getUserAgentEmailByAddress(emailAddress);
  }

  async getUserAgentEmailsForAgent(userId: string, agentType: string): Promise<UserAgentEmail[]> {
    return this.agentStorage.getUserAgentEmailsForAgent(userId, agentType);
  }

  async updateUserAgentEmail(id: number, updateData: Partial<InsertUserAgentEmail>): Promise<UserAgentEmail> {
    return this.agentStorage.updateUserAgentEmail(id, updateData);
  }

  async deleteUserAgentEmail(id: number): Promise<void> {
    return this.agentStorage.deleteUserAgentEmail(id);
  }

  generateDefaultAgentEmailForUser(userId: string, agentType: string, instanceName?: string): string {
    // For individual users, use clean format for primary, instance ID for others
    if (!instanceName || instanceName.toLowerCase() === 'primary' || instanceName.toLowerCase() === 'default') {
      return `${agentType}@inboxleap.com`;
    } else {
      // Generate unique instance ID for non-primary instances
      const instanceId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      return `${agentType}+${instanceId}@inboxleap.com`;
    }
  }

  // Legacy methods - implement directly for now (these are less commonly used)
  // TODO: These could be moved to separate storage classes as well

  async createEmailCredentials(credentialsData: InsertEmailCredentials): Promise<EmailCredentials> {
    try {
      const [credentials] = await db.insert(emailCredentials)
        .values(credentialsData)
        .returning();
      return credentials;
    } catch (error) {
      console.error('Error creating email credentials:', error);
      throw error;
    }
  }

  async getUserEmailCredentials(userId: string): Promise<EmailCredentials[]> {
    try {
      return await db.select()
        .from(emailCredentials)
        .where(eq(emailCredentials.userId, userId))
        .orderBy(asc(emailCredentials.createdAt));
    } catch (error) {
      console.error('Error getting user email credentials:', error);
      return [];
    }
  }

  async getEmailCredentials(id: number): Promise<EmailCredentials | undefined> {
    try {
      const [credentials] = await db.select()
        .from(emailCredentials)
        .where(eq(emailCredentials.id, id));
      return credentials;
    } catch (error) {
      console.error('Error getting email credentials:', error);
      return undefined;
    }
  }

  async updateEmailCredentials(id: number, credentialsData: Partial<InsertEmailCredentials>): Promise<EmailCredentials> {
    try {
      const [credentials] = await db.update(emailCredentials)
        .set(credentialsData)
        .where(eq(emailCredentials.id, id))
        .returning();
      return credentials;
    } catch (error) {
      console.error('Error updating email credentials:', error);
      throw error;
    }
  }

  async deleteEmailCredentials(id: number): Promise<void> {
    try {
      await db.delete(emailCredentials).where(eq(emailCredentials.id, id));
    } catch (error) {
      console.error('Error deleting email credentials:', error);
      throw error;
    }
  }

  async createProcessedEmail(emailData: InsertProcessedEmail): Promise<ProcessedEmail> {
    try {
      const [processedEmail] = await db.insert(processedEmails)
        .values(emailData)
        .returning();
      return processedEmail;
    } catch (error) {
      console.error('Error creating processed email:', error);
      throw error;
    }
  }

  async getProcessedEmailsBySource(source: string): Promise<ProcessedEmail[]> {
    try {
      // For test emails, look for [TEST] prefix in subject
      if (source === 'test-generator') {
        return await db.select()
          .from(processedEmails)
          .where(sql`${processedEmails.subject} LIKE '[TEST]%'`);
      }
      // For other sources, this method won't work as there's no source field
      return [];
    } catch (error) {
      console.error('Error getting processed emails by source:', error);
      return [];
    }
  }

  async deleteProcessedEmail(id: number): Promise<void> {
    try {
      await db.delete(processedEmails).where(eq(processedEmails.id, id));
    } catch (error) {
      console.error('Error deleting processed email:', error);
      throw error;
    }
  }

  async getEmailsByRecipient(recipientEmail: string, limit: number = 100): Promise<ProcessedEmail[]> {
    try {
      return await db.select()
        .from(processedEmails)
        .where(or(
          sql`${recipientEmail} = ANY(${processedEmails.recipients})`,
          sql`${recipientEmail} = ANY(${processedEmails.ccList})`,
          sql`${recipientEmail} = ANY(${processedEmails.bccList})`
        ))
        .orderBy(desc(processedEmails.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting emails by recipient:', error);
      return [];
    }
  }

  async getEmailsForAgentInstance(instanceId: number, limit: number = 100): Promise<ProcessedEmail[]> {
    try {
      // Get the current instance to find the agent type and current email
      const { agentInstances } = await import('@email-task-router/shared');
      const [instance] = await db.select()
        .from(agentInstances)
        .where(eq(agentInstances.id, instanceId))
        .limit(1);

      if (!instance) {
        return [];
      }

      // SECURITY FIX: For Tanya agents, ONLY look for emails sent to the SPECIFIC instance email
      // Never include general t5t@inboxleap.com to prevent cross-topic contamination
      if (instance.agentType === 't5t') {
        const specificEmail = instance.emailAddress;

        console.log(`🔒 [SECURITY] Getting emails ONLY for specific Tanya instance: ${specificEmail}`);

        // STRICT: Only get emails sent to this specific instance email address
        return await db.select()
          .from(processedEmails)
          .where(or(
            sql`${specificEmail} = ANY(${processedEmails.recipients})`,
            sql`${specificEmail} = ANY(${processedEmails.ccList})`,
            sql`${specificEmail} = ANY(${processedEmails.bccList})`
          ))
          .orderBy(desc(processedEmails.createdAt))
          .limit(limit);
      }

      // For other agents, fall back to the current email address only
      return this.getEmailsByRecipient(instance.emailAddress, limit);
    } catch (error) {
      console.error('Error getting emails for agent instance:', error);
      return [];
    }
  }

  async getAllProcessedEmails(limit: number = 1000): Promise<ProcessedEmail[]> {
    try {
      return await db.select()
        .from(processedEmails)
        .orderBy(desc(processedEmails.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting all processed emails:', error);
      return [];
    }
  }

  async getAllIntelligenceAgents(userId?: string): Promise<PollingAgent[]> {
    try {
      // If userId is provided, only return agents owned by that user
      if (userId) {
        return await db.select()
          .from(pollingAgents)
          .where(eq(pollingAgents.createdBy, userId))
          .orderBy(desc(pollingAgents.createdAt));
      }

      return await db.select()
        .from(pollingAgents)
        .orderBy(desc(pollingAgents.createdAt));
    } catch (error) {
      console.error('Error getting intelligence agents:', error);
      return [];
    }
  }

  async getAllActiveAgentEmails(agentType: string): Promise<any[]> {
    try {
      return await db.select()
        .from(userAgentEmails)
        .where(and(
          eq(userAgentEmails.agentType, agentType),
          eq(userAgentEmails.isActive, true)
        ));
    } catch (error) {
      console.error('Error getting all active agent emails:', error);
      return [];
    }
  }

  async getAllActiveCompanyAgentEmails(agentType: string): Promise<any[]> {
    try {
      return await db.select()
        .from(companyAgentEmails)
        .where(and(
          eq(companyAgentEmails.agentType, agentType),
          eq(companyAgentEmails.isActive, true)
        ));
    } catch (error) {
      console.error('Error getting all active company agent emails:', error);
      return [];
    }
  }

  async getProcessedEmailByMessageId(messageId: string): Promise<ProcessedEmail | undefined> {
    try {
      const [processedEmail] = await db.select()
        .from(processedEmails)
        .where(eq(processedEmails.messageId, messageId));
      return processedEmail;
    } catch (error) {
      console.error('Error getting processed email by message ID:', error);
      return undefined;
    }
  }

  async getRecentProcessedEmails(limit: number = 10): Promise<ProcessedEmail[]> {
    try {
      return await db.select()
        .from(processedEmails)
        .orderBy(desc(processedEmails.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting recent processed emails:', error);
      return [];
    }
  }

  async updateProcessedEmail(id: number, emailData: Partial<InsertProcessedEmail>): Promise<ProcessedEmail> {
    try {
      const [processedEmail] = await db.update(processedEmails)
        .set(emailData)
        .where(eq(processedEmails.id, id))
        .returning();
      return processedEmail;
    } catch (error) {
      console.error('Error updating processed email:', error);
      throw error;
    }
  }

  // User trust relationship operations
  async createUserTrustRelationship(relationshipData: InsertUserTrustRelationship): Promise<UserTrustRelationship> {
    try {
      const [relationship] = await db.insert(userTrustRelationships)
        .values(relationshipData)
        .returning();
      return relationship;
    } catch (error) {
      console.error('Error creating user trust relationship:', error);
      throw error;
    }
  }

  async getUserTrustRelationship(userId: string, trustedUserId: string): Promise<UserTrustRelationship | undefined> {
    try {
      const [relationship] = await db.select()
        .from(userTrustRelationships)
        .where(and(
          eq(userTrustRelationships.userId, userId),
          eq(userTrustRelationships.trustedUserId, trustedUserId)
        ));
      return relationship;
    } catch (error) {
      console.error('Error getting user trust relationship:', error);
      return undefined;
    }
  }

  async updateUserTrustRelationship(id: number, relationshipData: Partial<InsertUserTrustRelationship>): Promise<UserTrustRelationship> {
    try {
      const [relationship] = await db.update(userTrustRelationships)
        .set({ ...relationshipData, updatedAt: new Date() })
        .where(eq(userTrustRelationships.id, id))
        .returning();
      return relationship;
    } catch (error) {
      console.error('Error updating user trust relationship:', error);
      throw error;
    }
  }

  async getUserTrustRelationships(userId: string): Promise<UserTrustRelationship[]> {
    try {
      return await db.select()
        .from(userTrustRelationships)
        .where(eq(userTrustRelationships.userId, userId))
        .orderBy(desc(userTrustRelationships.createdAt));
    } catch (error) {
      console.error('Error getting user trust relationships:', error);
      return [];
    }
  }

  // Alias method for backward compatibility
  async getTrustRelationship(userId: string, trustedUserId: string): Promise<UserTrustRelationship | undefined> {
    return this.getUserTrustRelationship(userId, trustedUserId);
  }

  async getUsersBlockedByMany(threshold: number): Promise<Array<{ email: string; blockCount: number }>> {
    try {
      // Find users who have been blocked by at least 'threshold' number of other users
      // This queries trust relationships where trustLevel is 'blocked'
      const blockedUsersQuery = db.select({
        trustedUserId: userTrustRelationships.trustedUserId,
        blockCount: sql<number>`count(*)`.as('blockCount')
      })
      .from(userTrustRelationships)
      .where(eq(userTrustRelationships.trustStatus, 'blocked'))
      .groupBy(userTrustRelationships.trustedUserId)
      .having(sql`count(*) >= ${threshold}`);

      const blockedUserIds = await blockedUsersQuery;

      if (blockedUserIds.length === 0) {
        return [];
      }

      // Get the actual user records for those blocked users
      const userIds = blockedUserIds.map(b => b.trustedUserId);
      const blockedUsers = await db.select()
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);

      // Map to return format with block counts
      return blockedUsers.map(user => {
        const blockData = blockedUserIds.find(b => b.trustedUserId === user.id);
        return {
          email: user.email || '',
          blockCount: blockData?.blockCount || 0
        };
      });
    } catch (error) {
      console.error('Error getting users blocked by many:', error);
      return [];
    }
  }

  async getUsersWhoBlockMany(threshold: number): Promise<Array<{ email: string; blockCount: number }>> {
    try {
      // Find users who have blocked at least 'threshold' number of other users
      const blockersQuery = await db.select({
        userId: userTrustRelationships.userId,
        blockCount: sql<number>`count(*)`.as('blockCount')
      })
      .from(userTrustRelationships)
      .where(eq(userTrustRelationships.trustStatus, 'blocked'))
      .groupBy(userTrustRelationships.userId)
      .having(sql`count(*) >= ${threshold}`);

      if (blockersQuery.length === 0) {
        return [];
      }

      // Get the actual user records
      const userIds = blockersQuery.map(b => b.userId);
      const blockerUsers = await db.select()
        .from(users)
        .where(inArray(users.id, userIds));

      // Map to return format with block counts
      return blockerUsers.map(user => {
        const blockData = blockersQuery.find(b => b.userId === user.id);
        return {
          email: user.email || '',
          blockCount: blockData?.blockCount || 0
        };
      });
    } catch (error) {
      console.error('Error getting users who block many:', error);
      return [];
    }
  }

  // Upsert method for trust relationships
  async upsertTrustRelationship(relationshipData: InsertUserTrustRelationship): Promise<UserTrustRelationship> {
    try {
      // Try to find existing relationship
      const existing = await this.getUserTrustRelationship(relationshipData.userId, relationshipData.trustedUserId);
      
      if (existing) {
        // Update existing relationship
        return this.updateUserTrustRelationship(existing.id, relationshipData);
      } else {
        // Create new relationship
        return this.createUserTrustRelationship(relationshipData);
      }
    } catch (error) {
      console.error('Error upserting trust relationship:', error);
      throw error;
    }
  }

  async createNotificationPreferences(preferencesData: InsertNotificationPreferences): Promise<NotificationPreferences> {
    try {
      const [preferences] = await db.insert(notificationPreferences)
        .values(preferencesData)
        .returning();
      return preferences;
    } catch (error) {
      console.error('Error creating notification preferences:', error);
      throw error;
    }
  }

  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    try {
      const [preferences] = await db.select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
      return preferences;
    } catch (error) {
      console.error('Error getting user notification preferences:', error);
      return undefined;
    }
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    return this.getUserNotificationPreferences(userId);
  }

  async updateNotificationPreferences(id: number, preferencesData: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences> {
    try {
      const [preferences] = await db.update(notificationPreferences)
        .set({ ...preferencesData, updatedAt: new Date() })
        .where(eq(notificationPreferences.id, id))
        .returning();
      return preferences;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  // Polling agent operations
  async createPollingAgent(agentData: InsertPollingAgent): Promise<PollingAgent> {
    try {
      const [agent] = await db.insert(pollingAgents)
        .values(agentData)
        .returning();
      return agent;
    } catch (error) {
      console.error('Error creating polling agent:', error);
      throw error;
    }
  }

  async getPollingAgents(userId?: string): Promise<PollingAgent[]> {
    try {
      const query = db.select().from(pollingAgents);
      if (userId) {
        return await query.where(eq(pollingAgents.createdBy, userId));
      }
      return await query.orderBy(desc(pollingAgents.createdAt));
    } catch (error) {
      console.error('Error getting polling agents:', error);
      return [];
    }
  }

  async getPollingAgentsForCompany(companyId: number): Promise<PollingAgent[]> {
    try {
      return await db.select()
        .from(pollingAgents)
        .where(eq(pollingAgents.companyId, companyId))
        .orderBy(desc(pollingAgents.createdAt));
    } catch (error) {
      console.error('Error getting polling agents for company:', error);
      return [];
    }
  }

  async getPollingAgent(id: number): Promise<PollingAgent | undefined> {
    try {
      const [agent] = await db.select()
        .from(pollingAgents)
        .where(eq(pollingAgents.id, id));
      return agent;
    } catch (error) {
      console.error('Error getting polling agent:', error);
      return undefined;
    }
  }

  async getPollingAgentByEmail(email: string): Promise<PollingAgent | undefined> {
    try {
      const [agent] = await db.select()
        .from(pollingAgents)
        .where(eq(pollingAgents.emailAddress, email));
      return agent;
    } catch (error) {
      console.error('Error getting polling agent by email:', error);
      return undefined;
    }
  }

  async updatePollingAgent(id: number, agentData: Partial<InsertPollingAgent>): Promise<PollingAgent> {
    try {
      const [agent] = await db.update(pollingAgents)
        .set({ ...agentData, updatedAt: new Date() })
        .where(eq(pollingAgents.id, id))
        .returning();
      return agent;
    } catch (error) {
      console.error('Error updating polling agent:', error);
      throw error;
    }
  }

  async deletePollingAgent(id: number): Promise<void> {
    try {
      await db.delete(pollingAgents).where(eq(pollingAgents.id, id));
    } catch (error) {
      console.error('Error deleting polling agent:', error);
      throw error;
    }
  }

  // T5T submission operations
  async createT5tSubmission(submissionData: InsertT5tSubmission): Promise<T5tSubmission> {
    try {
      const [submission] = await db.insert(t5tSubmissions)
        .values(submissionData)
        .returning();
      return submission;
    } catch (error) {
      console.error('Error creating T5T submission:', error);
      throw error;
    }
  }

  async getT5tSubmissionByMessageId(messageId: string): Promise<T5tSubmission | undefined> {
    try {
      const [submission] = await db.select()
        .from(t5tSubmissions)
        .where(eq(t5tSubmissions.messageId, messageId));
      return submission;
    } catch (error) {
      console.error('Error getting T5T submission by message ID:', error);
      return undefined;
    }
  }

  async getT5tSubmissions(pollingAgentId: number, options: { limit?: number, period?: string } = {}): Promise<T5tSubmission[]> {
    try {
      const { limit = 50, period } = options;
      let query = db.select()
        .from(t5tSubmissions)
        .where(eq(t5tSubmissions.pollingAgentId, pollingAgentId))
        .orderBy(desc(t5tSubmissions.submissionDate))
        .limit(limit);

      // If period is provided, we could add date filtering here in the future
      // For now, just ignore the period parameter

      return await query;
    } catch (error) {
      console.error('Error getting T5T submissions:', error);
      return [];
    }
  }

  async updateT5tSubmission(id: number, submissionData: Partial<InsertT5tSubmission>): Promise<T5tSubmission> {
    try {
      const [submission] = await db.update(t5tSubmissions)
        .set(submissionData)
        .where(eq(t5tSubmissions.id, id))
        .returning();
      return submission;
    } catch (error) {
      console.error('Error updating T5T submission:', error);
      throw error;
    }
  }

  // Polling insight operations
  async createPollingInsight(insightData: InsertPollingInsight): Promise<PollingInsight> {
    try {
      const [insight] = await db.insert(pollingInsights)
        .values(insightData)
        .returning();
      return insight;
    } catch (error) {
      console.error('Error creating polling insight:', error);
      throw error;
    }
  }

  async getPollingInsights(pollingAgentId: number, options: { limit?: number, period?: string } = {}): Promise<PollingInsight[]> {
    try {
      const { limit = 50, period } = options;
      let query = db.select()
        .from(pollingInsights)
        .where(eq(pollingInsights.pollingAgentId, pollingAgentId))
        .orderBy(desc(pollingInsights.createdAt))
        .limit(limit);

      // If period is provided, we could add date filtering here in the future
      // For now, just ignore the period parameter

      return await query;
    } catch (error) {
      console.error('Error getting polling insights:', error);
      return [];
    }
  }

  async updatePollingInsight(id: number, insightData: Partial<InsertPollingInsight>): Promise<PollingInsight> {
    try {
      const [insight] = await db.update(pollingInsights)
        .set({ ...insightData, updatedAt: new Date() })
        .where(eq(pollingInsights.id, id))
        .returning();
      return insight;
    } catch (error) {
      console.error('Error updating polling insight:', error);
      throw error;
    }
  }

  async incrementInsightViewCount(id: number): Promise<void> {
    try {
      await db.update(pollingInsights)
        .set({ 
          viewCount: sql`view_count + 1`,
          lastViewed: new Date()
        })
        .where(eq(pollingInsights.id, id));
    } catch (error) {
      console.error('Error incrementing insight view count:', error);
      throw error;
    }
  }

  // User department operations
  async createUserDepartment(departmentData: InsertUserDepartment): Promise<UserDepartment> {
    try {
      const [department] = await db.insert(userDepartments)
        .values(departmentData)
        .returning();
      return department;
    } catch (error) {
      console.error('Error creating user department:', error);
      throw error;
    }
  }

  async getUserDepartments(userId: string): Promise<UserDepartment[]> {
    try {
      return await db.select()
        .from(userDepartments)
        .where(eq(userDepartments.userId, userId))
        .orderBy(asc(userDepartments.departmentName));
    } catch (error) {
      console.error('Error getting user departments:', error);
      return [];
    }
  }

  async updateUserDepartment(id: number, departmentData: Partial<InsertUserDepartment>): Promise<UserDepartment> {
    try {
      const [department] = await db.update(userDepartments)
        .set({ ...departmentData, updatedAt: new Date() })
        .where(eq(userDepartments.id, id))
        .returning();
      return department;
    } catch (error) {
      console.error('Error updating user department:', error);
      throw error;
    }
  }

  async deleteUserDepartment(id: number): Promise<void> {
    try {
      await db.delete(userDepartments).where(eq(userDepartments.id, id));
    } catch (error) {
      console.error('Error deleting user department:', error);
      throw error;
    }
  }

  // Polling agent participant operations
  async createPollingAgentParticipant(participantData: InsertPollingAgentParticipant): Promise<PollingAgentParticipant> {
    try {
      const [participant] = await db.insert(pollingAgentParticipants)
        .values(participantData)
        .returning();
      return participant;
    } catch (error) {
      console.error('Error creating polling agent participant:', error);
      throw error;
    }
  }

  async getPollingAgentParticipants(pollingAgentId: number): Promise<PollingAgentParticipant[]> {
    try {
      return await db.select()
        .from(pollingAgentParticipants)
        .where(eq(pollingAgentParticipants.pollingAgentId, pollingAgentId))
        .orderBy(asc(pollingAgentParticipants.joinedAt));
    } catch (error) {
      console.error('Error getting polling agent participants:', error);
      return [];
    }
  }

  async getPollingAgentParticipant(pollingAgentId: number, userId: string): Promise<PollingAgentParticipant | undefined> {
    try {
      const [participant] = await db.select()
        .from(pollingAgentParticipants)
        .where(and(
          eq(pollingAgentParticipants.pollingAgentId, pollingAgentId),
          eq(pollingAgentParticipants.userId, userId)
        ));
      return participant;
    } catch (error) {
      console.error('Error getting polling agent participant:', error);
      return undefined;
    }
  }

  async updatePollingAgentParticipant(id: number, participantData: Partial<InsertPollingAgentParticipant>): Promise<PollingAgentParticipant> {
    try {
      const [participant] = await db.update(pollingAgentParticipants)
        .set(participantData)
        .where(eq(pollingAgentParticipants.id, id))
        .returning();
      return participant;
    } catch (error) {
      console.error('Error updating polling agent participant:', error);
      throw error;
    }
  }

  async deletePollingAgentParticipant(id: number): Promise<void> {
    try {
      await db.delete(pollingAgentParticipants).where(eq(pollingAgentParticipants.id, id));
    } catch (error) {
      console.error('Error deleting polling agent participant:', error);
      throw error;
    }
  }

  // Email opt-out operations
  async createEmailOptOut(optOutData: InsertEmailOptOut): Promise<EmailOptOut> {
    try {
      const [optOut] = await db.insert(emailOptOuts)
        .values(optOutData)
        .returning();
      return optOut;
    } catch (error) {
      console.error('Error creating email opt-out:', error);
      throw error;
    }
  }

  async getEmailOptOut(email: string): Promise<EmailOptOut | undefined> {
    try {
      const [optOut] = await db.select()
        .from(emailOptOuts)
        .where(eq(emailOptOuts.email, email));
      return optOut;
    } catch (error) {
      console.error('Error getting email opt-out:', error);
      return undefined;
    }
  }

  async deleteEmailOptOut(id: number): Promise<void> {
    try {
      await db.delete(emailOptOuts).where(eq(emailOptOuts.id, id));
    } catch (error) {
      console.error('Error deleting email opt-out:', error);
      throw error;
    }
  }

  // Password reset token operations
  async createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken> {
    try {
      const [token] = await db.insert(passwordResetTokens)
        .values(tokenData)
        .returning();
      return token;
    } catch (error) {
      console.error('Error creating password reset token:', error);
      throw error;
    }
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    try {
      const [resetToken] = await db.select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false)
        ));
      return resetToken;
    } catch (error) {
      console.error('Error getting password reset token:', error);
      return undefined;
    }
  }

  async markPasswordResetTokenUsed(id: number): Promise<void> {
    try {
      await db.update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, id));
    } catch (error) {
      console.error('Error marking password reset token as used:', error);
      throw error;
    }
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    try {
      await db.delete(passwordResetTokens)
        .where(sql`expires_at < NOW()`);
    } catch (error) {
      console.error('Error deleting expired password reset tokens:', error);
      throw error;
    }
  }

  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    try {
      const result = await db.delete(passwordResetTokens)
        .where(sql`expires_at < NOW()`)
        .returning({ id: passwordResetTokens.id });
      return result.length;
    } catch (error) {
      console.error('Error cleaning up expired password reset tokens:', error);
      return 0;
    }
  }

  // Trust confirmation token operations
  async createTrustConfirmationToken(tokenData: InsertTrustConfirmationToken): Promise<TrustConfirmationToken> {
    try {
      const [token] = await db.insert(trustConfirmationTokens)
        .values(tokenData)
        .returning();
      return token;
    } catch (error) {
      console.error('Error creating trust confirmation token:', error);
      throw error;
    }
  }

  async getTrustConfirmationToken(token: string): Promise<TrustConfirmationToken | undefined> {
    try {
      const [confirmationToken] = await db.select()
        .from(trustConfirmationTokens)
        .where(and(
          eq(trustConfirmationTokens.token, token),
          eq(trustConfirmationTokens.used, false)
        ));
      return confirmationToken;
    } catch (error) {
      console.error('Error getting trust confirmation token:', error);
      return undefined;
    }
  }

  // Alias method for backward compatibility
  async getValidTrustConfirmationToken(token: string): Promise<TrustConfirmationToken | undefined> {
    try {
      const [confirmationToken] = await db.select()
        .from(trustConfirmationTokens)
        .where(and(
          eq(trustConfirmationTokens.token, token),
          eq(trustConfirmationTokens.used, false),
          sql`expires_at > NOW()` // Also check if token is not expired
        ));
      return confirmationToken;
    } catch (error) {
      console.error('Error getting valid trust confirmation token:', error);
      return undefined;
    }
  }

  async markTrustConfirmationTokenUsed(id: number): Promise<void> {
    try {
      await db.update(trustConfirmationTokens)
        .set({ used: true })
        .where(eq(trustConfirmationTokens.id, id));
    } catch (error) {
      console.error('Error marking trust confirmation token as used:', error);
      throw error;
    }
  }

  // Alias method for backward compatibility
  async markTrustConfirmationTokenAsUsed(id: number): Promise<void> {
    return this.markTrustConfirmationTokenUsed(id);
  }

  async deleteExpiredTrustConfirmationTokens(): Promise<void> {
    try {
      await db.delete(trustConfirmationTokens)
        .where(sql`expires_at < NOW()`);
    } catch (error) {
      console.error('Error deleting expired trust confirmation tokens:', error);
      throw error;
    }
  }

  async cleanupExpiredTrustConfirmationTokens(): Promise<number> {
    try {
      const result = await db.delete(trustConfirmationTokens)
        .where(sql`expires_at < NOW()`)
        .returning({ id: trustConfirmationTokens.id });
      return result.length;
    } catch (error) {
      console.error('Error cleaning up expired trust confirmation tokens:', error);
      return 0;
    }
  }

  async getOldPendingTrustRequests(beforeDate: Date): Promise<TrustConfirmationToken[]> {
    try {
      return await db.select()
        .from(trustConfirmationTokens)
        .where(and(
          eq(trustConfirmationTokens.used, false),
          sql`created_at < ${beforeDate.toISOString()}`
        ))
        .orderBy(desc(trustConfirmationTokens.createdAt));
    } catch (error) {
      console.error('Error getting old pending trust requests:', error);
      return [];
    }
  }

  // Helper methods
  async getCompanyDepartmentCount(companyId: number): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(companyDepartments)
        .where(eq(companyDepartments.companyId, companyId));
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting company department count:', error);
      return 0;
    }
  }

  // FAQ Organization operations
  async getFAQOrganizationByUser(userId: string): Promise<FAQOrganization | null> {
    try {
      const result = await db.select()
        .from(faqOrganizations)
        .where(eq(faqOrganizations.createdBy, userId))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting FAQ organization by user:', error);
      return null;
    }
  }

  async getFAQOrganizationByEmail(email: string): Promise<FAQOrganization | null> {
    try {
      const result = await db.select()
        .from(faqOrganizations)
        .where(eq(faqOrganizations.faqEmail, email))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting FAQ organization by email:', error);
      return null;
    }
  }

  async createFAQOrganization(organizationData: InsertFAQOrganization): Promise<FAQOrganization> {
    try {
      const result = await db.insert(faqOrganizations)
        .values(organizationData)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating FAQ organization:', error);
      throw error;
    }
  }

  async updateFAQOrganization(id: number, updateData: Partial<InsertFAQOrganization>): Promise<FAQOrganization> {
    try {
      const result = await db.update(faqOrganizations)
        .set({...updateData, updatedAt: new Date()})
        .where(eq(faqOrganizations.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating FAQ organization:', error);
      throw error;
    }
  }

  async deleteFAQOrganization(id: number): Promise<void> {
    try {
      await db.delete(faqOrganizations)
        .where(eq(faqOrganizations.id, id));
    } catch (error) {
      console.error('Error deleting FAQ organization:', error);
      throw error;
    }
  }

  // SOP Document operations
  async createSOPDocument(documentData: InsertSOPDocument): Promise<SOPDocument> {
    try {
      const result = await db.insert(sopDocuments)
        .values(documentData)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating SOP document:', error);
      throw error;
    }
  }

  async getSOPDocuments(organizationId: number): Promise<SOPDocument[]> {
    try {
      return await db.select()
        .from(sopDocuments)
        .where(eq(sopDocuments.organizationId, organizationId))
        .orderBy(desc(sopDocuments.createdAt));
    } catch (error) {
      console.error('Error getting SOP documents:', error);
      return [];
    }
  }

  async getSOPDocument(id: number): Promise<SOPDocument | null> {
    try {
      const result = await db.select()
        .from(sopDocuments)
        .where(eq(sopDocuments.id, id))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting SOP document:', error);
      return null;
    }
  }

  async updateSOPDocument(id: number, updateData: Partial<InsertSOPDocument>): Promise<SOPDocument> {
    try {
      const result = await db.update(sopDocuments)
        .set({...updateData, updatedAt: new Date()})
        .where(eq(sopDocuments.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating SOP document:', error);
      throw error;
    }
  }

  async deleteSOPDocument(id: number): Promise<void> {
    try {
      await db.delete(sopDocuments)
        .where(eq(sopDocuments.id, id));
    } catch (error) {
      console.error('Error deleting SOP document:', error);
      throw error;
    }
  }

  // FAQ Entry operations
  async createFAQEntry(entryData: InsertFAQEntry): Promise<FAQEntry> {
    try {
      const result = await db.insert(faqEntries)
        .values(entryData)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating FAQ entry:', error);
      throw error;
    }
  }

  async getFAQEntries(organizationId: number): Promise<FAQEntry[]> {
    try {
      return await db.select()
        .from(faqEntries)
        .where(eq(faqEntries.organizationId, organizationId))
        .orderBy(desc(faqEntries.createdAt));
    } catch (error) {
      console.error('Error getting FAQ entries:', error);
      return [];
    }
  }

  async getFAQEntry(id: number): Promise<FAQEntry | null> {
    try {
      const result = await db.select()
        .from(faqEntries)
        .where(eq(faqEntries.id, id))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error getting FAQ entry:', error);
      return null;
    }
  }

  async updateFAQEntry(id: number, updateData: Partial<InsertFAQEntry>): Promise<FAQEntry> {
    try {
      const result = await db.update(faqEntries)
        .set({...updateData, updatedAt: new Date()})
        .where(eq(faqEntries.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating FAQ entry:', error);
      throw error;
    }
  }

  async deleteFAQEntry(id: number): Promise<void> {
    try {
      await db.delete(faqEntries)
        .where(eq(faqEntries.id, id));
    } catch (error) {
      console.error('Error deleting FAQ entry:', error);
      throw error;
    }
  }

  // Intelligence Token operations (stub implementations)
  async createIntelligenceToken(tokenData: any): Promise<any> {
    try {
      const [token] = await db.insert(intelligenceTokens)
        .values(tokenData)
        .returning();
      return token;
    } catch (error) {
      console.error('Error creating intelligence token:', error);
      throw error;
    }
  }

  async getIntelligenceTokens(organizationId: string, timeframe: string = 'week'): Promise<any[]> {
    try {
      // Calculate date filter based on timeframe
      const now = new Date();
      let startDate = new Date();

      switch (timeframe) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 7); // Default to week
      }

      return await db.select()
        .from(intelligenceTokens)
        .where(and(
          eq(intelligenceTokens.organizationId, organizationId),
          sql`created_at >= ${startDate.toISOString()}`
        ))
        .orderBy(desc(intelligenceTokens.createdAt));
    } catch (error) {
      console.error('Error getting intelligence tokens:', error);
      return [];
    }
  }

  // Polling agent access control (stub implementations)
  async userHasAccessToPollingAgent(userId: string, pollingAgentId: number): Promise<boolean> {
    try {
      // Check if user is creator of the polling agent
      const agent = await this.getPollingAgent(pollingAgentId);
      if (agent?.createdBy === userId) {
        return true;
      }

      // Check if user is a participant
      const participant = await this.getPollingAgentParticipant(pollingAgentId, userId);
      return participant !== undefined;
    } catch (error) {
      console.error('Error checking user access to polling agent:', error);
      return false;
    }
  }

  async userHasAdminAccessToPollingAgent(userId: string, pollingAgentId: number): Promise<boolean> {
    try {
      // Check if user is creator of the polling agent
      const agent = await this.getPollingAgent(pollingAgentId);
      if (agent?.createdBy === userId) {
        return true;
      }

      // Check if user is a participant with admin role
      const participant = await this.getPollingAgentParticipant(pollingAgentId, userId);
      return participant?.role === 'admin' || participant?.role === 'owner';
    } catch (error) {
      console.error('Error checking user admin access to polling agent:', error);
      return false;
    }
  }

  // Task assignee operations (stub implementations)
  async addTaskAssignee(assigneeData: any): Promise<any> {
    try {
      return await this.assignTask(assigneeData);
    } catch (error) {
      console.error('Error adding task assignee:', error);
      throw error;
    }
  }

  async removeTaskAssignee(taskId: number, userId: string): Promise<void> {
    try {
      return await this.unassignTask(taskId, userId);
    } catch (error) {
      console.error('Error removing task assignee:', error);
      throw error;
    }
  }

  // Trust relationship analytics (stub implementations)
  async getRecentBlockingActivity(sinceDate: Date): Promise<any[]> {
    try {
      return await db.select()
        .from(userTrustRelationships)
        .where(and(
          eq(userTrustRelationships.trustStatus, 'blocked'),
          sql`created_at >= ${sinceDate.toISOString()}`
        ))
        .orderBy(desc(userTrustRelationships.createdAt));
    } catch (error) {
      console.error('Error getting recent blocking activity:', error);
      return [];
    }
  }

  async getRecentTrustActivity(sinceDate: Date): Promise<any[]> {
    try {
      return await db.select()
        .from(userTrustRelationships)
        .where(and(
          eq(userTrustRelationships.trustStatus, 'trusted'),
          sql`created_at >= ${sinceDate.toISOString()}`
        ))
        .orderBy(desc(userTrustRelationships.createdAt));
    } catch (error) {
      console.error('Error getting recent trust activity:', error);
      return [];
    }
  }

  async getTrustRelationshipStats(): Promise<{ blocks: number; trusts: number; pending: number }> {
    try {
      const [blocksResult] = await db.select({ count: sql<number>`count(*)` })
        .from(userTrustRelationships)
        .where(eq(userTrustRelationships.trustStatus, 'blocked'));

      const [trustsResult] = await db.select({ count: sql<number>`count(*)` })
        .from(userTrustRelationships)
        .where(eq(userTrustRelationships.trustStatus, 'trusted'));

      const [pendingResult] = await db.select({ count: sql<number>`count(*)` })
        .from(userTrustRelationships)
        .where(eq(userTrustRelationships.trustStatus, 'pending'));

      return {
        blocks: blocksResult?.count || 0,
        trusts: trustsResult?.count || 0,
        pending: pendingResult?.count || 0
      };
    } catch (error) {
      console.error('Error getting trust relationship stats:', error);
      return { blocks: 0, trusts: 0, pending: 0 };
    }
  }

  async deleteTrustRelationship(userId: string, trustedUserId: string): Promise<void> {
    try {
      await db.delete(userTrustRelationships)
        .where(and(
          eq(userTrustRelationships.userId, userId),
          eq(userTrustRelationships.trustedUserId, trustedUserId)
        ));
    } catch (error) {
      console.error('Error deleting trust relationship:', error);
      throw error;
    }
  }

  // Project query operations (stub implementations)
  async getProjects(): Promise<Project[]> {
    try {
      return await db.select()
        .from(projects)
        .orderBy(desc(projects.createdAt));
    } catch (error) {
      console.error('Error getting all projects:', error);
      return [];
    }
  }

  async getProjectsByName(name: string): Promise<Project[]> {
    try {
      return await db.select()
        .from(projects)
        .where(eq(projects.name, name))
        .orderBy(desc(projects.createdAt));
    } catch (error) {
      console.error('Error getting projects by name:', error);
      return [];
    }
  }

  // User department operations (stub implementations)
  async getUserDepartment(userId: string, departmentName: string): Promise<UserDepartment | undefined> {
    try {
      const [department] = await db.select()
        .from(userDepartments)
        .where(and(
          eq(userDepartments.userId, userId),
          eq(userDepartments.departmentName, departmentName)
        ));
      return department;
    } catch (error) {
      console.error('Error getting user department:', error);
      return undefined;
    }
  }

  // Department submissions (stub implementations)
  async getSubmissionsByDepartment(departmentName: string): Promise<any[]> {
    try {
      // Query t5t submissions that have department metadata
      return await db.select()
        .from(t5tSubmissions)
        .where(sql`department_name = ${departmentName}`)
        .orderBy(desc(t5tSubmissions.submissionDate));
    } catch (error) {
      console.error('Error getting submissions by department:', error);
      return [];
    }
  }

  // Email attachment operations (stub implementations)
  async createEmailAttachment(attachmentData: any): Promise<any> {
    try {
      const [attachment] = await db.insert(emailAttachments)
        .values(attachmentData)
        .returning();
      return attachment;
    } catch (error) {
      console.error('Error creating email attachment:', error);
      throw error;
    }
  }

  async getEmailAttachments(emailId: number): Promise<any[]> {
    try {
      // Note: emailAttachments table doesn't have emailId field, it has emailMessageId
      // This method is not properly implemented yet
      console.warn('getEmailAttachments is not properly implemented - schema mismatch');
      return [];
    } catch (error) {
      console.error('Error getting email attachments:', error);
      return [];
    }
  }

  async getEmailAttachment(id: number): Promise<any | undefined> {
    try {
      const [attachment] = await db.select()
        .from(emailAttachments)
        .where(eq(emailAttachments.id, id));
      return attachment;
    } catch (error) {
      console.error('Error getting email attachment:', error);
      return undefined;
    }
  }

  async getEmailAttachmentByMessageAndFilename(messageId: string, filename: string): Promise<any | undefined> {
    try {
      const [attachment] = await db.select()
        .from(emailAttachments)
        .where(and(
          eq(emailAttachments.emailMessageId, messageId),
          eq(emailAttachments.filename, filename)
        ));
      return attachment;
    } catch (error) {
      console.error('Error getting email attachment by message and filename:', error);
      return undefined;
    }
  }

  async updateEmailAttachment(id: number, updateData: any): Promise<any> {
    try {
      const [attachment] = await db.update(emailAttachments)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(emailAttachments.id, id))
        .returning();
      return attachment;
    } catch (error) {
      console.error('Error updating email attachment:', error);
      throw error;
    }
  }

  async deleteEmailAttachment(id: number): Promise<void> {
    try {
      await db.delete(emailAttachments)
        .where(eq(emailAttachments.id, id));
    } catch (error) {
      console.error('Error deleting email attachment:', error);
      throw error;
    }
  }

  async getEmailAttachmentsByProject(projectId: number): Promise<any[]> {
    try {
      // Get all emails for the project first
      const projectEmails = await this.getProjectEmails(projectId);
      const emailIds = projectEmails.map(email => email.id);

      if (emailIds.length === 0) {
        return [];
      }

      // Note: emailAttachments table doesn't have emailId field, it has emailMessageId
      // This method needs to be reimplemented to match the schema
      console.warn('getEmailAttachmentsByProject not fully implemented - schema mismatch');
      return [];
    } catch (error) {
      console.error('Error getting email attachments by project:', error);
      return [];
    }
  }

  async updateEmailAttachmentAnalysis(id: number, analysisData: any): Promise<any> {
    try {
      console.log('[DB] Updating attachment analysis for ID:', id);
      console.log('[DB] Analysis data:', JSON.stringify(analysisData, null, 2));

      const result = await db.update(emailAttachments)
        .set({
          analysis: analysisData,
          updatedAt: new Date()
        })
        .where(eq(emailAttachments.id, id))
        .returning();

      console.log('[DB] Update successful');
      return result[0];
    } catch (error) {
      console.error('Error updating email attachment analysis:', error);
      console.error('Error details:', {
        id,
        analysisDataKeys: Object.keys(analysisData || {}),
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // User creation and authentication methods
  async createUserFromEmail(email: string, additionalData?: any): Promise<User | undefined> {
    try {
      // Check if user already exists
      const existing = await this.getUserByEmail(email);
      if (existing) {
        return existing;
      }

      // Create new user with email
      const userData: UpsertUser = {
        id: additionalData?.id || `user_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        email,
        firstName: additionalData?.firstName || email.split('@')[0],
        lastName: additionalData?.lastName || '',
        profileImageUrl: additionalData?.profileImageUrl || null
      };

      return await this.createUser(userData);
    } catch (error) {
      console.error('Error creating user from email:', error);
      return undefined;
    }
  }

  async getUserByEmailWithPassword(email: string): Promise<User | undefined> {
    try {
      // This is a stub - password authentication is not implemented yet
      return await this.getUserByEmail(email);
    } catch (error) {
      console.error('Error getting user by email with password:', error);
      return undefined;
    }
  }

  async getLinkedAccountByProvider(provider: string, providerAccountId: string): Promise<UserLinkedAccount | undefined> {
    try {
      const [account] = await db.select()
        .from(userLinkedAccounts)
        .where(and(
          eq(userLinkedAccounts.provider, provider),
          eq(userLinkedAccounts.providerAccountId, providerAccountId)
        ));
      return account;
    } catch (error) {
      console.error('Error getting linked account by provider:', error);
      return undefined;
    }
  }

  async deleteLinkedAccount(accountId: number): Promise<void> {
    try {
      await db.delete(userLinkedAccounts)
        .where(eq(userLinkedAccounts.id, accountId));
    } catch (error) {
      console.error('Error deleting linked account:', error);
      throw error;
    }
  }

  // Company invitation methods
  async getCompanyInvitationByEmail(companyId: number, email: string): Promise<CompanyInvitation | undefined> {
    try {
      const [invitation] = await db.select()
        .from(companyInvitations)
        .where(and(
          eq(companyInvitations.companyId, companyId),
          eq(companyInvitations.inviteeEmail, email)
        ));
      return invitation;
    } catch (error) {
      console.error('Error getting company invitation by email:', error);
      return undefined;
    }
  }

  async acceptCompanyInvitation(invitationId: number, userId: string): Promise<CompanyMembership> {
    try {
      // Get the invitation
      const invitation = await this.getCompanyInvitation(invitationId);
      if (!invitation) {
        throw new Error('Invitation not found');
      }

      // Create company membership
      const membership = await this.createCompanyMembership({
        companyId: invitation.companyId,
        userId,
        role: invitation.role || 'member'
      });

      // Mark invitation as accepted
      await this.updateCompanyInvitation(invitationId, {
        status: 'accepted',
        respondedAt: new Date()
      });

      return membership;
    } catch (error) {
      console.error('Error accepting company invitation:', error);
      throw error;
    }
  }

  // FAQ methods
  async getSOPDocumentsByOrganization(organizationId: number): Promise<SOPDocument[]> {
    try {
      return await this.getSOPDocuments(organizationId);
    } catch (error) {
      console.error('Error getting SOP documents by organization:', error);
      return [];
    }
  }

  async getFAQEntriesByOrganization(organizationId: number): Promise<FAQEntry[]> {
    try {
      return await this.getFAQEntries(organizationId);
    } catch (error) {
      console.error('Error getting FAQ entries by organization:', error);
      return [];
    }
  }

  // Notification preferences methods
  async upsertNotificationPreferences(userId: string, preferences: any): Promise<NotificationPreferences> {
    try {
      const existing = await this.getUserNotificationPreferences(userId);

      if (existing) {
        return await this.updateNotificationPreferences(existing.id, preferences);
      } else {
        return await this.createNotificationPreferences({
          userId,
          ...preferences
        });
      }
    } catch (error) {
      console.error('Error upserting notification preferences:', error);
      throw error;
    }
  }

  // Polling agent methods
  async getPollingAgentsForUser(userId: string): Promise<PollingAgent[]> {
    try {
      return await this.getPollingAgents(userId);
    } catch (error) {
      console.error('Error getting polling agents for user:', error);
      return [];
    }
  }

  async getT5tSubmissionsCount(pollingAgentId: number): Promise<number> {
    try {
      const [result] = await db.select({ count: sql<number>`count(*)` })
        .from(t5tSubmissions)
        .where(eq(t5tSubmissions.pollingAgentId, pollingAgentId));
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting T5T submissions count:', error);
      return 0;
    }
  }

  async getT5tSubmission(id: number): Promise<T5tSubmission | undefined> {
    try {
      const [submission] = await db.select()
        .from(t5tSubmissions)
        .where(eq(t5tSubmissions.id, id));
      return submission;
    } catch (error) {
      console.error('Error getting T5T submission:', error);
      return undefined;
    }
  }

  async deleteT5tSubmission(id: number): Promise<void> {
    try {
      await db.delete(t5tSubmissions)
        .where(eq(t5tSubmissions.id, id));
    } catch (error) {
      console.error('Error deleting T5T submission:', error);
      throw error;
    }
  }

  // Project methods
  async getProjectParticipant(projectId: number, userId: string): Promise<ProjectParticipant | undefined> {
    try {
      const [participant] = await db.select()
        .from(projectParticipants)
        .where(and(
          eq(projectParticipants.projectId, projectId),
          eq(projectParticipants.userId, userId)
        ));
      return participant;
    } catch (error) {
      console.error('Error getting project participant:', error);
      return undefined;
    }
  }

  async getProjectOriginalEmail(projectId: number): Promise<ProcessedEmail | undefined> {
    try {
      // Get the first email for the project
      const emails = await this.getProjectEmails(projectId);
      return emails[0];
    } catch (error) {
      console.error('Error getting project original email:', error);
      return undefined;
    }
  }

  async getUserTasks(userId: string, companyId?: number): Promise<Task[]> {
    try {
      return await this.getUserAssignedTasks(userId, companyId);
    } catch (error) {
      console.error('Error getting user tasks:', error);
      return [];
    }
  }

  // User stats method
  async getUserStats(userId: string): Promise<any> {
    try {
      const [projectCount] = await db.select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(eq(projects.createdBy, userId));

      // Note: tasks table doesn't have assignedTo field, uses task_assignees table instead
      const taskAssignments = await db.select({ count: sql<number>`count(DISTINCT ${taskAssignees.taskId})` })
        .from(taskAssignees)
        .where(eq(taskAssignees.userId, userId));

      return {
        projectCount: projectCount?.count || 0,
        taskCount: taskAssignments[0]?.count || 0
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return { projectCount: 0, taskCount: 0 };
    }
  }

  // Document Analysis Result operations
  async createDocumentAnalysisResult(resultData: any): Promise<any> {
    try {
      const [result] = await db.insert(documentAnalysisResults)
        .values(resultData)
        .returning();
      return result;
    } catch (error) {
      console.error('Error creating document analysis result:', error);
      throw error;
    }
  }

  async getDocumentAnalysisResults(userId: string, limit: number = 20): Promise<any[]> {
    try {
      return await db.select()
        .from(documentAnalysisResults)
        .where(eq(documentAnalysisResults.userId, userId))
        .orderBy(desc(documentAnalysisResults.processedAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting document analysis results:', error);
      return [];
    }
  }

  async getDocumentAnalysisResult(id: number): Promise<any | undefined> {
    try {
      const [result] = await db.select()
        .from(documentAnalysisResults)
        .where(eq(documentAnalysisResults.id, id));
      return result;
    } catch (error) {
      console.error('Error getting document analysis result:', error);
      return undefined;
    }
  }

  async getDocumentAnalysisResultByMessageId(messageId: string): Promise<any | undefined> {
    try {
      
      const [result] = await db.select()
        .from(documentAnalysisResults)
        .where(eq(documentAnalysisResults.messageId, messageId));
      return result;
    } catch (error) {
      console.error('Error getting document analysis result by message ID:', error);
      return undefined;
    }
  }

  async updateDocumentAnalysisResult(id: number, updateData: any): Promise<any> {
    try {
      
      const [result] = await db.update(documentAnalysisResults)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(documentAnalysisResults.id, id))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating document analysis result:', error);
      throw error;
    }
  }

  async deleteDocumentAnalysisResult(id: number): Promise<void> {
    try {
      await db.delete(documentAnalysisResults)
        .where(eq(documentAnalysisResults.id, id));
    } catch (error) {
      console.error('Error deleting document analysis result:', error);
      throw error;
    }
  }

  // Polly polling methods (stub implementations)
  async createPoll(pollData: any): Promise<any> {
    console.warn('createPoll is not implemented yet');
    return null;
  }

  async getPoll(pollId: number): Promise<any> {
    console.warn('getPoll is not implemented yet');
    return null;
  }

  async getPollByMessageId(messageId: string): Promise<any> {
    console.warn('getPollByMessageId is not implemented yet');
    return null;
  }

  async canUserVote(pollId: number, userId: string): Promise<boolean> {
    console.warn('canUserVote is not implemented yet');
    return false;
  }

  async createVote(voteData: any): Promise<any> {
    console.warn('createVote is not implemented yet');
    return null;
  }

  async getPollResults(pollId: number): Promise<any> {
    console.warn('getPollResults is not implemented yet');
    return null;
  }
}
