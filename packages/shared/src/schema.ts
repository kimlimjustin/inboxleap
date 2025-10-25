import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  boolean,
  integer,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql, type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { decimal } from "drizzle-orm/pg-core";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: varchar("password"), // For email authentication
  authProvider: varchar("auth_provider").default("google"), // 'google' or 'email'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Linked authentication methods for users (allows multiple auth methods per user)
export const userLinkedAccounts = pgTable("user_linked_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider").notNull(), // 'google' or 'email'
  providerAccountId: varchar("provider_account_id"), // Google ID or null for email
  email: varchar("email"), // Email for this auth method
  isActive: boolean("is_active").default(true),
  linkedAt: timestamp("linked_at").defaultNow(),
  lastUsed: timestamp("last_used").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate provider accounts for same user
  uniqueUserProvider: unique("unique_user_provider").on(table.userId, table.provider, table.providerAccountId),
  // Index for efficient lookups
  userIdIdx: index("idx_linked_accounts_user_id").on(table.userId),
  providerIdx: index("idx_linked_accounts_provider").on(table.provider, table.providerAccountId),
}));

// Email credentials for users
export const emailCredentials = pgTable("email_credentials", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  email: varchar("email").notNull(),
  imapHost: varchar("imap_host").notNull(),
  imapPort: integer("imap_port").notNull(),
  imapUsername: varchar("imap_username").notNull(),
  imapPassword: varchar("imap_password").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Team projects
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),

  // New: Reference to identity (replaces type + companyId)
  identityId: integer("identity_id").references(() => identities.id, { onDelete: "cascade" }),

  // Legacy fields for backward compatibility
  type: varchar("type"), // 'individual' or 'team' (deprecated, use identityId)
  companyId: integer("company_id").references(() => companies.id), // null for individual projects (deprecated)

  createdBy: varchar("created_by").notNull().references(() => users.id),

  // New: Link to specific agent instance/topic
  agentInstanceId: integer("agent_instance_id").references(() => agentInstances.id),

  // Legacy topic field (deprecated, use agentInstanceId)
  topic: text("topic"), // For grouping related emails

  sourceEmail: varchar("source_email"), // Track which agent instance this project belongs to
  sourceEmailSubject: varchar("source_email_subject"), // Original email subject
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  identityIdx: index("idx_projects_identity").on(table.identityId),
  agentInstanceIdx: index("idx_projects_agent_instance").on(table.agentInstanceId),
  createdByIdx: index("idx_projects_created_by").on(table.createdBy),
  companyIdx: index("idx_projects_company").on(table.companyId), // Legacy index
}));

// Project participants
export const projectParticipants = pgTable("project_participants", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role").notNull(), // 'owner', 'editor', 'viewer'
  canEdit: boolean("can_edit").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Tasks
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  title: varchar("title").notNull(),
  description: text("description"),
  priority: varchar("priority").notNull().default('medium'), // 'low', 'medium', 'high'
  status: varchar("status").notNull().default('pending'), // Dynamic status set by LLM
  dueDate: timestamp("due_date"),
  sourceEmail: varchar("source_email"),
  sourceEmailSubject: varchar("source_email_subject"),
  createdBy: varchar("created_by").notNull().references(() => users.id),

  // Legacy: companyId (deprecated - identity is inherited from project)
  companyId: integer("company_id").references(() => companies.id), // null for individual tasks

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  projectIdx: index("idx_tasks_project").on(table.projectId),
  createdByIdx: index("idx_tasks_created_by").on(table.createdBy),
  statusIdx: index("idx_tasks_status").on(table.status),
  companyIdx: index("idx_tasks_company").on(table.companyId), // Legacy index
}));

