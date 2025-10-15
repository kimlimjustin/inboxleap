import { Express } from 'express';
import { isAuthenticated } from '../googleAuth';
import { z } from 'zod';
import {
  registerCompany,
  inviteUserToCompany,
  getUserCompanies,
  createDepartment,
  addHierarchyRelationship,
  getCompanyOrganization,
  getUserCompanyContext,
  validateCompanyName,
  createSubCompany,
  getCompanyHierarchy
} from '../services/companyRegistrationService';

/**
 * Company management API routes
 */
export function registerCompanyRoutes(app: Express) {
  
  /**
   * Register a new company
   */
  app.post('/api/companies/register', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Validation schema
      const registerSchema = z.object({
        name: z.string().min(2).max(100),
        description: z.string().optional(),
        emailAddress: z.string().email().optional(),
        domainRestrictions: z.object({
          enabled: z.boolean(),
          domains: z.array(z.string())
        }).optional()
      });
      
      const companyData = registerSchema.parse(req.body);
      
      // Validate company name
      const validation = validateCompanyName(companyData.name);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      // Validate email uniqueness if provided
      if (companyData.emailAddress) {
        const { storage } = await import('../storage');
        const existingCompany = await storage.getCompanyByEmail(companyData.emailAddress);
        if (existingCompany) {
          return res.status(400).json({
            success: false,
            message: 'This email address is already taken by another company'
          });
        }
      }
      
      const result = await registerCompany(userId, companyData);
      
      res.status(201).json({
        success: true,
        message: `Company "${companyData.name}" registered successfully`,
        data: {
          company: result.company,
          membership: result.membership
        }
      });
      
    } catch (error: any) {
      console.error('Error registering company:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to register company'
      });
    }
  });
  
  /**
   * Get user's companies
   */
  app.get('/api/companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companies = await getUserCompanies(userId);
      
      res.json({
        success: true,
        data: {
          companies,
          count: companies.length
        }
      });
      
    } catch (error: any) {
      console.error('Error getting user companies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get companies'
      });
    }
  });
  
  /**
   * Get user's company context (for determining account type)
   */
  app.get('/api/companies/context', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const context = await getUserCompanyContext(userId);
      
      res.json({
        success: true,
        data: context
      });
      
    } catch (error: any) {
      console.error('Error getting user company context:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get company context'
      });
    }
  });
  
  /**
   * Invite user to company
   */
  app.post('/api/companies/:companyId/invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = parseInt(req.params.companyId);
      
      // Validation schema
      const inviteSchema = z.object({
        email: z.string().email(),
        role: z.enum(['admin', 'manager', 'member']),
        department: z.string().optional()
      });
      
      const inviteData = inviteSchema.parse(req.body);
      
      const membership = await inviteUserToCompany({
        companyId,
        inviterUserId: userId,
        inviteEmail: inviteData.email,
        role: inviteData.role,
        department: inviteData.department
      });
      
      res.status(201).json({
        success: true,
        message: `User ${inviteData.email} invited successfully`,
        data: { membership }
      });
      
    } catch (error: any) {
      console.error('Error inviting user to company:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to invite user'
      });
    }
  });
  
  /**
   * Create department in company
   */
  app.post('/api/companies/:companyId/departments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = parseInt(req.params.companyId);
      
      // Validation schema
      const departmentSchema = z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        managerUserId: z.string().optional()
      });
      
      const departmentData = departmentSchema.parse(req.body);
      
      const department = await createDepartment(companyId, userId, departmentData);
      
      res.status(201).json({
        success: true,
        message: `Department "${departmentData.name}" created successfully`,
        data: { department }
      });
      
    } catch (error: any) {
      console.error('Error creating department:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create department'
      });
    }
  });
  
  /**
   * Add hierarchy relationship
   */
  app.post('/api/companies/:companyId/hierarchy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = parseInt(req.params.companyId);
      
      // Validation schema
      const hierarchySchema = z.object({
        employeeUserId: z.string(),
        managerUserId: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
        source: z.string().optional()
      });
      
      const hierarchyData = hierarchySchema.parse(req.body);
      
      const hierarchy = await addHierarchyRelationship(companyId, userId, hierarchyData);
      
      res.status(201).json({
        success: true,
        message: 'Hierarchy relationship added successfully',
        data: { hierarchy }
      });
      
    } catch (error: any) {
      console.error('Error adding hierarchy relationship:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add hierarchy relationship'
      });
    }
  });
  
  /**
   * Get company organization chart
   */
  app.get('/api/companies/:companyId/organization', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = parseInt(req.params.companyId);
      
      const organization = await getCompanyOrganization(companyId, userId);
      
      res.json({
        success: true,
        data: organization
      });
      
    } catch (error: any) {
      console.error('Error getting company organization:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get organization chart'
      });
    }
  });
  
  /**
   * Get company departments (for dropdowns, etc.)
   */
  app.get('/api/companies/:companyId/departments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify user has access to company
      const organization = await getCompanyOrganization(companyId, userId);
      
      res.json({
        success: true,
        data: {
          departments: organization.departments,
          count: organization.departments.length
        }
      });
      
    } catch (error: any) {
      console.error('Error getting company departments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get departments'
      });
    }
  });
  
  /**
   * Get company members (for assigning managers, etc.)
   */
  app.get('/api/companies/:companyId/members', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = parseInt(req.params.companyId);
      
      // Verify user has access to company
      const organization = await getCompanyOrganization(companyId, userId);
      
      // Transform memberships to include user details
      const membersWithUserInfo = await Promise.all(
        organization.memberships.map(async (membership) => {
          // Get user details from storage
          const { storage } = await import('../storage');
          const user = await storage.getUser(membership.userId);
          
          return {
            membership,
            user: user ? {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName
            } : null
          };
        })
      );
      
      res.json({
        success: true,
        data: {
          members: membersWithUserInfo.filter(m => m.user !== null),
          count: membersWithUserInfo.length
        }
      });
      
    } catch (error: any) {
      console.error('Error getting company members:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get company members'
      });
    }
  });
  
  /**
   * Update company settings
   */
  app.patch('/api/companies/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = parseInt(req.params.companyId);
      
      // Validation schema
      const updateSchema = z.object({
        name: z.string().min(2).max(100).optional(),
        description: z.string().optional(),
        emailAddress: z.string().email().optional().nullable(),
        domainRestrictions: z.object({
          enabled: z.boolean(),
          domains: z.array(z.string())
        }).optional()
      });
      
      const updateData = updateSchema.parse(req.body);
      
      // Get storage instance for all operations
      const { storage } = await import('../storage');
      
      // Verify user is admin
      const membership = await storage.getCompanyMembership(companyId, userId);
      if (!membership || membership.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only company administrators can update company settings'
        });
      }
      
      // Validate company name if provided
      if (updateData.name) {
        const validation = validateCompanyName(updateData.name);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: validation.error
          });
        }
      }
      
      // Validate email uniqueness if provided and changed
      if (updateData.emailAddress) {
        const existingCompany = await storage.getCompanyByEmail(updateData.emailAddress);
        if (existingCompany && existingCompany.id !== companyId) {
          return res.status(400).json({
            success: false,
            message: 'This email address is already taken by another company'
          });
        }
      }
      
      // Update company
      const updatedCompany = await storage.updateCompany(companyId, updateData);
      
      res.json({
        success: true,
        message: 'Company updated successfully',
        data: { company: updatedCompany }
      });
      
    } catch (error: any) {
      console.error('Error updating company:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update company'
      });
    }
  });
  
  /**
   * Create sub-company (subsidiary, division, or project)
   */
  app.post('/api/companies/:parentCompanyId/sub-companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const parentCompanyId = parseInt(req.params.parentCompanyId);
      
      // Validation schema
      const subCompanySchema = z.object({
        name: z.string().min(2).max(100),
        description: z.string().optional(),
        companyType: z.enum(['subsidiary', 'division', 'project']),
        inheritParentSettings: z.boolean().optional().default(true)
      });
      
      const subCompanyData = subCompanySchema.parse(req.body);
      
      // Validate company name
      const validation = validateCompanyName(subCompanyData.name);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
      
      const result = await createSubCompany(userId, parentCompanyId, subCompanyData);
      
      res.status(201).json({
        success: true,
        message: `${subCompanyData.companyType} "${subCompanyData.name}" created successfully`,
        data: {
          company: result.company,
          membership: result.membership
        }
      });
      
    } catch (error: any) {
      console.error('Error creating sub-company:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create sub-company'
      });
    }
  });
  
  /**
   * Get company hierarchy (parent and sub-companies)
   */
  app.get('/api/companies/:companyId/hierarchy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const companyId = parseInt(req.params.companyId);
      
      const hierarchy = await getCompanyHierarchy(companyId, userId);
      
      res.json({
        success: true,
        data: hierarchy
      });
      
    } catch (error: any) {
      console.error('Error getting company hierarchy:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get company hierarchy'
      });
    }
  });
  
  /**
   * Get sub-companies of a parent company
   */
  app.get('/api/companies/:parentCompanyId/sub-companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const parentCompanyId = parseInt(req.params.parentCompanyId);
      
      // Verify user has access to parent company
      const { storage } = await import('../storage');
      const membership = await storage.getCompanyMembership(parentCompanyId, userId);
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this company'
        });
      }
      
      const subCompanies = await storage.getSubCompanies(parentCompanyId);
      
      // Add membership info for each sub-company
      const subCompaniesWithMembership = await Promise.all(
        subCompanies.map(async (subCompany) => {
          const subMembership = await storage.getCompanyMembership(subCompany.id, userId);
          return {
            ...subCompany,
            userMembership: subMembership
          };
        })
      );
      
      res.json({
        success: true,
        data: {
          subCompanies: subCompaniesWithMembership,
          count: subCompanies.length
        }
      });
      
    } catch (error: any) {
      console.error('Error getting sub-companies:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get sub-companies'
      });
    }
  });
}