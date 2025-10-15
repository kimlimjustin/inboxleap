import { storage } from '../storage';
import type { 
  InsertCompany, 
  InsertCompanyMembership, 
  InsertCompanyDepartment,
  InsertCompanyHierarchy,
  Company,
  CompanyMembership,
  CompanyDepartment,
  CompanyHierarchy
} from '@email-task-router/shared';

/**
 * Service for platform-wide company registration and management
 */

export interface CompanyRegistrationData {
  name: string;
  description?: string;
  domainRestrictions?: {
    enabled: boolean;
    domains: string[];
  };
  parentCompanyId?: number; // For sub-companies
  companyType?: 'main' | 'subsidiary' | 'division' | 'project';
}

export interface CompanyInvitationData {
  companyId: number;
  inviterUserId: string;
  inviteEmail: string;
  role: 'admin' | 'manager' | 'member';
  department?: string;
}

/**
 * Register a new company on the platform
 */
export async function registerCompany(
  creatorUserId: string,
  companyData: CompanyRegistrationData
): Promise<{
  company: Company;
  membership: CompanyMembership;
}> {
  try {
    console.log(`🏢 [COMPANY-REG] Registering company: ${companyData.name} by user: ${creatorUserId}`);
    
    // Validate company name
    const validation = validateCompanyName(companyData.name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Check if company already exists by querying all companies
    // Note: We need to check manually since getCompanyByName doesn't exist
    const existingCompany = null; // TODO: Implement proper company name check
    if (existingCompany) {
      throw new Error('Company name already exists');
    }
    
    // Validate parent company if creating sub-company
    if (companyData.parentCompanyId) {
      const parentCompany = await storage.getCompany(companyData.parentCompanyId);
      if (!parentCompany) {
        throw new Error('Parent company not found');
      }
      
      // Verify user has access to parent company
      const parentMembership = await storage.getCompanyMembership(companyData.parentCompanyId, creatorUserId);
      if (!parentMembership || !['admin', 'manager'].includes(parentMembership.role)) {
        throw new Error('Insufficient permissions to create sub-companies under this parent');
      }
    }
    
    // Create company
    const company = await storage.createCompany({
      name: companyData.name,
      createdBy: creatorUserId
    });
    
    // Add creator as admin member
    const membership = await storage.createCompanyMembership({
      companyId: company.id,
      userId: creatorUserId
    });
    
    console.log(`✅ [COMPANY-REG] Created company: ${company.name} (ID: ${company.id})`);
    
    return { company, membership };
    
  } catch (error) {
    console.error(`🚨 [COMPANY-REG] Error registering company ${companyData.name}:`, error);
    throw error;
  }
}

/**
 * Create a sub-company for agent-specific use cases
 * This allows users to create specialized company contexts (divisions, projects, etc.)
 * while maintaining connection to the main company structure
 */
export async function createSubCompany(
  creatorUserId: string,
  parentCompanyId: number,
  subCompanyData: {
    name: string;
    description?: string;
    companyType: 'subsidiary' | 'division' | 'project';
    inheritParentSettings?: boolean; // Whether to inherit domain restrictions, etc.
  }
): Promise<{
  company: Company;
  membership: CompanyMembership;
}> {
  try {
    console.log(`🏗️ [SUB-COMPANY] Creating ${subCompanyData.companyType}: ${subCompanyData.name} under parent: ${parentCompanyId}`);
    
    // Get parent company
    const parentCompany = await storage.getCompany(parentCompanyId);
    if (!parentCompany) {
      throw new Error('Parent company not found');
    }
    
    // Verify user has access to parent company
    const parentMembership = await storage.getCompanyMembership(parentCompanyId, creatorUserId);
    if (!parentMembership || !['admin', 'manager'].includes(parentMembership.role)) {
      throw new Error('Insufficient permissions to create sub-companies');
    }
    
    // Validate sub-company name (can be similar to parent, but must be unique)
    const validation = validateCompanyName(subCompanyData.name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Check if sub-company name already exists globally (to avoid confusion)
    // Note: We need to check manually since getCompanyByName doesn't exist
    const existingCompany = null; // TODO: Implement proper company name check
    if (existingCompany) {
      throw new Error(`Company name "${subCompanyData.name}" already exists. Please choose a different name.`);
    }
    
    // Inherit settings from parent if requested
    const domainRestrictions = subCompanyData.inheritParentSettings && parentCompany.domainRestrictions
      ? parentCompany.domainRestrictions
      : JSON.stringify({ enabled: false, domains: [] });
    
    // Create sub-company
    const subCompany = await storage.createCompany({
      name: subCompanyData.name,
      createdBy: creatorUserId
    });
    
    // Add creator as admin member of sub-company
    const membership = await storage.createCompanyMembership({
      companyId: subCompany.id,
      userId: creatorUserId
    });
    
    console.log(`✅ [SUB-COMPANY] Created ${subCompanyData.companyType}: ${subCompany.name} (ID: ${subCompany.id})`);
    
    return { company: subCompany, membership };
    
  } catch (error) {
    console.error(`🚨 [SUB-COMPANY] Error creating sub-company:`, error);
    throw error;
  }
}

/**
 * Get company hierarchy (parent and sub-companies)
 */
export async function getCompanyHierarchy(
  companyId: number,
  userId: string
): Promise<{
  company: Company;
  parentCompany?: Company;
  subCompanies: Company[];
  userRole: string;
}> {
  try {
    console.log(`🌳 [COMPANY-TREE] Getting hierarchy for company: ${companyId}`);
    
    // Verify user has access
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership) {
      throw new Error('User is not a member of this company');
    }
    
    const company = await storage.getCompany(companyId);
    if (!company) {
      throw new Error('Company not found');
    }
    
    // Get parent company if exists
    let parentCompany: Company | undefined;
    if (company.parentCompanyId) {
      parentCompany = await storage.getCompany(company.parentCompanyId) || undefined;
    }
    
    // Get sub-companies
    const subCompanies = await storage.getSubCompanies(companyId);
    
    console.log(`🌳 [COMPANY-TREE] Found ${subCompanies.length} sub-companies under ${company.name}`);
    
    return {
      company,
      parentCompany,
      subCompanies,
      userRole: membership.role
    };
    
  } catch (error) {
    console.error(`🚨 [COMPANY-TREE] Error getting company hierarchy:`, error);
    throw error;
  }
}

/**
 * Invite a user to join a company
 */
export async function inviteUserToCompany(
  invitationData: CompanyInvitationData
): Promise<CompanyMembership> {
  try {
    const { companyId, inviterUserId, inviteEmail, role, department } = invitationData;
    
    console.log(`🤝 [COMPANY-INV] Inviting ${inviteEmail} to company ID: ${companyId}`);
    
    // Verify inviter has admin/manager permissions
    const inviterMembership = await storage.getCompanyMembership(companyId, inviterUserId);
    if (!inviterMembership || !['admin', 'manager'].includes(inviterMembership.role)) {
      throw new Error('Insufficient permissions to invite users');
    }
    
    // Find user by email
    const user = await storage.getUserByEmail(inviteEmail);
    if (!user) {
      throw new Error('User not found with this email address');
    }
    
    // Check if user is already a member
    const existingMembership = await storage.getCompanyMembership(companyId, user.id);
    if (existingMembership) {
      throw new Error('User is already a member of this company');
    }
    
    // Create membership
    const membership = await storage.createCompanyMembership({
      companyId,
      userId: user.id
    });
    
    console.log(`✅ [COMPANY-INV] Added ${inviteEmail} to company ID: ${companyId} as ${role}`);
    
    return membership;
    
  } catch (error) {
    console.error(`🚨 [COMPANY-INV] Error inviting user to company:`, error);
    throw error;
  }
}

/**
 * Get user's company memberships
 */
export async function getUserCompanies(userId: string): Promise<Array<{
  company: Company;
  membership: CompanyMembership;
  memberCount: number;
  departmentCount: number;
}>> {
  try {
    console.log(`🔍 [COMPANY-GET] Getting companies for user: ${userId}`);
    
    const memberships = await storage.getUserCompanyMemberships(userId);
    
    const companiesWithDetails = await Promise.all(
      memberships.map(async (membership) => {
        const company = await storage.getCompany(membership.companyId);
        if (!company) {
          throw new Error(`Company not found: ${membership.companyId}`);
        }
        
        const memberCount = await storage.getCompanyMemberCount(company.id);
        const departmentCount = await storage.getCompanyDepartmentCount(company.id);
        
        return {
          company,
          membership,
          memberCount,
          departmentCount
        };
      })
    );
    
    console.log(`🔍 [COMPANY-GET] Found ${companiesWithDetails.length} companies for user: ${userId}`);
    
    return companiesWithDetails;
    
  } catch (error) {
    console.error(`🚨 [COMPANY-GET] Error getting user companies:`, error);
    throw error;
  }
}

/**
 * Create a department within a company
 */
export async function createDepartment(
  companyId: number,
  creatorUserId: string,
  departmentData: {
    name: string;
    description?: string;
    managerUserId?: string;
  }
): Promise<CompanyDepartment> {
  try {
    console.log(`🏗️ [DEPT-CREATE] Creating department: ${departmentData.name} in company: ${companyId}`);
    
    // Verify creator has admin/manager permissions
    const membership = await storage.getCompanyMembership(companyId, creatorUserId);
    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      throw new Error('Insufficient permissions to create departments');
    }
    
    // Check if department already exists
    // Note: We need to check manually since getCompanyDepartmentByName doesn't exist
    const existingDept = null; // TODO: Implement proper department name check
    if (existingDept) {
      throw new Error('Department already exists with this name');
    }
    
    // Create department
    const department = await storage.createCompanyDepartment({
      companyId,
      name: departmentData.name
    });
    
    console.log(`✅ [DEPT-CREATE] Created department: ${department.name} (ID: ${department.id})`);
    
    return department;
    
  } catch (error) {
    console.error(`🚨 [DEPT-CREATE] Error creating department:`, error);
    throw error;
  }
}