// Task assignees (many-to-many relationship between tasks and users)
export const taskAssignees = pgTable("task_assignees", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

// Processed emails
export const processedEmails = pgTable("processed_emails", {
  id: serial("id").primaryKey(),
  messageId: varchar("message_id").unique().notNull(),
  subject: varchar("subject").notNull(),
  sender: varchar("sender").notNull(),
  recipients: text("recipients").array(),
  ccList: text("cc_list").array(),
  bccList: text("bcc_list").array(),
  body: text("body"),
  status: varchar("status").notNull(), // 'processing', 'processed', 'failed'
  tasksCreated: integer("tasks_created").default(0),
  projectId: integer("project_id").references(() => projects.id),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Email opt-out table for users who don't want to receive emails
export const emailOptOuts = pgTable("email_opt_outs", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  emailCredentials: many(emailCredentials),
  ownedProjects: many(projects),
  participantProjects: many(projectParticipants),
  tasks: many(tasks),
  taskAssignments: many(taskAssignees),
  linkedAccounts: many(userLinkedAccounts),
  // New identity relations
  identity: one(identities, { fields: [users.id], references: [identities.userId] }),
  identityAccess: many(identityAccess),
  sessionContext: one(userSessionContext, { fields: [users.id], references: [userSessionContext.userId] }),
}));

export const userLinkedAccountsRelations = relations(userLinkedAccounts, ({ one }) => ({
  user: one(users, { fields: [userLinkedAccounts.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, { fields: [projects.createdBy], references: [users.id] }),
  identity: one(identities, { fields: [projects.identityId], references: [identities.id] }),
  agentInstance: one(agentInstances, { fields: [projects.agentInstanceId], references: [agentInstances.id] }),
  participants: many(projectParticipants),
  tasks: many(tasks),
  processedEmails: many(processedEmails),
  // Legacy company relation
  company: one(companies, { fields: [projects.companyId], references: [companies.id] }),
}));

export const projectParticipantsRelations = relations(projectParticipants, ({ one }) => ({
  project: one(projects, { fields: [projectParticipants.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectParticipants.userId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  creator: one(users, { fields: [tasks.createdBy], references: [users.id] }),
  assignees: many(taskAssignees),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, { fields: [taskAssignees.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskAssignees.userId], references: [users.id] }),
}));

export const processedEmailsRelations = relations(processedEmails, ({ one }) => ({
  project: one(projects, { fields: [processedEmails.projectId], references: [projects.id] }),
}));

// User trust relationships
export const userTrustRelationships = pgTable("user_trust_relationships", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User making the trust decision
  trustedUserId: varchar("trusted_user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User being trusted/blocked
  trustStatus: varchar("trust_status").notNull(), // 'trusted', 'blocked', 'pending'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate trust relationships
  uniqueTrustRelationship: unique("unique_trust_relationship").on(table.userId, table.trustedUserId),
  // Indexes for better query performance
  userIdIdx: index("idx_trust_user_id").on(table.userId),
  trustedUserIdIdx: index("idx_trust_trusted_user_id").on(table.trustedUserId),
  // Prevent self-trust relationships
  checkNotSelfTrust: check("check_not_self_trust", sql`user_id != trusted_user_id`),
}));

// User notification preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  emailNotifications: boolean("email_notifications").default(true),
  newTaskAlerts: boolean("new_task_alerts").default(true),
  projectUpdates: boolean("project_updates").default(true),
  taskStatusChanges: boolean("task_status_changes").default(true),
  taskAssignments: boolean("task_assignments").default(true),
  taskDueReminders: boolean("task_due_reminders").default(true),
  weeklyDigest: boolean("weekly_digest").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for better query performance
  userIdIdx: index("idx_notification_user_id").on(table.userId),
}));

export const userTrustRelationshipsRelations = relations(userTrustRelationships, ({ one }) => ({
  user: one(users, { fields: [userTrustRelationships.userId], references: [users.id] }),
  trustedUser: one(users, { fields: [userTrustRelationships.trustedUserId], references: [users.id] }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, { fields: [notificationPreferences.userId], references: [users.id] }),
}));

// Polling Agents - T5T style email polling agents
export const pollingAgents = pgTable("polling_agents", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(), // e.g., "Weekly T5T", "Customer Intelligence"
  description: text("description"),
  emailAddress: varchar("email_address").notNull().unique(), // e.g., "t5t+acme@inboxleap.com"
  commandPrefix: varchar("command_prefix"), // e.g., "$poll", "$t5t"
  type: varchar("type").notNull().default('t5t'), // 't5t', 'customer_intelligence', 'innovation_radar', etc.
  isActive: boolean("is_active").default(true),
  organizationId: varchar("organization_id"), // Legacy: Company identifier (deprecated, use companyId)
  organizationName: varchar("organization_name"), // Legacy: Human readable company name (deprecated)
  organizationDescription: text("organization_description"), // Legacy: Optional company description (deprecated)
  companyId: integer("company_id").references(() => companies.id), // New: References companies table
  accountType: varchar("account_type", { length: 20 }).default("individual"), // 'individual' or 'company'
  createdBy: varchar("created_by").notNull().references(() => users.id),
  settings: jsonb("settings").default({}), // Flexible config: submission_frequency, max_items, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  emailAddressIdx: index("idx_polling_agent_email").on(table.emailAddress),
  organizationIdx: index("idx_polling_agent_org").on(table.organizationId), // Legacy index
  orgNameIdx: index("idx_polling_agent_org_name").on(table.organizationName), // Legacy index
  companyIdx: index("idx_polling_agent_company").on(table.companyId), // New index
  accountTypeIdx: index("idx_polling_agent_account_type").on(table.accountType),
  accountTypeCheck: check("polling_agents_account_type_check", sql`account_type IN ('individual', 'company')`),
}));

// T5T Submissions - Individual email submissions to polling agents
export const t5tSubmissions = pgTable("t5t_submissions", {
  id: serial("id").primaryKey(),
  pollingAgentId: integer("polling_agent_id").notNull().references(() => pollingAgents.id),
  submitterUserId: varchar("submitter_user_id").notNull().references(() => users.id),
  submitterEmail: varchar("submitter_email").notNull(), // Email address of submitter
  messageId: varchar("message_id").unique().notNull(), // Email message ID
  subject: varchar("subject").notNull(),
  rawContent: text("raw_content").notNull(), // Original email body
  parsedItems: jsonb("parsed_items").default([]), // AI-parsed T5T items
  sentiment: varchar("sentiment"), // 'positive', 'neutral', 'negative'
  sentimentScore: integer("sentiment_score"), // -100 to 100
  topics: text("topics").array().default([]), // AI-extracted topics/keywords
  priority: varchar("priority").default('medium'), // 'low', 'medium', 'high'
  weekNumber: integer("week_number"), // Week of year for trend analysis
  monthNumber: integer("month_number"), // Month number for trend analysis
  yearNumber: integer("year_number"), // Year for trend analysis
  submissionDate: timestamp("submission_date").notNull(),
  processedAt: timestamp("processed_at"),
  processingStatus: varchar("processing_status").notNull().default('pending'), // 'pending', 'processed', 'failed'
  processingError: text("processing_error"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  messageIdIdx: index("idx_t5t_message_id").on(table.messageId),
  submitterIdx: index("idx_t5t_submitter").on(table.submitterUserId),
  agentIdx: index("idx_t5t_agent").on(table.pollingAgentId),
  dateIdx: index("idx_t5t_date").on(table.submissionDate),
  weekIdx: index("idx_t5t_week").on(table.weekNumber, table.yearNumber),
  sentimentIdx: index("idx_t5t_sentiment").on(table.sentiment),
  processingStatusIdx: index("idx_t5t_processing_status").on(table.processingStatus),
}));

