import { Express } from 'express';
import { isAuthenticated } from '../googleAuth';
import { copilotAIService } from '../services/copilotAIService';
import { copilotDataAggregationService } from '../services/copilotDataAggregationService';

export function registerCopilotRoutes(app: Express) {
  // Generate AI-powered response based on context and user question
  app.post('/api/copilot/chat', isAuthenticated, async (req: any, res) => {
    try {
      const { userQuestion, context, contextData } = req.body;

      if (!userQuestion || !context) {
        return res.status(400).json({ error: 'Missing required fields: userQuestion and context' });
      }

      console.log(`🤖 [COPILOT] Processing chat request: ${context} - "${userQuestion}"`);

      const copilotContext = {
        type: context,
        data: contextData,
        userQuestion,
        userId: req.user?.id,
        companyId: req.user?.companyId
      };

      const response = await copilotAIService.generateContextualResponse(copilotContext);

      console.log(`🤖 [COPILOT] Generated response with ${response.suggestions.length} suggestions and ${response.insights.length} insights`);
      res.json(response);

    } catch (error) {
      console.error('🚨 [COPILOT] Error generating response:', error);
      res.status(500).json({
        error: 'Failed to generate copilot response',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Analyze tasks and provide intelligent recommendations
  app.post('/api/copilot/analyze-tasks', isAuthenticated, async (req: any, res) => {
    try {
      const { tasks, projects } = req.body;
      
      if (!tasks || !Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Missing or invalid tasks array' });
      }
      
      console.log(`🤖 [COPILOT] Analyzing ${tasks.length} tasks and ${projects?.length || 0} projects`);
      
      const analysis = await copilotAIService.analyzeTasksAndProjects(tasks, projects);
      
      console.log(`🤖 [COPILOT] Task analysis complete with ${analysis.actionableItems.length} action items`);
      res.json(analysis);
      
    } catch (error) {
      console.error('🚨 [COPILOT] Error analyzing tasks:', error);
      res.status(500).json({ 
        error: 'Failed to analyze tasks',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Analyze intelligence data and provide strategic insights
  app.post('/api/copilot/analyze-intelligence', isAuthenticated, async (req: any, res) => {
    try {
      const { intelligenceData } = req.body;
      
      if (!intelligenceData) {
        return res.status(400).json({ error: 'Missing intelligence data' });
      }
      
      console.log(`🤖 [COPILOT] Analyzing intelligence data`);
      
      const analysis = await copilotAIService.analyzeIntelligenceData(intelligenceData);
      
      console.log(`🤖 [COPILOT] Intelligence analysis complete with ${analysis.insights.length} insights`);
      res.json(analysis);
      
    } catch (error) {
      console.error('🚨 [COPILOT] Error analyzing intelligence:', error);
      res.status(500).json({ 
        error: 'Failed to analyze intelligence data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get contextual suggestions based on current view
  app.post('/api/copilot/suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const { context, contextData } = req.body;
      
      if (!context) {
        return res.status(400).json({ error: 'Missing context' });
      }
      
      console.log(`🤖 [COPILOT] Generating suggestions for context: ${context}`);
      
      const copilotContext = {
        type: context,
        data: contextData,
        userQuestion: 'What insights and suggestions do you have for my current view?'
      };
      
      const response = await copilotAIService.generateContextualResponse(copilotContext);
      
      res.json({
        suggestions: response.suggestions,
        insights: response.insights,
        actionableItems: response.actionableItems
      });
      
    } catch (error) {
      console.error('🚨 [COPILOT] Error generating suggestions:', error);
      res.status(500).json({ 
        error: 'Failed to generate suggestions',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get agent activity summary and cross-agent insights
  app.get('/api/copilot/activity-summary', isAuthenticated, async (req: any, res) => {
    try {
      const { timeframe = '24h' } = req.query;

      console.log(`🤖 [COPILOT] Getting activity summary for timeframe: ${timeframe}`);

      const summary = copilotDataAggregationService.getActivitySummary(req.user?.id, timeframe);
      const crossAgentInsights = await copilotDataAggregationService.getCrossAgentInsights(req.user?.id, 10);
      const aggregatedContext = await copilotDataAggregationService.getAggregatedContextData(req.user?.id, req.user?.companyId);

      res.json({
        summary,
        crossAgentInsights,
        aggregatedContext,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('🚨 [COPILOT] Error getting activity summary:', error);
      res.status(500).json({
        error: 'Failed to get activity summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Track agent activity (for testing and manual tracking)
  app.post('/api/copilot/track-activity', isAuthenticated, async (req: any, res) => {
    try {
      const { agentType, activityType, data, metadata } = req.body;

      if (!agentType || !activityType) {
        return res.status(400).json({ error: 'Missing required fields: agentType and activityType' });
      }

      await copilotDataAggregationService.trackActivity({
        agentType,
        activityType,
        userId: req.user?.id,
        companyId: req.user?.companyId,
        timestamp: new Date().toISOString(),
        data: data || {},
        metadata: metadata || {}
      });

      console.log(`🤖 [COPILOT] Tracked activity: ${agentType} - ${activityType}`);
      res.json({ success: true, message: 'Activity tracked successfully' });

    } catch (error) {
      console.error('🚨 [COPILOT] Error tracking activity:', error);
      res.status(500).json({
        error: 'Failed to track activity',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
