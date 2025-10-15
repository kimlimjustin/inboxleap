/**
 * DepartmentService - Handles organizational department management
 * 
 * Features:
 * - Extract department names from email subjects
 * - Normalize department variations (Marketing, MKT, etc.)
 * - Build organizational structure through email intelligence
 * - Integrate with project system for team collaboration
 */

interface DepartmentExtractionResult {
  departmentName: string | null;
  extractedText: string | null;
  confidence: number; // 0-100
  method: 'explicit' | 'inferred' | 'failed';
}

interface TeamStructure {
  departmentName: string;
  teamLeaderEmail: string | null;
  teamLeaderUserId: string | null;
  teamMembers: string[];
  projectId: number | null;
}

export class DepartmentService {
  
  // Department name variations mapping
  private static readonly DEPARTMENT_MAPPINGS: Record<string, string[]> = {
    'Engineering': ['eng', 'engineering', 'tech', 'technology', 'development', 'dev', 'software'],
    'Marketing': ['marketing', 'mkt', 'mrkt', 'brand', 'promotion', 'advertising', 'ad'],
    'Sales': ['sales', 'selling', 'revenue', 'business development', 'biz dev', 'bd'],
    'HR': ['hr', 'human resources', 'people', 'talent', 'recruiting', 'recruitment'],
    'Finance': ['finance', 'fin', 'accounting', 'acct', 'treasury', 'financial'],
    'Operations': ['ops', 'operations', 'operational', 'logistics', 'supply chain'],
    'Product': ['product', 'prod', 'pm', 'product management', 'product strategy'],
    'Design': ['design', 'ui', 'ux', 'creative', 'visual', 'user experience'],
    'Legal': ['legal', 'compliance', 'regulatory', 'contracts', 'law'],
    'Executive': ['exec', 'executive', 'leadership', 'c-suite', 'management'],
    'Customer Success': ['cs', 'customer success', 'support', 'customer support', 'help desk'],
    'QA': ['qa', 'quality', 'testing', 'qc', 'quality control', 'quality assurance']
  };

  /**
   * Extract department name from email subject line
   */
  static extractDepartmentFromSubject(subject: string): DepartmentExtractionResult {
    console.log(`🏢 [DEPT] Extracting department from subject: "${subject}"`);
    
    // Clean and normalize subject
    const cleanSubject = subject.trim().toUpperCase();
    
    // Method 1: Explicit department prefix (MARKETING - Top 5 Things)
    const explicitMatch = cleanSubject.match(/^([A-Z\s&]+)\s*[-–—]\s*/);
    if (explicitMatch) {
      const extractedText = explicitMatch[1].trim();
      const normalizedDept = this.normalizeDepartmentName(extractedText);
      
      if (normalizedDept) {
        console.log(`✅ [DEPT] Explicit match: "${extractedText}" → "${normalizedDept}"`);
        return {
          departmentName: normalizedDept,
          extractedText,
          confidence: 95,
          method: 'explicit'
        };
      }
    }

    // Method 2: Department mentioned in subject content
    for (const [standardName, variations] of Object.entries(this.DEPARTMENT_MAPPINGS)) {
      for (const variation of variations) {
        const regex = new RegExp(`\\b${variation.replace(/\s+/g, '\\s*')}\\b`, 'i');
        if (regex.test(subject)) {
          console.log(`✅ [DEPT] Inferred match: "${variation}" → "${standardName}"`);
          return {
            departmentName: standardName,
            extractedText: variation,
            confidence: 75,
            method: 'inferred'
          };
        }
      }
    }

    console.log(`❌ [DEPT] No department found in subject: "${subject}"`);
    return {
      departmentName: null,
      extractedText: null,
      confidence: 0,
      method: 'failed'
    };
  }

  /**
   * Normalize department name variations to standard names
   */
  private static normalizeDepartmentName(input: string): string | null {
    const normalized = input.trim().toUpperCase();
    
    for (const [standardName, variations] of Object.entries(this.DEPARTMENT_MAPPINGS)) {
      // Check if input matches standard name exactly
      if (standardName.toUpperCase() === normalized) {
        return standardName;
      }
      
      // Check variations
      for (const variation of variations) {
        if (variation.toUpperCase() === normalized) {
          return standardName;
        }
      }
    }
    
    // If no match found, return cleaned input as potential new department
    const cleaned = input.replace(/[^A-Za-z\s&]/g, '').trim();
    return cleaned || null;
  }

  /**
   * Extract team structure from email metadata
   */
  static async extractTeamStructure(
    emailData: {
      from: string;
      to: string[];
      cc: string[];
      bcc: string[];
    },
    departmentName: string
  ): Promise<TeamStructure> {
    console.log(`👥 [DEPT] Extracting team structure for ${departmentName}`);
    
    // Team leader is first CC (per requirements)
    const teamLeaderEmail = emailData.cc.length > 0 ? emailData.cc[0] : null;
    
    // Team members are all recipients (To + CC + sender)
    const teamMembers = [
      ...new Set([
        emailData.from,
        ...emailData.to,
        ...emailData.cc
      ])
    ];

    console.log(`👥 [DEPT] Team structure - Leader: ${teamLeaderEmail}, Members: ${teamMembers.length}`);

    // Find or create team leader user
    let teamLeaderUserId = null;
    if (teamLeaderEmail) {
      try {
        const { getOrCreateUserByEmail } = await import('./userService');
        const teamLeader = await getOrCreateUserByEmail(teamLeaderEmail);
        teamLeaderUserId = teamLeader.id;
      } catch (error) {
        console.warn(`⚠️ [DEPT] Could not resolve team leader ${teamLeaderEmail}:`, error);
      }
    }

    // Find or create department project
    let projectId = null;
    try {
      projectId = await this.findOrCreateDepartmentProject(
        departmentName, 
        teamMembers, 
        teamLeaderUserId
      );
    } catch (error) {
      console.warn(`⚠️ [DEPT] Could not create/find department project:`, error);
    }

    return {
      departmentName,
      teamLeaderEmail,
      teamLeaderUserId,
      teamMembers,
      projectId
    };
  }

