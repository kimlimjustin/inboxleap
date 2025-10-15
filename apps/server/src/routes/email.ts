import { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../googleAuth';
import { insertEmailCredentialsSchema } from '@email-task-router/shared';
import { emailService } from '../services/emailService';
import { s3EmailBackupProcessor } from '../services/s3EmailBackupProcessor';

export function registerEmailRoutes(app: Express) {
  // SES Inbound Email Webhook (for AWS Lambda integration)
  app.post('/api/inbound/email', async (req, res) => {
    try {
      // Security: Validate shared secret
      const authToken = req.headers['x-auth-token'] || req.headers['x-signature'];
      const expectedToken = process.env.SES_WEBHOOK_SECRET || 'your-webhook-secret';
      
      if (!authToken || authToken !== expectedToken) {
        console.log('❌ [SES] Unauthorized webhook request');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { messageId, subject, from, to, cc, bcc, body, date, headers } = req.body;

      // Validate required fields
      if (!messageId || !subject || !from || !to || !body) {
        console.log('❌ [SES] Missing required fields in webhook payload');
        return res.status(400).json({ message: 'Missing required fields: messageId, subject, from, to, body' });
      }

      // Create EmailData object
      const emailData = {
        messageId,
        subject,
        from,
        to: Array.isArray(to) ? to : [to],
        cc: Array.isArray(cc) ? cc : cc ? [cc] : [],
        bcc: Array.isArray(bcc) ? bcc : bcc ? [bcc] : [],
        body,
        date: date ? new Date(date) : new Date(),
        // Extract thread info from headers if provided
        inReplyTo: headers?.['in-reply-to'] || headers?.inReplyTo,
        references: headers?.references ? (Array.isArray(headers.references) ? headers.references : [headers.references]) : undefined,
        threadId: headers?.['in-reply-to'] || headers?.inReplyTo || messageId
      };

      console.log(`📧 [SES] Processing inbound email from ${from}: ${subject}`);
      console.log(`📧 [SES] Recipients: ${emailData.to.join(', ')}`);

      // Use existing email processing logic with timeout protection
      const processEmailPromise = emailService.processIncomingServiceEmailToQueue(emailData);
      
      // Add timeout to prevent hanging (5 minutes max)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email processing timeout')), 300000); // 5 minutes
      });
      
      await Promise.race([processEmailPromise, timeoutPromise]);

      console.log(`✅ [SES] Email processed successfully: ${messageId}`);
      res.status(200).json({ 
        message: 'Email processed successfully', 
        messageId,
        recipients: emailData.to 
      });

    } catch (error) {
      console.error('❌ [SES] Error processing inbound email:', error);
      res.status(500).json({ message: 'Failed to process email' });
    }
  });

  // Email credentials routes
  app.get('/api/email-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const credentials = await storage.getUserEmailCredentials(userId);
      res.json(credentials);
    } catch (error) {
      console.error("Error fetching email credentials:", error);
      res.status(500).json({ message: "Failed to fetch email credentials" });
    }
  });

  app.post('/api/email-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertEmailCredentialsSchema.parse({
        ...req.body,
        userId,
      });
      const credentials = await storage.createEmailCredentials(validatedData);
      
      // Start email monitoring for this user
      emailService.startMonitoring(userId);
      
      res.json(credentials);
    } catch (error) {
      console.error("Error creating email credentials:", error);
      res.status(500).json({ message: "Failed to create email credentials" });
    }
  });

  // Recent email activity
  app.get('/api/recent-emails', isAuthenticated, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const emails = await storage.getRecentProcessedEmails(limit);
      res.json(emails);
    } catch (error) {
      console.error("Error fetching recent emails:", error);
      res.status(500).json({ message: "Failed to fetch recent emails" });
    }
  });

  // Trigger manual S3 email check and processing
  app.post('/api/admin/s3-refresh', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🔄 [API] Manual S3 refresh triggered by user:', req.user.email);
      
      // Trigger the S3 email processor to check for new emails
      await s3EmailBackupProcessor.processUnprocessedEmails();
      
      res.json({ 
        message: 'S3 refresh completed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ [API] Error during S3 refresh:', error);
      res.status(500).json({ 
        message: 'Failed to refresh S3 emails',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get S3 email processor status and test email parsing
  app.get('/api/admin/s3-status', isAuthenticated, async (req: any, res) => {
    try {
      const status = s3EmailBackupProcessor.getStatus();
      res.json(status);
    } catch (error) {
      console.error('❌ [API] Error getting S3 processor status:', error);
      res.status(500).json({ 
        message: 'Failed to get S3 processor status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test email parsing with sample data
  app.post('/api/admin/s3-test-parsing', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🧪 [API] Testing S3 email parsing triggered by user:', req.user.email);
      
      // Sample test data that mimics mailparser output
      const testEmailData = {
        messageId: '<test@example.com>',
        subject: 'Test Email Subject',
        from: {
          value: [{ address: 'sender@example.com', name: 'Test Sender' }],
          text: 'Test Sender <sender@example.com>'
        },
        to: {
          value: [
            { address: 'recipient1@example.com', name: 'Recipient One' },
            { address: 'recipient2@example.com', name: 'Recipient Two' }
          ],
          text: 'Recipient One <recipient1@example.com>, Recipient Two <recipient2@example.com>'
        },
        cc: {
          value: [{ address: 'cc@example.com', name: 'CC Recipient' }],
          text: 'CC Recipient <cc@example.com>'
        },
        bcc: undefined,
        text: 'This is a test email body',
        html: '<p>This is a test email body</p>',
        date: new Date(),
        inReplyTo: undefined,
        references: undefined
      };
      
      const result = await s3EmailBackupProcessor.testEmailParsing(testEmailData);
      
      res.json({ 
        message: 'Email parsing test completed',
        testData: testEmailData,
        result: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ [API] Error during email parsing test:', error);
      res.status(500).json({ 
        message: 'Failed to test email parsing',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