// Polling Insights - AI-generated insights from submissions
export const pollingInsights = pgTable("polling_insights", {
  id: serial("id").primaryKey(),
  pollingAgentId: integer("polling_agent_id").notNull().references(() => pollingAgents.id),
  insightType: varchar("insight_type").notNull(), 
  // 'trending_topics', 'sentiment_trend', 'emerging_signals', 'team_mood', 'participation_rate', 
  // 'cross_team_themes', 'recurring_concerns', 'positive_highlights', 'pain_points', 'ideas_suggestions'
  title: varchar("title").notNull(),
  description: text("description"),
  data: jsonb("data").notNull(), // Flexible insight data structure
  scope: varchar("scope").notNull(), // 'weekly', 'monthly', 'quarterly', 'real_time'
  period: varchar("period").notNull(), // e.g., '2025-W31', '2025-07', '2025-Q2'
  confidence: integer("confidence").default(80), // AI confidence score 0-100
  priority: varchar("priority").default('medium'), // 'low', 'medium', 'high'
  isAlert: boolean("is_alert").default(false), // Flag urgent insights
  viewCount: integer("view_count").default(0),
  lastViewed: timestamp("last_viewed"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  agentIdx: index("idx_insight_agent").on(table.pollingAgentId),
  typeIdx: index("idx_insight_type").on(table.insightType),
  periodIdx: index("idx_insight_period").on(table.period),
  priorityIdx: index("idx_insight_priority").on(table.priority),
  alertIdx: index("idx_insight_alert").on(table.isAlert),
}));

// Intelligence Tokens - Reusable intelligence units from batch processing
export const intelligenceTokens = pgTable("intelligence_tokens", {
  id: varchar("id").primaryKey(), // UUID from batch processing
  organizationId: varchar("organization_id").notNull(), // Links to pollingAgents org
  text: text("text").notNull(), // The actual insight/observation
  topics: jsonb("topics").notNull().default('[]'), // Array of topic keywords
  sentiment: varchar("sentiment").notNull().default('neutral'), // positive, neutral, negative
  category: varchar("category").notNull().default('observation'), // observation, concern, idea, achievement, question
  priority: varchar("priority").notNull().default('medium'), // low, medium, high
  confidence: integer("confidence").notNull().default(70), // AI confidence score 0-100
  submitters: jsonb("submitters").notNull().default('[]'), // Array of submitter email addresses
  frequency: integer("frequency").notNull().default(1), // How many times this appears
  relatedEmailIds: jsonb("related_email_ids").notNull().default('[]'), // Array of email IDs
  isActive: boolean("is_active").default(true), // Can be deactivated if obsolete
  usageCount: integer("usage_count").default(0), // How many times referenced in insights
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  orgIdx: index("idx_token_org").on(table.organizationId),
  topicsIdx: index("idx_token_topics").on(table.topics),
  sentimentIdx: index("idx_token_sentiment").on(table.sentiment),
  categoryIdx: index("idx_token_category").on(table.category),
  priorityIdx: index("idx_token_priority").on(table.priority),
  activeIdx: index("idx_token_active").on(table.isActive),
  createdIdx: index("idx_token_created").on(table.createdAt),
}));

// Team/Department mappings for organizational insights
export const userDepartments = pgTable("user_departments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  departmentName: varchar("department_name").notNull(), // 'Engineering', 'Sales', 'Marketing', etc.
  teamName: varchar("team_name"), // More specific team within department
  role: varchar("role"), // 'manager', 'member', 'lead'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("idx_user_dept_user").on(table.userId),
  deptIdx: index("idx_user_dept_dept").on(table.departmentName),
  teamIdx: index("idx_user_dept_team").on(table.teamName),
  uniqueUserDept: unique("unique_user_dept").on(table.userId, table.departmentName),
}));