  /**
   * Find or create a project for the department
   */
  private static async findOrCreateDepartmentProject(
    departmentName: string,
    teamMembers: string[],
    teamLeaderUserId: string | null
  ): Promise<number | null> {
    try {
      const { storage } = await import('../storage');
      const { getOrCreateUserByEmail } = await import('./userService');

      // Look for existing department project
      const projectName = `${departmentName} Intelligence`;
      const existingProjects = await storage.getProjectsByName(projectName);
      
      if (existingProjects.length > 0) {
        console.log(`📁 [DEPT] Found existing project: ${projectName} (ID: ${existingProjects[0].id})`);
        return existingProjects[0].id;
      }

      // Create new department project
      console.log(`📁 [DEPT] Creating new project: ${projectName}`);
      
      // Use team leader as project creator, or first team member
      let creatorUserId = teamLeaderUserId;
      if (!creatorUserId && teamMembers.length > 0) {
        const creator = await getOrCreateUserByEmail(teamMembers[0]);
        creatorUserId = creator.id;
      }

      if (!creatorUserId) {
        console.warn(`⚠️ [DEPT] No valid creator for project ${projectName}`);
        return null;
      }

      const project = await storage.createProject({
        name: projectName,
        type: 'team',
        createdBy: creatorUserId,
        topic: `Intelligence submissions for ${departmentName} department`
      });

      // Add team members as project participants
      for (const memberEmail of teamMembers) {
        try {
          const member = await getOrCreateUserByEmail(memberEmail);
          const role = member.id === teamLeaderUserId ? 'owner' : 'editor';
          
          await storage.addProjectParticipant({
            projectId: project.id,
            userId: member.id,
            role,
            canEdit: true
          });
          
          console.log(`👤 [DEPT] Added ${memberEmail} as ${role} to project ${projectName}`);
        } catch (error) {
          console.warn(`⚠️ [DEPT] Could not add ${memberEmail} to project:`, error);
        }
      }

      console.log(`✅ [DEPT] Created project: ${projectName} (ID: ${project.id}) with ${teamMembers.length} members`);
      return project.id;
      
    } catch (error) {
      console.error(`🚨 [DEPT] Error creating department project:`, error);
      return null;
    }
  }

  /**
   * Update user department mapping based on intelligence submission
   */
  static async updateUserDepartment(
    userId: string,
    departmentName: string,
    role: 'manager' | 'member' = 'member'
  ): Promise<void> {
    try {
      const { storage } = await import('../storage');
      
      // Check if user already has this department
      const existingMapping = await storage.getUserDepartment(userId, departmentName);
      
      if (!existingMapping) {
        await storage.createUserDepartment({
          userId,
          departmentName,
          role,
          isActive: true
        });
        console.log(`🏢 [DEPT] Added ${userId} to ${departmentName} as ${role}`);
      } else if (existingMapping.role !== role) {
        // Update role if it changed (e.g., member → manager)
        await storage.updateUserDepartment(existingMapping.id, { role });
        console.log(`🏢 [DEPT] Updated ${userId} role in ${departmentName}: ${existingMapping.role} → ${role}`);
      }
      
    } catch (error) {
      console.error(`🚨 [DEPT] Error updating user department:`, error);
    }
  }

  /**
   * Get department analytics and insights
   */
  static async getDepartmentAnalytics(departmentName: string) {
    try {
      const { storage } = await import('../storage');
      
      // Get all submissions for this department
      const submissions = await storage.getSubmissionsByDepartment(departmentName);
      
      // Get unique team members
      const teamMembers = new Set<string>();
      // const teamLeaders = new Set<string>(); // TODO: Implement team leader concept
      
      submissions.forEach((submission: any) => {
        if (submission.submitterEmail) teamMembers.add(submission.submitterEmail);
        // TODO: Add team leader logic when the field is available
        // if (submission.teamLeaderEmail) teamLeaders.add(submission.teamLeaderEmail);
      });

      return {
        departmentName,
        totalSubmissions: submissions.length,
        teamMemberCount: teamMembers.size,
        teamLeaderCount: 0, // TODO: Implement team leader count when available
        submissions: submissions.slice(0, 10), // Recent 10
        analytics: {
          averageSentiment: submissions.reduce((acc: number, s: any) => acc + (s.sentimentScore || 0), 0) / submissions.length || 0,
          commonTopics: this.extractCommonTopics(submissions)
        }
      };
      
    } catch (error) {
      console.error(`🚨 [DEPT] Error getting department analytics:`, error);
      return null;
    }
  }

  /**
   * Extract common topics from submissions
   */
  private static extractCommonTopics(submissions: any[]): string[] {
    const topicCounts: Record<string, number> = {};
    
    submissions.forEach(submission => {
      if (submission.topics && Array.isArray(submission.topics)) {
        submission.topics.forEach((topic: string) => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      }
    });

    return Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([topic]) => topic);
  }
}