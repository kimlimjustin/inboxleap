import { pgTable, index, foreignKey, unique, serial, varchar, boolean, timestamp, check, text, jsonb, integer, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const notificationPreferences = pgTable("notification_preferences", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	emailNotifications: boolean("email_notifications").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	newTaskAlerts: boolean("new_task_alerts").default(true),
	projectUpdates: boolean("project_updates").default(true),
	taskStatusChanges: boolean("task_status_changes").default(true),
	taskAssignments: boolean("task_assignments").default(true),
	taskDueReminders: boolean("task_due_reminders").default(true),
	weeklyDigest: boolean("weekly_digest").default(false),
}, (table) => [
	index("idx_notification_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_preferences_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("notification_preferences_user_id_unique").on(table.userId),
]);

export const pollingAgents = pgTable("polling_agents", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	emailAddress: varchar("email_address").notNull(),
	commandPrefix: varchar("command_prefix"),
	type: varchar().default('t5t').notNull(),
	isActive: boolean("is_active").default(true),
	organizationId: varchar("organization_id"),
	createdBy: varchar("created_by").notNull(),
	settings: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	organizationName: varchar("organization_name"),
	organizationDescription: text("organization_description"),
	companyId: integer("company_id"),
	accountType: varchar("account_type", { length: 20 }).default('individual'),
}, (table) => [
	index("idx_polling_agent_account_type").using("btree", table.accountType.asc().nullsLast().op("text_ops")),
	index("idx_polling_agent_company").using("btree", table.companyId.asc().nullsLast().op("int4_ops")),
	index("idx_polling_agent_email").using("btree", table.emailAddress.asc().nullsLast().op("text_ops")),
	index("idx_polling_agent_org").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	index("idx_polling_agent_org_name").using("btree", table.organizationName.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "polling_agents_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "polling_agents_company_id_companies_id_fk"
		}),
	unique("polling_agents_email_address_unique").on(table.emailAddress),
	check("polling_agents_account_type_check", sql`(account_type)::text = ANY ((ARRAY['individual'::character varying, 'company'::character varying])::text[])`),
]);

export const pollingInsights = pgTable("polling_insights", {
	id: serial().primaryKey().notNull(),
	pollingAgentId: integer("polling_agent_id").notNull(),
	insightType: varchar("insight_type").notNull(),
	title: varchar().notNull(),
	description: text(),
	data: jsonb().notNull(),
	scope: varchar().notNull(),
	period: varchar().notNull(),
	confidence: integer().default(80),
	priority: varchar().default('medium'),
	isAlert: boolean("is_alert").default(false),
	viewCount: integer("view_count").default(0),
	lastViewed: timestamp("last_viewed", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_insight_agent").using("btree", table.pollingAgentId.asc().nullsLast().op("int4_ops")),
	index("idx_insight_alert").using("btree", table.isAlert.asc().nullsLast().op("bool_ops")),
	index("idx_insight_period").using("btree", table.period.asc().nullsLast().op("text_ops")),
	index("idx_insight_priority").using("btree", table.priority.asc().nullsLast().op("text_ops")),
	index("idx_insight_type").using("btree", table.insightType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.pollingAgentId],
			foreignColumns: [pollingAgents.id],
			name: "polling_insights_polling_agent_id_polling_agents_id_fk"
		}),
]);

export const processedEmails = pgTable("processed_emails", {
	id: serial().primaryKey().notNull(),
	messageId: varchar("message_id").notNull(),
	subject: varchar().notNull(),
	sender: varchar().notNull(),
	recipients: text().array(),
	ccList: text("cc_list").array(),
	bccList: text("bcc_list").array(),
	body: text(),
	status: varchar().notNull(),
	tasksCreated: integer("tasks_created").default(0),
	projectId: integer("project_id"),
	processingError: text("processing_error"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "processed_emails_project_id_projects_id_fk"
		}),
	unique("processed_emails_message_id_unique").on(table.messageId),
]);

export const projectParticipants = pgTable("project_participants", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	userId: varchar("user_id").notNull(),
	role: varchar().notNull(),
	canEdit: boolean("can_edit").default(true),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_participants_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "project_participants_user_id_users_id_fk"
		}),
]);

