import express, { type Router } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../googleAuth';

const router: Router = express.Router();

// Available agent types
const AGENT_TYPES = ['todo', 'alex', 'polly', 'faq', 't5t'] as const;

// Validation schemas
const createAgentEmailSchema = z.object({
  agentType: z.enum(AGENT_TYPES),
  instanceName: z.string().min(1).max(100).default('primary'),
  emailAddress: z.string().email().optional(),
  isActive: z.boolean().default(true),
  customization: z.record(z.any()).default({}),
  inheritCompanySettings: z.boolean().default(true),
  allowGlobalEmails: z.boolean().default(false)
});

const updateAgentEmailSchema = z.object({
  instanceName: z.string().min(1).max(100).optional(),
  emailAddress: z.string().email().optional(),
  isActive: z.boolean().optional(),
  customization: z.record(z.any()).optional(),
  inheritCompanySettings: z.boolean().optional(),
  allowGlobalEmails: z.boolean().optional()
});

const createAgentSettingsSchema = z.object({
  agentType: z.enum(AGENT_TYPES),
  defaultSettings: z.record(z.any()).default({}),
  isEnabled: z.boolean().default(true),
  maxInstances: z.number().int().min(1).max(20).default(5)
});

// GET /api/companies/:companyId/agent-emails
// Get all agent email addresses for a company
router.get('/:companyId/agent-emails', isAuthenticated, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Verify user has access to this company
    const { storage } = await import('../storage');
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this company'
      });
    }

    const agentEmails = await storage.getCompanyAgentEmails(companyId);

    res.json({
      success: true,
      data: { agentEmails }
    });

  } catch (error: any) {
    console.error('Error getting company agent emails:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// POST /api/companies/:companyId/agent-emails
// Create or update an agent email address for a company
router.post('/:companyId/agent-emails', isAuthenticated, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate input
    const agentEmailData = createAgentEmailSchema.parse(req.body);

    // Verify user is admin of this company
    const { storage } = await import('../storage');
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only company administrators can manage agent emails'
      });
    }

    // Get company info for default email generation
    const company = await storage.getCompany(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Check for agent settings and enforce max instances
    const agentSettings = await storage.getCompanyAgentSettings(companyId, agentEmailData.agentType);
    if (agentSettings && !agentSettings.isEnabled) {
      return res.status(400).json({
        success: false,
        message: `Agent type ${agentEmailData.agentType} is not enabled for this company`
      });
    }

    // Check if this specific instance already exists
    const existingEmail = await storage.getCompanyAgentEmail(companyId, agentEmailData.agentType, agentEmailData.instanceName);
    
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: `Agent instance "${agentEmailData.instanceName}" already exists for ${agentEmailData.agentType}`
      });
    }

    // Check max instances limit
    const existingInstances = await storage.getCompanyAgentEmailsForAgent(companyId, agentEmailData.agentType);
    const maxInstances = agentSettings?.maxInstances || 5;
    
    if (existingInstances.length >= maxInstances) {
      return res.status(400).json({
        success: false,
        message: `Maximum number of instances (${maxInstances}) reached for ${agentEmailData.agentType}`
      });
    }

    // Generate email address
    const emailAddress = agentEmailData.emailAddress || 
      storage.generateDefaultAgentEmail(company.name, agentEmailData.agentType, agentEmailData.instanceName);

    // Check for conflicts
    const conflictEmail = await storage.getCompanyAgentEmailByAddress(emailAddress);
    if (conflictEmail) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already taken by another company agent'
      });
    }

    // Create new agent instance
    const agentEmail = await storage.createCompanyAgentEmail({
      companyId,
      agentType: agentEmailData.agentType,
      instanceName: agentEmailData.instanceName,
      emailAddress,
      isActive: agentEmailData.isActive,
      customization: agentEmailData.customization,
      inheritCompanySettings: agentEmailData.inheritCompanySettings,
      allowGlobalEmails: agentEmailData.allowGlobalEmails,
      createdBy: userId
    });

    res.json({
      success: true,
      message: 'Agent email configured successfully',
      data: { agentEmail }
    });

  } catch (error: any) {
    console.error('Error creating/updating agent email:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// PUT /api/companies/:companyId/agent-emails/:agentEmailId
// Update a specific agent email
router.put('/:companyId/agent-emails/:agentEmailId', isAuthenticated, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const agentEmailId = parseInt(req.params.agentEmailId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate input
    const updateData = updateAgentEmailSchema.parse(req.body);

    // Verify user is admin of this company
    const { storage } = await import('../storage');
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only company administrators can manage agent emails'
      });
    }

    // Check if updating email address conflicts with other agents
    if (updateData.emailAddress) {
      const conflictEmail = await storage.getCompanyAgentEmailByAddress(updateData.emailAddress);
      if (conflictEmail && conflictEmail.id !== agentEmailId) {
        return res.status(400).json({
          success: false,
          message: 'This email address is already taken by another company agent'
        });
      }
    }

    const updatedAgentEmail = await storage.updateCompanyAgentEmail(agentEmailId, updateData);

    res.json({
      success: true,
      message: 'Agent email updated successfully',
      data: { agentEmail: updatedAgentEmail }
    });

  } catch (error: any) {
    console.error('Error updating agent email:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// DELETE /api/companies/:companyId/agent-emails/:agentEmailId
// Delete a specific agent email
router.delete('/:companyId/agent-emails/:agentEmailId', isAuthenticated, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const agentEmailId = parseInt(req.params.agentEmailId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Verify user is admin of this company
    const { storage } = await import('../storage');
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only company administrators can manage agent emails'
      });
    }

    await storage.deleteCompanyAgentEmail(agentEmailId);

    res.json({
      success: true,
      message: 'Agent email deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting agent email:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// GET /api/companies/:companyId/agent-emails/generate-default/:agentType
// Generate a default email address for an agent type
router.get('/:companyId/agent-emails/generate-default/:agentType', isAuthenticated, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const agentType = req.params.agentType;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate agent type
    if (!AGENT_TYPES.includes(agentType as any)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agent type'
      });
    }

    // Verify user has access to this company
    const { storage } = await import('../storage');
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this company'
      });
    }

    // Get company info
    const company = await storage.getCompany(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const instanceName = req.query.instanceName as string || 'primary';
    const defaultEmail = storage.generateDefaultAgentEmail(company.name, agentType, instanceName);

    res.json({
      success: true,
      data: { 
        emailAddress: defaultEmail,
        agentType,
        instanceName,
        companyName: company.name
      }
    });

  } catch (error: any) {
    console.error('Error generating default email:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// GET /api/companies/:companyId/agent-emails/:agentType/instances
// Get all instances of a specific agent type
router.get('/:companyId/agent-emails/:agentType/instances', isAuthenticated, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const agentType = req.params.agentType;
    const userId = req.user?.id;

    if (!userId || !AGENT_TYPES.includes(agentType as any)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    // Verify user has access to this company
    const { storage } = await import('../storage');
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this company'
      });
    }

    const instances = await storage.getCompanyAgentEmailsForAgent(companyId, agentType);

    res.json({
      success: true,
      data: { instances }
    });

  } catch (error: any) {
    console.error('Error getting agent instances:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// Company Agent Settings Routes

// GET /api/companies/:companyId/agent-settings
// Get all agent settings for a company
router.get('/:companyId/agent-settings', isAuthenticated, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Verify user has access to this company
    const { storage } = await import('../storage');
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this company'
      });
    }

    // Get settings for all agent types
    const settingsPromises = AGENT_TYPES.map(async (agentType) => {
      const settings = await storage.getCompanyAgentSettings(companyId, agentType);
      return {
        agentType,
        settings: settings || {
          agentType,
          defaultSettings: {},
          isEnabled: true,
          maxInstances: 5
        }
      };
    });

    const allSettings = await Promise.all(settingsPromises);

    res.json({
      success: true,
      data: { agentSettings: allSettings }
    });

  } catch (error: any) {
    console.error('Error getting agent settings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// POST /api/companies/:companyId/agent-settings
// Create or update agent settings
router.post('/:companyId/agent-settings', isAuthenticated, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate input
    const settingsData = createAgentSettingsSchema.parse(req.body);

    // Verify user is admin of this company
    const { storage } = await import('../storage');
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only company administrators can manage agent settings'
      });
    }

    // Check if settings already exist
    const existingSettings = await storage.getCompanyAgentSettings(companyId, settingsData.agentType);
    
    let agentSettings;
    if (existingSettings) {
      // Update existing
      agentSettings = await storage.updateCompanyAgentSettings(existingSettings.id, {
        defaultSettings: settingsData.defaultSettings,
        isEnabled: settingsData.isEnabled,
        maxInstances: settingsData.maxInstances
      });
    } else {
      // Create new
      agentSettings = await storage.createCompanyAgentSettings({
        companyId,
        agentType: settingsData.agentType,
        defaultSettings: settingsData.defaultSettings,
        isEnabled: settingsData.isEnabled,
        maxInstances: settingsData.maxInstances,
        createdBy: userId
      });
    }

    res.json({
      success: true,
      message: 'Agent settings configured successfully',
      data: { agentSettings }
    });

  } catch (error: any) {
    console.error('Error creating/updating agent settings:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

export default router;