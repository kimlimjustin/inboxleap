import { storage } from '../storage';
import type { InsertPollingAgent } from '@email-task-router/shared';
import { getUserCompanyContext, createSubCompany } from './companyRegistrationService';

/**
 * Service to handle company-specific Tanya intelligence setup
 */

/**
 * Generate a unique company identifier from company name
 */
function generateCompanyId(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Generate company-specific Tanya email address
 */
function generateTanyaEmail(companyName: string): string {
  const companyId = generateCompanyId(companyName);
  return `t5t+${companyId}@inboxleap.com`;
}

/**
 * Set up Tanya intelligence for a company (NEW: uses platform-wide company system)
 * This now requires the user to first register a company through the platform
 */
export async function setupCompanyIntelligence(
  userId: string,
  companyId: number, // NEW: Use actual company ID from platform
  agentName?: string // Optional custom agent name
): Promise<{
  agent: any;
  emailAddress: string;
  companyId: number;
}> {
  try {
    console.log(`🏢 [TANYA-SETUP] Setting up intelligence for company ID: ${companyId}`);
    
    // Verify user has access to this company
    const company = await storage.getCompany(companyId);
    if (!company) {
      throw new Error('Company not found');
    }
    
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership) {
      throw new Error('User is not a member of this company');
    }
    
    if (!['admin', 'manager'].includes(membership.role)) {
      throw new Error('Insufficient permissions to create intelligence agents');
    }
    
    // Generate company-specific email address
    const companySlug = generateCompanyId(company.name);
    const emailAddress = generateTanyaEmail(company.name);
    
    // Check if company already has a Tanya intelligence agent
    const existingAgent = await storage.getPollingAgentsForCompany(companyId);
    const existingTanyaAgent = existingAgent?.find(agent => agent.type === 't5t');
    
    if (existingTanyaAgent) {
      console.log(`📧 [TANYA-SETUP] Company "${company.name}" already has Tanya intelligence agent`);
      return {
        agent: existingTanyaAgent,
        emailAddress: existingTanyaAgent.emailAddress,
        companyId: companyId
      };
    }
    
    // Create new Tanya intelligence agent for the company
    const agentData: InsertPollingAgent = {
      name: agentName || `${company.name} - Tanya Intelligence`,
      description: company.description 
        ? `Organizational intelligence for ${company.name}: ${company.description}`
        : `Organizational intelligence and top 5 topics analysis for ${company.name}`,
      emailAddress,
      type: 't5t',
      // NEW: Use proper company system fields
      companyId: companyId,
      accountType: 'company',
      // LEGACY: Keep for backward compatibility during transition
      organizationId: companySlug,
      organizationName: company.name,
      organizationDescription: company.description || undefined,
      createdBy: userId,
      isActive: true,
      settings: {
        submissionFrequency: 'weekly',
        maxItems: 5,
        autoAnalysis: true,
        emailDomain: 'inboxleap.com',
        companySpecific: true,
        // Get domain restrictions from company settings
        isDomainRestricted: company.domainRestrictions ? 
          JSON.parse(company.domainRestrictions as string)?.enabled || false : false,
        allowedDomains: company.domainRestrictions ? 
          JSON.parse(company.domainRestrictions as string)?.domains || [] : [],
        // Initialize empty hierarchy - will be populated from company departments
        hierarchyData: {
          departments: {},
          relationships: []
        }
      }
    };
    
    const agent = await storage.createPollingAgent(agentData);

    // Add the creator as an admin participant
    await storage.createPollingAgentParticipant({
      pollingAgentId: agent.id,
      userId,
      role: 'admin',
      canViewInsights: true,
      canViewDetailedAnalytics: true,
      isActive: true
    });
    
    console.log(`✅ [TANYA-SETUP] Created intelligence agent for ${company.name}: ${emailAddress}`);
    
    return {
      agent,
      emailAddress,
      companyId
    };
    
  } catch (error) {
    console.error(`🚨 [TANYA-SETUP] Error setting up intelligence for company ID ${companyId}:`, error);
    throw error;
  }
}

/**
 * Get user's company intelligence agents (NEW: uses platform-wide company system)
 */