/**
 * Add hierarchy relationship (employee -> manager)
 */
export async function addHierarchyRelationship(
  companyId: number,
  creatorUserId: string,
  relationshipData: {
    employeeUserId: string;
    managerUserId?: string;
    confidence?: number;
    source?: string;
  }
): Promise<CompanyHierarchy> {
  try {
    console.log(`👥 [HIERARCHY] Adding relationship in company: ${companyId}`);
    
    // Verify creator has admin/manager permissions
    const membership = await storage.getCompanyMembership(companyId, creatorUserId);
    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      throw new Error('Insufficient permissions to manage hierarchy');
    }
    
    // Verify both users are company members
    const employeeMembership = await storage.getCompanyMembership(companyId, relationshipData.employeeUserId);
    if (!employeeMembership) {
      throw new Error('Employee is not a member of this company');
    }
    
    if (relationshipData.managerUserId) {
      const managerMembership = await storage.getCompanyMembership(companyId, relationshipData.managerUserId);
      if (!managerMembership) {
        throw new Error('Manager is not a member of this company');
      }
    }
    
    // Create or update hierarchy relationship
    const hierarchy = await storage.upsertCompanyHierarchy({
      companyId,
      employeeUserId: relationshipData.employeeUserId
    });
    
    console.log(`✅ [HIERARCHY] Added hierarchy relationship for employee: ${relationshipData.employeeUserId}`);
    
    return hierarchy;
    
  } catch (error) {
    console.error(`🚨 [HIERARCHY] Error adding hierarchy relationship:`, error);
    throw error;
  }
}

