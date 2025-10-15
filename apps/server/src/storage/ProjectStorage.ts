import { db } from '../db';
import { eq, and, desc, asc, isNull, not, sql, or, inArray } from 'drizzle-orm';
import {
  projects,
  projectParticipants,
  tasks,
  taskAssignees,
  users,
  processedEmails,
  agentInstances,
  type Project,
  type InsertProject,
  type ProjectParticipant,
  type InsertProjectParticipant,
  type Task,
  type InsertTask,
  type TaskAssignee,
  type InsertTaskAssignee,
  type ProcessedEmail,
} from '@email-task-router/shared';

export class ProjectStorage {
  private normalizeEmailList(emails: string[]): string[] {
    const normalized = new Set<string>();
    for (const value of emails) {
      if (!value) {
        continue;
      }
      const match = value.match(/<([^>]+)>/);
      const email = (match ? match[1] : value).trim().toLowerCase();
      if (email) {
        normalized.add(email);
      }
    }
    return Array.from(normalized).sort();
  }

  private emailSetsOverlap(target: string[], candidate: string[]): boolean {
    if (!target.length || !candidate.length) {
      return false;
    }
    const targetSet = new Set(target);
    const candidateSet = new Set(candidate);
    let intersection = 0;
    for (const email of targetSet) {
      if (candidateSet.has(email)) {
        intersection++;
      }
    }
    if (intersection === 0) {
      return false;
    }
    if (intersection === targetSet.size || intersection === candidateSet.size) {
      return true;
    }
    const minSize = Math.min(targetSet.size, candidateSet.size);
    return intersection >= Math.max(1, Math.floor(minSize * 0.75));
  }

