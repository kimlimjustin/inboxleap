import { Router, type Router as ExpressRouter } from 'express';
import { identityService } from '../services/identityService';

const router: ExpressRouter = Router();

/**
 * Get all identities accessible to the current user
 */
router.get('/', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let identities = await identityService.getUserAccessibleIdentities(userId);

    // If user has no personal identity, create one automatically
    if (!identities.personal) {
      console.log(`🆔 [IDENTITIES] No personal identity found for user ${userId}, creating one...`);
      const userEmail = req.user?.email || 'Unknown User';
      const newIdentity = await identityService.createUserIdentity(userId, userEmail);
      console.log(`✅ [IDENTITIES] Created personal identity ID: ${newIdentity.id} for user ${userId}`);

      // Refetch identities
      identities = await identityService.getUserAccessibleIdentities(userId);
    }

    res.json(identities);
  } catch (error) {
    console.error('Error fetching identities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get current identity context
 */
router.get('/current', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const identity = await identityService.getCurrentIdentity(userId);
    if (!identity) {
      return res.status(404).json({ error: 'No identity found' });
    }

    // Get permissions
    const permissions = await identityService.getIdentityPermissions(userId, identity.id);

    res.json({ identity, permissions });
  } catch (error) {
    console.error('Error fetching current identity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Switch identity context
 */
router.post('/switch/:identityId', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const identityId = parseInt(req.params.identityId);
    if (isNaN(identityId)) {
      return res.status(400).json({ error: 'Invalid identity ID' });
    }

    const identity = await identityService.switchIdentity(userId, identityId);
    const permissions = await identityService.getIdentityPermissions(userId, identity.id);

    res.json({ identity, permissions });
  } catch (error) {
    console.error('Error switching identity:', error);
    if (error instanceof Error && error.message.includes('does not have access')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get identity details by ID
 */
router.get('/:identityId', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const identityId = parseInt(req.params.identityId);
    if (isNaN(identityId)) {
      return res.status(400).json({ error: 'Invalid identity ID' });
    }

    // Verify access
    const hasAccess = await identityService.verifyIdentityAccess(userId, identityId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const identity = await identityService.getIdentityDetails(identityId);
    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }

    const permissions = await identityService.getIdentityPermissions(userId, identityId);

    res.json({ identity, permissions });
  } catch (error) {
    console.error('Error fetching identity details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get agent instances for an identity
 */
router.get('/:identityId/agent-instances', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const identityId = parseInt(req.params.identityId);
    if (isNaN(identityId)) {
      return res.status(400).json({ error: 'Invalid identity ID' });
    }

    // Verify access
    const hasAccess = await identityService.verifyIdentityAccess(userId, identityId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const instances = await identityService.getIdentityAgentInstances(identityId);
    res.json({ instances });
  } catch (error) {
    console.error('Error fetching identity agent instances:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get projects for an identity
 */
router.get('/:identityId/projects', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const identityId = parseInt(req.params.identityId);
    if (isNaN(identityId)) {
      return res.status(400).json({ error: 'Invalid identity ID' });
    }

    // Verify access
    const hasAccess = await identityService.verifyIdentityAccess(userId, identityId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const projects = await identityService.getIdentityProjects(identityId);
    res.json({ projects });
  } catch (error) {
    console.error('Error fetching identity projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get identity access list (team members for company identities)
 */
router.get('/:identityId/access', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const identityId = parseInt(req.params.identityId);
    if (isNaN(identityId)) {
      return res.status(400).json({ error: 'Invalid identity ID' });
    }

    // Verify access
    const hasAccess = await identityService.verifyIdentityAccess(userId, identityId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get identity details
    const identity = await identityService.getIdentityById(identityId);
    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }

    // Only company identities have access lists
    if (identity.type !== 'company') {
      return res.json({ access: [] });
    }

    // Get all users with access to this identity
    const access = await identityService.getIdentityAccessList(identityId);
    res.json({ access });
  } catch (error) {
    console.error('Error fetching identity access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;