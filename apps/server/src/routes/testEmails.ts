import express, { type Router } from 'express';
import { z } from 'zod';
import { faker } from '@faker-js/faker';
import { isAuthenticated } from '../googleAuth';
import { TestEmailGenerator } from '../services/testEmailGenerator';
import type { EmailData } from '../services/email/types';
import { emailService } from '../services/emailService';

const router: Router = express.Router();

// Validation schema for email generation request
const generateEmailsSchema = z.object({
  count: z.number().int().min(1).max(1000, 'Count must be between 1 and 1000'),
  types: z.array(z.enum(['task-request', 'team-collaboration', 'question-inquiry', 'urgent-issue', 'project-update', 'meeting-schedule'])).min(1, 'At least one email type is required'),
  emails: z.array(z.string().email()).optional(), // Optional - will use user's agent emails if not provided
  customFromEmail: z.string().email().optional(),
  customSubject: z.string().optional()
});

// POST /api/test/generate-emails
// Generate bulk test emails and process them as if they were received
router.post('/generate-emails', isAuthenticated, async (req, res) => {
  try {
    console.log('🧪 [TEST] Received generate-emails request');
    console.log('🧪 [TEST] Request body:', JSON.stringify(req.body, null, 2));

    const userId = req.user?.id;

    if (!userId) {
      console.log('🧪 [TEST] Authentication failed - no user ID');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate input
    const requestData = generateEmailsSchema.parse(req.body);

    // SECURITY: Get the user's agent instances automatically
    const { agentInstanceService } = await import('../services/agentInstanceService');

    // Get all agent instances for this user across all agent types
    const agentTypes = ['todo', 't5t', 'analyzer', 'polly', 'faq', 'sally', 'agent'];
    const allUserInstances = [];

    for (const agentType of agentTypes) {
      const instances = await agentInstanceService.getUserInstances(userId, agentType);
      allUserInstances.push(...instances);
    }

    if (allUserInstances.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No agent instances found for your account. Please set up agent instances first.'
      });
    }

    const userAgentEmails = allUserInstances.map(instance => instance.emailAddress);

    // Determine target emails: use provided emails if given, otherwise use all user's agent emails
    let targetEmails: string[];
    if (requestData.emails && requestData.emails.length > 0) {
      // SECURITY: Validate that all provided emails belong to this user's agent instances
      const invalidEmails = requestData.emails.filter(email => !userAgentEmails.includes(email));

      if (invalidEmails.length > 0) {
        console.log(`🚨 [SECURITY] User ${userId} attempted to send to non-owned emails: ${invalidEmails.join(', ')}`);
        return res.status(403).json({
          success: false,
          message: `You can only send test emails to your own agent instances. Invalid emails: ${invalidEmails.join(', ')}`,
          userAgentEmails: userAgentEmails
        });
      }

      targetEmails = requestData.emails;
      console.log(`🧪 [TEST] Using user-specified emails: ${targetEmails.join(', ')}`);
    } else {
      targetEmails = userAgentEmails;
      console.log(`🧪 [TEST] Using all user agent emails: ${targetEmails.join(', ')}`);
    }

    console.log(`🧪 [TEST] Generating ${requestData.count} test emails for user ${userId}`);
    console.log(`🧪 [TEST] Types: ${requestData.types.join(', ')}`);
    console.log(`🧪 [TEST] Target emails: ${targetEmails.join(', ')}`);

    // Generate emails
    const generator = new TestEmailGenerator();
    const emails = generator.generateBulkEmails(
      requestData.count,
      requestData.types,
      targetEmails,
      requestData.customFromEmail,
      requestData.customSubject
    );

    console.log(`🧪 [TEST] Generated ${emails.length} emails, now processing them...`);

    // Track queue results for the response
    const queuedEmails: Array<{ messageId: string; subject: string; to: string; type: string }> = [];
    const errors: Array<{ subject: string; to: string; error: string }> = [];
    let successCount = 0;
    let errorCount = 0;

    // Queue each generated email for processing through the standard pipeline
    for (const email of emails) {
      try {
        const ccList: string[] = [];
        const bccList: string[] = [];

        if (email.type === 'team-collaboration') {
          const ccCount = Math.max(1, Math.floor(Math.random() * 3));
          for (let i = 0; i < ccCount; i++) {
            const alias = faker.internet.userName().replace(/[^a-zA-Z0-9]/g, '.').toLowerCase();
            ccList.push(`${alias}@${faker.internet.domainName()}`);
          }
        }

        const emailData: EmailData = {
          messageId: email.messageId,
          subject: `[TEST] ${email.subject}`,
          from: email.from,
          to: [email.to],
          cc: ccList,
          bcc: bccList,
          body: email.textBody,
          date: email.receivedAt,
          // Add test mode flag to bypass batch processing for immediate results
          testMode: true,
        };

        // Use the internal service pipeline so the email is routed exactly as live traffic
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (emailService as any).processIncomingEmail(emailData, 'test-service');

        successCount++;
        queuedEmails.push({
          messageId: email.messageId,
          subject: emailData.subject,
          to: email.to,
          type: email.type,
        });
        console.log(`?? [TEST] ? Queued email for processing: ${email.subject} -> ${email.to}`);
      } catch (emailError) {
        errorCount++;
        console.error(`?? [TEST] ? Error queuing email "${email.subject}":`, emailError);
        errors.push({
          subject: email.subject,
          to: email.to,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }
    console.log(`?? [TEST] Queued ${successCount} emails for processing (${errorCount} failures)`);

    res.json({
      success: errorCount === 0,
      message: `Queued ${successCount} test emails for processing`,
      data: {
        requested: requestData.count,
        generated: emails.length,
        queued: successCount,
        failed: errorCount,
        types: requestData.types,
        targetEmails,
        queuedEmails,
        errors
      }
    });

  } catch (error: any) {
    console.error('🧪 [TEST] Error generating test emails:', error);
    
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

// POST /api/test/send-todo-sample
// Generate and process a representative Todo task email for the current user
router.post('/send-todo-sample', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId || !userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const generator = new TestEmailGenerator();
    const sample = generator.generateEmail('team-collaboration', 'todo@inboxleap.com', userEmail, '[TEST TODO]');

    const teammateEmails = new Set<string>();
    while (teammateEmails.size < 2) {
      const teammateEmail = faker.internet.email().toLowerCase();
      if (teammateEmail !== userEmail.toLowerCase() && !teammateEmail.endsWith('@inboxleap.com')) {
        teammateEmails.add(teammateEmail);
      }
    }

    const emailData: EmailData = {
      messageId: sample.messageId,
      subject: sample.subject.startsWith('[TEST TODO]') ? sample.subject : `[TEST TODO] ${sample.subject}`,
      from: userEmail,
      to: ['todo@inboxleap.com'],
      cc: Array.from(teammateEmails),
      bcc: [],
      body: `${sample.textBody}

(This message was generated from the /test sandbox to validate Todo task routing.)`,
      date: new Date(),
      threadId: sample.messageId,
      testMode: true,
    };

    await (emailService as any).processIncomingEmail(emailData, 'todo-test-sample');

    res.json({
      success: true,
      message: 'Sample Todo task email queued for processing',
      data: {
        subject: emailData.subject,
        to: emailData.to,
        cc: emailData.cc,
      },
    });
  } catch (error: any) {
    console.error('Error sending Todo sample email:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

// GET /api/test/email-stats
// Get statistics about test emails
router.get('/email-stats', isAuthenticated, async (req, res) => {
  try {
    const { storage } = await import('../storage');
    
    // Get test emails (identified by source = 'test-generator')
    const testEmails = await storage.getProcessedEmailsBySource('test-generator');
    
    // Group by agent
    const statsByAgent = testEmails.reduce((acc, email) => {
      // Get first recipient email (primary target)
      const firstRecipient = email.recipients?.[0] || '';
      const agentMatch = firstRecipient.match(/^(\w+)@/);
      const agent = agentMatch ? agentMatch[1] : 'unknown';

      if (!acc[agent]) {
        acc[agent] = 0;
      }
      acc[agent]++;

      return acc;
    }, {} as Record<string, number>);

    // Group by type (extracted from subject)
    const statsByType = testEmails.reduce((acc, email) => {
      try {
        // Extract type from subject - subjects are like "[TEST] Request: Update the quarterly sales report"
        const subjectMatch = email.subject.match(/\[TEST\]\s*([^:]+):/);
        const type = subjectMatch ? subjectMatch[1].toLowerCase().trim() : 'unknown';
        
        if (!acc[type]) {
          acc[type] = 0;
        }
        acc[type]++;
        
        return acc;
      } catch {
        if (!acc['unknown']) {
          acc['unknown'] = 0;
        }
        acc['unknown']++;
        return acc;
      }
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        totalTestEmails: testEmails.length,
        statsByAgent,
        statsByType,
        oldestTestEmail: testEmails.length > 0 ? Math.min(...testEmails.map(e => new Date(e.createdAt || new Date()).getTime())) : null,
        newestTestEmail: testEmails.length > 0 ? Math.max(...testEmails.map(e => new Date(e.createdAt || new Date()).getTime())) : null
      }
    });

  } catch (error: any) {
    console.error('Error getting test email stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// DELETE /api/test/clear-emails
// Clear all test emails (for cleanup)
router.delete('/clear-emails', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { storage } = await import('../storage');

    // SECURITY: Only clear test emails sent to this user's agent addresses
    const { agentInstanceService } = await import('../services/agentInstanceService');

    // Get all agent instances for this user across all agent types
    const agentTypes = ['todo', 't5t', 'analyzer', 'polly', 'faq', 'sally', 'agent'];
    const allUserInstances = [];

    for (const agentType of agentTypes) {
      const instances = await agentInstanceService.getUserInstances(userId, agentType);
      allUserInstances.push(...instances);
    }

    const userEmails = allUserInstances.map(instance => instance.emailAddress);

    // Get all test emails (has [TEST] prefix)
    const allTestEmails = await storage.getProcessedEmailsBySource('test-generator');

    // Filter to only test emails sent to this user's agents
    const userTestEmails = allTestEmails.filter(email =>
      email.recipients && email.recipients.some(recipient => userEmails.includes(recipient))
    );

    console.log(`🧪 [TEST] Found ${allTestEmails.length} total test emails, ${userTestEmails.length} belong to user ${userId}`);
    console.log(`🧪 [TEST] User email addresses: ${userEmails.join(', ')}`);
    console.log(`🧪 [TEST] Clearing ${userTestEmails.length} user-specific test emails...`);

    // Delete each user-specific test email
    let deletedCount = 0;
    for (const email of userTestEmails) {
      try {
        await storage.deleteProcessedEmail(email.id);
        deletedCount++;
      } catch (error) {
        console.error(`🧪 [TEST] Error deleting email ${email.id}:`, error);
      }
    }

    console.log(`🧪 [TEST] Cleared ${deletedCount} test emails`);

    res.json({
      success: true,
      message: `Cleared ${deletedCount} test emails`,
      data: {
        deleted: deletedCount,
        requested: userTestEmails.length,
        totalTestEmails: allTestEmails.length
      }
    });

  } catch (error: any) {
    console.error('🧪 [TEST] Error clearing test emails:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

export default router;