  async createProject(projectData: InsertProject): Promise<Project> {
    try {
      const [project] = await db.insert(projects)
        .values(projectData)
        .returning();
      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  /**
   * Get projects for an identity
   */
  async getIdentityProjects(identityId: number): Promise<Project[]> {
    try {
      const projectsData = await db.select({
        id: projects.id,
        name: projects.name,
        type: projects.type,
        createdBy: projects.createdBy,
        companyId: projects.companyId,
        identityId: projects.identityId,
        agentInstanceId: projects.agentInstanceId,
        topic: projects.topic,
        sourceEmail: projects.sourceEmail,
        sourceEmailSubject: projects.sourceEmailSubject,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
        .from(projects)
        .where(eq(projects.identityId, identityId))
        .orderBy(desc(projects.updatedAt));

      // Get participants for all projects
      const projectIds = projectsData.map(p => p.id);
      if (projectIds.length === 0) return [];

      const participantsData = await db.select()
        .from(projectParticipants)
        .where(inArray(projectParticipants.projectId, projectIds));

      return projectsData.map(project => ({
        ...project,
        participants: participantsData
          .filter(p => p.projectId === project.id)
          .map(p => ({
            userId: p.userId,
            role: p.role,
            canEdit: p.canEdit,
          })),
      }));
    } catch (error) {
      console.error('Error fetching identity projects:', error);
      return [];
    }
  }

  /**
   * Get projects where user is a participant (including projects they don't own)
   */
  async getProjectsWhereUserIsParticipant(userId: string): Promise<Project[]> {
    try {
      console.log(`🔍 [ProjectStorage] ========== FETCHING PARTICIPANT PROJECTS ==========`);
      console.log(`🔍 [ProjectStorage] User ID: ${userId}`);

      // Find all projects where user is a participant
      const participantsData = await db.select({
        projectId: projectParticipants.projectId,
        userId: projectParticipants.userId,
        role: projectParticipants.role,
      })
        .from(projectParticipants)
        .where(eq(projectParticipants.userId, userId));

      console.log(`🔍 [ProjectStorage] Query result: Found ${participantsData.length} participant records`);
      console.log(`🔍 [ProjectStorage] Participant data:`, JSON.stringify(participantsData, null, 2));
      if (participantsData.length === 0) return [];

      const projectIds = participantsData.map(p => p.projectId);

      // Fetch the actual project data
      const projectsData = await db.select({
        id: projects.id,
        name: projects.name,
        type: projects.type,
        createdBy: projects.createdBy,
        companyId: projects.companyId,
        identityId: projects.identityId,
        agentInstanceId: projects.agentInstanceId,
        topic: projects.topic,
        sourceEmail: projects.sourceEmail,
        sourceEmailSubject: projects.sourceEmailSubject,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
        .from(projects)
        .where(inArray(projects.id, projectIds))
        .orderBy(desc(projects.updatedAt));

      // Get all participants for these projects
      const allParticipantsData = await db.select()
        .from(projectParticipants)
        .where(inArray(projectParticipants.projectId, projectIds));

      const result = projectsData.map(project => ({
        ...project,
        participants: allParticipantsData
          .filter(p => p.projectId === project.id)
          .map(p => ({
            userId: p.userId,
            role: p.role,
            canEdit: p.canEdit,
          })),
      }));

      console.log(`✅ [ProjectStorage] Returning ${result.length} projects where user ${userId} is a participant`);
      return result;
    } catch (error) {
      console.error('❌ [ProjectStorage] Error fetching projects where user is participant:', error);
      return [];
    }
  }

  async getUserProjects(userId: string, companyId?: number): Promise<Project[]> {
    try {
      // Get user's agent instance emails
      const userAgentEmails = await db.select({ emailAddress: agentInstances.emailAddress })
        .from(agentInstances)
        .where(and(
          eq(agentInstances.userId, userId),
          eq(agentInstances.isActive, true)
        ));

      const agentEmailList = userAgentEmails.map(instance => instance.emailAddress);
      // Always include default todo email for legacy projects
      agentEmailList.push('todo@inboxleap.com');

      // Projects where the user is an explicit participant
      const participantProjectRows = await db.select({ projectId: projectParticipants.projectId })
        .from(projectParticipants)
        .where(eq(projectParticipants.userId, userId));
      const participantProjectIds = participantProjectRows.map(row => row.projectId);

      const visibilityConditions = [
        eq(projects.createdBy, userId),
      ];

      if (agentEmailList.length > 0) {
        visibilityConditions.push(inArray(projects.sourceEmail, agentEmailList));
      }

      if (participantProjectIds.length > 0) {
        visibilityConditions.push(inArray(projects.id, participantProjectIds));
      }

      const projectVisibility = visibilityConditions.length > 1
        ? or(...visibilityConditions)
        : visibilityConditions[0];

      const filters = [projectVisibility];

      if (companyId !== undefined) {
        filters.push(eq(projects.companyId, companyId));
      } else {
        // Default to individual projects (companyId = null)
        filters.push(isNull(projects.companyId));
      }

      const projectsData = await db.select({
        id: projects.id,
        name: projects.name,
        type: projects.type,
        createdBy: projects.createdBy,
        companyId: projects.companyId,
        identityId: projects.identityId,
        agentInstanceId: projects.agentInstanceId,
        topic: projects.topic,
        sourceEmail: projects.sourceEmail,
        sourceEmailSubject: projects.sourceEmailSubject,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
        .from(projects)
        .where(and(...filters))
        .orderBy(desc(projects.createdAt));

      const projectsWithStats = await Promise.all(
        projectsData.map(async (project) => {
          const [emailCountResult] = await db.select({ count: sql<number>`count(*)` })
            .from(processedEmails)
            .where(eq(processedEmails.projectId, project.id));

          return {
            ...project,
            emailCount: emailCountResult?.count || 0,
          };
        })
      );

      const projectIds = projectsWithStats.map(project => project.id);
      const participantsData = projectIds.length > 0
        ? await db.select({
            projectId: projectParticipants.projectId,
            userId: projectParticipants.userId,
            role: projectParticipants.role,
            canEdit: projectParticipants.canEdit,
          })
            .from(projectParticipants)
            .where(inArray(projectParticipants.projectId, projectIds))
        : [];

      return projectsWithStats.map(project => {
        const projectParticipantsList = participantsData
          .filter(participant => participant.projectId === project.id)
          .map(participant => ({
            userId: participant.userId,
            role: participant.role,
            canEdit: participant.canEdit,
          }));

        return {
          ...project,
          participantCount: projectParticipantsList.length,
          participants: projectParticipantsList,
        };
      });
    } catch (error) {
      console.error('Error getting user projects:', error);
      return [];
    }
  }

  // TEMPORARY: Simple method to get all projects created by user (bypass identity filtering)
  async getProjectsByCreator(userId: string): Promise<Project[]> {
    try {
      const projectsData = await db.select({
        id: projects.id,
        name: projects.name,
        type: projects.type,
        createdBy: projects.createdBy,
        companyId: projects.companyId,
        identityId: projects.identityId,
        agentInstanceId: projects.agentInstanceId,
        topic: projects.topic,
        sourceEmail: projects.sourceEmail,
        sourceEmailSubject: projects.sourceEmailSubject,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
        .from(projects)
        .where(eq(projects.createdBy, userId))
        .orderBy(desc(projects.createdAt));

      // Add stats (emailCount, participantCount) to each project
      const projectsWithStats = await Promise.all(
        projectsData.map(async (project) => {
          // Get email count for this project
          const emailCount = await db.select({ count: sql<number>`count(*)` })
            .from(processedEmails)
            .where(eq(processedEmails.projectId, project.id));

          // Get participant count for this project
          const participantCount = await db.select({ count: sql<number>`count(*)` })
            .from(projectParticipants)
            .where(eq(projectParticipants.projectId, project.id));

          return {
            ...project,
            emailCount: emailCount[0]?.count || 0,
            participantCount: participantCount[0]?.count || 0,
          };
        })
      );

      return projectsWithStats;
    } catch (error) {
      console.error('Error getting projects by creator:', error);
      return [];
    }
  }

  async getProject(id: number): Promise<Project | undefined> {
    try {
      const [project] = await db.select()
        .from(projects)
        .where(eq(projects.id, id));
      return project;
    } catch (error) {
      console.error('Error getting project:', error);
      return undefined;
    }
  }

  async findProjectByThreadId(threadId: string): Promise<Project | null> {
    if (!threadId) {
      return null;
    }
    try {
      const [project] = await db.select()
        .from(projects)
        .where(eq(projects.topic, threadId))
        .orderBy(desc(projects.updatedAt))
        .limit(1);
      return project || null;
    } catch (error) {
      console.error('Error finding project by thread ID:', error);
      return null;
    }
  }

  async findProjectByTopicAndParticipants(topic: string, participants: string[]): Promise<Project | null> {
    const normalizedTopic = topic?.trim();
    const normalizedParticipants = this.normalizeEmailList(participants);

    if (!normalizedTopic || normalizedParticipants.length === 0) {
      return null;
    }

    try {
      const candidateProjects = await db.select()
        .from(projects)
        .where(eq(projects.topic, normalizedTopic))
        .orderBy(desc(projects.updatedAt))
        .limit(10);

      for (const candidate of candidateProjects) {
        const participantRows = await db.select({
          email: users.email,
        })
          .from(projectParticipants)
          .leftJoin(users, eq(projectParticipants.userId, users.id))
          .where(eq(projectParticipants.projectId, candidate.id));

        const candidateEmails = this.normalizeEmailList(participantRows.map(row => row.email ?? ''));

        if (this.emailSetsOverlap(normalizedParticipants, candidateEmails)) {
          return candidate;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding project by topic and participants:', error);
      return null;
    }
  }

  async getProjectTasks(projectId: number): Promise<Task[]> {
    return this.getTasks(projectId);
  }

  async updateProject(id: number, projectData: Partial<InsertProject>): Promise<Project> {
    try {
      const [project] = await db.update(projects)
        .set({ ...projectData, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();
      return project;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  async deleteProject(id: number): Promise<void> {
    try {
      await db.delete(projects).where(eq(projects.id, id));
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  async addProjectParticipant(participantData: InsertProjectParticipant): Promise<ProjectParticipant> {
    try {
      console.log(`💾 [ProjectStorage] Adding participant to DB:`, JSON.stringify(participantData, null, 2));
      const [participant] = await db.insert(projectParticipants)
        .values(participantData)
        .returning();
      console.log(`✅ [ProjectStorage] Participant added successfully:`, JSON.stringify(participant, null, 2));
      return participant;
    } catch (error) {
      console.error('❌ [ProjectStorage] Error adding project participant:', error);
      throw error;
    }
  }

  async getProjectParticipants(projectId: number): Promise<ProjectParticipant[]> {
    try {
      return await db.select()
        .from(projectParticipants)
        .where(eq(projectParticipants.projectId, projectId))
        .orderBy(asc(projectParticipants.joinedAt));
    } catch (error) {
      console.error('Error getting project participants:', error);
      return [];
    }
  }

  async removeProjectParticipant(projectId: number, userId: string): Promise<void> {
    try {
      await db.delete(projectParticipants)
        .where(and(
          eq(projectParticipants.projectId, projectId),
          eq(projectParticipants.userId, userId)
        ));
    } catch (error) {
      console.error('Error removing project participant:', error);
      throw error;
    }
  }

  async isUserProjectParticipant(projectId: number, userId: string): Promise<boolean> {
    try {
      const [participant] = await db.select()
        .from(projectParticipants)
        .where(and(
          eq(projectParticipants.projectId, projectId),
          eq(projectParticipants.userId, userId)
        ))
        .limit(1);
      return !!participant;
    } catch (error) {
      console.error('Error checking if user is project participant:', error);
      return false;
    }
  }

  // Task operations
  async createTask(taskData: InsertTask): Promise<Task> {
    try {
      const [task] = await db.insert(tasks)
        .values(taskData)
        .returning();
      return task;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async getTasks(projectId: number): Promise<Task[]> {
    try {
      return await db.select()
        .from(tasks)
        .where(eq(tasks.projectId, projectId))
        .orderBy(desc(tasks.createdAt));
    } catch (error) {
      console.error('Error getting tasks:', error);
      return [];
    }
  }

  async getTask(id: number): Promise<Task | undefined> {
    try {
      const [task] = await db.select()
        .from(tasks)
        .where(eq(tasks.id, id));
      return task;
    } catch (error) {
      console.error('Error getting task:', error);
      return undefined;
    }
  }

  async updateTask(id: number, taskData: Partial<InsertTask>): Promise<Task> {
    try {
      const [task] = await db.update(tasks)
        .set({ ...taskData, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();
      return task;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async deleteTask(id: number): Promise<void> {
    try {
      await db.delete(tasks).where(eq(tasks.id, id));
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  async assignTask(assignmentData: InsertTaskAssignee): Promise<TaskAssignee> {
    try {
      const [assignment] = await db.insert(taskAssignees)
        .values(assignmentData)
        .returning();
      return assignment;
    } catch (error) {
      console.error('Error assigning task:', error);
      throw error;
    }
  }

  async getTaskAssignees(taskId: number): Promise<TaskAssignee[]> {
    try {
      return await db.select()
        .from(taskAssignees)
        .where(eq(taskAssignees.taskId, taskId))
        .orderBy(asc(taskAssignees.assignedAt));
    } catch (error) {
      console.error('Error getting task assignees:', error);
      return [];
    }
  }

  async unassignTask(taskId: number, userId: string): Promise<void> {
    try {
      await db.delete(taskAssignees)
        .where(and(
          eq(taskAssignees.taskId, taskId),
          eq(taskAssignees.userId, userId)
        ));
    } catch (error) {
      console.error('Error unassigning task:', error);
      throw error;
    }
  }

  // Get tasks assigned to a user
  async getUserAssignedTasks(userId: string, companyId?: number): Promise<Task[]> {
    try {
      const query = db.select({
        id: tasks.id,
        projectId: tasks.projectId,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        sourceEmail: tasks.sourceEmail,
        sourceEmailSubject: tasks.sourceEmailSubject,
        createdBy: tasks.createdBy,
        companyId: tasks.companyId,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assignees: sql`COALESCE(
          JSON_ARRAYAGG(
            CASE WHEN ${taskAssignees.id} IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', ${taskAssignees.id},
                'userId', ${taskAssignees.userId},
                'assignedAt', ${taskAssignees.assignedAt},
                'user', JSON_BUILD_OBJECT(
                  'id', ${users.id},
                  'email', ${users.email},
                  'firstName', ${users.firstName},
                  'lastName', ${users.lastName},
                  'profileImageUrl', ${users.profileImageUrl}
                )
              )
            END
          ) FILTER (WHERE ${taskAssignees.id} IS NOT NULL),
          '[]'::json
        )`.as('assignees'),
        project: sql`JSON_BUILD_OBJECT(
          'id', ${projects.id},
          'name', ${projects.name}
        )`.as('project')
      })
      .from(tasks)
      .innerJoin(taskAssignees, eq(tasks.id, taskAssignees.taskId))
      .leftJoin(users, eq(taskAssignees.userId, users.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        eq(taskAssignees.userId, userId),
        not(eq(tasks.status, 'done')),
        companyId ? eq(projects.companyId, companyId) : isNull(projects.companyId)
      ))
      .groupBy(tasks.id, projects.id, projects.name)
      .orderBy(desc(tasks.createdAt));

      return await query;
    } catch (error) {
      console.error('Error getting user assigned tasks:', error);
      throw error;
    }
  }

  // Get tasks assigned by a user (tasks they created and assigned to others)
  async getTasksAssignedByUser(userId: string, companyId?: number): Promise<Task[]> {
    try {
      const query = db.select({
        id: tasks.id,
        projectId: tasks.projectId,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        sourceEmail: tasks.sourceEmail,
        sourceEmailSubject: tasks.sourceEmailSubject,
        createdBy: tasks.createdBy,
        companyId: tasks.companyId,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assignees: sql`COALESCE(
          JSON_ARRAYAGG(
            CASE WHEN ${taskAssignees.id} IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', ${taskAssignees.id},
                'userId', ${taskAssignees.userId},
                'assignedAt', ${taskAssignees.assignedAt},
                'user', JSON_BUILD_OBJECT(
                  'id', ${users.id},
                  'email', ${users.email},
                  'firstName', ${users.firstName},
                  'lastName', ${users.lastName},
                  'profileImageUrl', ${users.profileImageUrl}
                )
              )
            END
          ) FILTER (WHERE ${taskAssignees.id} IS NOT NULL),
          '[]'::json
        )`.as('assignees'),
        project: sql`JSON_BUILD_OBJECT(
          'id', ${projects.id},
          'name', ${projects.name}
        )`.as('project'),
        assignedByMe: sql`TRUE`.as('assignedByMe')
      })
      .from(tasks)
      .leftJoin(taskAssignees, eq(tasks.id, taskAssignees.taskId))
      .leftJoin(users, eq(taskAssignees.userId, users.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        eq(tasks.createdBy, userId),
        not(eq(tasks.status, 'done')),
        companyId ? eq(projects.companyId, companyId) : isNull(projects.companyId)
      ))
      .groupBy(tasks.id, projects.id, projects.name)
      .orderBy(desc(tasks.createdAt));

      return await query;
    } catch (error) {
      console.error('Error getting tasks assigned by user:', error);
      throw error;
    }
  }

  // Get tasks a user is monitoring (could be based on project participation or other criteria)
  async getUserMonitorTasks(userId: string, companyId?: number): Promise<Task[]> {
    try {
      // For now, return tasks from projects the user participates in but isn't directly assigned to
      const query = db.select({
        id: tasks.id,
        projectId: tasks.projectId,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        sourceEmail: tasks.sourceEmail,
        sourceEmailSubject: tasks.sourceEmailSubject,
        createdBy: tasks.createdBy,
        companyId: tasks.companyId,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assignees: sql`COALESCE(
          JSON_ARRAYAGG(
            CASE WHEN ${taskAssignees.id} IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', ${taskAssignees.id},
                'userId', ${taskAssignees.userId},
                'assignedAt', ${taskAssignees.assignedAt},
                'user', JSON_BUILD_OBJECT(
                  'id', ${users.id},
                  'email', ${users.email},
                  'firstName', ${users.firstName},
                  'lastName', ${users.lastName},
                  'profileImageUrl', ${users.profileImageUrl}
                )
              )
            END
          ) FILTER (WHERE ${taskAssignees.id} IS NOT NULL),
          '[]'::json
        )`.as('assignees'),
        project: sql`JSON_BUILD_OBJECT(
          'id', ${projects.id},
          'name', ${projects.name}
        )`.as('project')
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(projectParticipants, eq(projects.id, projectParticipants.projectId))
      .leftJoin(taskAssignees, eq(tasks.id, taskAssignees.taskId))
      .leftJoin(users, eq(taskAssignees.userId, users.id))
      .where(and(
        eq(projectParticipants.userId, userId),
        not(eq(tasks.status, 'done')),
        not(eq(tasks.createdBy, userId)),
        companyId ? eq(projects.companyId, companyId) : isNull(projects.companyId),
        // Exclude tasks where user is directly assigned
        sql`NOT EXISTS (
          SELECT 1 FROM ${taskAssignees} ta 
          WHERE ta.task_id = ${tasks.id} AND ta.user_id = ${userId}
        )`
      ))
      .groupBy(tasks.id, projects.id, projects.name)
      .orderBy(desc(tasks.createdAt));

      return await query;
    } catch (error) {
      console.error('Error getting user monitor tasks:', error);
      throw error;
    }
  }

  // Get completed/done tasks for a user
  async getUserDoneTasks(userId: string, companyId?: number): Promise<Task[]> {
    try {
      const query = db.select({
        id: tasks.id,
        projectId: tasks.projectId,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        sourceEmail: tasks.sourceEmail,
        sourceEmailSubject: tasks.sourceEmailSubject,
        createdBy: tasks.createdBy,
        companyId: tasks.companyId,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assignees: sql`COALESCE(
          JSON_ARRAYAGG(
            CASE WHEN ${taskAssignees.id} IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', ${taskAssignees.id},
                'userId', ${taskAssignees.userId},
                'assignedAt', ${taskAssignees.assignedAt},
                'user', JSON_BUILD_OBJECT(
                  'id', ${users.id},
                  'email', ${users.email},
                  'firstName', ${users.firstName},
                  'lastName', ${users.lastName},
                  'profileImageUrl', ${users.profileImageUrl}
                )
              )
            END
          ) FILTER (WHERE ${taskAssignees.id} IS NOT NULL),
          '[]'::json
        )`.as('assignees'),
        project: sql`JSON_BUILD_OBJECT(
          'id', ${projects.id},
          'name', ${projects.name}
        )`.as('project')
      })
      .from(tasks)
      .leftJoin(taskAssignees, eq(tasks.id, taskAssignees.taskId))
      .leftJoin(users, eq(taskAssignees.userId, users.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        eq(tasks.status, 'done'),
        companyId ? eq(projects.companyId, companyId) : isNull(projects.companyId),
        sql`(
          ${tasks.createdBy} = ${userId} OR 
          EXISTS (
            SELECT 1 FROM ${taskAssignees} ta 
            WHERE ta.task_id = ${tasks.id} AND ta.user_id = ${userId}
          )
        )`
      ))
      .groupBy(tasks.id, projects.id, projects.name)
      .orderBy(desc(tasks.updatedAt));

      return await query;
    } catch (error) {
      console.error('Error getting user done tasks:', error);
      throw error;
    }
  }

  // Get tasks with assignees for a specific project
  async getTasksWithAssignees(projectId: number): Promise<Task[]> {
    try {
      // First get all tasks for the project
      const projectTasks = await db.select()
        .from(tasks)
        .where(eq(tasks.projectId, projectId))
        .orderBy(desc(tasks.createdAt));

      // Then get assignees for each task
      const tasksWithAssignees = await Promise.all(
        projectTasks.map(async (task) => {
          const assignees = await db.select({
            id: taskAssignees.id,
            userId: taskAssignees.userId,
            assignedAt: taskAssignees.assignedAt,
            user: {
              id: users.id,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
              profileImageUrl: users.profileImageUrl
            }
          })
          .from(taskAssignees)
          .leftJoin(users, eq(taskAssignees.userId, users.id))
          .where(eq(taskAssignees.taskId, task.id));

          return {
            ...task,
            assignees: assignees.map(a => ({
              id: a.id,
              userId: a.userId,
              assignedAt: a.assignedAt,
              user: a.user
            }))
          };
        })
      );

      return tasksWithAssignees;
    } catch (error) {
      console.error('Error getting tasks with assignees:', error);
      throw error;
    }
  }

  // Get emails for a specific project
  async getProjectEmails(projectId: number): Promise<ProcessedEmail[]> {
    try {
      const emails = await db.select()
        .from(processedEmails)
        .where(eq(processedEmails.projectId, projectId))
        .orderBy(desc(processedEmails.createdAt));

      return emails;
    } catch (error) {
      console.error('Error getting project emails:', error);
      throw error;
    }
  }
}