// Attachments for Alex agent
export const emailAttachments = pgTable("email_attachments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  contentType: varchar("content_type").notNull(),
  size: integer("size").notNull(),
  s3Key: varchar("s3_key"), // S3 storage key if using S3
  localPath: varchar("local_path"), // Local file path if stored locally
  content: text("content"), // Base64 encoded attachment content
  emailMessageId: varchar("email_message_id"), // Link to source email
  analysis: jsonb("analysis"), // AI analysis results
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document Analysis Results - Standalone document analysis (not tied to projects)
export const documentAnalysisResults = pgTable("document_analysis_results", {
  id: serial("id").primaryKey(),
  messageId: varchar("message_id").notNull(), // Email message ID or web upload ID
  userId: varchar("user_id").notNull().references(() => users.id),
  filename: varchar("filename").notNull(),
  fileType: varchar("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileHash: varchar("file_hash"), // SHA-256 hash for deduplication

  // Storage
  s3Key: varchar("s3_key"), // S3 storage key if using S3
  localPath: varchar("local_path"), // Local file path if stored locally
  content: text("content"), // Base64 encoded file content (for small files)

  // Analysis results
  analysisData: jsonb("analysis_data"), // Structured data extraction results
  aiAnalysis: jsonb("ai_analysis").notNull(), // AI-generated insights and analysis
  processingResults: jsonb("processing_results"), // OCR, virus scan, etc.

  // Metadata
  category: varchar("category"), // Document category (financial, legal, etc.)
  confidence: integer("confidence"), // AI confidence score 0-100
  extractedText: text("extracted_text"), // Full text extraction for search
  virusScanPassed: boolean("virus_scan_passed").default(true),
  processedAt: timestamp("processed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("idx_document_analysis_user").on(table.userId),
  messageIdx: index("idx_document_analysis_message").on(table.messageId),
  categoryIdx: index("idx_document_analysis_category").on(table.category),
  processedAtIdx: index("idx_document_analysis_processed_at").on(table.processedAt),
}));

export const documentAnalysisResultsRelations = relations(documentAnalysisResults, ({ one }) => ({
  user: one(users, { fields: [documentAnalysisResults.userId], references: [users.id] }),
}));

// FAQ System Tables

// FAQ Organizations
export const faqOrganizations = pgTable("faq_organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  faqEmail: varchar("faq_email").unique(), // e.g., faq+acme@inboxleap.com
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company Agent Email Addresses - Multiple instances per agent type per company
export const companyAgentEmails = pgTable("company_agent_emails", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  agentType: varchar("agent_type", { length: 50 }).notNull(), // 'todo', 'analyzer', 'polly', 'faq', 't5t', etc.
  instanceName: varchar("instance_name", { length: 100 }).notNull(), // e.g., "primary", "sales", "support", etc.
  emailAddress: varchar("email_address").notNull().unique(), // e.g., "todo+acmecorp-sales@inboxleap.com"
  isActive: boolean("is_active").default(true),
  customization: jsonb("customization").default({}), // Additional per-instance agent settings
  inheritCompanySettings: boolean("inherit_company_settings").default(true), // Whether to inherit company-level settings
  allowGlobalEmails: boolean("allow_global_emails").default(false), // Whether to receive emails from everywhere
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  companyAgentIdx: index("idx_company_agent_emails_company_agent").on(table.companyId, table.agentType),
  emailIdx: index("idx_company_agent_emails_email").on(table.emailAddress),
  agentTypeIdx: index("idx_company_agent_emails_agent_type").on(table.agentType),
  instanceIdx: index("idx_company_agent_emails_instance").on(table.companyId, table.agentType, table.instanceName),
  companyAgentInstanceUnique: unique("company_agent_emails_company_agent_instance_unique").on(table.companyId, table.agentType, table.instanceName),
}));

// Company-level agent settings that can be inherited by instances
export const companyAgentSettings = pgTable("company_agent_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  agentType: varchar("agent_type", { length: 50 }).notNull(), // 'todo', 'analyzer', 'polly', 'faq', 't5t', etc.
  defaultSettings: jsonb("default_settings").default({}), // Default settings for all instances
  isEnabled: boolean("is_enabled").default(true),
  maxInstances: integer("max_instances").default(5), // Maximum number of instances allowed
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  companyAgentTypeIdx: index("idx_company_agent_settings_company_agent").on(table.companyId, table.agentType),
  companyAgentTypeUnique: unique("company_agent_settings_company_agent_unique").on(table.companyId, table.agentType),
}));

// User Agent Email Addresses - Multiple instances per agent type per individual user
// New unified agent instances system - now supports both user and company identities
export const agentInstances = pgTable("agent_instances", {
  id: serial("id").primaryKey(),

  // New: Reference to identity (can be user or company)
  identityId: integer("identity_id").references(() => identities.id, { onDelete: "cascade" }),

  // Legacy: Keep userId for backward compatibility during migration
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),

  agentType: varchar("agent_type", { length: 50 }).notNull(), // 'todo', 't5t', etc.
  instanceName: varchar("instance_name", { length: 100 }).notNull(), // 'default', 'personal', 'work', etc.
  emailAddress: varchar("email_address").notNull().unique(),
  isDefault: boolean("is_default").default(false), // true for the default instance (todo@inboxleap.com)
  isActive: boolean("is_active").default(true),
  customization: jsonb("customization").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // New indexes for identity-based lookups
  identityAgentIdx: index("idx_agent_instances_identity_agent").on(table.identityId, table.agentType),
  identityIdx: index("idx_agent_instances_identity").on(table.identityId),

  // Legacy indexes
  userAgentIdx: index("idx_agent_instances_user_agent").on(table.userId, table.agentType),

  emailIdx: index("idx_agent_instances_email").on(table.emailAddress),
  agentTypeIdx: index("idx_agent_instances_agent_type").on(table.agentType),
  defaultIdx: index("idx_agent_instances_default").on(table.isDefault),

  // New unique constraint for identity-based instances
  identityAgentInstanceUnique: unique("agent_instances_identity_agent_instance_unique").on(table.identityId, table.agentType, table.instanceName),

  // Legacy unique constraint (will be removed after migration)
  userAgentInstanceUnique: unique("agent_instances_user_agent_instance_unique").on(table.userId, table.agentType, table.instanceName),
}));