export const emailCredentials = pgTable("email_credentials", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	email: varchar().notNull(),
	imapHost: varchar("imap_host").notNull(),
	imapPort: integer("imap_port").notNull(),
	imapUsername: varchar("imap_username").notNull(),
	imapPassword: varchar("imap_password").notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "email_credentials_user_id_users_id_fk"
		}),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const taskAssignees = pgTable("task_assignees", {
	id: serial().primaryKey().notNull(),
	taskId: integer("task_id").notNull(),
	userId: varchar("user_id").notNull(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [tasks.id],
			name: "task_assignees_task_id_tasks_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "task_assignees_user_id_users_id_fk"
		}),
]);

export const t5TSubmissions = pgTable("t5t_submissions", {
	id: serial().primaryKey().notNull(),
	pollingAgentId: integer("polling_agent_id").notNull(),
	submitterUserId: varchar("submitter_user_id").notNull(),
	submitterEmail: varchar("submitter_email").notNull(),
	messageId: varchar("message_id").notNull(),
	subject: varchar().notNull(),
	rawContent: text("raw_content").notNull(),
	parsedItems: jsonb("parsed_items").default([]),
	sentiment: varchar(),
	sentimentScore: integer("sentiment_score"),
	topics: text().array().default([""]),
	priority: varchar().default('medium'),
	weekNumber: integer("week_number"),
	monthNumber: integer("month_number"),
	yearNumber: integer("year_number"),
	submissionDate: timestamp("submission_date", { mode: 'string' }).notNull(),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	processingStatus: varchar("processing_status").default('pending').notNull(),
	processingError: text("processing_error"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_t5t_agent").using("btree", table.pollingAgentId.asc().nullsLast().op("int4_ops")),
	index("idx_t5t_date").using("btree", table.submissionDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_t5t_message_id").using("btree", table.messageId.asc().nullsLast().op("text_ops")),
	index("idx_t5t_processing_status").using("btree", table.processingStatus.asc().nullsLast().op("text_ops")),
	index("idx_t5t_sentiment").using("btree", table.sentiment.asc().nullsLast().op("text_ops")),
	index("idx_t5t_submitter").using("btree", table.submitterUserId.asc().nullsLast().op("text_ops")),
	index("idx_t5t_week").using("btree", table.weekNumber.asc().nullsLast().op("int4_ops"), table.yearNumber.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.pollingAgentId],
			foreignColumns: [pollingAgents.id],
			name: "t5t_submissions_polling_agent_id_polling_agents_id_fk"
		}),
	foreignKey({
			columns: [table.submitterUserId],
			foreignColumns: [users.id],
			name: "t5t_submissions_submitter_user_id_users_id_fk"
		}),
	unique("t5t_submissions_message_id_unique").on(table.messageId),
]);

export const tasks = pgTable("tasks", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	title: varchar().notNull(),
	description: text(),
	priority: varchar().default('medium').notNull(),
	status: varchar().default('pending').notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }),
	sourceEmail: varchar("source_email"),
	sourceEmailSubject: varchar("source_email_subject"),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	companyId: integer("company_id"),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "tasks_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "tasks_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "tasks_company_id_companies_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: varchar().primaryKey().notNull(),
	email: varchar(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	password: varchar(),
	authProvider: varchar("auth_provider").default('google'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const pollingAgentParticipants = pgTable("polling_agent_participants", {
	id: serial().primaryKey().notNull(),
	pollingAgentId: integer("polling_agent_id").notNull(),
	userId: varchar("user_id").notNull(),
	role: varchar().default('participant').notNull(),
	canViewInsights: boolean("can_view_insights").default(true),
	canViewDetailedAnalytics: boolean("can_view_detailed_analytics").default(false),
	isActive: boolean("is_active").default(true),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_agent_participant").using("btree", table.pollingAgentId.asc().nullsLast().op("int4_ops"), table.userId.asc().nullsLast().op("text_ops")),
	index("idx_participant_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "polling_agent_participants_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.pollingAgentId],
			foreignColumns: [pollingAgents.id],
			name: "polling_agent_participants_polling_agent_id_polling_agents_id_f"
		}),
	unique("unique_agent_user").on(table.pollingAgentId, table.userId),
]);

export const userDepartments = pgTable("user_departments", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	departmentName: varchar("department_name").notNull(),
	teamName: varchar("team_name"),
	role: varchar(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_dept_dept").using("btree", table.departmentName.asc().nullsLast().op("text_ops")),
	index("idx_user_dept_team").using("btree", table.teamName.asc().nullsLast().op("text_ops")),
	index("idx_user_dept_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_departments_user_id_users_id_fk"
		}),
	unique("unique_user_dept").on(table.userId, table.departmentName),
]);

