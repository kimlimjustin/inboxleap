import type {
  User,
  UpsertUser,
  Project,
  InsertProject,
  Task,
  InsertTask,
  TaskAssignee,
  InsertTaskAssignee,
  EmailCredentials,
  InsertEmailCredentials,
  ProcessedEmail,
  InsertProcessedEmail,
  ProjectParticipant,
  InsertProjectParticipant,
  UserTrustRelationship,
  InsertUserTrustRelationship,
  NotificationPreferences,
  InsertNotificationPreferences,
  PollingAgent,
  InsertPollingAgent,
  T5tSubmission,
  InsertT5tSubmission,
  PollingInsight,
  InsertPollingInsight,
  UserDepartment,
  InsertUserDepartment,
  PollingAgentParticipant,
  InsertPollingAgentParticipant,
  EmailOptOut,
  InsertEmailOptOut,
  PasswordResetToken,
  InsertPasswordResetToken,
  TrustConfirmationToken,
  InsertTrustConfirmationToken,
  UserLinkedAccount,
  InsertUserLinkedAccount,
  Company,
  InsertCompany,
  CompanyMembership,
  InsertCompanyMembership,
  CompanyInvitation,
  InsertCompanyInvitation,
  CompanyDepartment,
  InsertCompanyDepartment,
  CompanyHierarchy,
  InsertCompanyHierarchy,
  CompanyAgentEmail,
  InsertCompanyAgentEmail,
  CompanyAgentSettings,
  InsertCompanyAgentSettings,
  UserAgentEmail,
  InsertUserAgentEmail,
  FAQOrganization,
  InsertFAQOrganization,
  SOPDocument,
  InsertSOPDocument,
  FAQEntry,
  InsertFAQEntry,
} from '@email-task-router/shared';

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  createUser(userData: UpsertUser): Promise<User>;
  updateUser(id: string, userData: Partial<UpsertUser>): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  
  // User authentication operations
  createUserLinkedAccount(accountData: InsertUserLinkedAccount): Promise<UserLinkedAccount>;
  getUserLinkedAccounts(userId: string): Promise<UserLinkedAccount[]>;
  getUserByProviderAccount(provider: string, providerAccountId: string): Promise<User | undefined>;
  updateLinkedAccountLastUsed(accountId: number): Promise<void>;
  
  // Project operations
  createProject(projectData: InsertProject): Promise<Project>;
  getUserProjects(userId: string, companyId?: number): Promise<Project[]>;
  getProjectsByCreator(userId: string): Promise<Project[]>; // TEMPORARY: Get all projects created by user
  getIdentityProjects(identityId: number): Promise<Project[]>; // Get projects for an identity
  getProjectsWhereUserIsParticipant(userId: string): Promise<Project[]>; // Get projects where user is a participant
  getProject(id: number): Promise<Project | undefined>;
  findProjectByThreadId(threadId: string): Promise<Project | null>;
  findProjectByTopicAndParticipants(topic: string, participants: string[]): Promise<Project | null>;
  getProjectTasks(projectId: number): Promise<Task[]>;
  updateProject(id: number, projectData: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;
  
  // Project participant operations
  addProjectParticipant(participantData: InsertProjectParticipant): Promise<ProjectParticipant>;
  getProjectParticipants(projectId: number): Promise<ProjectParticipant[]>;
  removeProjectParticipant(projectId: number, userId: string): Promise<void>;
  isUserProjectParticipant(projectId: number, userId: string): Promise<boolean>;
  
  // Task operations
  createTask(taskData: InsertTask): Promise<Task>;
  getTasks(projectId: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  updateTask(id: number, taskData: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  
  // Task assignee operations
  assignTask(assignmentData: InsertTaskAssignee): Promise<TaskAssignee>;
  getTaskAssignees(taskId: number): Promise<TaskAssignee[]>;
  unassignTask(taskId: number, userId: string): Promise<void>;
  
  // User task query operations
  getUserAssignedTasks(userId: string, companyId?: number): Promise<Task[]>;
  getTasksAssignedByUser(userId: string, companyId?: number): Promise<Task[]>;
  getUserMonitorTasks(userId: string, companyId?: number): Promise<Task[]>;
  getUserDoneTasks(userId: string, companyId?: number): Promise<Task[]>;
  getTasksWithAssignees(projectId: number): Promise<Task[]>;
  getProjectEmails(projectId: number): Promise<ProcessedEmail[]>;
  
  // Email credentials operations
  createEmailCredentials(credentialsData: InsertEmailCredentials): Promise<EmailCredentials>;
  getUserEmailCredentials(userId: string): Promise<EmailCredentials[]>;
  getEmailCredentials(id: number): Promise<EmailCredentials | undefined>;
  updateEmailCredentials(id: number, credentialsData: Partial<InsertEmailCredentials>): Promise<EmailCredentials>;
  deleteEmailCredentials(id: number): Promise<void>;
  
  // Processed email operations
  createProcessedEmail(emailData: InsertProcessedEmail): Promise<ProcessedEmail>;
  getProcessedEmailByMessageId(messageId: string): Promise<ProcessedEmail | undefined>;
  getRecentProcessedEmails(limit?: number): Promise<ProcessedEmail[]>;
  updateProcessedEmail(id: number, emailData: Partial<InsertProcessedEmail>): Promise<ProcessedEmail>;
  
  // User trust relationship operations
  createUserTrustRelationship(relationshipData: InsertUserTrustRelationship): Promise<UserTrustRelationship>;
  getUserTrustRelationship(userId: string, trustedUserId: string): Promise<UserTrustRelationship | undefined>;
  updateUserTrustRelationship(id: number, relationshipData: Partial<InsertUserTrustRelationship>): Promise<UserTrustRelationship>;
  getUserTrustRelationships(userId: string): Promise<UserTrustRelationship[]>;
  getUsersBlockedByMany(threshold: number): Promise<Array<{ email: string; blockCount: number }>>;
  getUsersWhoBlockMany(threshold: number): Promise<Array<{ email: string; blockCount: number }>>;
  
  // Notification preferences operations
  createNotificationPreferences(preferencesData: InsertNotificationPreferences): Promise<NotificationPreferences>;
  getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  updateNotificationPreferences(id: number, preferencesData: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences>;
  
  // Polling agent operations
  createPollingAgent(agentData: InsertPollingAgent): Promise<PollingAgent>;
  getPollingAgents(userId?: string): Promise<PollingAgent[]>;
  getPollingAgentsForCompany(companyId: number): Promise<PollingAgent[]>;
  getPollingAgent(id: number): Promise<PollingAgent | undefined>;
  getPollingAgentByEmail(email: string): Promise<PollingAgent | undefined>;
  getAllIntelligenceAgents(userId?: string): Promise<PollingAgent[]>;
  updatePollingAgent(id: number, agentData: Partial<InsertPollingAgent>): Promise<PollingAgent>;
  deletePollingAgent(id: number): Promise<void>;
  
  // T5T submission operations
  createT5tSubmission(submissionData: InsertT5tSubmission): Promise<T5tSubmission>;
  getT5tSubmissionByMessageId(messageId: string): Promise<T5tSubmission | undefined>;
  getT5tSubmissions(pollingAgentId: number, options?: { limit?: number; period?: string }): Promise<T5tSubmission[]>;
  updateT5tSubmission(id: number, submissionData: Partial<InsertT5tSubmission>): Promise<T5tSubmission>;
  
  // Polling insight operations
  createPollingInsight(insightData: InsertPollingInsight): Promise<PollingInsight>;
  getPollingInsights(pollingAgentId: number, options?: { limit?: number; period?: string }): Promise<PollingInsight[]>;
  updatePollingInsight(id: number, insightData: Partial<InsertPollingInsight>): Promise<PollingInsight>;
  incrementInsightViewCount(id: number): Promise<void>;
  
  // User department operations
  createUserDepartment(departmentData: InsertUserDepartment): Promise<UserDepartment>;
  getUserDepartments(userId: string): Promise<UserDepartment[]>;
  updateUserDepartment(id: number, departmentData: Partial<InsertUserDepartment>): Promise<UserDepartment>;
  deleteUserDepartment(id: number): Promise<void>;
  
  // Polling agent participant operations
  createPollingAgentParticipant(participantData: InsertPollingAgentParticipant): Promise<PollingAgentParticipant>;
  getPollingAgentParticipants(pollingAgentId: number): Promise<PollingAgentParticipant[]>;
  getPollingAgentParticipant(pollingAgentId: number, userId: string): Promise<PollingAgentParticipant | undefined>;
  updatePollingAgentParticipant(id: number, participantData: Partial<InsertPollingAgentParticipant>): Promise<PollingAgentParticipant>;
  deletePollingAgentParticipant(id: number): Promise<void>;
  
  // Email opt-out operations
  createEmailOptOut(optOutData: InsertEmailOptOut): Promise<EmailOptOut>;
  getEmailOptOut(email: string): Promise<EmailOptOut | undefined>;
  deleteEmailOptOut(id: number): Promise<void>;
  
  // Password reset token operations
  createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  cleanupExpiredPasswordResetTokens(): Promise<number>;
  
  // Trust confirmation token operations
  createTrustConfirmationToken(tokenData: InsertTrustConfirmationToken): Promise<TrustConfirmationToken>;
  getTrustConfirmationToken(token: string): Promise<TrustConfirmationToken | undefined>;
  markTrustConfirmationTokenUsed(id: number): Promise<void>;
  deleteExpiredTrustConfirmationTokens(): Promise<void>;
  cleanupExpiredTrustConfirmationTokens(): Promise<number>;
  getOldPendingTrustRequests(beforeDate: Date): Promise<TrustConfirmationToken[]>;
  
  // Company operations
  createCompany(companyData: InsertCompany): Promise<Company>;
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyByEmail(email: string): Promise<Company | undefined>;
  updateCompany(id: number, companyData: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: number): Promise<void>;
  
  // Company membership operations
  createCompanyMembership(membershipData: InsertCompanyMembership): Promise<CompanyMembership>;
  getCompanyMembership(companyId: number, userId: string): Promise<CompanyMembership | undefined>;
  getCompanyMemberships(companyId: number): Promise<CompanyMembership[]>;
  getUserCompanyMemberships(userId: string): Promise<CompanyMembership[]>;
  updateCompanyMembership(id: number, membershipData: Partial<InsertCompanyMembership>): Promise<CompanyMembership>;
  deleteCompanyMembership(id: number): Promise<void>;
  
  // Company invitation operations
  createCompanyInvitation(invitationData: InsertCompanyInvitation): Promise<CompanyInvitation>;
  getCompanyInvitation(id: number): Promise<CompanyInvitation | undefined>;
  getCompanyInvitationByToken(token: string): Promise<CompanyInvitation | undefined>;
  getCompanyInvitations(companyId: number): Promise<CompanyInvitation[]>;
  getPendingCompanyInvitations(email: string): Promise<CompanyInvitation[]>;
  updateCompanyInvitation(id: number, invitationData: Partial<InsertCompanyInvitation>): Promise<CompanyInvitation>;
  deleteCompanyInvitation(id: number): Promise<void>;
  
  // Company department operations
  createCompanyDepartment(departmentData: InsertCompanyDepartment): Promise<CompanyDepartment>;
  getCompanyDepartments(companyId: number): Promise<CompanyDepartment[]>;
  getCompanyDepartment(id: number): Promise<CompanyDepartment | undefined>;
  updateCompanyDepartment(id: number, departmentData: Partial<InsertCompanyDepartment>): Promise<CompanyDepartment>;
  deleteCompanyDepartment(id: number): Promise<void>;
  
  // Company hierarchy operations
  upsertCompanyHierarchy(hierarchyData: InsertCompanyHierarchy): Promise<CompanyHierarchy>;
  getCompanyHierarchies(companyId: number): Promise<CompanyHierarchy[]>;
  getSubCompanies(parentCompanyId: number): Promise<Company[]>;
  
  // Company Agent Email operations
  createCompanyAgentEmail(emailData: InsertCompanyAgentEmail): Promise<CompanyAgentEmail>;
  getCompanyAgentEmails(companyId: number): Promise<CompanyAgentEmail[]>;
  getCompanyAgentEmail(companyId: number, agentType: string, instanceName?: string): Promise<CompanyAgentEmail | null>;
  getCompanyAgentEmailByAddress(emailAddress: string): Promise<CompanyAgentEmail | null>;
  getCompanyAgentEmailsForAgent(companyId: number, agentType: string): Promise<CompanyAgentEmail[]>;
  getAllGlobalAgentEmails(agentType: string): Promise<CompanyAgentEmail[]>;
  updateCompanyAgentEmail(id: number, updateData: Partial<InsertCompanyAgentEmail>): Promise<CompanyAgentEmail>;
  deleteCompanyAgentEmail(id: number): Promise<void>;
  generateDefaultAgentEmail(companyName: string, agentType: string, instanceName?: string): string;
  
  // Company Agent Settings operations
  createCompanyAgentSettings(settingsData: InsertCompanyAgentSettings): Promise<CompanyAgentSettings>;
  getCompanyAgentSettings(companyId: number, agentType: string): Promise<CompanyAgentSettings | null>;
  updateCompanyAgentSettings(id: number, updateData: Partial<InsertCompanyAgentSettings>): Promise<CompanyAgentSettings>;
  deleteCompanyAgentSettings(id: number): Promise<void>;

  // User Agent Email operations
  createUserAgentEmail(emailData: InsertUserAgentEmail): Promise<UserAgentEmail>;
  getUserAgentEmails(userId: string): Promise<UserAgentEmail[]>;
  getUserAgentEmail(userId: string, agentType: string, instanceName?: string): Promise<UserAgentEmail | null>;
  getUserAgentEmailById(id: number): Promise<UserAgentEmail | null>;
  getUserAgentEmailByAddress(emailAddress: string): Promise<UserAgentEmail | null>;
  getUserAgentEmailsForAgent(userId: string, agentType: string): Promise<UserAgentEmail[]>;
  updateUserAgentEmail(id: number, updateData: Partial<InsertUserAgentEmail>): Promise<UserAgentEmail>;
  deleteUserAgentEmail(id: number): Promise<void>;
  generateDefaultAgentEmailForUser(userId: string, agentType: string, instanceName?: string): string;

  // Helper methods
  getCompanyDepartmentCount(companyId: number): Promise<number>;

  // FAQ Organization operations
  getFAQOrganizationByUser(userId: string): Promise<FAQOrganization | null>;
  getFAQOrganizationByEmail(email: string): Promise<FAQOrganization | null>;
  createFAQOrganization(organizationData: InsertFAQOrganization): Promise<FAQOrganization>;
  updateFAQOrganization(id: number, updateData: Partial<InsertFAQOrganization>): Promise<FAQOrganization>;
  deleteFAQOrganization(id: number): Promise<void>;

  // SOP Document operations
  createSOPDocument(documentData: InsertSOPDocument): Promise<SOPDocument>;
  getSOPDocuments(organizationId: number): Promise<SOPDocument[]>;
  getSOPDocument(id: number): Promise<SOPDocument | null>;
  updateSOPDocument(id: number, updateData: Partial<InsertSOPDocument>): Promise<SOPDocument>;
  deleteSOPDocument(id: number): Promise<void>;

  // FAQ Entry operations
  createFAQEntry(entryData: InsertFAQEntry): Promise<FAQEntry>;
  getFAQEntries(organizationId: number): Promise<FAQEntry[]>;
  getFAQEntry(id: number): Promise<FAQEntry | null>;
  updateFAQEntry(id: number, updateData: Partial<InsertFAQEntry>): Promise<FAQEntry>;
  deleteFAQEntry(id: number): Promise<void>;
}