// Legacy table - keeping for backward compatibility during migration
export const userAgentEmails = pgTable("user_agent_emails", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentType: varchar("agent_type", { length: 50 }).notNull(), // 'todo', 'analyzer', 'polly', 'faq', 't5t', etc.
  instanceName: varchar("instance_name", { length: 100 }).notNull(), // e.g., "primary", "personal", "work", etc.
  emailAddress: varchar("email_address").notNull().unique(), // e.g., "todo+user123@inboxleap.com"
  isActive: boolean("is_active").default(true),
  customization: jsonb("customization").default({}), // Additional per-instance agent settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userAgentIdx: index("idx_user_agent_emails_user_agent").on(table.userId, table.agentType),
  emailIdx: index("idx_user_agent_emails_email").on(table.emailAddress),
  agentTypeIdx: index("idx_user_agent_emails_agent_type").on(table.agentType),
  instanceIdx: index("idx_user_agent_emails_instance").on(table.userId, table.agentType, table.instanceName),
  userAgentInstanceUnique: unique("user_agent_emails_user_agent_instance_unique").on(table.userId, table.agentType, table.instanceName),
}));

export type CompanyAgentEmail = InferSelectModel<typeof companyAgentEmails>;
export type InsertCompanyAgentEmail = InferInsertModel<typeof companyAgentEmails>;
export type CompanyAgentSettings = InferSelectModel<typeof companyAgentSettings>;
export type InsertCompanyAgentSettings = InferInsertModel<typeof companyAgentSettings>;

// New agent instances types
export type AgentInstance = InferSelectModel<typeof agentInstances>;
export type InsertAgentInstance = InferInsertModel<typeof agentInstances>;

// Legacy types
export type UserAgentEmail = InferSelectModel<typeof userAgentEmails>;
export type InsertUserAgentEmail = InferInsertModel<typeof userAgentEmails>;

// FAQ Organization types
export type FAQOrganization = InferSelectModel<typeof faqOrganizations>;
export type InsertFAQOrganization = InferInsertModel<typeof faqOrganizations>;
export type SOPDocument = InferSelectModel<typeof sopDocuments>;
export type InsertSOPDocument = InferInsertModel<typeof sopDocuments>;
export type FAQEntry = InferSelectModel<typeof faqEntries>;
export type InsertFAQEntry = InferInsertModel<typeof faqEntries>;

// SOP Documents
export const sopDocuments = pgTable("sop_documents", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => faqOrganizations.id),
  title: varchar("title").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  category: varchar("category"),
  tags: text("tags").array().default([]),
  isPublished: boolean("is_published").default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// FAQ Entries
export const faqEntries = pgTable("faq_entries", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => faqOrganizations.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: varchar("category"),
  relatedDocuments: integer("related_documents").array().default([]), // References to sopDocuments.id
  isPublished: boolean("is_published").default(true),
  viewCount: integer("view_count").default(0),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Companies table - Platform-wide company registration
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  emailAddress: varchar("email_address").unique(), // Unique email address for company communications
  domainRestrictions: jsonb("domain_restrictions").default('{"enabled": false, "domains": []}'),
  parentCompanyId: integer("parent_company_id"),
  companyType: varchar("company_type", { length: 20 }).default("main"), // 'main', 'subsidiary', 'division'
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("idx_companies_name").on(table.name),
  emailIdx: index("idx_companies_email").on(table.emailAddress),
  createdByIdx: index("idx_companies_created_by").on(table.createdBy),
  parentCompanyIdx: index("idx_companies_parent").on(table.parentCompanyId),
  companyTypeIdx: index("idx_companies_type").on(table.companyType),
  companyTypeCheck: check("companies_type_check", sql`company_type IN ('main', 'subsidiary', 'division', 'project')`),
}));

// Identities table - Unified identity system for users and companies
// Represents an entity that can own emails, tasks, projects, and agent instances
export const identities = pgTable("identities", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull(), // 'user' or 'company'

  // For users: links to existing users table
  userId: varchar("user_id").unique().references(() => users.id, { onDelete: "cascade" }),

  // For companies: company info
  companyId: integer("company_id").unique().references(() => companies.id, { onDelete: "cascade" }),

  // Metadata
  displayName: varchar("display_name").notNull(), // User's name or company name
  description: text("description"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  typeIdx: index("idx_identities_type").on(table.type),
  userIdx: index("idx_identities_user").on(table.userId),
  companyIdx: index("idx_identities_company").on(table.companyId),
  typeCheck: check("identities_type_check", sql`type IN ('user', 'company')`),
  identityCheck: check("identities_identity_check", sql`
    (type = 'user' AND user_id IS NOT NULL AND company_id IS NULL) OR
    (type = 'company' AND company_id IS NOT NULL AND user_id IS NULL)
  `),
}));