export async function getUserCompanyIntelligence(userId: string): Promise<any[]> {
  try {
    console.log('🔍 [COMPANY-INTEL] Getting company intelligence agents for user ID:', userId);
    
    // Get user's company memberships
    const memberships = await storage.getUserCompanyMemberships(userId);
    console.log('🔍 [COMPANY-INTEL] User belongs to companies:', memberships.length);
    
    if (memberships.length === 0) {
      console.log('🔍 [COMPANY-INTEL] User has no company memberships');
      return [];
    }
    
    // Get intelligence agents for each company the user belongs to
    const allCompanyAgents = await Promise.all(
      memberships.map(async (membership) => {
        const company = await storage.getCompany(membership.companyId);
        const agents = await storage.getPollingAgentsForCompany(membership.companyId);
        
        // Filter for T5T (Tanya) intelligence agents
        const intelligenceAgents = agents.filter(agent => agent.type === 't5t');
        
        return intelligenceAgents.map(agent => ({
          ...agent,
          // NEW: Use actual company data
          company: {
            id: company?.id,
            name: company?.name,
            description: company?.description
          },
          userRole: membership.role,
          userDepartment: membership.department,
          // LEGACY: Keep for backward compatibility
          companyId: agent.organizationId || company?.id.toString(),
          companyName: agent.organizationName || company?.name,
          companyDescription: agent.organizationDescription || company?.description,
          emailAddress: agent.emailAddress,
          isCompanySpecific: true
        }));
      })
    );
    
    // Flatten the array
    const companyAgents = allCompanyAgents.flat();
    
    console.log('🔍 [COMPANY-INTEL] Found company intelligence agents:', companyAgents.length, 
                companyAgents.map(a => ({ id: a.id, name: a.name, company: a.company.name })));
    
    return companyAgents;
    
  } catch (error) {
    console.error(`🚨 [COMPANY-INTEL] Error getting user company intelligence:`, error);
    throw error;
  }
}

/**
 * Create a sub-company and set up intelligence for it (agent-level company creation)
 * This allows users to quickly create specialized company contexts directly from agent setup
 */
export async function createSubCompanyWithIntelligence(
  userId: string,
  parentCompanyId: number,
  subCompanyData: {
    name: string;
    description?: string;
    companyType: 'subsidiary' | 'division' | 'project';
    agentName?: string;
    inheritParentSettings?: boolean;
  }
): Promise<{
  company: any;
  agent: any;
  emailAddress: string;
  companyId: number;
}> {
  try {
    console.log(`🚀 [SUB-COMPANY-INTEL] Creating sub-company with intelligence: ${subCompanyData.name}`);
    
    // Create the sub-company
    const { company } = await createSubCompany(userId, parentCompanyId, {
      name: subCompanyData.name,
      description: subCompanyData.description,
      companyType: subCompanyData.companyType,
      inheritParentSettings: subCompanyData.inheritParentSettings
    });
    
    // Set up intelligence for the new sub-company
    const intelligenceResult = await setupCompanyIntelligence(
      userId, 
      company.id, 
      subCompanyData.agentName || `${subCompanyData.name} - Intelligence`
    );
    
    console.log(`✅ [SUB-COMPANY-INTEL] Created sub-company with intelligence: ${company.name}`);
    
    return {
      company,
      agent: intelligenceResult.agent,
      emailAddress: intelligenceResult.emailAddress,
      companyId: company.id
    };
    
  } catch (error) {
    console.error(`🚨 [SUB-COMPANY-INTEL] Error creating sub-company with intelligence:`, error);
    throw error;
  }
}

/**
 * Quick setup: Create sub-company from agent interface with minimal input
 * This is the most user-friendly way for agent-level company creation
 */
export async function quickCreateCompanyForAgent(
  userId: string,
  companyData: {
    name: string;
    description?: string;
    parentCompanyId?: number; // If not provided, will suggest main company creation
    companyType?: 'subsidiary' | 'division' | 'project';
    agentName?: string;
  }
): Promise<{
  agent?: any;
  emailAddress?: string;
  companyId?: number;
  requiresMainCompany?: boolean;
  availableParents?: any[];
  message?: string;
}> {
  try {
    console.log(`⚡ [QUICK-COMPANY] Quick company setup for: ${companyData.name}`);
    
    // Get user's company context
    const userContext = await getUserCompanyContext(userId);
    
    // If user has no companies at all, guide to main company creation
    if (!userContext.hasCompanies) {
      return {
        requiresMainCompany: true,
        message: 'Please register your main company first. Then you can create sub-companies for specific projects or divisions.'
      };
    }
    
    // If parentCompanyId is specified, use it
    if (companyData.parentCompanyId) {
      const result = await createSubCompanyWithIntelligence(userId, companyData.parentCompanyId, {
        name: companyData.name,
        description: companyData.description,
        companyType: companyData.companyType || 'project',
        agentName: companyData.agentName,
        inheritParentSettings: true
      });
      
      return {
        agent: result.agent,
        emailAddress: result.emailAddress,
        companyId: result.companyId
      };
    }
    
    // If user has multiple companies, let them choose parent
    if (userContext.companies.length > 1) {
      return {
        availableParents: userContext.companies.map(c => ({
          id: c.company.id,
          name: c.company.name,
          description: c.company.description,
          userRole: c.membership.role,
          companyType: c.company.companyType || 'main'
        })),
        message: `You belong to ${userContext.companies.length} companies. Please specify which company this "${companyData.name}" should be created under.`
      };
    }
    
    // If user has exactly one company, use it as parent
    const parentCompany = userContext.companies[0];
    const result = await createSubCompanyWithIntelligence(userId, parentCompany.company.id, {
      name: companyData.name,
      description: companyData.description,
      companyType: companyData.companyType || 'project',
      agentName: companyData.agentName,
      inheritParentSettings: true
    });
    
    return {
      agent: result.agent,
      emailAddress: result.emailAddress,
      companyId: result.companyId
    };
    
  } catch (error) {
    console.error(`🚨 [QUICK-COMPANY] Error in quick company setup:`, error);
    throw error;
  }
}

