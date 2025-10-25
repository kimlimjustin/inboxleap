import { storage } from '../storage';
import { t5tCache } from './t5tCache';
import { t5tAnalysisService } from './t5tAnalysisService';

export interface AgentActivityData {
  agentType: 't5t' | 'todo' | 'analyzer' | 'faq' | 'polly';
  userId?: string;
  companyId?: number;
  instanceId?: number;
  activityType: 'email_processed' | 'task_created' | 'task_updated' | 'insight_generated' | 'analysis_completed' | 'file_analyzed' | 'question_answered';
  timestamp: string;
  data: any;
  metadata?: {
    emailSubject?: string;
    taskTitle?: string;
    projectName?: string;
    sentimentScore?: number;
    priority?: string;
    tags?: string[];
  };
}

export interface TanyaIntelligenceData {
  agentIdentifier: string;
  reportData?: {
    executiveSummary: string;
    keyFindings: string[];
    actionableInsights: any[];
    metrics: {
      emailVolume: number;
      participationRate: number;
      sentimentScore: number;
      alertCount: number;
    };
    trendingTopics: any[];
    emergingSignals: any[];
    sentimentOverview: any;
  };
  recentActivities: AgentActivityData[];
  lastUpdated: string;
}

export interface AgentContextData {
  t5t?: TanyaIntelligenceData;
  todo?: {
    recentProjects: any[];
    taskSummary: {
      total: number;
      byStatus: Record<string, number>;
      highPriority: number;
      completed: number;
    };
    recentActivities: AgentActivityData[];
  };
  alex?: {
    recentAttachments: any[];
    analysisResults: any[];
    recentActivities: AgentActivityData[];
  };
  faq?: {
    recentQuestions: any[];
    sopUpdates: any[];
    recentActivities: AgentActivityData[];
  };
  polly?: {
    recentPolls: any[];
    responseMetrics: any;
    recentActivities: AgentActivityData[];
  };
}

class CopilotDataAggregationService {
  private recentActivities: AgentActivityData[] = [];
  private maxActivities = 1000; // Keep last 1000 activities

  // Track agent activity for Copilot context
  async trackActivity(activity: AgentActivityData): Promise<void> {
    try {
      // Add to recent activities
      this.recentActivities.unshift(activity);

      // Keep only recent activities
      if (this.recentActivities.length > this.maxActivities) {
        this.recentActivities = this.recentActivities.slice(0, this.maxActivities);
      }

      // Store in database for persistence (optional)
      // await storage.storeAgentActivity(activity);

      console.log(`🤖 [COPILOT-DATA] Tracked ${activity.agentType} activity: ${activity.activityType}`);
    } catch (error) {
      console.error('🚨 [COPILOT-DATA] Error tracking activity:', error);
    }
  }

  // Get Tanya intelligence data for Copilot
  async getTanyaIntelligenceData(agentIdentifier?: string, userId?: string): Promise<TanyaIntelligenceData | null> {
    try {
      let reportData: TanyaIntelligenceData['reportData'] | undefined = undefined;

      if (agentIdentifier) {
        // Get cached report data
        const { data } = t5tCache.get(agentIdentifier, 'week', 'comprehensive');
        reportData = data as TanyaIntelligenceData['reportData'];
      }

      // Get recent Tanya activities
      const recentActivities = this.recentActivities
        .filter(activity => activity.agentType === 't5t')
        .filter(activity => !userId || activity.userId === userId)
        .slice(0, 50); // Last 50 activities

      return {
        agentIdentifier: agentIdentifier || 'default',
        reportData,
        recentActivities,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('🚨 [COPILOT-DATA] Error getting Tanya data:', error);
      return null;
    }
  }

  // Get Todo project and task data
  async getTodoContextData(userId?: string, companyId?: number): Promise<AgentContextData['todo']> {
    try {
      // Get recent projects
      const projects = await storage.getProjects();
      const recentProjects = projects
        .filter((p: any) => p.sourceEmail !== null) // Email-based projects
        .slice(0, 20)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          sourceEmail: p.sourceEmail,
          emailCount: p.emailCount,
          participantCount: p.participantCount,
          lastActivity: p.updatedAt
        }));

      // Get task summary
      const allTasks: any[] = []; // Would get from storage
      const taskSummary = {
        total: allTasks.length,
        byStatus: allTasks.reduce((acc: any, task: any) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {}),
        highPriority: allTasks.filter((t: any) => t.priority === 'high').length,
        completed: allTasks.filter((t: any) => t.status === 'completed' || t.status === 'done').length
      };

      // Get recent activities
      const recentActivities = this.recentActivities
        .filter(activity => activity.agentType === 'todo')
        .filter(activity => !userId || activity.userId === userId)
        .slice(0, 50);