// Identity Access - which users can access which identities (for company identities)
export const identityAccess = pgTable("identity_access", {
  id: serial("id").primaryKey(),
  identityId: integer("identity_id").notNull().references(() => identities.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  role: varchar("role", { length: 50 }).notNull().default("member"), // 'admin', 'member', 'viewer'
  canManageAgents: boolean("can_manage_agents").default(false),
  canManageProjects: boolean("can_manage_projects").default(true),
  canManageTasks: boolean("can_manage_tasks").default(true),

  isActive: boolean("is_active").default(true),
  grantedAt: timestamp("granted_at").defaultNow(),
}, (table) => ({
  identityUserIdx: index("idx_identity_access_identity_user").on(table.identityId, table.userId),
  userIdx: index("idx_identity_access_user").on(table.userId),
  uniqueIdentityUser: unique("unique_identity_user").on(table.identityId, table.userId),
}));

// User Session Context - tracks which identity user is currently viewing
export const userSessionContext = pgTable("user_session_context", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  currentIdentityId: integer("current_identity_id").references(() => identities.id),

  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("idx_user_session_context_user").on(table.userId),
  identityIdx: index("idx_user_session_context_identity").on(table.currentIdentityId),
}));

// Company memberships - Users belong to companies
export const companyMemberships = pgTable("company_memberships", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull().default("member"), // admin, manager, member
  department: varchar("department", { length: 100 }),
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  companyUserIdx: index("idx_company_memberships_company_user").on(table.companyId, table.userId),
  userIdx: index("idx_company_memberships_user").on(table.userId),
  uniqueCompanyUser: unique("unique_company_user").on(table.companyId, table.userId),
}));

// Company invitations - Team member invitations
export const companyInvitations = pgTable("company_invitations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  inviterUserId: varchar("inviter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  inviteeEmail: varchar("invitee_email").notNull(),
  inviteeUserId: varchar("invitee_user_id").references(() => users.id, { onDelete: "cascade" }), // null until user accepts
  role: varchar("role", { length: 50 }).notNull().default("member"), // admin, manager, member
  department: varchar("department", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, accepted, declined, expired
  invitationToken: varchar("invitation_token").unique().notNull(), // unique token for invitation link
  message: text("message"), // optional invitation message
  expiresAt: timestamp("expires_at").notNull(), // invitation expiry
  respondedAt: timestamp("responded_at"), // when user responded
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  companyIdx: index("idx_company_invitations_company").on(table.companyId),
  emailIdx: index("idx_company_invitations_email").on(table.inviteeEmail),
  tokenIdx: index("idx_company_invitations_token").on(table.invitationToken),
  statusIdx: index("idx_company_invitations_status").on(table.status),
  uniqueCompanyEmail: unique("unique_company_invitation").on(table.companyId, table.inviteeEmail),
}));

// Company departments - Normalized department structure
export const companyDepartments = pgTable("company_departments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  managerUserId: varchar("manager_user_id").references(() => users.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  companyIdx: index("idx_company_departments_company").on(table.companyId),
  nameIdx: index("idx_company_departments_name").on(table.companyId, table.name),
}));

// Company hierarchy relationships - Employee -> Manager relationships
export const companyHierarchy = pgTable("company_hierarchy", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeUserId: varchar("employee_user_id").notNull().references(() => users.id),
  managerUserId: varchar("manager_user_id").references(() => users.id),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("1.00"),
  source: varchar("source", { length: 50 }).default("manual"), // manual, ai_analysis, cc_analysis
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  companyIdx: index("idx_company_hierarchy_company").on(table.companyId),
  employeeIdx: index("idx_company_hierarchy_employee").on(table.employeeUserId),
  managerIdx: index("idx_company_hierarchy_manager").on(table.managerUserId),
  uniqueCompanyEmployee: unique("unique_company_employee").on(table.companyId, table.employeeUserId),
}));

