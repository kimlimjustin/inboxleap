import express, { type Router } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../googleAuth';
import { storage } from '../storage';

const router: Router = express.Router();

// Validation schemas
const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'member']).default('member'),
  department: z.string().optional(),
  message: z.string().optional(),
});

const respondToInvitationSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

// GET /api/companies/:companyId/invitations
// Get all invitations for a company (admin/manager only)
router.get('/:companyId/invitations', isAuthenticated, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Verify user has admin/manager access to this company
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins and managers can view invitations.'
      });
    }

    const invitations = await storage.getCompanyInvitations(companyId);

    res.json({
      success: true,
      data: { invitations }
    });

  } catch (error: any) {
    console.error('Error getting company invitations:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// POST /api/companies/:companyId/invitations
// Invite a team member to join the company
router.post('/:companyId/invitations', isAuthenticated, async (req, res) => {
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
    const invitationData = inviteTeamMemberSchema.parse(req.body);

    // Verify user is admin/manager of this company
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only company administrators and managers can invite team members'
      });
    }

    // Check if user is already a member
    const existingUser = await storage.getUserByEmail(invitationData.email);
    if (existingUser) {
      const existingMembership = await storage.getCompanyMembership(companyId, existingUser.id);
      if (existingMembership) {
        return res.status(400).json({
          success: false,
          message: 'User is already a member of this company'
        });
      }
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = await storage.getCompanyInvitationByEmail(companyId, invitationData.email);
    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        message: 'An invitation is already pending for this email address'
      });
    }

    // Get company info for invitation
    const company = await storage.getCompany(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Create the invitation
    const invitation = await storage.createCompanyInvitation({
      companyId,
      inviterUserId: userId,
      inviteeEmail: invitationData.email,
      role: invitationData.role,
      department: invitationData.department,
      message: invitationData.message,
      status: 'pending',
      invitationToken: require('crypto').randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // TODO: Send invitation email
    console.log('Invitation created - would send email to:', invitationData.email);
    console.log('Invitation link would be:', `${req.protocol}://${req.get('host')}/invite?token=${invitation.invitationToken}`);

    res.json({
      success: true,
      message: 'Team member invitation sent successfully',
      data: { invitation }
    });

  } catch (error: any) {
    console.error('Error inviting team member:', error);
    
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

// GET /api/invitations/:token
// Get invitation details by token (public route for invitation acceptance)
router.get('/token/:token', async (req, res) => {
  try {
    const token = req.params.token;
    
    const invitation = await storage.getCompanyInvitationByToken(token);
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or expired'
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Invitation has already been responded to'
      });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation has expired'
      });
    }

    // Get company info
    const company = await storage.getCompany(invitation.companyId);
    
    res.json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          companyName: company?.name,
          role: invitation.role,
          department: invitation.department,
          message: invitation.message,
          inviteeEmail: invitation.inviteeEmail,
          expiresAt: invitation.expiresAt,
        }
      }
    });

  } catch (error: any) {
    console.error('Error getting invitation by token:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// POST /api/invitations/:token/respond
// Respond to invitation (accept/decline)
router.post('/token/:token/respond', isAuthenticated, async (req, res) => {
  try {
    const token = req.params.token;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate input
    const responseData = respondToInvitationSchema.parse(req.body);
    
    const invitation = await storage.getCompanyInvitationByToken(token);
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Invitation has already been responded to'
      });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation has expired'
      });
    }

    // Verify the user's email matches the invitation
    const user = await storage.getUser(userId);
    if (user?.email !== invitation.inviteeEmail) {
      return res.status(403).json({
        success: false,
        message: 'This invitation is not for your email address'
      });
    }

    if (responseData.action === 'accept') {
      const membership = await storage.acceptCompanyInvitation(invitation.id, userId);

      res.json({
        success: true,
        message: 'Invitation accepted successfully! Welcome to the team.',
        data: {
          membership,
          invitation
        }
      });
    } else {
      // Decline invitation
      await storage.updateCompanyInvitation(invitation.id, {
        status: 'declined',
        respondedAt: new Date(),
      });
      
      res.json({
        success: true,
        message: 'Invitation declined',
      });
    }

  } catch (error: any) {
    console.error('Error responding to invitation:', error);
    
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

// DELETE /api/companies/:companyId/invitations/:invitationId
// Cancel/delete an invitation
router.delete('/:companyId/invitations/:invitationId', isAuthenticated, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const invitationId = parseInt(req.params.invitationId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Verify user is admin/manager of this company
    const membership = await storage.getCompanyMembership(companyId, userId);
    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only company administrators and managers can cancel invitations'
      });
    }

    // Verify invitation belongs to this company
    const invitation = await storage.getCompanyInvitation(invitationId);
    if (!invitation || invitation.companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    await storage.deleteCompanyInvitation(invitationId);

    res.json({
      success: true,
      message: 'Invitation cancelled successfully'
    });

  } catch (error: any) {
    console.error('Error cancelling invitation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

export default router;