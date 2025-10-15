import { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../googleAuth';

export function registerFAQRoutes(app: Express) {
  // Get organization setup status
  app.get('/api/faq/organization', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      console.log(`📋 [FAQ] Getting organization for user ${userId}`);
      
      const organization = await storage.getFAQOrganizationByUser(userId);
      
      if (!organization) {
        res.json({
          hasOrganization: false
        });
        return;
      }
      
      res.json({
        hasOrganization: true,
        organizationName: organization.name,
        faqEmail: organization.faqEmail,
        description: organization.description
      });
    } catch (error) {
      console.error('Error getting FAQ organization:', error);
      res.status(500).json({
        message: 'Failed to get organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create organization
  app.post('/api/faq/organization', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name, description } = req.body;
      
      console.log(`📋 [FAQ] Creating organization ${name} for user ${userId}`);
      
      const existingOrg = await storage.getFAQOrganizationByUser(userId);
      if (existingOrg) {
        return res.status(409).json({
          message: 'User already has an organization',
          organization: existingOrg
        });
      }
      
      const orgSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const faqEmail = `faq+${orgSlug}@inboxleap.com`;
      
      const organization = await storage.createFAQOrganization({
        name,
        description,
        faqEmail,
        createdBy: userId
      });
      
      console.log(`📋 [FAQ] Created organization ${organization.id} for user ${userId}`);
      
      res.json({
        id: organization.id,
        name: organization.name,
        description: organization.description,
        faqEmail: organization.faqEmail,
        createdBy: organization.createdBy
      });
    } catch (error) {
      console.error('Error creating FAQ organization:', error);
      res.status(500).json({
        message: 'Failed to create organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get SOP documents
  app.get('/api/faq/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      console.log(`📋 [FAQ] Getting SOP documents for user ${userId}`);
      
      const organization = await storage.getFAQOrganizationByUser(userId);
      if (!organization) {
        return res.status(404).json({
          message: 'No organization found for user'
        });
      }
      
      const documents = await storage.getSOPDocumentsByOrganization(organization.id);
      
      const transformedDocs = documents.map(doc => ({
        id: doc.id.toString(),
        title: doc.title,
        description: doc.description,
        content: doc.content,
        category: doc.category,
        tags: doc.tags || [],
        createdAt: (doc.createdAt || new Date()).toISOString(),
        updatedAt: (doc.updatedAt || new Date()).toISOString(),
        createdBy: doc.createdBy
      }));
      
      console.log(`📋 [FAQ] Found ${transformedDocs.length} SOP documents for organization ${organization.id}`);
      res.json(transformedDocs);
    } catch (error) {
      console.error('Error getting SOP documents:', error);
      res.status(500).json({
        message: 'Failed to get SOP documents',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create SOP document
  app.post('/api/faq/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { title, description, content, category, tags } = req.body;
      
      console.log(`📋 [FAQ] Creating SOP document ${title} for user ${userId}`);
      
      const organization = await storage.getFAQOrganizationByUser(userId);
      if (!organization) {
        return res.status(404).json({
          message: 'No organization found for user'
        });
      }
      
      const document = await storage.createSOPDocument({
        organizationId: organization.id,
        title,
        description,
        content,
        category,
        tags: tags || [],
        createdBy: userId
      });
      
      console.log(`📋 [FAQ] Created SOP document ${document.id} for organization ${organization.id}`);
      
      res.json({
        id: document.id.toString(),
        title: document.title,
        description: document.description,
        content: document.content,
        category: document.category,
        tags: document.tags || [],
        createdAt: (document.createdAt || new Date()).toISOString(),
        updatedAt: (document.updatedAt || new Date()).toISOString(),
        createdBy: document.createdBy
      });
    } catch (error) {
      console.error('Error creating SOP document:', error);
      res.status(500).json({
        message: 'Failed to create SOP document',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get FAQ entries
  app.get('/api/faq/entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      console.log(`📋 [FAQ] Getting FAQ entries for user ${userId}`);
      
      const organization = await storage.getFAQOrganizationByUser(userId);
      if (!organization) {
        return res.status(404).json({
          message: 'No organization found for user'
        });
      }
      
      const entries = await storage.getFAQEntriesByOrganization(organization.id);
      
      const transformedEntries = entries.map(entry => ({
        id: entry.id.toString(),
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        relatedDocuments: entry.relatedDocuments || [],
        createdAt: (entry.createdAt || new Date()).toISOString(),
        updatedAt: (entry.updatedAt || new Date()).toISOString()
      }));
      
      console.log(`📋 [FAQ] Found ${transformedEntries.length} FAQ entries for organization ${organization.id}`);
      res.json(transformedEntries);
    } catch (error) {
      console.error('Error getting FAQ entries:', error);
      res.status(500).json({
        message: 'Failed to get FAQ entries',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create FAQ entry
  app.post('/api/faq/entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { question, answer, category } = req.body;
      
      console.log(`📋 [FAQ] Creating FAQ entry for user ${userId}`);
      
      const organization = await storage.getFAQOrganizationByUser(userId);
      if (!organization) {
        return res.status(404).json({
          message: 'No organization found for user'
        });
      }
      
      const entry = await storage.createFAQEntry({
        organizationId: organization.id,
        question,
        answer,
        category,
        relatedDocuments: [],
        createdBy: userId
      });
      
      console.log(`📋 [FAQ] Created FAQ entry ${entry.id} for organization ${organization.id}`);
      
      res.json({
        id: entry.id.toString(),
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        relatedDocuments: entry.relatedDocuments || [],
        createdAt: (entry.createdAt || new Date()).toISOString(),
        updatedAt: (entry.updatedAt || new Date()).toISOString()
      });
    } catch (error) {
      console.error('Error creating FAQ entry:', error);
      res.status(500).json({
        message: 'Failed to create FAQ entry',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get FAQ inquiries (recent questions/answers)
  app.get('/api/faq/inquiries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 20;
      
      console.log(`📋 [FAQ] Getting recent inquiries for user ${userId}`);
      
      const organization = await storage.getFAQOrganizationByUser(userId);
      if (!organization) {
        return res.status(404).json({
          message: 'No organization found for user'
        });
      }
      
      // Get recent FAQ entries (which include both manual entries and auto-generated from emails)
      const entries = await storage.getFAQEntriesByOrganization(organization.id);
      
      const recentInquiries = entries
        .sort((a, b) => new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime())
        .slice(0, limit)
        .map(entry => ({
          id: entry.id.toString(),
          question: entry.question,
          answer: entry.answer,
          category: entry.category,
          createdAt: (entry.createdAt || new Date()).toISOString(),
          isAutoGenerated: entry.question.length > 150 // Assume longer questions are from emails
        }));
      
      console.log(`📋 [FAQ] Found ${recentInquiries.length} recent inquiries`);
      res.json(recentInquiries);
    } catch (error) {
      console.error('Error getting FAQ inquiries:', error);
      res.status(500).json({
        message: 'Failed to get FAQ inquiries',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test FAQ processing endpoint
  app.post('/api/faq/test-inquiry', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { inquiry, senderEmail } = req.body;
      
      if (!inquiry) {
        return res.status(400).json({ message: 'Inquiry text is required' });
      }
      
      console.log(`📋 [FAQ-TEST] Processing test inquiry for user ${userId}`);
      
      const organization = await storage.getFAQOrganizationByUser(userId);
      if (!organization) {
        return res.status(404).json({
          message: 'No organization found for user'
        });
      }
      
      // Create mock email data
      const mockEmail = {
        messageId: `test_${Date.now()}@inboxleap.com`,
        subject: 'Test FAQ Inquiry',
        from: senderEmail || 'test@example.com',
        to: [organization.faqEmail || 'faq@inboxleap.com'],
        cc: [],
        bcc: [],
        body: inquiry,
        date: new Date(),
        attachments: []
      };
      
      // Process through FAQ handler
      const { faqHandler } = await import('../services/handlers/faqHandler');
      await faqHandler.processEmail(mockEmail);
      
      res.json({
        success: true,
        message: 'Test inquiry processed successfully',
        organizationEmail: organization.faqEmail,
        inquiry: inquiry.substring(0, 100) + (inquiry.length > 100 ? '...' : '')
      });
    } catch (error) {
      console.error('Error processing test inquiry:', error);
      res.status(500).json({
        message: 'Failed to process test inquiry',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