/**
 * LEGACY WRAPPER: Set up company intelligence using old API (for backward compatibility)
 * This will guide users to first register a company, then create intelligence agents
 */
export async function setupCompanyIntelligenceLegacy(
  userId: string,
  companyName: string,
  companyDescription?: string,
  isDomainRestricted?: boolean,
  allowedDomains?: string[]
): Promise<{
  agent?: any;
  emailAddress?: string;
  companyId?: string;
  requiresCompanyRegistration?: boolean;
  message?: string;
}> {
  try {
    console.log(`🔄 [LEGACY-SETUP] Legacy setup requested for: ${companyName}`);
    
    // Check if user has company context
    const userContext = await getUserCompanyContext(userId);
    
    // If user has no companies, suggest company registration
    if (!userContext.hasCompanies) {
      return {
        requiresCompanyRegistration: true,
        message: 'Please register your company first using the new company registration system. This allows you to manage teams, departments, and use intelligence agents across all features.'
      };
    }
    
    // Check if a company with this name already exists in user's companies
    const existingCompany = userContext.companies.find(c => 
      c.company.name.toLowerCase() === companyName.toLowerCase()
    );
    
    if (existingCompany) {
      // Use existing company to set up intelligence
      console.log(`🔄 [LEGACY-SETUP] Found existing company: ${existingCompany.company.name}`);
      const result = await setupCompanyIntelligence(userId, existingCompany.company.id);
      return {
        agent: result.agent,
        emailAddress: result.emailAddress,
        companyId: result.companyId.toString() // Convert number to string for legacy API
      };
    } else {
      // Suggest registering this specific company
      return {
        requiresCompanyRegistration: true,
        message: `Company "${companyName}" not found in your registered companies. Please register it first using /api/companies/register, then set up intelligence agents.`
      };
    }
    
  } catch (error) {
    console.error(`🚨 [LEGACY-SETUP] Error in legacy setup:`, error);
    throw error;
  }
}

/**
 * Find company intelligence agent by email address
 */
export async function findAgentByEmail(emailAddress: string): Promise<any | null> {
  try {
    // Extract company identifier from email if it's a T5T email
    const t5tEmailMatch = emailAddress.match(/^t5t\+([^@]+)@inboxleap\.com$/);
    if (!t5tEmailMatch) {
      return null;
    }

    const companyId = t5tEmailMatch[1];
    
    // Find agent by organization ID or email address
    const agents = await storage.getPollingAgents();
    const agent = agents.find(a => 
      a.organizationId === companyId || 
      a.emailAddress === emailAddress
    );
    
    return agent || null;
    
  } catch (error) {
    console.error(`🚨 [TANYA-SETUP] Error finding agent by email ${emailAddress}:`, error);
    return null;
  }
}

/**
 * Validate company name for intelligence setup
 */
export function validateCompanyName(companyName: string): { valid: boolean; error?: string } {
  if (!companyName || typeof companyName !== 'string') {
    return { valid: false, error: 'Company name is required' };
  }
  
  if (companyName.length < 2) {
    return { valid: false, error: 'Company name must be at least 2 characters' };
  }
  
  if (companyName.length > 100) {
    return { valid: false, error: 'Company name must be less than 100 characters' };
  }
  
  // Check for invalid characters that could cause issues
  if (!/^[a-zA-Z0-9\s\-\.\&\(\)]+$/.test(companyName)) {
    return { valid: false, error: 'Company name contains invalid characters' };
  }
  
  return { valid: true };
}

/**
 * Get sample instructions for using company intelligence
 */
export function getCompanyIntelligenceInstructions(
  companyName: string,
  emailAddress: string
): {
  emailAddress: string;
  instructions: string[];
  sampleEmail: string;
} {
  return {
    emailAddress,
    instructions: [
      `Send your top 5 topics/concerns to: ${emailAddress}`,
      'Email weekly on Fridays for best results',
      'Include both challenges and wins in your submissions',
      'Use bullet points or numbered lists for clarity',
      'Tanya will analyze patterns and generate insights automatically'
    ],
    sampleEmail: `To: ${emailAddress}
Subject: Weekly T5T - Week of [Date]

Hi Tanya,

Here are my top 5 topics for this week:

1. 🚀 Successfully launched new product feature X - great customer feedback
2. ⚠️ Team capacity issues in engineering - may need additional resources
3. 📈 Sales pipeline looking strong for Q4 - up 15% from last quarter
4. 🤝 Partnership discussion with Company Y progressing well
5. 🔧 Technical debt in payment system - planning refactor next sprint

Best regards,
[Your Name]`
  };
}