export const userTrustRelationships = pgTable("user_trust_relationships", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	trustedUserId: varchar("trusted_user_id").notNull(),
	trustStatus: varchar("trust_status").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_trust_trusted_user_id").using("btree", table.trustedUserId.asc().nullsLast().op("text_ops")),
	index("idx_trust_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_trust_relationships_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.trustedUserId],
			foreignColumns: [users.id],
			name: "user_trust_relationships_trusted_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("unique_trust_relationship").on(table.userId, table.trustedUserId),
	check("check_not_self_trust", sql`(user_id)::text <> (trusted_user_id)::text`),
]);

export const faqOrganizations = pgTable("faq_organizations", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	faqEmail: varchar("faq_email"),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "faq_organizations_created_by_users_id_fk"
		}),
	unique("faq_organizations_faq_email_unique").on(table.faqEmail),
]);

export const sopDocuments = pgTable("sop_documents", {
	id: serial().primaryKey().notNull(),
	organizationId: integer("organization_id").notNull(),
	title: varchar().notNull(),
	description: text(),
	content: text().notNull(),
	category: varchar(),
	tags: text().array().default([""]),
	isPublished: boolean("is_published").default(true),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [faqOrganizations.id],
			name: "sop_documents_organization_id_faq_organizations_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "sop_documents_created_by_users_id_fk"
		}),
]);

export const faqEntries = pgTable("faq_entries", {
	id: serial().primaryKey().notNull(),
	organizationId: integer("organization_id").notNull(),
	question: text().notNull(),
	answer: text().notNull(),
	category: varchar(),
	relatedDocuments: integer("related_documents").array().default([]),
	isPublished: boolean("is_published").default(true),
	viewCount: integer("view_count").default(0),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [faqOrganizations.id],
			name: "faq_entries_organization_id_faq_organizations_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "faq_entries_created_by_users_id_fk"
		}),
]);

export const emailAttachments = pgTable("email_attachments", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	filename: varchar().notNull(),
	originalName: varchar("original_name").notNull(),
	contentType: varchar("content_type").notNull(),
	size: integer().notNull(),
	s3Key: varchar("s3_key"),
	localPath: varchar("local_path"),
	emailMessageId: varchar("email_message_id"),
	analysis: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	content: text(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "email_attachments_project_id_projects_id_fk"
		}),
]);

export const emailOptOuts = pgTable("email_opt_outs", {
	id: serial().primaryKey().notNull(),
	email: varchar().notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("email_opt_outs_email_unique").on(table.email),
]);