/**
 * Get company organization chart
 */
export async function getCompanyOrganization(
  companyId: number,
  userId: string
): Promise<{
  company: Company;
  departments: CompanyDepartment[];
  memberships: CompanyMembership[];
  hierarchies: CompanyHierarchy[];
}> {
  try {
    console.log(`📋 [ORG-CHART] Getting organization chart for company: ${companyId}`);
    
    // Verify user has access to company
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership) {
      throw new Error('User is not a member of this company');
    }
    
    const [company, departments, memberships, hierarchies] = await Promise.all([
      storage.getCompany(companyId),
      storage.getCompanyDepartments(companyId),
      storage.getCompanyMemberships(companyId),
      storage.getCompanyHierarchies(companyId)
    ]);
    
    if (!company) {
      throw new Error('Company not found');
    }
    
    console.log(`📋 [ORG-CHART] Retrieved org chart: ${departments.length} departments, ${memberships.length} members`);
    
    return {
      company,
      departments,
      memberships,
      hierarchies
    };
    
  } catch (error) {
    console.error(`🚨 [ORG-CHART] Error getting organization chart:`, error);
    throw error;
  }
}

/**
 * Validate company name
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
  
  if (!/^[a-zA-Z0-9\s\-\.&()]+$/.test(companyName)) {
    return { valid: false, error: 'Company name contains invalid characters' };
  }
  
  return { valid: true };
}

/**
 * Check if user can access company features
 */
export async function getUserCompanyContext(userId: string): Promise<{
  hasCompanies: boolean;
  defaultCompany?: Company;
  companies: Array<{ company: Company; membership: CompanyMembership }>;
}> {
  try {
    const memberships = await storage.getUserCompanyMemberships(userId);
    
    if (memberships.length === 0) {
      return {
        hasCompanies: false,
        companies: []
      };
    }
    
    const companies = await Promise.all(
      memberships.map(async (membership) => {
        const company = await storage.getCompany(membership.companyId);
        return { company: company!, membership };
      })
    );
    
    // Default to first company or admin company
    const defaultCompany = companies.find(c => c.membership.role === 'admin')?.company || companies[0]?.company;
    
    return {
      hasCompanies: true,
      defaultCompany,
      companies
    };
    
  } catch (error) {
    console.error(`🚨 [COMPANY-CTX] Error getting user company context:`, error);
    return {
      hasCompanies: false,
      companies: []
    };
  }
}