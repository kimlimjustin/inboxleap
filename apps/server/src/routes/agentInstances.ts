import { Router, type Router as ExpressRouter } from 'express';
import { agentInstanceService } from '../services/agentInstanceService';
import { isAuthenticated } from '../googleAuth';

const router: ExpressRouter = Router();

// Apply authentication middleware to all routes
router.use(isAuthenticated);

/**
 * GET /api/agent-instances/:agentType
 * Get all instances for the current identity and agent type
 */
router.get('/:agentType', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const identityId = req.session?.identityId; // Get current identity from session
    const { agentType } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!agentType || !['todo', 't5t', 'analyzer', 'polly', 'faq'].includes(agentType)) {
      return res.status(400).json({ error: 'Invalid agent type' });
    }

    // Get all instances for current identity (or legacy userId if no identity)
    const instances = identityId
      ? await agentInstanceService.getInstancesForIdentity(identityId, agentType)
      : await agentInstanceService.getUserInstances(userId, agentType);

    res.json({ instances });
  } catch (error) {
    console.error('Error fetching agent instances:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/agent-instances
 * Create a new custom instance for the current identity
 */
router.post('/', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const identityId = req.session?.identityId; // Get current identity from session
    const { agentType, instanceName, customEmail } = req.body;

    console.log('🔍 [AGENT-INSTANCES] Create request:', {
      userId,
      identityId,
      agentType,
      instanceName,
      customEmail,
      body: req.body
    });

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!agentType || !instanceName) {
      console.log('❌ [AGENT-INSTANCES] Missing required fields:', { agentType, instanceName });
      return res.status(400).json({ error: 'Agent type and instance name are required' });
    }

    if (!['todo', 't5t', 'analyzer', 'polly', 'faq'].includes(agentType)) {
      return res.status(400).json({ error: 'Invalid agent type' });
    }

    // Validate instance name (no special characters, reasonable length)
    if (!/^[a-zA-Z0-9-_ ]{1,50}$/.test(instanceName)) {
      return res.status(400).json({ error: 'Instance name must be 1-50 characters using letters, numbers, spaces, hyphens, or underscores' });
    }

    // Todo agent always uses the shared inbox
    if (agentType === 'todo' && customEmail && customEmail.toLowerCase() !== 'todo@inboxleap.com') {
      return res.status(400).json({
        error: 'Todo agent uses the shared todo@inboxleap.com inbox only'
      });
    }

    // For T5T agents, enforce email format: t5t+(something)@inboxleap.com (no generic t5t@inboxleap.com allowed)
    if (agentType === 't5t' && customEmail) {
      if (!customEmail.match(/^t5t\+[a-zA-Z0-9_-]+@inboxleap\.com$/)) {
        return res.status(400).json({
          error: 'T5T topic email must be in format: t5t+(something)@inboxleap.com'
        });
      }
    }

    // Create instance with identity (if available) or userId (legacy)
    const sanitizedCustomEmail = agentType === 'todo' ? undefined : customEmail;

    const instance = identityId
      ? await agentInstanceService.createInstanceForIdentity(identityId, agentType, instanceName, sanitizedCustomEmail)
      : await agentInstanceService.createInstance(userId, agentType, instanceName, sanitizedCustomEmail);

    res.status(201).json({ instance });
  } catch (error) {
    console.error('Error creating agent instance:', error);
    if (error instanceof Error && error.message.includes('already in use')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/agent-instances/:instanceId/email
 * Update instance email address
 */
router.put('/:instanceId/email', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { instanceId } = req.params;
    const { emailAddress } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!emailAddress || !emailAddress.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // SECURITY: Verify user owns this instance before allowing updates
    const existingInstance = await agentInstanceService.getInstanceById(parseInt(instanceId));
    if (!existingInstance || existingInstance.userId !== userId) {
      return res.status(403).json({ error: 'You can only update your own agent instances' });
    }

    // Todo agent inbox is fixed
    if (existingInstance.agentType === 'todo' && emailAddress.toLowerCase() !== 'todo@inboxleap.com') {
      return res.status(400).json({
        error: 'Todo agent email cannot be customized; use todo@inboxleap.com'
      });
    }

    const instance = await agentInstanceService.updateInstanceEmail(parseInt(instanceId), emailAddress);

    res.json({ instance });
  } catch (error) {
    console.error('Error updating instance email:', error);
    if (error instanceof Error && (error.message.includes('already in use') || error.message.includes('not found'))) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/agent-instances/:instanceId
 * Delete a custom instance (cannot delete default)
 */
router.delete('/:instanceId', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { instanceId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // SECURITY: Verify user owns this instance before allowing deletion
    const existingInstance = await agentInstanceService.getInstanceById(parseInt(instanceId));
    if (!existingInstance || existingInstance.userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own agent instances' });
    }

    await agentInstanceService.deleteInstance(parseInt(instanceId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent instance:', error);
    if (error instanceof Error && (error.message.includes('Cannot delete default') || error.message.includes('not found'))) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