      return {
        recentProjects,
        taskSummary,
        recentActivities
      };
    } catch (error) {
      console.error('🚨 [COPILOT-DATA] Error getting Todo data:', error);
      return {
        recentProjects: [],
        taskSummary: { total: 0, byStatus: {}, highPriority: 0, completed: 0 },
        recentActivities: []
      };
    }
  }

  // Get Alex attachment analysis data
  async getAnalyzerContextData(userId?: string): Promise<AgentContextData['analyzer']> {
    try {
      // Get recent attachments and analyses
      const recentAttachments: any[] = []; // Would get from storage
      const analysisResults: any[] = []; // Would get from storage

      const recentActivities = this.recentActivities
        .filter(activity => activity.agentType === 'analyzer')
        .filter(activity => !userId || activity.userId === userId)
        .slice(0, 50);

      return {
        recentAttachments,
        analysisResults,
        recentActivities
      };
    } catch (error) {
      console.error('🚨 [COPILOT-DATA] Error getting Analyzer data:', error);
      return {
        recentAttachments: [],
        analysisResults: [],
        recentActivities: []
      };
    }
  }

  // Get FAQ knowledge base data
  async getFAQContextData(userId?: string): Promise<AgentContextData['faq']> {
    try {
      const recentQuestions: any[] = []; // Would get from storage
      const sopUpdates: any[] = []; // Would get from storage

      const recentActivities = this.recentActivities
        .filter(activity => activity.agentType === 'faq')
        .filter(activity => !userId || activity.userId === userId)
        .slice(0, 50);

      return {
        recentQuestions,
        sopUpdates,
        recentActivities
      };
    } catch (error) {
      console.error('🚨 [COPILOT-DATA] Error getting FAQ data:', error);
      return {
        recentQuestions: [],
        sopUpdates: [],
        recentActivities: []
      };
    }
  }

  // Get aggregated context data for Copilot
  async getAggregatedContextData(userId?: string, companyId?: number, agentTypes?: string[]): Promise<AgentContextData> {
    const contextData: AgentContextData = {};

    try {
      // Get data for requested agent types or all
      const types = agentTypes || ['t5t', 'todo', 'analyzer', 'faq'];

      if (types.includes('t5t')) {
        contextData.t5t = await this.getTanyaIntelligenceData(undefined, userId) || undefined;
      }

      if (types.includes('todo')) {
        contextData.todo = await this.getTodoContextData(userId, companyId);
      }

      if (types.includes('analyzer')) {
        contextData.alex = await this.getAnalyzerContextData(userId);
      }

      if (types.includes('faq')) {
        contextData.faq = await this.getFAQContextData(userId);
      }

      console.log(`🤖 [COPILOT-DATA] Generated aggregated context for types: ${types.join(', ')}`);
      return contextData;
    } catch (error) {
      console.error('🚨 [COPILOT-DATA] Error aggregating context data:', error);
      return contextData;
    }
  }

  // Get recent cross-agent insights
  async getCrossAgentInsights(userId?: string, limit = 10): Promise<any[]> {
    try {
      const insights: any[] = [];

      // Analyze patterns across agent activities
      const userActivities = this.recentActivities
        .filter(activity => !userId || activity.userId === userId)
        .slice(0, 100);

      // Group by agent type for analysis
      const activityByAgent = userActivities.reduce((acc: any, activity) => {
        acc[activity.agentType] = acc[activity.agentType] || [];
        acc[activity.agentType].push(activity);
        return acc;
      }, {});

      // Generate cross-agent insights
      Object.entries(activityByAgent).forEach(([agentType, activities]) => {
        const acts = activities as any[];
        if (acts.length > 5) { // Only if significant activity
          insights.push({
            type: 'activity_pattern',
            agentType,
            title: `High ${agentType} activity`,
            description: `${acts.length} recent ${agentType} activities detected`,
            priority: acts.length > 20 ? 'high' : 'medium',
            timestamp: new Date().toISOString()
          });
        }
      });

      // Detect sentiment correlations between T5T and other agents
      const t5tActivities = activityByAgent.t5t || [];
      const t5tSentiment = t5tActivities
        .filter((a: any) => a.metadata?.sentimentScore)
        .map((a: any) => a.metadata.sentimentScore);

      if (t5tSentiment.length > 0) {
        const avgSentiment = t5tSentiment.reduce((a: number, b: number) => a + b, 0) / t5tSentiment.length;
        if (avgSentiment < -0.5) {
          insights.push({
            type: 'sentiment_alert',
            agentType: 't5t',
            title: 'Negative sentiment trend',
            description: 'Recent T5T intelligence shows declining sentiment',
            priority: 'high',
            timestamp: new Date().toISOString()
          });
        }
      }

      return insights.slice(0, limit);
    } catch (error) {
      console.error('🚨 [COPILOT-DATA] Error generating cross-agent insights:', error);
      return [];
    }
  }

  // Get activity summary for dashboard
  getActivitySummary(userId?: string, timeframe = '24h'): any {
    try {
      const cutoff = new Date();
      if (timeframe === '24h') cutoff.setHours(cutoff.getHours() - 24);
      else if (timeframe === '7d') cutoff.setDate(cutoff.getDate() - 7);
      else if (timeframe === '30d') cutoff.setDate(cutoff.getDate() - 30);

      const recentActivities = this.recentActivities
        .filter(activity => new Date(activity.timestamp) > cutoff)
        .filter(activity => !userId || activity.userId === userId);

      const summary = {
        total: recentActivities.length,
        byAgent: recentActivities.reduce((acc: any, activity) => {
          acc[activity.agentType] = (acc[activity.agentType] || 0) + 1;
          return acc;
        }, {}),
        byType: recentActivities.reduce((acc: any, activity) => {
          acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
          return acc;
        }, {}),
        timeframe,
        lastActivity: recentActivities[0]?.timestamp || null
      };

      return summary;
    } catch (error) {
      console.error('🚨 [COPILOT-DATA] Error getting activity summary:', error);
      return { total: 0, byAgent: {}, byType: {}, timeframe, lastActivity: null };
    }
  }
}

export const copilotDataAggregationService = new CopilotDataAggregationService();