// Polling Agent Participants - Who can submit to which agents
export const pollingAgentParticipants = pgTable("polling_agent_participants", {
  id: serial("id").primaryKey(),
  pollingAgentId: integer("polling_agent_id").notNull().references(() => pollingAgents.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role").notNull().default('participant'), // 'admin', 'analyst', 'participant'
  canViewInsights: boolean("can_view_insights").default(true),
  canViewDetailedAnalytics: boolean("can_view_detailed_analytics").default(false),
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  agentUserIdx: index("idx_agent_participant").on(table.pollingAgentId, table.userId),
  userIdx: index("idx_participant_user").on(table.userId),
  uniqueAgentUser: unique("unique_agent_user").on(table.pollingAgentId, table.userId),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
export const insertProjectSchema = createInsertSchema(projects);
export const insertTaskSchema = createInsertSchema(tasks);
export const insertTaskAssigneeSchema = createInsertSchema(taskAssignees);
export const insertEmailCredentialsSchema = createInsertSchema(emailCredentials);
export const insertProcessedEmailSchema = createInsertSchema(processedEmails);
export const insertUserTrustRelationshipSchema = createInsertSchema(userTrustRelationships);
export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences);
export const insertPollingAgentSchema = createInsertSchema(pollingAgents);
export const insertT5tSubmissionSchema = createInsertSchema(t5tSubmissions);
export const insertPollingInsightSchema = createInsertSchema(pollingInsights);
export const insertUserDepartmentSchema = createInsertSchema(userDepartments);
export const insertPollingAgentParticipantSchema = createInsertSchema(pollingAgentParticipants);
export const insertEmailOptOutSchema = createInsertSchema(emailOptOuts);
export const insertDocumentAnalysisResultSchema = createInsertSchema(documentAnalysisResults);

// New company system schemas
export const insertCompanySchema = createInsertSchema(companies);
export const insertCompanyMembershipSchema = createInsertSchema(companyMemberships);
export const insertCompanyInvitationSchema = createInsertSchema(companyInvitations);
export const insertCompanyDepartmentSchema = createInsertSchema(companyDepartments);
export const insertCompanyHierarchySchema = createInsertSchema(companyHierarchy);

// Types - Work around Drizzle inference issues by defining explicit types
export type User = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  password: string | null;
  authProvider: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type UpsertUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  password?: string | null;
  authProvider?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

// Original Drizzle inferred types (keeping for reference but not using due to inference issues)
export type DrizzleUser = typeof users.$inferSelect;
export type DrizzleUpsertUser = typeof users.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type TaskAssignee = typeof taskAssignees.$inferSelect;
export type InsertTaskAssignee = typeof taskAssignees.$inferInsert;
export type EmailCredentials = typeof emailCredentials.$inferSelect;
export type InsertEmailCredentials = typeof emailCredentials.$inferInsert;
export type ProcessedEmail = typeof processedEmails.$inferSelect;
export type InsertProcessedEmail = typeof processedEmails.$inferInsert;
export type ProjectParticipant = typeof projectParticipants.$inferSelect;
export type InsertProjectParticipant = typeof projectParticipants.$inferInsert;
export type UserTrustRelationship = typeof userTrustRelationships.$inferSelect;
export type InsertUserTrustRelationship = typeof userTrustRelationships.$inferInsert;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;
export type PollingAgent = typeof pollingAgents.$inferSelect;

// Explicit type definition to work around Drizzle inference issues
export type InsertPollingAgent = {
  name: string;
  description?: string;
  emailAddress: string;
  commandPrefix?: string;
  type?: string;
  isActive?: boolean;
  organizationId?: string; // Legacy field
  organizationName?: string; // Legacy field
  organizationDescription?: string; // Legacy field
  companyId?: number; // New field referencing companies table
  accountType?: string; // 'individual' or 'company'
  createdBy: string;
  settings?: any; // JSONB field
};
export type T5tSubmission = typeof t5tSubmissions.$inferSelect;

// Explicit type definition to work around Drizzle inference issues
export type InsertT5tSubmission = {
  pollingAgentId: number;
  submitterUserId: string;
  submitterEmail: string;
  messageId: string;
  subject: string;
  rawContent: string;
  parsedItems?: any; // JSONB field
  sentiment?: string;
  sentimentScore?: number;
  topics?: string[];
  priority?: string;
  weekNumber?: number;
  monthNumber?: number;
  yearNumber?: number;
  submissionDate: Date;
  processedAt?: Date;
  processingStatus?: string;
  processingError?: string;
};
export type PollingInsight = typeof pollingInsights.$inferSelect;
export type InsertPollingInsight = typeof pollingInsights.$inferInsert;
export type UserDepartment = typeof userDepartments.$inferSelect;
export type InsertUserDepartment = typeof userDepartments.$inferInsert;
export type PollingAgentParticipant = typeof pollingAgentParticipants.$inferSelect;
export type InsertPollingAgentParticipant = typeof pollingAgentParticipants.$inferInsert;
export type EmailOptOut = typeof emailOptOuts.$inferSelect;
export type InsertEmailOptOut = typeof emailOptOuts.$inferInsert;
export type DocumentAnalysisResult = typeof documentAnalysisResults.$inferSelect;
export type InsertDocumentAnalysisResult = typeof documentAnalysisResults.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type TrustConfirmationToken = typeof trustConfirmationTokens.$inferSelect;
export type InsertTrustConfirmationToken = typeof trustConfirmationTokens.$inferInsert;
export type UserLinkedAccount = typeof userLinkedAccounts.$inferSelect;
export type InsertUserLinkedAccount = typeof userLinkedAccounts.$inferInsert;

// Polling system relations
export const pollingAgentsRelations = relations(pollingAgents, ({ one, many }) => ({
  creator: one(users, { fields: [pollingAgents.createdBy], references: [users.id] }),
  submissions: many(t5tSubmissions),
  insights: many(pollingInsights),
  participants: many(pollingAgentParticipants),
}));

export const t5tSubmissionsRelations = relations(t5tSubmissions, ({ one }) => ({
  pollingAgent: one(pollingAgents, { fields: [t5tSubmissions.pollingAgentId], references: [pollingAgents.id] }),
  submitter: one(users, { fields: [t5tSubmissions.submitterUserId], references: [users.id] }),
}));

export const pollingInsightsRelations = relations(pollingInsights, ({ one }) => ({
  pollingAgent: one(pollingAgents, { fields: [pollingInsights.pollingAgentId], references: [pollingAgents.id] }),
}));

export const userDepartmentsRelations = relations(userDepartments, ({ one }) => ({
  user: one(users, { fields: [userDepartments.userId], references: [users.id] }),
}));

export const pollingAgentParticipantsRelations = relations(pollingAgentParticipants, ({ one }) => ({
  pollingAgent: one(pollingAgents, { fields: [pollingAgentParticipants.pollingAgentId], references: [pollingAgents.id] }),
  user: one(users, { fields: [pollingAgentParticipants.userId], references: [users.id] }),
}));

// Company system relations
export const companiesRelations = relations(companies, ({ one, many }) => ({
  creator: one(users, { fields: [companies.createdBy], references: [users.id] }),
  parentCompany: one(companies, { 
    fields: [companies.parentCompanyId], 
    references: [companies.id],
    relationName: 'parent'
  }),
  subCompanies: many(companies, { relationName: 'parent' }),
  memberships: many(companyMemberships),
  invitations: many(companyInvitations),
  departments: many(companyDepartments),
  hierarchies: many(companyHierarchy),
  pollingAgents: many(pollingAgents),
}));

export const companyMembershipsRelations = relations(companyMemberships, ({ one }) => ({
  company: one(companies, { fields: [companyMemberships.companyId], references: [companies.id] }),
  user: one(users, { fields: [companyMemberships.userId], references: [users.id] }),
}));

export const companyInvitationsRelations = relations(companyInvitations, ({ one }) => ({
  company: one(companies, { fields: [companyInvitations.companyId], references: [companies.id] }),
  inviter: one(users, { fields: [companyInvitations.inviterUserId], references: [users.id] }),
  invitee: one(users, { fields: [companyInvitations.inviteeUserId], references: [users.id] }),
}));

export const companyDepartmentsRelations = relations(companyDepartments, ({ one }) => ({
  company: one(companies, { fields: [companyDepartments.companyId], references: [companies.id] }),
  manager: one(users, { fields: [companyDepartments.managerUserId], references: [users.id] }),
}));

export const companyHierarchyRelations = relations(companyHierarchy, ({ one }) => ({
  company: one(companies, { fields: [companyHierarchy.companyId], references: [companies.id] }),
  employee: one(users, { fields: [companyHierarchy.employeeUserId], references: [users.id] }),
  manager: one(users, { fields: [companyHierarchy.managerUserId], references: [users.id] }),
}));

// Identity system relations
export const identitiesRelations = relations(identities, ({ one, many }) => ({
  user: one(users, { fields: [identities.userId], references: [users.id] }),
  company: one(companies, { fields: [identities.companyId], references: [companies.id] }),
  agentInstances: many(agentInstances),
  projects: many(projects),
  access: many(identityAccess),
  sessionContexts: many(userSessionContext),
}));

export const identityAccessRelations = relations(identityAccess, ({ one }) => ({
  identity: one(identities, { fields: [identityAccess.identityId], references: [identities.id] }),
  user: one(users, { fields: [identityAccess.userId], references: [users.id] }),
}));

export const userSessionContextRelations = relations(userSessionContext, ({ one }) => ({
  user: one(users, { fields: [userSessionContext.userId], references: [users.id] }),
  currentIdentity: one(identities, { fields: [userSessionContext.currentIdentityId], references: [identities.id] }),
}));

// Agent instances relations
export const agentInstancesRelations = relations(agentInstances, ({ one, many }) => ({
  identity: one(identities, { fields: [agentInstances.identityId], references: [identities.id] }),
  // Legacy user relation
  user: one(users, { fields: [agentInstances.userId], references: [users.id] }),
  projects: many(projects),
}));

// Company system types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type CompanyMembership = typeof companyMemberships.$inferSelect;
export type InsertCompanyMembership = typeof companyMemberships.$inferInsert;
export type CompanyInvitation = typeof companyInvitations.$inferSelect;
export type InsertCompanyInvitation = typeof companyInvitations.$inferInsert;
export type CompanyDepartment = typeof companyDepartments.$inferSelect;
export type InsertCompanyDepartment = typeof companyDepartments.$inferInsert;
export type CompanyHierarchy = typeof companyHierarchy.$inferSelect;
export type InsertCompanyHierarchy = typeof companyHierarchy.$inferInsert;

// Identity system types
export type Identity = typeof identities.$inferSelect;
export type InsertIdentity = typeof identities.$inferInsert;
export type IdentityAccess = typeof identityAccess.$inferSelect;
export type InsertIdentityAccess = typeof identityAccess.$inferInsert;
export type UserSessionContext = typeof userSessionContext.$inferSelect;
export type InsertUserSessionContext = typeof userSessionContext.$inferInsert;

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tokenIdx: index("idx_password_reset_token").on(table.token),
  userIdIdx: index("idx_password_reset_user_id").on(table.userId),
  expiresAtIdx: index("idx_password_reset_expires_at").on(table.expiresAt),
}));

// Trust confirmation tokens
export const trustConfirmationTokens = pgTable("trust_confirmation_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token").notNull().unique(),
  action: varchar("action").notNull(), // 'trust' or 'block'
  inviterUserId: varchar("inviter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectName: varchar("project_name"),
  emailSubject: varchar("email_subject"),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tokenIdx: index("idx_trust_token").on(table.token),
  inviterIdx: index("idx_trust_inviter").on(table.inviterUserId),
  targetIdx: index("idx_trust_target").on(table.targetUserId),
  expiresAtIdx: index("idx_trust_expires_at").on(table.expiresAt),
  actionIdx: index("idx_trust_action").on(table.action),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const trustConfirmationTokensRelations = relations(trustConfirmationTokens, ({ one }) => ({
  inviterUser: one(users, { fields: [trustConfirmationTokens.inviterUserId], references: [users.id] }),
  targetUser: one(users, { fields: [trustConfirmationTokens.targetUserId], references: [users.id] }),
}));

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens);
export const insertTrustConfirmationTokenSchema = createInsertSchema(trustConfirmationTokens);
export const insertUserLinkedAccountSchema = createInsertSchema(userLinkedAccounts);
