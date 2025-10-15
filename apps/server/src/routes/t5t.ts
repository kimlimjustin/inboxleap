import { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../googleAuth';
import { t5tCache } from '../services/t5tCache';
import { t5tAnalysisService } from '../services/t5tAnalysisService';
import { s3EmailBackupProcessor } from '../services/s3EmailBackupProcessor';
import { copilotDataAggregationService } from '../services/copilotDataAggregationService';

// Helper function to refresh T5T reports
async function refreshT5TReport(agentIdentifier: string, period: string, req?: any) {
  console.log(`📊 [T5T] Refreshing report for agent: ${agentIdentifier}, period: ${period}`);

  // SECURITY: If req is provided, ensure agentIdentifier matches authenticated user
  if (req && req.user && req.user.id !== agentIdentifier) {
    console.error(`🚨 [T5T] Security violation: User ${req.user.id} attempted to access agent ${agentIdentifier}`);
    throw new Error('Access denied: You can only access your own agent data');
  }

  if (!t5tCache.markInProgress(agentIdentifier, period, 'comprehensive')) {
    console.log(`📊 [T5T] Report refresh already in progress for ${agentIdentifier}`);
    // Return existing data if available
    const { data } = t5tCache.get(agentIdentifier, period, 'comprehensive');
    if (data) return data;
    throw new Error('Report refresh in progress, no cached data available');
  }

  try {
    // First refresh S3 data to ensure we have latest emails
    console.log(`📊 [T5T] Refreshing S3 data before analysis for agent: ${agentIdentifier}`);
    await s3EmailBackupProcessor.processUnprocessedEmails();
    
    const t5tEmail = `t5t+${agentIdentifier}@inboxleap.com`;
    const emails = await storage.getEmailsByRecipient(t5tEmail, 500);
    
    if (emails.length === 0) {
      // No emails yet, return placeholder data
      const placeholderReport = {
        period,
        agentIdentifier,
        generatedAt: new Date().toISOString(),
        executiveSummary: "Welcome to T5T Intelligence! No submissions have been received yet. Share your T5T email with team members to start collecting intelligence.",
        keyFindings: [
          "No team submissions received yet",
          `Share ${t5tEmail} with your team to get started`,
          "Weekly intelligence reports will be generated automatically"
        ],
        actionableInsights: [],
        metrics: {
          emailVolume: 0,
          participationRate: 0,
          sentimentScore: 0,
          alertCount: 0
        },
        trendingTopics: [],
        emergingSignals: [],
        sentimentOverview: {
          overall: 'neutral' as const,
          score: 0,
          trends: []
        },
        dataSource: {
          totalEmails: 0,
          analysisWindow: 'Last 7 days',
          confidence: 'low' as const,
          t5tEmail
        }
      };
      
      t5tCache.set(agentIdentifier, period, 'comprehensive', placeholderReport);
      return placeholderReport;
    }

    // Transform emails for analysis
    const transformedEmails = emails.map(email => ({
      id: email.id,
      subject: email.subject,
      body: email.body || '',
      senderEmail: email.sender,
      recipientEmails: email.recipients || [],
      receivedAt: email.createdAt || new Date(),
      isProcessed: true
    }));

    console.log(`📊 [T5T] Analyzing ${transformedEmails.length} emails for agent: ${agentIdentifier}`);

    // Get T5T submissions for this agent (improved agent lookup)
    const { findAgentByEmail } = await import('../services/companyIntelligence');
    let t5tSubmissions: any[] = [];
    let companyAgent: any = null;
    
    try {
      console.log(`🔍 [T5T] Looking for agent with identifier: "${agentIdentifier}"`);
      console.log(`🔍 [T5T] Expected email pattern: t5t+${agentIdentifier}@inboxleap.com`);
      
      // Try multiple lookup strategies
      
      // Strategy 1: Find by exact email address
      companyAgent = await findAgentByEmail(`t5t+${agentIdentifier}@inboxleap.com`);
      if (companyAgent) {
        console.log(`✅ [T5T] Found agent by email: ${companyAgent.id} (${companyAgent.organizationName})`);
      }
      
      // Strategy 2: Search through all agents if not found by email
      if (!companyAgent) {
        console.log(`🔍 [T5T] Agent not found by email, searching all intelligence agents...`);
        const allCompanyAgents = await storage.getAllIntelligenceAgents(req.user?.id);
        console.log(`🔍 [T5T] Total intelligence agents in database: ${allCompanyAgents.length}`);
        
        // Only search through agents that belong to the current user to prevent data leakage
        const userOwnedAgents = allCompanyAgents.filter(agent => {
          // Check if the agent is owned by or accessible to the current user
          return agent.createdBy === req.user?.id || agent.emailAddress?.includes(`+${req.user?.id}@`);
        });

        // Log user-owned agents for debugging
        userOwnedAgents.forEach(agent => {
          console.log(`📋 [DEBUG] User Agent ID: ${agent.id}, Name: ${agent.name}, OrgName: ${agent.organizationName}, OrgId: ${agent.organizationId}, Email: ${agent.emailAddress}`);
        });

        companyAgent = userOwnedAgents.find(agent => {
          const matchByOrgName = agent.organizationName?.toLowerCase() === agentIdentifier.toLowerCase();
          const matchByOrgId = agent.organizationId?.toLowerCase() === agentIdentifier.toLowerCase();
          const matchByAgentId = agent.id.toString() === agentIdentifier;
          const matchByEmail = agent.emailAddress === `t5t+${agentIdentifier}@inboxleap.com`;

          console.log(`🔍 [T5T] Checking user agent ${agent.id}: orgName="${agent.organizationName}" (match: ${matchByOrgName}), orgId="${agent.organizationId}" (match: ${matchByOrgId}), agentId="${agent.id}" (match: ${matchByAgentId}), email="${agent.emailAddress}" (match: ${matchByEmail})`);

          return matchByOrgName || matchByOrgId || matchByAgentId || matchByEmail;
        });
        
        if (companyAgent) {
          console.log(`✅ [T5T] Found agent by search: ${companyAgent.id} (${companyAgent.organizationName})`);
        } else {
          console.log(`❌ [T5T] No matching agent found for identifier: "${agentIdentifier}"`);
        }
      }
      
      // Get T5T submissions if we found a company agent
      if (companyAgent) {
        console.log(`📋 [T5T] Getting T5T submissions for company agent: ${companyAgent.id} (${companyAgent.organizationName})`);
        console.log(`📋 [T5T] Agent email: ${companyAgent.emailAddress}`);
        t5tSubmissions = await storage.getT5tSubmissions(companyAgent.id, { limit: 100, period });
        console.log(`📋 [T5T] Found ${t5tSubmissions.length} T5T submissions for agent ${companyAgent.id}`);
      }
      
      // SECURITY FIX: DO NOT fallback to global agent to prevent data contamination
      // Each agent should only show analysis for its own data, never mixed with global data
      if (t5tSubmissions.length === 0) {
        console.log(`🔒 [SECURITY] No T5T submissions found for this specific agent. Not using global fallback to prevent data contamination.`);
        t5tSubmissions = []; // Keep empty to ensure clean separation
      }
      
      console.log(`📊 [T5T] Final T5T submissions count: ${t5tSubmissions.length}`);
      
    } catch (error) {
      console.error(`⚠️ [T5T] Error getting T5T submissions:`, error);
      t5tSubmissions = [];
    }

    // Generate intelligence report ONLY if we have actual data to analyze
    let report, trends;
    if (transformedEmails.length > 0 || t5tSubmissions.length > 0) {
      console.log(`📊 [T5T] Generating analysis with ${transformedEmails.length} emails and ${t5tSubmissions.length} T5T submissions`);

      report = await t5tAnalysisService.generateWeeklyIntelligenceReport(
        transformedEmails,
        t5tSubmissions,
        period
      );

      trends = await t5tAnalysisService.analyzeOrganizationalTrends(
        transformedEmails,
        period
      );
    } else {
      console.log(`🔒 [SECURITY] No actual data to analyze. Skipping AI analysis to prevent phantom insights.`);

      // Return empty analysis structure
      report = {
        keyFindings: [],
        actionableInsights: [],
        metrics: {
          emailVolume: 0,
          participationRate: 0,
          sentimentScore: 0,
          alertCount: 0
        }
      };

      trends = {
        trendingTopics: [],
        emergingSignals: [],
        sentimentOverview: {
          overall: 'neutral' as const,
          score: 0,
          trends: []
        }
      };
    }

    // Get existing polling insights for this period - SECURITY: Only for the specific agent
    let pollingInsights: any[] = [];
    try {
      if (companyAgent) {
        console.log(`📊 [T5T] Getting polling insights for specific agent ${companyAgent.id}...`);
        pollingInsights = await storage.getPollingInsights(companyAgent.id, {
          period,
          limit: 100
        });
        console.log(`📊 [T5T] Found ${pollingInsights.length} polling insights for agent ${companyAgent.id} in period ${period}`);
      } else {
        console.log(`🔒 [SECURITY] No specific company agent found. Not using global polling insights to prevent data contamination.`);
        pollingInsights = []; // Keep empty to prevent contamination
      }
    } catch (error) {
      console.error(`⚠️ [T5T] Error getting polling insights:`, error);
      pollingInsights = [];
    }

    // Merge polling insights into the comprehensive report
    const enhancedKeyFindings = [...(report.keyFindings || [])];
    const enhancedActionableInsights = [...(report.actionableInsights || [])];
    const enhancedTrendingTopics = [...(trends.trendingTopics || [])];
    const enhancedEmergingSignals = [...(trends.emergingSignals || [])];

    // Add polling insights data to the report sections
    pollingInsights.forEach(insight => {
      switch (insight.insightType) {
        case 'key_finding':
          enhancedKeyFindings.push(insight.description);
          break;
        case 'actionable_insight':
          enhancedActionableInsights.push({
            title: insight.title,
            description: insight.description,
            priority: insight.priority,
            recommendedAction: insight.data?.recommendedAction || 'Review and take appropriate action'
          });
          break;
        case 'trending_topic':
          if (insight.data?.topic) {
            enhancedTrendingTopics.push({
              topic: insight.data.topic,
              frequency: insight.data.frequency || 1,
              sentiment: insight.data.sentiment || 'neutral',
              urgency: insight.priority === 'high' ? 'high' : 'medium',
              examples: insight.data.examples || []
            });
          }
          break;
        case 'emerging_signal':
          if (insight.data?.signal) {
            enhancedEmergingSignals.push({
              signal: insight.data.signal,
              description: insight.description,
              confidence: insight.confidence || 70,
              firstMentioned: insight.data.firstMentioned || insight.createdAt
            });
          }
          break;
      }
    });

    const comprehensiveReport = {
      period,
      agentIdentifier,
      generatedAt: new Date().toISOString(),
      ...report,
      keyFindings: enhancedKeyFindings.slice(0, 10),
      actionableInsights: enhancedActionableInsights.slice(0, 8),
      trendingTopics: enhancedTrendingTopics.slice(0, 10),
      emergingSignals: enhancedEmergingSignals.slice(0, 5),
      sentimentOverview: trends.sentimentOverview || {
        overall: 'neutral' as const,
        score: 0,
        trends: []
      },
      dataSource: {
        totalEmails: transformedEmails.length,
        totalT5TSubmissions: t5tSubmissions.length,
        totalPollingInsights: pollingInsights.length,
        analysisWindow: 'Last 7 days',
        confidence: transformedEmails.length > 20 ? 'high' as const : 
                    transformedEmails.length > 10 ? 'medium' as const : 'low' as const,
        t5tEmail,
        participantCount: new Set(emails.map(e => e.sender)).size
      }
    };

    // Cache the results
    t5tCache.set(agentIdentifier, period, 'comprehensive', comprehensiveReport);

    // Track activity for Copilot
    await copilotDataAggregationService.trackActivity({
      agentType: 't5t',
      activityType: 'analysis_completed',
      timestamp: new Date().toISOString(),
      data: {
        agentIdentifier,
        period,
        emailCount: emails.length,
        insightsGenerated: comprehensiveReport.keyFindings?.length || 0,
        sentimentScore: comprehensiveReport.metrics?.sentimentScore,
        participantCount: comprehensiveReport.metrics?.participationRate
      },
      metadata: {
        sentimentScore: comprehensiveReport.metrics?.sentimentScore,
        tags: ['intelligence', 'analysis', period]
      }
    });

    console.log(`📊 [T5T] Report refresh complete for agent: ${agentIdentifier}`);
    return comprehensiveReport;

  } finally {
    t5tCache.unmarkInProgress(agentIdentifier, period, 'comprehensive');
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

async function generateInsightsForAgent(agentId: number, insightType?: string, period?: string) {
  try {
    const currentPeriod = period || `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;
    
    console.log(`📊 [INSIGHTS] Starting insight generation for agent ${agentId}, period ${currentPeriod}`);
    
    // Get submissions for the agent
    let submissions = await storage.getT5tSubmissions(agentId, { 
      limit: 100, 
      period: currentPeriod 
    });
    console.log(`📊 [INSIGHTS] Found ${submissions.length} direct submissions for agent ${agentId}`);

    // SECURITY FIX: DO NOT fallback to global agent to prevent data contamination
    if (submissions.length === 0) {
      console.log(`🔒 [SECURITY] No submissions found for agent ${agentId}. Not using global fallback to prevent data contamination.`);
      // Keep submissions empty to maintain clean data isolation
    }

    if (submissions.length === 0) {
      console.log(`📊 [INSIGHTS] No submissions found for agent ${agentId} (or global fallback) in period ${currentPeriod}`);
      return;
    }

    console.log(`📊 [INSIGHTS] Processing ${submissions.length} submissions for analysis (agent: ${agentId})`);  

    const insightTypes = insightType ? [insightType] : [
      'trending_topics',
      'sentiment_trend', 
      'emerging_signals',
      'team_mood',
      'participation_rate'
    ];

    console.log(`📊 [INSIGHTS] Will generate ${insightTypes.length} insight types: ${insightTypes.join(', ')}`);

    let totalInsightsCreated = 0;

    for (const type of insightTypes) {
      console.log(`📊 [INSIGHTS] Generating insights for type: ${type}`);
      
      const transformedSubmissions = submissions.map(s => ({
        id: s.id,
        submitterEmail: s.submitterEmail,
        rawContent: s.rawContent,
        parsedItems: s.parsedItems,
        sentiment: s.sentiment || 'neutral',
        topics: Array.isArray(s.topics) ? s.topics : [],
        submissionDate: s.submissionDate,
        departmentName: undefined,
        teamName: undefined
      }));

      const insights = await t5tAnalysisService.generateAggregateInsights(
        transformedSubmissions,
        type,
        currentPeriod
      );

      console.log(`📊 [INSIGHTS] Generated ${insights.length} insights for type ${type}`);

      for (const insight of insights) {
        try {
          const createdInsight = await storage.createPollingInsight({
            pollingAgentId: agentId,
            insightType: insight.type,
            title: insight.title,
            description: insight.description,
            data: insight.data,
            scope: 'weekly',
            period: currentPeriod,
            confidence: insight.confidence,
            priority: insight.priority,
            isAlert: insight.isAlert
          });
          console.log(`📊 [INSIGHTS] Saved insight: ${createdInsight.title} (ID: ${createdInsight.id})`);
          totalInsightsCreated++;
        } catch (insightError) {
          console.error(`📊 [INSIGHTS] Error saving insight:`, insightError);
        }
      }
    }

    console.log(`✅ [INSIGHTS] Generated ${insightTypes.length} insight types for agent ${agentId}, created ${totalInsightsCreated} total insights`);
  } catch (error) {
    console.error(`❌ [INSIGHTS] Error generating insights for agent ${agentId}:`, error);
  }
}

export function registerT5TRoutes(app: Express) {
  // Get or create T5T agent for user
  app.get('/api/t5t/agent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // SECURITY: Only allow user to access their own agent data
      // Never allow arbitrary agent parameter that could access other users' data
      const agentIdentifier = userId; // Force use of user's own ID only
      const t5tEmail = `t5t+${agentIdentifier}@inboxleap.com`;
      
      res.json({
        agentIdentifier,
        email: t5tEmail,
        dashboardUrl: `/intelligence/t5t?agent=${encodeURIComponent(agentIdentifier)}`,
        instructions: {
          setup: "Share this email with your team members",
          usage: "Team members send updates, feedback, and insights to this email",
          analysis: "T5T analyzes all submissions weekly to generate Top 5 insights"
        }
      });
      
    } catch (error) {
      console.error('🚨 [T5T] Error getting agent:', error);
      res.status(500).json({ 
        message: 'Failed to get T5T agent',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Trigger on-demand T5T analysis
  app.post('/api/t5t/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { period, insightTypes, companyId, agent } = req.body;
      
      const currentPeriod = period || `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;
      
      // Determine which agent to use for analysis
      const { getUserCompanyIntelligence } = await import('../services/companyIntelligence');
      const userAgents = await getUserCompanyIntelligence(userId);
      
      let targetAgent;
      let agentId;
      let agentIdentifier;
      
      console.log(`🔄 [T5T-ANALYZE] Found ${userAgents.length} user company agents`);
      
      if (userAgents.length > 0) {
        // Use company intelligence agent
        targetAgent = userAgents[0];
        if (companyId) {
          const specificAgent = userAgents.find(agent => agent.organizationId === companyId);
          if (specificAgent) {
            targetAgent = specificAgent;
            console.log(`🔄 [T5T-ANALYZE] Using specific company agent: ${specificAgent.organizationName}`);
          }
        }
        agentId = targetAgent.id;
        agentIdentifier = targetAgent.organizationName || targetAgent.organizationId;
        console.log(`🔄 [T5T-ANALYZE] Using company agent: ID=${agentId}, identifier="${agentIdentifier}", email="${targetAgent.emailAddress}"`);
      } else {
        // Fallback to personal agent - SECURITY: Only use authenticated user's ID
        agentIdentifier = userId; // Never allow external agent parameter to prevent data leakage
        agentId = 1;
        targetAgent = {
          id: agentId,
          organizationName: agentIdentifier,
          emailAddress: `t5t+${agentIdentifier}@inboxleap.com`
        };
        console.log(`🔄 [T5T-ANALYZE] Using fallback personal agent: identifier="${agentIdentifier}"`);
      }
      
      console.log(`🔄 [T5T] Triggering analysis for agent ${agentIdentifier}, period ${currentPeriod}`);
      
      const types = insightTypes || [
        'trending_topics',
        'sentiment_trend',
        'emerging_signals',
        'recurring_concerns',
        'positive_highlights'
      ];
      
      for (const insightType of types) {
        await generateInsightsForAgent(agentId, insightType, currentPeriod);
      }
      
      t5tCache.invalidate(agentIdentifier, currentPeriod, 'comprehensive');
      
      const freshReport = await refreshT5TReport(agentIdentifier, currentPeriod, req);
      
      console.log(`✅ [T5T] Analysis completed for ${types.length} insight types`);
      
      res.json({
        success: true,
        message: `Analysis completed for ${types.length} insight types`,
        period: currentPeriod,
        companyName: targetAgent.organizationName,
        companyId: targetAgent.organizationId,
        agentId: targetAgent.id,
        insightTypes: types,
        freshReport: freshReport
      });
      
    } catch (error) {
      console.error('🚨 [T5T] Error triggering analysis:', error);
      res.status(500).json({
        message: 'Failed to trigger analysis',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get T5T status and health metrics
  app.get('/api/t5t/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // SECURITY: Only allow access to user's own agent data
      const agentIdentifier = userId; // Never allow req.query.agent to prevent data leakage
      const t5tEmail = `t5t+${agentIdentifier}@inboxleap.com`;
      
      console.log(`🔍 [T5T] Getting status for agent ${agentIdentifier}`);
      
      await s3EmailBackupProcessor.processUnprocessedEmails();
      
      const emails = await storage.getEmailsByRecipient(t5tEmail, 100);
      const thisWeekEmails = emails.filter(email => {
        const emailDate = new Date(email.createdAt || '');
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return emailDate >= weekStart;
      });
      
      const participantEmails = new Set(emails.map(e => e.sender)).size;
      const period = `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;
      
      const { data: cachedReport } = t5tCache.get(agentIdentifier, period, 'comprehensive');
      
      const status = {
        isActive: emails.length > 0,
        lastAnalysis: (cachedReport as any)?.generatedAt || null,
        submissionsThisWeek: thisWeekEmails.length,
        insightsGenerated: (cachedReport as any)?.keyFindings?.length || 0,
        participantCount: participantEmails,
        healthStatus: emails.length > 10 ? 'healthy' : emails.length > 0 ? 'idle' : 'error',
        nextAnalysis: 'Analysis updates automatically when new emails arrive',
        agentEmail: t5tEmail,
        agentIdentifier,
        totalEmails: emails.length,
        confidence: emails.length > 20 ? 'high' : emails.length > 10 ? 'medium' : 'low'
      };
      
      res.json(status);
      
    } catch (error) {
      console.error('🚨 [T5T] Error getting status:', error);
      
      res.json({
        isActive: false,
        lastAnalysis: null,
        submissionsThisWeek: 0,
        insightsGenerated: 0,
        participantCount: 0,
        healthStatus: 'error',
        nextAnalysis: 'Service initialization required',
        agentEmail: `t5t+${req.query.agent || req.user?.id || 'default'}@inboxleap.com`,
        confidence: 'low'
      });
    }
  });
  
  // Get T5T comprehensive intelligence report with caching
  app.get('/api/t5t/comprehensive-report', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // SECURITY: Only allow access to user's own agent data
      const agentIdentifier = userId; // Never allow req.query.agent to prevent data leakage
      const period = req.query.period || `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;
      
      console.log(`📈 [T5T] Getting comprehensive report for agent ${agentIdentifier}, period ${period}`);
      
      const { data: cachedReport, isStale } = t5tCache.get(agentIdentifier, period, 'comprehensive');
      
      if (cachedReport && !isStale) {
        console.log(`📈 [T5T] Returning cached report for agent ${agentIdentifier}`);
        return res.json(cachedReport);
      }
      
      if (cachedReport && isStale) {
        console.log(`📈 [T5T] Returning stale cached report, triggering refresh for agent ${agentIdentifier}`);
        res.json(cachedReport);
        
        refreshT5TReport(agentIdentifier, period, req).catch(error => {
          console.error('📈 [T5T] Background refresh failed:', error);
        });
        return;
      }
      
      const report = await refreshT5TReport(agentIdentifier, period, req);
      res.json(report);
      
    } catch (error) {
      console.error('🚨 [T5T] Error getting comprehensive report:', error);
      
      res.json({
        period: req.query.period || `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`,
        generatedAt: new Date().toISOString(),
        executiveSummary: "T5T intelligence analysis is currently being generated. Please check back in a few minutes for fresh insights.",
        keyFindings: [
          "Email analysis is in progress",
          "Intelligence processing is initializing", 
          "Fresh insights will be available shortly"
        ],
        actionableInsights: [],
        metrics: {
          emailVolume: 0,
          participationRate: 0,
          sentimentScore: 0,
          alertCount: 0
        },
        trendingTopics: [],
        emergingSignals: [],
        sentimentOverview: {
          overall: 'neutral',
          score: 0,
          trends: []
        },
        dataSource: {
          totalEmails: 0,
          t5tSubmissions: 0,
          analysisWindow: 'Initializing',
          confidence: 'low'
        }
      });
    }
  });
  
  // Force refresh comprehensive report (bypasses all caching)
  app.post('/api/t5t/force-refresh', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // SECURITY: Only allow access to user's own agent data
      const agentIdentifier = userId; // Never allow req.query.agent to prevent data leakage
      const period = req.query.period || `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;
      
      console.log(`🔄 [T5T] Force refreshing comprehensive report for agent ${agentIdentifier}, period ${period}`);
      
      t5tCache.invalidateAll(agentIdentifier, period);
      
      const freshReport = await refreshT5TReport(agentIdentifier, period, req);
      
      console.log(`✅ [T5T] Force refresh complete for agent ${agentIdentifier}`);
      res.json({
        success: true,
        message: 'Fresh analysis completed',
        report: freshReport,
        generatedAt: (freshReport as any)?.generatedAt || new Date().toISOString(),
        period: period
      });
      
    } catch (error) {
      console.error('🚨 [T5T] Error in force refresh:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh analysis',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get comprehensive T5T insights dashboard
  app.get('/api/t5t/insights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const period = req.query.period || `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;
      const companyId = req.query.companyId;
      
      const { getUserCompanyIntelligence } = await import('../services/companyIntelligence');
      const userAgents = await getUserCompanyIntelligence(userId);
      
      if (userAgents.length === 0) {
        return res.status(404).json({
          message: 'No company intelligence agents found. Please set up company intelligence first.',
          hasAgents: false
        });
      }
      
      let targetAgent = userAgents[0];
      if (companyId) {
        const specificAgent = userAgents.find(agent => agent.organizationId === companyId);
        if (specificAgent) {
          targetAgent = specificAgent;
        }
      }
      
      const agentId = targetAgent.id;
      
      console.log(`📊 [T5T] Getting comprehensive insights for company ${targetAgent.organizationName}, period ${period}`);
      
      const insights = await storage.getPollingInsights(agentId, {
        period,
        limit: 100
      });
      
      const insightsByType = insights.reduce((acc, insight) => {
        if (!acc[insight.insightType]) {
          acc[insight.insightType] = [];
        }
        acc[insight.insightType].push(insight);
        return acc;
      }, {} as Record<string, any[]>);
      
      const anomalies = insights
        .filter(i => i.isAlert && i.priority === 'high')
        .map(i => ({
          type: i.insightType,
          message: i.title,
          urgency: i.priority
        }));
      
      res.json({
        period,
        generatedAt: new Date().toISOString(),
        companyName: targetAgent.organizationName,
        companyId: targetAgent.organizationId,
        agentId: targetAgent.id,
        insightsByType,
        anomalies,
        summary: {
          totalInsights: insights.length,
          alertCount: anomalies.length,
          topInsightTypes: Object.keys(insightsByType)
            .map(type => ({ type, count: insightsByType[type].length }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }
      });
      
    } catch (error) {
      console.error('🚨 [T5T] Error getting insights:', error);
      res.status(500).json({
        message: 'Failed to get insights',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get intelligence insights for a specific T5T instance (and optionally specific email)
  // Now supports POST with visible data from the frontend
  app.all('/api/t5t/instance-intelligence/:instanceId', isAuthenticated, async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { emailId } = req.query; // Optional specific email ID
      const period = req.query.period || `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;

      // Check if visible data is provided via POST body for comprehensive analysis
      let visibleData = null;
      let useVisibleData = false;

      if (req.method === 'POST') {
        // Handle different request body formats
        if (req.body && typeof req.body === 'string') {
          try {
            visibleData = JSON.parse(req.body);
          } catch (e) {
            console.error('Failed to parse request body JSON:', e);
            visibleData = null;
          }
        } else if (req.body && req.body.body && typeof req.body.body === 'string') {
          // Handle nested body format
          try {
            visibleData = JSON.parse(req.body.body);
          } catch (e) {
            console.error('Failed to parse nested request body JSON:', e);
            visibleData = null;
          }
        } else {
          // Handle already parsed JSON
          visibleData = req.body;
        }

        useVisibleData = visibleData && (visibleData.emails || visibleData.projects);
      }

      console.log(`📊 [T5T] Getting instance intelligence for instanceId: ${instanceId}, emailId: ${emailId}, period: ${period}${useVisibleData ? ', with visible data' : ''}`);
      console.log(`📊 [T5T] Request method: ${req.method}`);
      console.log(`📊 [T5T] Request body:`, req.body);
      console.log(`📊 [T5T] Raw visible data:`, visibleData ? {
        emails: visibleData.emails?.length || 0,
        projects: visibleData.projects?.length || 0,
        useVisibleData
      } : 'No visible data received');
      console.log(`📊 [T5T] Content-Type:`, req.headers['content-type']);

      // Get instance details first
      const { db } = await import('../db');
      const { agentInstances } = await import('@email-task-router/shared');
      const { eq } = await import('drizzle-orm');

      const [instance] = await db.select()
        .from(agentInstances)
        .where(eq(agentInstances.id, parseInt(instanceId)))
        .limit(1);

      if (!instance) {
        return res.status(404).json({
          message: 'Instance not found',
          instanceId
        });
      }

      let t5tEmail = instance.emailAddress;

      // For the primary instance, override to use t5t@inboxleap.com
      if (instance.instanceName === 'primary' || instance.id === 1) {
        t5tEmail = 't5t@inboxleap.com';
        console.log(`📊 [T5T] Primary instance detected, using t5t@inboxleap.com instead of ${instance.emailAddress}`);
      }

      console.log(`📊 [T5T] Using email: ${t5tEmail}`);

      // Get comprehensive report for this specific instance
      let agentIdentifier: string;
      if (t5tEmail === 't5t@inboxleap.com') {
        // Primary instance - use user ID for individual users
        agentIdentifier = req.user.id;
      } else {
        // Extract identifier from email pattern (t5t+something@inboxleap.com)
        const match = t5tEmail.match(/t5t\+(.+)@inboxleap\.com/);
        agentIdentifier = match ? match[1] : req.user.id;
      }

      console.log(`📊 [T5T] Using agent identifier: ${agentIdentifier}`);

      let allAnalysisData = [];
      let dataContext = 'T5T emails only';

      if (useVisibleData) {
        // SECURITY FIX: Filter visible data to ONLY include emails for this SPECIFIC instance
        console.log(`📊 [T5T] Filtering visible data for instance ${instanceId} with email: ${t5tEmail}`);
        console.log(`📊 [T5T] Raw visible data: ${visibleData.emails?.length || 0} emails, ${visibleData.projects?.length || 0} projects`);

        // STRICT FILTERING: Only include emails that were actually sent to this specific instance
        const instanceSpecificEmails = (visibleData.emails || []).filter((email: any) => {
          const isForThisInstance = email.recipients?.includes(t5tEmail) ||
                                   email.ccList?.includes(t5tEmail) ||
                                   email.bccList?.includes(t5tEmail);

          console.log(`🔍 [SECURITY] Email "${email.subject}" - Recipients: ${email.recipients?.join(', ')} - For this instance (${t5tEmail}): ${isForThisInstance}`);
          return isForThisInstance;
        });

        console.log(`🔒 [SECURITY] Filtered to ${instanceSpecificEmails.length} emails specifically for instance ${t5tEmail}`);

        // Convert filtered emails to analysis format
        const visibleEmails = instanceSpecificEmails.map((email: any) => ({
          ...email,
          content: email.body || email.content, // Map body to content for AI analysis
          source: 'email',
          sourceAgent: 't5t' // Since we've already filtered to this T5T instance
        }));

        // SECURITY NOTE: Projects are typically Todo-managed, but filter based on user ownership
        // Only include projects that are relevant to the current user
        const userOwnedProjects = (visibleData.projects || []).filter((project: any) => {
          // Projects should be filtered by user ownership, not by instance
          // This prevents cross-user project contamination
          return project.createdBy === req.user?.id || project.userId === req.user?.id;
        });

        console.log(`🔒 [SECURITY] Filtered to ${userOwnedProjects.length} user-owned projects out of ${visibleData.projects?.length || 0} total`);

        const visibleProjectsAsEmails = userOwnedProjects.map((project: any) => ({
          id: project.id,
          subject: project.title || 'Project Update',
          sender: project.createdBy || 'system',
          content: project.description || '',
          recipients: [t5tEmail], // Associate with this specific instance
          source: 'project',
          sourceAgent: 'todo',
          createdAt: project.createdAt || new Date().toISOString(),
          status: project.status
        }));

        allAnalysisData = [...visibleEmails, ...visibleProjectsAsEmails];
        dataContext = `Mixed data: ${visibleEmails.length} emails + ${visibleProjectsAsEmails.length} projects from visible page`;
      } else {
        // Get all emails for this instance for comprehensive intelligence (legacy behavior)
        console.log(`📊 [T5T] Getting all emails for instance ${instanceId} with email: ${t5tEmail}`);
        const allInstanceEmails = await storage.getEmailsForAgentInstance(Number(instanceId), 500);
        console.log(`📊 [T5T] Found ${allInstanceEmails.length} emails for instance analysis`);

        allAnalysisData = allInstanceEmails.map(email => ({
          ...email,
          content: email.body, // Map body to content for AI analysis
          source: 'email',
          sourceAgent: 't5t'
        }));
        dataContext = `T5T instance emails only (${allAnalysisData.length})`;
      }

      console.log(`📊 [T5T] Analysis context: ${dataContext}`);

      // Generate intelligence report using bulk AI analysis
      let instanceReport;
      if (allAnalysisData.length > 0) {
        console.log(`📊 [T5T] Generating AI-powered intelligence report from ${allAnalysisData.length} data points`);

        try {
          // Use the new bulk AI intelligence service
          const { bulkIntelligenceService } = await import('../services/bulkIntelligenceService');

          console.log(`🤖 [T5T] About to call AI analysis with ${allAnalysisData.length} items`);
          console.log('🤖 [T5T] Sample data:', allAnalysisData.slice(0, 2));

          const aiResult = await bulkIntelligenceService.analyzeBulkData(
            allAnalysisData,
            {
              instanceId: parseInt(instanceId),
              instanceName: instance.instanceName,
              period,
              agentIdentifier
            }
          );

          instanceReport = {
            period,
            agentIdentifier: `ai_${agentIdentifier}`,
            generatedAt: new Date().toISOString(),
            executiveSummary: aiResult.executiveSummary,
            summaryHighlights: aiResult.summaryHighlights,
            recommendedAction: aiResult.recommendedAction,
            keyFindings: aiResult.keyFindings,
            actionableInsights: aiResult.insights,
            metrics: aiResult.metrics,
            trendingTopics: aiResult.trendingTopics,
            emergingSignals: [],
            dataSource: {
              totalEmails: allAnalysisData.length,
              analysisWindow: period,
              confidence: allAnalysisData.length > 10 ? 'high' : allAnalysisData.length > 3 ? 'medium' : 'low',
              sources: aiResult.sourceBreakdown,
              context: `${dataContext} - AI-powered analysis`,
              aiPowered: true
            }
          };

          console.log(`🤖 [T5T] AI analysis completed:`, {
            insights: aiResult.insights.length,
            keyFindings: aiResult.keyFindings.length,
            trendingTopics: aiResult.trendingTopics.length,
            sentimentScore: aiResult.metrics.sentimentScore,
            sources: Object.keys(aiResult.sourceBreakdown).join(', ')
          });

        } catch (error) {
          console.error('🚨 [T5T] AI analysis failed, falling back to basic analysis:', error);

          // Fallback to basic analysis if AI fails
          instanceReport = createFallbackAnalysis(allAnalysisData, {
            period,
            agentIdentifier,
            instanceId,
            dataContext
          });
        }
      } else {
        // No data yet, create empty placeholder
        instanceReport = {
          period,
          agentIdentifier,
          generatedAt: new Date().toISOString(),
          executiveSummary: `No data available for analysis. ${useVisibleData ? 'No visible emails or projects found on the current page.' : 'Send emails to start generating intelligence insights.'}`,
          keyFindings: [useVisibleData ? 'No visible data to analyze' : 'No emails received yet', `${useVisibleData ? 'Refresh the page or navigate to view data' : `Send emails to ${t5tEmail} to get started`}`],
          actionableInsights: [],
          metrics: { emailVolume: 0, participationRate: 0, sentimentScore: 0, alertCount: 0 },
          trendingTopics: [],
          emergingSignals: [],
          dataSource: { totalEmails: 0, analysisWindow: period, confidence: 'low', context: dataContext }
        };
      }

      // If specific email is selected, get additional email-specific intelligence
      let emailSpecificIntelligence = null;
      if (emailId && allAnalysisData.length > 0) {
        console.log(`📊 [T5T] Generating email-specific intelligence for email ${emailId}`);
        const selectedItem = allAnalysisData.find(item => item.id.toString() === emailId);
        if (selectedItem) {
          // Generate insights for just this item
          emailSpecificIntelligence = {
            emailId: selectedItem.id,
            subject: selectedItem.subject || selectedItem.title,
            sender: selectedItem.sender || selectedItem.createdBy,
            source: selectedItem.source,
            sourceAgent: selectedItem.sourceAgent,
            insights: [
              {
                id: `item-${selectedItem.id}-1`,
                topic: `${selectedItem.source === 'project' ? 'Project' : 'Email'} Analysis: ${selectedItem.subject || selectedItem.title}`,
                description: `Specific insights for ${selectedItem.source} from ${selectedItem.sender || selectedItem.createdBy} (${selectedItem.sourceAgent} agent)`,
                urgency: 'medium',
                sentiment: 'neutral',
                frequency: 1
              }
            ],
            summary: `Analysis of ${selectedItem.source}: "${selectedItem.subject || selectedItem.title}" from ${selectedItem.sender || selectedItem.createdBy} via ${selectedItem.sourceAgent} agent`
          };
        }
      }

      // Format the response with both instance-wide and email-specific intelligence
      const response = {
        instanceId: parseInt(instanceId),
        instanceName: instance.instanceName,
        instanceEmail: t5tEmail,
        period,
        generatedAt: (instanceReport as any)?.generatedAt || new Date().toISOString(),
        dataContext,
        useVisibleData,

        // Instance-wide intelligence (all analysis data)
        instanceIntelligence: {
          // Intelligence overview metrics
          metrics: {
            emailVolume: (instanceReport as any)?.dataSource?.totalEmails || allAnalysisData.length,
            participationRate: (instanceReport as any)?.metrics?.participationRate || new Set(allAnalysisData.map(e => e.sender || e.createdBy)).size,
            sentimentScore: (instanceReport as any)?.metrics?.sentimentScore || 0,
            alertCount: (instanceReport as any)?.keyFindings?.length || 0,
            insightsGenerated: (instanceReport as any)?.actionableInsights?.length || 0
          },

          // Key insights formatted for UI
          insights: (instanceReport as any)?.actionableInsights?.map((insight: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            topic: insight.title || insight.description?.split('.')[0] || 'General Insight',
            frequency: insight.priority === 'high' ? 15 : insight.priority === 'medium' ? 8 : 3,
            urgency: insight.priority || 'medium',
            sentiment: insight.data?.sentiment || 'neutral',
            description: insight.description || insight.title || 'No description available'
          })) || [],

          // Trending topics from the report
          trendingTopics: (instanceReport as any)?.trendingTopics?.map((topic: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            topic: topic.topic || topic.signal || 'Unknown Topic',
            frequency: topic.frequency || 1,
            urgency: topic.urgency || 'medium',
            sentiment: topic.sentiment || 'neutral',
            description: topic.description || `Trending topic: ${topic.topic}`
          })) || [],

          // Key findings
          keyFindings: (instanceReport as any)?.keyFindings || [],
          summaryHighlights: (instanceReport as any)?.summaryHighlights || [],
          recommendedAction: (instanceReport as any)?.recommendedAction || '',

          // Executive summary
          executiveSummary: (instanceReport as any)?.executiveSummary || 'No analysis available yet',

          // Data source information
          dataSource: (instanceReport as any)?.dataSource || {
            totalEmails: allAnalysisData.length,
            analysisWindow: period,
            confidence: allAnalysisData.length > 20 ? 'high' : allAnalysisData.length > 10 ? 'medium' : 'low'
          }
        },

        // Email-specific intelligence (when email is selected)
        emailSpecificIntelligence,

        // Backwards compatibility - use instance intelligence as main data
        metrics: {
          emailVolume: (instanceReport as any)?.dataSource?.totalEmails || allAnalysisData.length,
          participationRate: (instanceReport as any)?.metrics?.participationRate || new Set(allAnalysisData.map(e => e.sender || e.createdBy)).size,
          sentimentScore: (instanceReport as any)?.metrics?.sentimentScore || 0,
          alertCount: (instanceReport as any)?.keyFindings?.length || 0,
          insightsGenerated: (instanceReport as any)?.actionableInsights?.length || 0
        },

        insights: (instanceReport as any)?.actionableInsights?.map((insight: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          topic: insight.title || insight.description?.split('.')[0] || 'General Insight',
          frequency: insight.priority === 'high' ? 15 : insight.priority === 'medium' ? 8 : 3,
          urgency: insight.priority || 'medium',
          sentiment: insight.data?.sentiment || 'neutral',
          description: insight.description || insight.title || 'No description available'
        })) || [],

        trendingTopics: (instanceReport as any)?.trendingTopics?.map((topic: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          topic: topic.topic || topic.signal || 'Unknown Topic',
          frequency: topic.frequency || 1,
          urgency: topic.urgency || 'medium',
          sentiment: topic.sentiment || 'neutral',
          description: topic.description || `Trending topic: ${topic.topic}`
        })) || [],

        keyFindings: (instanceReport as any)?.keyFindings || [],
        summaryHighlights: (instanceReport as any)?.summaryHighlights || [],
        recommendedAction: (instanceReport as any)?.recommendedAction || '',
        executiveSummary: (instanceReport as any)?.executiveSummary || 'No analysis available yet',
        dataSource: (instanceReport as any)?.dataSource || {
          totalEmails: allAnalysisData.length,
          analysisWindow: period,
          confidence: allAnalysisData.length > 20 ? 'high' : allAnalysisData.length > 10 ? 'medium' : 'low',
          context: dataContext
        }
      };

      console.log(`📊 [T5T] Returning intelligence for instance ${instanceId}:`);
      console.log(`  - Main insights: ${response.insights.length}`);
      console.log(`  - Instance intelligence insights: ${response.instanceIntelligence?.insights?.length || 0}`);
      console.log(`  - Email volume: ${response.metrics.emailVolume}`);
      console.log(`  - Data context: ${response.dataContext}`);
      console.log(`  - Use visible data: ${response.useVisibleData}`);

      if (response.insights.length > 0) {
        console.log(`  - Sample insight: ${response.insights[0]?.topic || 'No topic'} - ${response.insights[0]?.description?.substring(0, 100) || 'No description'}...`);
      }

      res.json(response);

    } catch (error) {
      console.error('🚨 [T5T] Error getting instance intelligence:', error);
      res.status(500).json({
        message: 'Failed to get instance intelligence',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get emails for a specific T5T instance
  app.get('/api/t5t/emails/:instanceId', isAuthenticated, async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { agentInstanceService } = await import('../services/agentInstanceService');
      
      // Get the agent instance
      const agentInstance = await agentInstanceService.getInstanceById(Number(instanceId));
      
      if (!agentInstance) {
        return res.status(404).json({
          message: `Agent instance with ID ${instanceId} not found`
        });
      }
      
      // Verify user has access to this instance
      const userId = req.user.id;
      
      // Check if instance belongs to the user
      if (agentInstance.userId !== userId) {
        // For now, just check user ownership
        return res.status(403).json({
          message: 'You do not have access to this agent instance'
        });
      }
      
      console.log(`📧 [T5T] Getting emails for instance ${instanceId} with email ${agentInstance.emailAddress}`);

      // Get emails for this instance (including historical email addresses)
      const emails = await storage.getEmailsForAgentInstance(Number(instanceId), 100);
      console.log(`📧 [T5T] Found ${emails.length} emails for instance ${instanceId}`);
      
      // Transform emails into a simpler format for the client
      const transformedEmails = emails.map(email => ({
        id: email.id,
        subject: email.subject,
        sender: email.sender,
        body: email.body?.substring(0, 300) + (email.body && email.body.length > 300 ? '...' : ''),
        recipients: email.recipients,
        createdAt: email.createdAt,
        status: email.status
      }));
      
      res.json({ emails: transformedEmails });
    } catch (error) {
      console.error('📧 [T5T] Error getting emails for instance:', error);
      res.status(500).json({
        message: 'Failed to get emails for this instance',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get weekly reports for T5T agent
  app.get('/api/t5t/reports/:agentIdentifier', isAuthenticated, async (req: any, res) => {
    try {
      const { agentIdentifier } = req.params;
      const userId = req.user.id;
      
      // For now, just return a static report structure
      const report = {
        period: `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`,
        agentIdentifier,
        generatedAt: new Date().toISOString(),
        executiveSummary: "This is a placeholder report. No real data available yet.",
        keyFindings: [
          "Placeholder finding 1",
          "Placeholder finding 2"
        ],
        actionableInsights: [],
        metrics: {
          emailVolume: 0,
          participationRate: 0,
          sentimentScore: 0,
          alertCount: 0
        },
        trendingTopics: [],
        emergingSignals: [],
        sentimentOverview: {
          overall: 'neutral',
          score: 0,
          trends: []
        },
        dataSource: {
          totalEmails: 0,
          t5tSubmissions: 0,
          analysisWindow: 'Initializing',
          confidence: 'low'
        }
      };
      
      res.json(report);
      
    } catch (error) {
      console.error('🚨 [T5T] Error getting weekly reports:', error);
      res.status(500).json({
        message: 'Failed to get weekly reports',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Debug endpoint to check T5T data - SECURITY: Only allow user's own data
  app.get('/api/t5t/debug/:agentIdentifier', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // SECURITY: Ignore URL parameter and only use authenticated user's ID
      const agentIdentifier = userId; // Never allow arbitrary agent access via URL params
      const t5tEmail = `t5t+${agentIdentifier}@inboxleap.com`;

      // Verify the requested agentIdentifier matches the authenticated user
      if (req.params.agentIdentifier !== userId) {
        return res.status(403).json({
          error: 'Access denied: You can only debug your own agent data',
          requestedAgent: req.params.agentIdentifier,
          allowedAgent: userId
        });
      }
      
      console.log(`🔍 [T5T-DEBUG] Debugging agent identifier: "${agentIdentifier}"`);
      console.log(`🔍 [T5T-DEBUG] Expected email pattern: ${t5tEmail}`);
      
      // Check emails by recipient - SECURITY: Only get emails for this user's agent
      const emailsByRecipient = await storage.getEmailsByRecipient(t5tEmail, 100);
      console.log(`🔍 [T5T-DEBUG] Emails by recipient ${t5tEmail}: ${emailsByRecipient.length}`);
      
      // Check intelligence agents - SECURITY: Only get agents owned by this user
      const userAgents = await storage.getAllIntelligenceAgents(userId);
      console.log(`🔍 [T5T-DEBUG] User's intelligence agents: ${userAgents.length}`);
      
      const matchingAgents = userAgents.filter(agent =>
        agent.organizationName?.toLowerCase() === agentIdentifier.toLowerCase() ||
        agent.organizationId?.toLowerCase() === agentIdentifier.toLowerCase() ||
        agent.emailAddress === t5tEmail
      );
      console.log(`🔍 [T5T-DEBUG] Matching user agents: ${matchingAgents.length}`);
      
      // If we have a matching agent, check T5T submissions and polling insights
      let t5tSubmissions = [];
      let pollingInsights = [];
      if (matchingAgents.length > 0) {
        const agent = matchingAgents[0];
        console.log(`🔍 [T5T-DEBUG] Using agent: ID=${agent.id}, name=${agent.organizationName}, email=${agent.emailAddress}`);
        
        t5tSubmissions = await storage.getT5tSubmissions(agent.id, { limit: 100 });
        pollingInsights = await storage.getPollingInsights(agent.id, { limit: 100 });
        console.log(`🔍 [T5T-DEBUG] T5T submissions: ${t5tSubmissions.length}`);
        console.log(`🔍 [T5T-DEBUG] Polling insights: ${pollingInsights.length}`);
      }
      
      res.json({
        agentIdentifier,
        t5tEmail,
        userId,
        emailsByRecipient: emailsByRecipient.length,
        userAgents: userAgents.length,
        matchingAgents: matchingAgents.length,
        agentDetails: matchingAgents.map(a => ({
          id: a.id,
          name: a.name,
          organizationName: a.organizationName,
          organizationId: a.organizationId,
          emailAddress: a.emailAddress
        })),
        t5tSubmissions: t5tSubmissions.length,
        pollingInsights: pollingInsights.length,
        recentEmails: emailsByRecipient.slice(0, 5).map(e => ({
          id: e.id,
          subject: e.subject,
          sender: e.sender,
          createdAt: e.createdAt
        }))
      });
    } catch (error) {
      console.error('🔍 [T5T-DEBUG] Debug endpoint error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
}


// Fallback analysis function for when AI fails
function createFallbackAnalysis(allAnalysisData: any[], context: any) {
  console.log(`dY"S [T5T] Creating fallback analysis for ${allAnalysisData.length} items`);

  const formatList = (items: string[]): string => {
    if (items.length === 0) {
      return '';
    }
    if (items.length === 1) {
      return items[0];
    }
    if (items.length === 2) {
      return `${items[0]} and ${items[1]}`;
    }
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  };

  const ensureSentence = (text?: string): string | undefined => {
    if (!text) {
      return undefined;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return undefined;
    }
    const lastChar = trimmed.slice(-1);
    return ['.', '!', '?'].includes(lastChar) ? trimmed : `${trimmed}.`;
  };

  const stopwords = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'that',
    'this',
    'have',
    'has',
    'been',
    'into',
    'about',
    'subject',
    're',
    'fw',
    'your',
    'you',
    'our',
    'are',
    'was',
    'were',
    'will',
    'can',
    'just',
    'sent',
    'regarding',
    'team',
    'update',
    'project',
    'email'
  ]);

  const sourceBreakdown = allAnalysisData.reduce((acc: any, item: any) => {
    const key = `${item.sourceAgent}_${item.source}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const senderCounts = new Map<string, number>();
  const subjectCounts = new Map<string, number>();
  const keywordCounts = new Map<string, number>();

  allAnalysisData.forEach(item => {
    const sender = (item.sender || item.createdBy || 'Unknown').trim();
    if (sender) {
      senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
    }

    const subject = (item.subject || item.title || '').trim();
    if (subject) {
      subjectCounts.set(subject, (subjectCounts.get(subject) || 0) + 1);
    }

    const textContent = [item.subject, item.title, item.body, item.content, item.description]
      .filter(Boolean)
      .join(' ');

    if (textContent) {
      textContent
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .forEach(word => {
          if (!word || word.length < 3 || stopwords.has(word)) {
            return;
          }
          keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
        });
    }
  });

  const uniqueSenders = Array.from(senderCounts.keys());

  const topSubjectEntries = Array.from(subjectCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topSubjects = topSubjectEntries.slice(0, 3).map(([subject]) => subject);

  const keywordEntries = Array.from(keywordCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topKeywords = keywordEntries.slice(0, 3).map(([word]) => word);

  const topContributorEntry = Array.from(senderCounts.entries()).sort((a, b) => b[1] - a[1])[0];

  const summaryFragments: string[] = [];
  const subjectSentence = topSubjects.length
    ? ensureSentence(`Updates emphasize ${formatList(topSubjects)}`)
    : undefined;
  if (subjectSentence) {
    summaryFragments.push(subjectSentence);
  }

  const keywordSentence = topKeywords.length
    ? ensureSentence(`Frequent themes include ${formatList(topKeywords)}`)
    : undefined;
  if (keywordSentence) {
    summaryFragments.push(keywordSentence);
  }

  if (topContributorEntry) {
    const contributorSentence = ensureSentence(
      `${topContributorEntry[0]} shared ${topContributorEntry[1]} update${topContributorEntry[1] === 1 ? '' : 's'}`
    );
    if (contributorSentence) {
      summaryFragments.push(contributorSentence);
    }
  }

  if (!summaryFragments.length) {
    const fallbackSummary = ensureSentence(
      `Communications include ${allAnalysisData.length} updates across ${Object.keys(sourceBreakdown).length || 1} sources`
    );
    if (fallbackSummary) {
      summaryFragments.push(fallbackSummary);
    }
  }

  const executiveSummary =
    summaryFragments[0] || 'Communications captured but require manual review for specifics.';
  const summaryHighlights = summaryFragments.slice(1);

  const actionableInsights: any[] = [];

  if (sourceBreakdown.todo_project > 0) {
    actionableInsights.push({
      title: 'Cross-Agent Activity Detected',
      description: `${sourceBreakdown.todo_project} Todo projects and ${sourceBreakdown.t5t_email || 0} T5T emails are being tracked together.`,
      priority: 'high'
    });
  }

  if (uniqueSenders.length > 1) {
    actionableInsights.push({
      title: 'Multi-Source Engagement',
      description: `${uniqueSenders.length} different contributors across ${Object.keys(sourceBreakdown).length} data sources.`,
      priority: 'medium'
    });
  }

  if (topSubjects[0]) {
    actionableInsights.push({
      title: `Follow up on ${topSubjects[0]}`,
      description: `Coordinate next steps on ${topSubjects[0]} based on recent updates.`,
      priority: 'medium'
    });
  }

  const recommendedActionText =
    (topSubjects[0] && `Focus next steps on ${topSubjects[0]} to maintain momentum`) ||
    (topKeywords[0] && `Plan follow-up work around ${topKeywords[0]} based on recent conversations`) ||
    actionableInsights[0]?.description ||
    actionableInsights[0]?.title;

  const recommendedAction =
    ensureSentence(recommendedActionText) || 'Review recent submissions for actionable follow-ups.';

  const trendingTopics = topKeywords.map(word => ({
    topic: word.charAt(0).toUpperCase() + word.slice(1),
    frequency: keywordCounts.get(word) ?? 1,
    urgency: 'medium',
    sentiment: 'neutral',
    description: `${keywordCounts.get(word) ?? 1} mentions detected in recent updates.`
  }));

  const keyFindingsSet = new Set<string>();
  keyFindingsSet.add(executiveSummary);
  summaryHighlights.forEach(point => keyFindingsSet.add(point));
  if (topSubjects[0]) {
    keyFindingsSet.add(`Most mentioned focus area: ${topSubjects[0]}`);
  }
  if (topContributorEntry) {
    keyFindingsSet.add(`Top contributor: ${topContributorEntry[0]} (${topContributorEntry[1]} updates)`);
  }
  keyFindingsSet.add(`${uniqueSenders.length} contributors across ${Object.keys(sourceBreakdown).length} sources.`);

  const keyFindings = Array.from(keyFindingsSet);

  return {
    period: context.period,
    agentIdentifier: `fallback_${context.agentIdentifier}`,
    generatedAt: new Date().toISOString(),
    executiveSummary,
    summaryHighlights,
    keyFindings,
    recommendedAction,
    actionableInsights,
    metrics: {
      emailVolume: allAnalysisData.length,
      participationRate: uniqueSenders.length,
      sentimentScore: 50,
      alertCount: actionableInsights.length
    },
    trendingTopics,
    emergingSignals: [],
    dataSource: {
      totalEmails: allAnalysisData.length,
      analysisWindow: context.period,
      confidence: 'low',
      sources: sourceBreakdown,
      context: `${context.dataContext} - fallback analysis`
    }
  };
}




