import type { Express, Request, Response } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../googleAuth';
import { analyzeAttachment } from '../services/analyzer/analyzerAnalysisService';

/**
 * Register document analysis routes
 */
export function registerDocumentRoutes(app: Express): void {
  /**
   * GET /api/documents/results
   * Get document analysis results for the current user
   */
  app.get('/api/documents/results', isAuthenticated, async (req: Request, res: Response) => {
    try {
      console.log('[DocumentRoutes] Fetching document analysis results');

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      // Get limit from query params
      const limitParam = Number(req.query.limit);
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

      // Fetch results from storage
      const results = await storage.getDocumentAnalysisResults(userId, limit);

      console.log(`[DocumentRoutes] Found ${results.length} analysis results for user ${userId}`);

      return res.status(200).json({
        success: true,
        results: results
      });

    } catch (error) {
      console.error('[DocumentRoutes] Error fetching results:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch analysis results'
      });
    }
  });

  /**
   * GET /api/documents/:id
   * Get a specific document analysis result
   */
  app.get('/api/documents/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const resultId = parseInt(req.params.id);

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      // Fetch result from storage
      const result = await storage.getDocumentAnalysisResult(resultId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Analysis result not found'
        });
      }

      // Verify ownership
      if (result.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      return res.status(200).json({
        success: true,
        result: result
      });

    } catch (error) {
      console.error('[DocumentRoutes] Error fetching result:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch analysis result'
      });
    }
  });

  /**
   * POST /api/documents/results/:id/reanalyze
   * Re-run analysis for a specific document result
   */
  app.post('/api/documents/results/:id/reanalyze', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const resultId = parseInt(req.params.id);
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      const existingResult = await storage.getDocumentAnalysisResult(resultId);
      if (!existingResult) {
        return res.status(404).json({
          success: false,
          message: 'Analysis result not found'
        });
      }

      if (existingResult.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const attachment = await storage.getEmailAttachmentByMessageAndFilename(
        existingResult.messageId,
        existingResult.filename
      );

      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: 'Original attachment not found for reanalysis'
        });
      }

      const processedEmail = existingResult.messageId
        ? await storage.getProcessedEmailByMessageId(existingResult.messageId)
        : undefined;

      const analysis = await analyzeAttachment(attachment, {
        subject: processedEmail?.subject || '',
        body: processedEmail?.body || ''
      });

      await storage.updateEmailAttachmentAnalysis(attachment.id, analysis);

      const updatedResult = await storage.updateDocumentAnalysisResult(resultId, {
        aiAnalysis: analysis,
        extractedText: analysis.extractedText || null,
        analysisData: analysis.contentAnalysis ?? existingResult.analysisData,
        processedAt: new Date()
      });

      return res.status(200).json({
        success: true,
        result: updatedResult
      });

    } catch (error) {
      console.error('[DocumentRoutes] Error reanalyzing result:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reanalyze document'
      });
    }
  });

  /**
   * GET /api/documents/results/:id/file
   * Download or inline view of an analyzed file
   */
  app.get('/api/documents/results/:id/file', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const resultId = parseInt(req.params.id);
      const mode = typeof req.query.mode === 'string' && req.query.mode.toLowerCase() === 'inline' ? 'inline' : 'attachment';

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      const result = await storage.getDocumentAnalysisResult(resultId);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Analysis result not found'
        });
      }

      if (result.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const attachment = await storage.getEmailAttachmentByMessageAndFilename(
        result.messageId,
        result.filename
      );

      if (!attachment || !attachment.content) {
        return res.status(404).json({
          success: false,
          message: 'Attachment content not available'
        });
      }

      const project = attachment.projectId ? await storage.getProject(attachment.projectId) : undefined;
      if (project && project.createdBy !== userId) {
        const participant = await storage.getProjectParticipant(attachment.projectId, userId);
        if (!participant) {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }

      const buffer = Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(attachment.content, 'base64');

      const filename = attachment.originalName || result.filename;
      res.setHeader('Content-Disposition', `${mode}; filename="${filename}"`);
      res.setHeader('Content-Type', attachment.contentType || result.fileType || 'application/octet-stream');
      res.setHeader('Content-Length', buffer.length);

      return res.send(buffer);
    } catch (error) {
      console.error('[DocumentRoutes] Error serving file:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to serve attachment'
      });
    }
  });

  /**
   * DELETE /api/documents/:id
   * Delete a document analysis result
   */
  app.delete('/api/documents/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const resultId = parseInt(req.params.id);

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      // Fetch result to verify ownership
      const result = await storage.getDocumentAnalysisResult(resultId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Analysis result not found'
        });
      }

      // Verify ownership
      if (result.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Delete the result
      await storage.deleteDocumentAnalysisResult(resultId);

      return res.status(200).json({
        success: true,
        message: 'Analysis result deleted'
      });

    } catch (error) {
      console.error('[DocumentRoutes] Error deleting result:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete analysis result'
      });
    }
  });

  console.log('✅ [DocumentRoutes] Document analysis routes registered');
}
