import { vi } from 'vitest'
import { EmailData } from '../src/services/email/types'
import { isServiceEmail } from '../src/services/utils/emailUtils'

/**
 * Test utilities for creating mock data
 */

export function createMockEmail(overrides: Partial<EmailData> = {}): EmailData {
  const now = new Date()
  const messageId = `test-${now.getTime()}-${Math.random().toString(36).slice(2)}`
  
  return {
    messageId,
    subject: 'Test Email Subject',
    from: 'test@example.com',
    to: ['agent@inboxleap.com'],
    cc: [],
    bcc: [],
    body: 'This is a test email body with some content.',
    date: now,
    inReplyTo: undefined,
    references: [],
    threadId: undefined,
    ...overrides
  }
}

export function createMockIntelligenceEmail(companySlug: string, overrides: Partial<EmailData> = {}): EmailData {
  return createMockEmail({
    to: [`t5t+${companySlug}@inboxleap.com`],
    subject: 'Weekly T5T Submission',
    body: `Here are this week's top 5 things:
    
1. Launched new feature X - seeing good user adoption
2. Customer feedback has been very positive 
3. Need to hire 2 more engineers this quarter
4. Revenue is trending 15% above target
5. Partnership discussions with BigCorp are progressing`,
    ...overrides
  })
}

export function createMockTaskEmail(overrides: Partial<EmailData> = {}): EmailData {
  return createMockEmail({
    to: ['agent@inboxleap.com'],
    subject: 'Project Update - Need Reviews',
    body: `Hi team,

I need help with the following tasks:
- Review the new user interface designs
- Test the payment integration
- Update the documentation

Please let me know when you can help.

Best regards`,
    ...overrides
  })
}

export function createMockUser(overrides: any = {}) {
  const now = new Date()
  return {
    id: `user-${now.getTime()}-${Math.random().toString(36).slice(2)}`,
    email: `test-${now.getTime()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    authProvider: 'system' as const,
    profileImageUrl: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

export function createMockProject(createdBy: string, overrides: any = {}) {
  const now = new Date()
  return {
    id: `project-${now.getTime()}-${Math.random().toString(36).slice(2)}`,
    name: 'Test Project',
    type: 'team' as const,
    topic: 'Test Topic',
    createdBy,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

export function createMockTask(projectId: string, createdBy: string, overrides: any = {}) {
  const now = new Date()
  return {
    id: `task-${now.getTime()}-${Math.random().toString(36).slice(2)}`,
    projectId,
    title: 'Test Task',
    description: 'This is a test task description',
    priority: 'medium' as const,
    status: 'pending' as const,
    createdBy,
    sourceEmail: 'test@example.com',
    sourceEmailSubject: 'Test Email',
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

export function createMockPollingAgent(organizationId: string, createdBy: string, overrides: any = {}) {
  const now = new Date()
  const slug = `test-company-${now.getTime()}`
  
  return {
    id: `agent-${now.getTime()}-${Math.random().toString(36).slice(2)}`,
    name: 'Test Tanya Agent',
    type: 't5t' as const,
    organizationId,
    organizationName: 'Test Company',
    organizationSlug: slug,
    emailAddress: `t5t+${slug}@inboxleap.com`,
    instructions: 'Test intelligence gathering instructions',
    createdBy,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function stripServiceEmails(emails: string[]): string[] {
  return emails.filter(email => !isServiceEmail(email))
}

/**
 * Create a mock storage implementation for testing
 */
export function createMockStorage() {
  return {
    // User operations
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUsersByEmail: vi.fn(),
    createUserFromEmail: vi.fn(),
    createUser: vi.fn(),
    getUserByEmailWithPassword: vi.fn(),
    upsertUser: vi.fn(),

    // Project operations
    getProject: vi.fn(),
    createProject: vi.fn(),
    getUserProjects: vi.fn(),
    findProjectByTopicAndParticipants: vi.fn(),
    findProjectByThreadId: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),

    // Task operations
    getTask: vi.fn(),
    createTask: vi.fn(),
    getProjectTasks: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    getUserTasks: vi.fn(),
    getUserAssignedTasks: vi.fn(),
    getTasksAssignedByUser: vi.fn(),
    getUserMonitorTasks: vi.fn(),
    getUserDoneTasks: vi.fn(),

    // Task assignees
    addTaskAssignee: vi.fn(),
    getTaskAssignees: vi.fn(),
    removeTaskAssignee: vi.fn(),
    getTasksWithAssignees: vi.fn(),

    // Project participants
    addProjectParticipant: vi.fn(),
    getProjectParticipants: vi.fn(),
    getProjectParticipant: vi.fn(),

    // Email credentials
    getUserEmailCredentials: vi.fn(),
    createEmailCredentials: vi.fn(),
    getActiveEmailCredentials: vi.fn(),

    // Processed emails
    createProcessedEmail: vi.fn(),
    getProcessedEmail: vi.fn(),

    // T5T operations
    createT5tSubmission: vi.fn(),
    getT5tSubmissionByMessageId: vi.fn(),
    getT5tSubmissions: vi.fn(),
    getT5tSubmissionsByAgent: vi.fn(),
    getT5tSubmissionsByUser: vi.fn(),
    updateT5tSubmission: vi.fn(),

    // Polling agents
    createPollingAgent: vi.fn(),
    getPollingAgent: vi.fn(),
    getPollingAgents: vi.fn(),
    updatePollingAgent: vi.fn(),
    deletePollingAgent: vi.fn(),
    getPollingAgentByEmail: vi.fn(),

    // Insights
    createPollingInsight: vi.fn(),
    getPollingInsights: vi.fn(),
    getInsightsByAgent: vi.fn(),

    // Trust relationships
    getTrustRelationship: vi.fn(),
    createTrustRelationship: vi.fn(),
    updateTrustRelationship: vi.fn(),
    getUserTrustRelationship: vi.fn(),
    createUserTrustRelationship: vi.fn(),
    updateUserTrustRelationship: vi.fn(),
    upsertTrustRelationship: vi.fn(),

    // Notification preferences
    getNotificationPreferences: vi.fn(),
    upsertNotificationPreferences: vi.fn(),
    createNotificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),

    // Notification queue
    createNotificationQueueItem: vi.fn(),
    updateNotificationQueueItem: vi.fn(),
    getNotificationsByStatus: vi.fn(),
    getNotificationStats: vi.fn(),

    // Departments
    createUserDepartment: vi.fn(),
    getUserDepartment: vi.fn(),
    updateUserDepartment: vi.fn(),
    deleteUserDepartment: vi.fn(),

    // Email opt-outs
    createEmailOptOut: vi.fn(),
    getEmailOptOut: vi.fn(),
    deleteEmailOptOut: vi.fn(),

    // Agent participants
    addPollingAgentParticipant: vi.fn(),
    removePollingAgentParticipant: vi.fn(),
    getPollingAgentParticipants: vi.fn(),
  }
}
