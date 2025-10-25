import express, { type Router } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../googleAuth';

const router: Router = express.Router();

// Available agent types
const AGENT_TYPES = ['todo', 'analyzer', 'polly', 'faq', 't5t'] as const;

// Validation schemas
const createUserAgentEmailSchema = z.object({
  agentType: z.enum(AGENT_TYPES),
  instanceName: z.string().min(1).max(100).default('primary'),
  emailAddress: z.string().email().optional(),
  isActive: z.boolean().default(true),
  customization: z.record(z.any()).default({})
});

const updateUserAgentEmailSchema = z.object({
  instanceName: z.string().min(1).max(100).optional(),
  emailAddress: z.string().email().optional(),
  isActive: z.boolean().optional(),
  customization: z.record(z.any()).optional()
});

// GET /api/user/agent-emails
// Get all agent email addresses for the current user
router.get('/agent-emails', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { storage } = await import('../storage');
    const agentEmails = await storage.getUserAgentEmails(userId);

    res.json({
      success: true,
      data: { agentEmails }
    });

  } catch (error: any) {
    console.error('Error getting user agent emails:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// POST /api/user/agent-emails
// Create a new agent email address for the current user
router.post('/agent-emails', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate input
    const agentEmailData = createUserAgentEmailSchema.parse(req.body);

    const { storage } = await import('../storage');

    // Check if this specific instance already exists
    const existingEmail = await storage.getUserAgentEmail(userId, agentEmailData.agentType, agentEmailData.instanceName);
    
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: `Agent instance "${agentEmailData.instanceName}" already exists for ${agentEmailData.agentType}`
      });
    }

    // Check max instances limit (set to 5 for individual users)
    const existingInstances = await storage.getUserAgentEmailsForAgent(userId, agentEmailData.agentType);
    const maxInstances = 5;
    
    if (existingInstances.length >= maxInstances) {
      return res.status(400).json({
        success: false,
        message: `Maximum number of instances (${maxInstances}) reached for ${agentEmailData.agentType}`
      });
    }

    // Generate email address
    const emailAddress = agentEmailData.emailAddress || 
      storage.generateDefaultAgentEmailForUser(userId, agentEmailData.agentType, agentEmailData.instanceName);

    // Check for conflicts
    const conflictEmail = await storage.getUserAgentEmailByAddress(emailAddress);
    if (conflictEmail) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already taken by another user agent'
      });
    }

    // Create new agent instance
    const agentEmail = await storage.createUserAgentEmail({
      userId,
      agentType: agentEmailData.agentType,
      instanceName: agentEmailData.instanceName,
      emailAddress,
      isActive: agentEmailData.isActive,
      customization: agentEmailData.customization
    });

    res.json({
      success: true,
      message: 'Agent email configured successfully',
      data: { agentEmail }
    });

  } catch (error: any) {
    console.error('Error creating user agent email:', error);
    
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

// PATCH /api/user/agent-emails/:agentEmailId
// Update a specific user agent email
router.patch('/agent-emails/:agentEmailId', isAuthenticated, async (req, res) => {
  try {
    const agentEmailId = parseInt(req.params.agentEmailId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate input
    const updateData = updateUserAgentEmailSchema.parse(req.body);

    const { storage } = await import('../storage');

    // Verify the agent email belongs to this user
    const existingAgentEmail = await storage.getUserAgentEmailById(agentEmailId);
    if (!existingAgentEmail || existingAgentEmail.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Agent email not found or access denied'
      });
    }

    // Check if updating email address conflicts with other agents
    if (updateData.emailAddress) {
      const conflictEmail = await storage.getUserAgentEmailByAddress(updateData.emailAddress);
      if (conflictEmail && conflictEmail.id !== agentEmailId) {
        return res.status(400).json({
          success: false,
          message: 'This email address is already taken by another user agent'
        });
      }
    }

    const updatedAgentEmail = await storage.updateUserAgentEmail(agentEmailId, updateData);

    res.json({
      success: true,
      message: 'Agent email updated successfully',
      data: { agentEmail: updatedAgentEmail }
    });

  } catch (error: any) {
    console.error('Error updating user agent email:', error);
    
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

// DELETE /api/user/agent-emails/:agentEmailId
// Delete a specific user agent email
router.delete('/agent-emails/:agentEmailId', isAuthenticated, async (req, res) => {
  try {
    const agentEmailId = parseInt(req.params.agentEmailId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { storage } = await import('../storage');

    // Verify the agent email belongs to this user
    const existingAgentEmail = await storage.getUserAgentEmailById(agentEmailId);
    if (!existingAgentEmail || existingAgentEmail.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Agent email not found or access denied'
      });
    }

    await storage.deleteUserAgentEmail(agentEmailId);

    res.json({
      success: true,
      message: 'Agent email deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting user agent email:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// GET /api/user/agent-emails/:agentType/instances
// Get all instances of a specific agent type for the current user
router.get('/agent-emails/:agentType/instances', isAuthenticated, async (req, res) => {
  try {
    const agentType = req.params.agentType;
    const userId = req.user?.id;

    if (!userId || !AGENT_TYPES.includes(agentType as any)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    const { storage } = await import('../storage');
    const instances = await storage.getUserAgentEmailsForAgent(userId, agentType);

    res.json({
      success: true,
      data: { instances }
    });

  } catch (error: any) {
    console.error('Error getting user agent instances:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

export default router;