export const trustConfirmationTokens = pgTable("trust_confirmation_tokens", {
	id: serial().primaryKey().notNull(),
	token: varchar().notNull(),
	action: varchar().notNull(),
	inviterUserId: varchar("inviter_user_id").notNull(),
	targetUserId: varchar("target_user_id").notNull(),
	projectName: varchar("project_name"),
	emailSubject: varchar("email_subject"),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	used: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_trust_action").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("idx_trust_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_trust_inviter").using("btree", table.inviterUserId.asc().nullsLast().op("text_ops")),
	index("idx_trust_target").using("btree", table.targetUserId.asc().nullsLast().op("text_ops")),
	index("idx_trust_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.inviterUserId],
			foreignColumns: [users.id],
			name: "trust_confirmation_tokens_inviter_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.targetUserId],
			foreignColumns: [users.id],
			name: "trust_confirmation_tokens_target_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("trust_confirmation_tokens_token_unique").on(table.token),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	token: varchar().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	used: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_password_reset_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_password_reset_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("idx_password_reset_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "password_reset_tokens_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("password_reset_tokens_token_unique").on(table.token),
]);

export const userLinkedAccounts = pgTable("user_linked_accounts", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	provider: varchar().notNull(),
	providerAccountId: varchar("provider_account_id"),
	email: varchar(),
	isActive: boolean("is_active").default(true),
	linkedAt: timestamp("linked_at", { mode: 'string' }).defaultNow(),
	lastUsed: timestamp("last_used", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_linked_accounts_provider").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.providerAccountId.asc().nullsLast().op("text_ops")),
	index("idx_linked_accounts_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_linked_accounts_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("unique_user_provider").on(table.userId, table.provider, table.providerAccountId),
]);

export const intelligenceTokens = pgTable("intelligence_tokens", {
	id: varchar().primaryKey().notNull(),
	organizationId: varchar("organization_id").notNull(),
	text: text().notNull(),
	topics: jsonb().default([]).notNull(),
	sentiment: varchar().default('neutral').notNull(),
	category: varchar().default('observation').notNull(),
	priority: varchar().default('medium').notNull(),
	confidence: integer().default(70).notNull(),
	submitters: jsonb().default([]).notNull(),
	frequency: integer().default(1).notNull(),
	relatedEmailIds: jsonb("related_email_ids").default([]).notNull(),
	isActive: boolean("is_active").default(true),
	usageCount: integer("usage_count").default(0),
	lastUsed: timestamp("last_used", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_token_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_token_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_token_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_token_org").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	index("idx_token_priority").using("btree", table.priority.asc().nullsLast().op("text_ops")),
	index("idx_token_sentiment").using("btree", table.sentiment.asc().nullsLast().op("text_ops")),
	index("idx_token_topics").using("btree", table.topics.asc().nullsLast().op("jsonb_ops")),
]);

export const companyDepartments = pgTable("company_departments", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	managerUserId: varchar("manager_user_id"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_company_departments_company").using("btree", table.companyId.asc().nullsLast().op("int4_ops")),
	index("idx_company_departments_name").using("btree", table.companyId.asc().nullsLast().op("int4_ops"), table.name.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_departments_company_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.managerUserId],
			foreignColumns: [users.id],
			name: "company_departments_manager_user_id_users_id_fk"
		}),
]);

export const companyHierarchy = pgTable("company_hierarchy", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	employeeUserId: varchar("employee_user_id").notNull(),
	managerUserId: varchar("manager_user_id"),
	confidence: numeric({ precision: 3, scale:  2 }).default('1.00'),
	source: varchar({ length: 50 }).default('manual'),
	lastSeen: timestamp("last_seen", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_company_hierarchy_company").using("btree", table.companyId.asc().nullsLast().op("int4_ops")),
	index("idx_company_hierarchy_employee").using("btree", table.employeeUserId.asc().nullsLast().op("text_ops")),
	index("idx_company_hierarchy_manager").using("btree", table.managerUserId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_hierarchy_company_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.employeeUserId],
			foreignColumns: [users.id],
			name: "company_hierarchy_employee_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.managerUserId],
			foreignColumns: [users.id],
			name: "company_hierarchy_manager_user_id_users_id_fk"
		}),
	unique("unique_company_employee").on(table.companyId, table.employeeUserId),
]);

export const companyMemberships = pgTable("company_memberships", {
	id: serial().primaryKey().notNull(),
	companyId: integer("company_id").notNull(),
	userId: varchar("user_id").notNull(),
	role: varchar({ length: 50 }).default('member').notNull(),
	department: varchar({ length: 100 }),
	isActive: boolean("is_active").default(true),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_company_memberships_company_user").using("btree", table.companyId.asc().nullsLast().op("int4_ops"), table.userId.asc().nullsLast().op("int4_ops")),
	index("idx_company_memberships_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_memberships_company_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "company_memberships_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("unique_company_user").on(table.companyId, table.userId),
]);

export const companies = pgTable("companies", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	domainRestrictions: jsonb("domain_restrictions").default({"domains":[],"enabled":false}),
	parentCompanyId: integer("parent_company_id"),
	companyType: varchar("company_type", { length: 20 }).default('main'),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	emailAddress: varchar("email_address"),
}, (table) => [
	index("idx_companies_created_by").using("btree", table.createdBy.asc().nullsLast().op("text_ops")),
	index("idx_companies_email").using("btree", table.emailAddress.asc().nullsLast().op("text_ops")),
	index("idx_companies_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_companies_parent").using("btree", table.parentCompanyId.asc().nullsLast().op("int4_ops")),
	index("idx_companies_type").using("btree", table.companyType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "companies_created_by_users_id_fk"
		}),
	unique("companies_email_address_unique").on(table.emailAddress),
	check("companies_type_check", sql`(company_type)::text = ANY ((ARRAY['main'::character varying, 'subsidiary'::character varying, 'division'::character varying, 'project'::character varying])::text[])`),
]);

export const projects = pgTable("projects", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	type: varchar().notNull(),
	createdBy: varchar("created_by").notNull(),
	topic: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	companyId: integer("company_id"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "projects_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "projects_company_id_companies_id_fk"
		}),
]);
