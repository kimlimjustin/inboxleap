import { relations } from "drizzle-orm/relations";
import { users, notificationPreferences, pollingAgents, companies, pollingInsights, projects, processedEmails, projectParticipants, emailCredentials, tasks, taskAssignees, t5TSubmissions, pollingAgentParticipants, userDepartments, userTrustRelationships, faqOrganizations, sopDocuments, faqEntries, emailAttachments, trustConfirmationTokens, passwordResetTokens, userLinkedAccounts, companyDepartments, companyHierarchy, companyMemberships } from "./schema";

export const notificationPreferencesRelations = relations(notificationPreferences, ({one}) => ({
	user: one(users, {
		fields: [notificationPreferences.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	notificationPreferences: many(notificationPreferences),
	pollingAgents: many(pollingAgents),
	projectParticipants: many(projectParticipants),
	emailCredentials: many(emailCredentials),
	taskAssignees: many(taskAssignees),
	t5TSubmissions: many(t5TSubmissions),
	tasks: many(tasks),
	pollingAgentParticipants: many(pollingAgentParticipants),
	userDepartments: many(userDepartments),
	userTrustRelationships_userId: many(userTrustRelationships, {
		relationName: "userTrustRelationships_userId_users_id"
	}),
	userTrustRelationships_trustedUserId: many(userTrustRelationships, {
		relationName: "userTrustRelationships_trustedUserId_users_id"
	}),
	faqOrganizations: many(faqOrganizations),
	sopDocuments: many(sopDocuments),
	faqEntries: many(faqEntries),
	trustConfirmationTokens_inviterUserId: many(trustConfirmationTokens, {
		relationName: "trustConfirmationTokens_inviterUserId_users_id"
	}),
	trustConfirmationTokens_targetUserId: many(trustConfirmationTokens, {
		relationName: "trustConfirmationTokens_targetUserId_users_id"
	}),
	passwordResetTokens: many(passwordResetTokens),
	userLinkedAccounts: many(userLinkedAccounts),
	companyDepartments: many(companyDepartments),
	companyHierarchies_employeeUserId: many(companyHierarchy, {
		relationName: "companyHierarchy_employeeUserId_users_id"
	}),
	companyHierarchies_managerUserId: many(companyHierarchy, {
		relationName: "companyHierarchy_managerUserId_users_id"
	}),
	companyMemberships: many(companyMemberships),
	companies: many(companies),
	projects: many(projects),
}));

export const pollingAgentsRelations = relations(pollingAgents, ({one, many}) => ({
	user: one(users, {
		fields: [pollingAgents.createdBy],
		references: [users.id]
	}),
	company: one(companies, {
		fields: [pollingAgents.companyId],
		references: [companies.id]
	}),
	pollingInsights: many(pollingInsights),
	t5TSubmissions: many(t5TSubmissions),
	pollingAgentParticipants: many(pollingAgentParticipants),
}));

export const companiesRelations = relations(companies, ({one, many}) => ({
	pollingAgents: many(pollingAgents),
	tasks: many(tasks),
	companyDepartments: many(companyDepartments),
	companyHierarchies: many(companyHierarchy),
	companyMemberships: many(companyMemberships),
	user: one(users, {
		fields: [companies.createdBy],
		references: [users.id]
	}),
	projects: many(projects),
}));

export const pollingInsightsRelations = relations(pollingInsights, ({one}) => ({
	pollingAgent: one(pollingAgents, {
		fields: [pollingInsights.pollingAgentId],
		references: [pollingAgents.id]
	}),
}));

export const processedEmailsRelations = relations(processedEmails, ({one}) => ({
	project: one(projects, {
		fields: [processedEmails.projectId],
		references: [projects.id]
	}),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	processedEmails: many(processedEmails),
	projectParticipants: many(projectParticipants),
	tasks: many(tasks),
	emailAttachments: many(emailAttachments),
	user: one(users, {
		fields: [projects.createdBy],
		references: [users.id]
	}),
	company: one(companies, {
		fields: [projects.companyId],
		references: [companies.id]
	}),
}));

export const projectParticipantsRelations = relations(projectParticipants, ({one}) => ({
	project: one(projects, {
		fields: [projectParticipants.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [projectParticipants.userId],
		references: [users.id]
	}),
}));

export const emailCredentialsRelations = relations(emailCredentials, ({one}) => ({
	user: one(users, {
		fields: [emailCredentials.userId],
		references: [users.id]
	}),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({one}) => ({
	task: one(tasks, {
		fields: [taskAssignees.taskId],
		references: [tasks.id]
	}),
	user: one(users, {
		fields: [taskAssignees.userId],
		references: [users.id]
	}),
}));

export const tasksRelations = relations(tasks, ({one, many}) => ({
	taskAssignees: many(taskAssignees),
	project: one(projects, {
		fields: [tasks.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [tasks.createdBy],
		references: [users.id]
	}),
	company: one(companies, {
		fields: [tasks.companyId],
		references: [companies.id]
	}),
}));

export const t5TSubmissionsRelations = relations(t5TSubmissions, ({one}) => ({
	pollingAgent: one(pollingAgents, {
		fields: [t5TSubmissions.pollingAgentId],
		references: [pollingAgents.id]
	}),
	user: one(users, {
		fields: [t5TSubmissions.submitterUserId],
		references: [users.id]
	}),
}));

export const pollingAgentParticipantsRelations = relations(pollingAgentParticipants, ({one}) => ({
	user: one(users, {
		fields: [pollingAgentParticipants.userId],
		references: [users.id]
	}),
	pollingAgent: one(pollingAgents, {
		fields: [pollingAgentParticipants.pollingAgentId],
		references: [pollingAgents.id]
	}),
}));

export const userDepartmentsRelations = relations(userDepartments, ({one}) => ({
	user: one(users, {
		fields: [userDepartments.userId],
		references: [users.id]
	}),
}));

export const userTrustRelationshipsRelations = relations(userTrustRelationships, ({one}) => ({
	user_userId: one(users, {
		fields: [userTrustRelationships.userId],
		references: [users.id],
		relationName: "userTrustRelationships_userId_users_id"
	}),
	user_trustedUserId: one(users, {
		fields: [userTrustRelationships.trustedUserId],
		references: [users.id],
		relationName: "userTrustRelationships_trustedUserId_users_id"
	}),
}));

export const faqOrganizationsRelations = relations(faqOrganizations, ({one, many}) => ({
	user: one(users, {
		fields: [faqOrganizations.createdBy],
		references: [users.id]
	}),
	sopDocuments: many(sopDocuments),
	faqEntries: many(faqEntries),
}));

export const sopDocumentsRelations = relations(sopDocuments, ({one}) => ({
	faqOrganization: one(faqOrganizations, {
		fields: [sopDocuments.organizationId],
		references: [faqOrganizations.id]
	}),
	user: one(users, {
		fields: [sopDocuments.createdBy],
		references: [users.id]
	}),
}));

export const faqEntriesRelations = relations(faqEntries, ({one}) => ({
	faqOrganization: one(faqOrganizations, {
		fields: [faqEntries.organizationId],
		references: [faqOrganizations.id]
	}),
	user: one(users, {
		fields: [faqEntries.createdBy],
		references: [users.id]
	}),
}));

export const emailAttachmentsRelations = relations(emailAttachments, ({one}) => ({
	project: one(projects, {
		fields: [emailAttachments.projectId],
		references: [projects.id]
	}),
}));

export const trustConfirmationTokensRelations = relations(trustConfirmationTokens, ({one}) => ({
	user_inviterUserId: one(users, {
		fields: [trustConfirmationTokens.inviterUserId],
		references: [users.id],
		relationName: "trustConfirmationTokens_inviterUserId_users_id"
	}),
	user_targetUserId: one(users, {
		fields: [trustConfirmationTokens.targetUserId],
		references: [users.id],
		relationName: "trustConfirmationTokens_targetUserId_users_id"
	}),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	user: one(users, {
		fields: [passwordResetTokens.userId],
		references: [users.id]
	}),
}));

export const userLinkedAccountsRelations = relations(userLinkedAccounts, ({one}) => ({
	user: one(users, {
		fields: [userLinkedAccounts.userId],
		references: [users.id]
	}),
}));

export const companyDepartmentsRelations = relations(companyDepartments, ({one}) => ({
	company: one(companies, {
		fields: [companyDepartments.companyId],
		references: [companies.id]
	}),
	user: one(users, {
		fields: [companyDepartments.managerUserId],
		references: [users.id]
	}),
}));

export const companyHierarchyRelations = relations(companyHierarchy, ({one}) => ({
	company: one(companies, {
		fields: [companyHierarchy.companyId],
		references: [companies.id]
	}),
	user_employeeUserId: one(users, {
		fields: [companyHierarchy.employeeUserId],
		references: [users.id],
		relationName: "companyHierarchy_employeeUserId_users_id"
	}),
	user_managerUserId: one(users, {
		fields: [companyHierarchy.managerUserId],
		references: [users.id],
		relationName: "companyHierarchy_managerUserId_users_id"
	}),
}));

export const companyMembershipsRelations = relations(companyMemberships, ({one}) => ({
	company: one(companies, {
		fields: [companyMemberships.companyId],
		references: [companies.id]
	}),
	user: one(users, {
		fields: [companyMemberships.userId],
		references: [users.id]
	}),
}));