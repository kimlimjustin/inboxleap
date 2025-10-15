import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
console.log('🔑 [BULK-AI] Initializing with API Key:', process.env.CLAUDE_API_KEY ? 'Present (length: ' + process.env.CLAUDE_API_KEY.length + ')' : 'MISSING');
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || ''
});

interface EmailData {
  id: string | number;
  subject?: string;
  title?: string;
  sender?: string;
  createdBy?: string;
  content?: string;
  description?: string;
  source: 'email' | 'project';
  sourceAgent: string;
  createdAt?: string;
  status?: string;
}

interface BulkAnalysisResult {
  insights: Array<{
    id: string;
    topic: string;
    description: string;
    urgency: 'low' | 'medium' | 'high';
    priority: 'low' | 'medium' | 'high';
    frequency: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
  }>;
  trendingTopics: Array<{
    topic: string;
    frequency: number;
    urgency: 'low' | 'medium' | 'high';
    sentiment: 'positive' | 'negative' | 'neutral';
    description: string;
  }>;
  keyFindings: string[];
  executiveSummary: string;
  metrics: {
    emailVolume: number;
    participationRate: number;
    sentimentScore: number;
    alertCount: number;
  };
  sourceBreakdown: Record<string, number>;
  summaryHighlights: string[];
  recommendedAction: string;
}

export class BulkIntelligenceService {
  /**
   * Analyze multiple emails/projects in bulk using AI
   */
  async analyzeBulkData(
    data: EmailData[],
    context: {
      instanceId: number;
      instanceName: string;
      period: string;
      agentIdentifier: string;
    }
  ): Promise<BulkAnalysisResult> {
    console.log(`🤖 [BULK-AI] Starting bulk analysis for ${data.length} items`);

    if (data.length === 0) {
      return this.createEmptyResult();
    }

    // Group data into batches for optimal AI processing
    const batches = this.createBatches(data, 10); // Process 10 items per batch
    const batchResults: any[] = [];

    for (let i = 0; i < batches.length; i++) {
      console.log(`🤖 [BULK-AI] Processing batch ${i + 1}/${batches.length} (${batches[i].length} items)`);

      try {
        const batchResult = await this.processBatch(batches[i], context);
        batchResults.push(batchResult);
      } catch (error) {
        console.error(`🚨 [BULK-AI] Error processing batch ${i + 1}:`, error);
        // Continue with other batches even if one fails
      }
    }

    // Combine all batch results
    return this.combineBatchResults(batchResults, data, context);
  }

  /**
   * Create batches of data for processing
   */
  private createBatches(data: EmailData[], batchSize: number): EmailData[][] {
    const batches: EmailData[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a single batch with AI
   */
  private async processBatch(batch: EmailData[], context: any): Promise<any> {
    const prompt = this.createAnalysisPrompt(batch, context);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }

      throw new Error('Unexpected response format from AI');
    } catch (error) {
      console.error('🚨 [BULK-AI] AI processing error:', error);
      if (error instanceof Error) {
        console.error('🚨 [BULK-AI] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          status: (error as any).status,
          code: (error as any).code,
          type: (error as any).type
        });
      }
      console.log('🔑 [BULK-AI] API Key check:', process.env.CLAUDE_API_KEY ? 'Present' : 'Missing');
      // Return fallback analysis for this batch
      return this.createFallbackBatchResult(batch);
    }
  }

  /**
   * Create AI analysis prompt for a batch
   */
  private createAnalysisPrompt(batch: EmailData[], context: any): string {
    const dataContext = batch.map(item => ({
      id: item.id,
      title: item.subject || item.title || 'No title',
      content: item.content || item.description || '',
      sender: item.sender || item.createdBy || 'Unknown',
      source: item.source,
      agent: item.sourceAgent,
      date: item.createdAt || 'Unknown'
    }));

    return `
You are a business intelligence analyst analyzing emails and communications. Focus on understanding the CONTENT and BUSINESS IMPLICATIONS, not technical details.

**Data to Analyze:**
${JSON.stringify(dataContext, null, 2)}

**Analysis Context:**
- Instance: ${context.instanceName} (ID: ${context.instanceId})
- Period: ${context.period}
- Mixed sources: emails and project communications

**Required Output (JSON only, no markdown):**
{
  "insights": [
    {
      "id": "unique_id",
      "topic": "Business topic (e.g., 'Customer Complaints about Pricing', 'Partnership Opportunities', 'Product Feature Requests')",
      "description": "What this means for the business and what action should be taken",
      "urgency": "low|medium|high",
      "priority": "low|medium|high",
      "frequency": number_of_mentions,
      "sentiment": "positive|negative|neutral",
      "confidence": 0-100
    }
  ],
  "trendingTopics": [
    {
      "topic": "Business/content topic name (e.g., 'Customer Satisfaction', 'Sales Inquiries', 'Support Issues')",
      "frequency": number,
      "urgency": "low|medium|high",
      "sentiment": "positive|negative|neutral",
      "description": "Why this topic is important to the business"
    }
  ],
  "keyFindings": ["Business-focused finding 1", "Strategic observation 2", "Market insight 3"],
  "executiveSummary": "Executive summary focusing on business implications and recommended actions",
  "sentimentBreakdown": {
    "positive": number,
    "negative": number,
    "neutral": number
  }
}

**IMPORTANT Guidelines:**
- IGNORE technical details like "10 items analyzed", "batch processing", "fallback method"
- Focus on BUSINESS CONTENT: What are people discussing? What do they need? What problems exist?
- Extract insights about: Customer needs, market trends, operational issues, opportunities
- Look for patterns in: Complaints, requests, inquiries, feedback
- Identify business themes like: Sales, support, partnerships, product feedback
- Make insights ACTIONABLE for business decisions
- If emails mention products, services, customers, or business topics - focus on those
- DO NOT mention technical processing details in your insights
`;
  }

  /**
   * Create fallback analysis when AI fails - focus on actual content
   */
  private createFallbackBatchResult(batch: EmailData[]): any {
    console.log('🔄 [BULK-AI] Creating fallback analysis with actual content focus');

    // Extract actual content themes from subjects and content
    const contentThemes: { [key: string]: { count: number, examples: string[] } } = {};

    batch.forEach(item => {
      const subject = item.subject || item.title || '';
      const content = item.content || item.description || '';

      // Look for business-relevant keywords across multiple languages
      const businessKeywords = [
        // English
        'customer', 'client', 'sale', 'purchase', 'order', 'inquiry', 'support',
        'meeting', 'project', 'deadline', 'proposal', 'budget', 'feedback',
        'issue', 'problem', 'solution', 'opportunity', 'partnership', 'contract',
        'product', 'service', 'feature', 'development', 'testing', 'launch',
        'marketing', 'campaign', 'lead', 'conversion', 'revenue', 'growth',
        // Spanish
        'cliente', 'venta', 'compra', 'pedido', 'consulta', 'soporte',
        'reunión', 'proyecto', 'fecha límite', 'propuesta', 'presupuesto',
        'problema', 'solución', 'oportunidad', 'sociedad', 'contrato',
        'producto', 'servicio', 'función', 'desarrollo', 'prueba', 'lanzamiento',
        'marketing', 'campaña', 'cliente potencial', 'conversión', 'ingresos',
        // French
        'client', 'vente', 'achat', 'commande', 'demande', 'support',
        'réunion', 'projet', 'échéance', 'proposition', 'budget',
        'problème', 'solution', 'opportunité', 'partenariat', 'contrat',
        'produit', 'service', 'fonctionnalité', 'développement', 'test', 'lancement',
        'marketing', 'campagne', 'prospect', 'conversion', 'revenus',
        // German
        'kunde', 'verkauf', 'kauf', 'bestellung', 'anfrage', 'support',
        'besprechung', 'projekt', 'frist', 'vorschlag', 'budget',
        'problem', 'lösung', 'gelegenheit', 'partnerschaft', 'vertrag',
        'produkt', 'service', 'funktion', 'entwicklung', 'test', 'launch',
        'marketing', 'kampagne', 'lead', 'conversion', 'umsatz'
      ];

      const allText = `${subject} ${content}`.toLowerCase();

      businessKeywords.forEach(keyword => {
        if (allText.includes(keyword)) {
          if (!contentThemes[keyword]) {
            contentThemes[keyword] = { count: 0, examples: [] };
          }
          contentThemes[keyword].count++;
          contentThemes[keyword].examples.push(subject || content.substring(0, 50));
        }
      });
    });

    // Create meaningful topics based on actual content
    const trendingTopics = Object.entries(contentThemes)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 3)
      .map(([keyword, data]) => ({
        topic: this.capitalizeWord(keyword),
        frequency: data.count,
        urgency: this.determineUrgency(keyword),
        sentiment: this.determineSentiment(keyword),
        description: this.createBusinessDescription(keyword, data.count, data.examples[0])
      }));

    // If no business keywords found, analyze subjects directly
    if (trendingTopics.length === 0) {
      const subjects = batch
        .map(item => item.subject || item.title || 'Communication')
        .filter(subject => !subject.toLowerCase().includes('[test]'));

      if (subjects.length > 0) {
        trendingTopics.push({
          topic: 'General Communications',
          frequency: subjects.length,
          urgency: 'medium' as const,
          sentiment: 'neutral' as const,
          description: `Various communication topics including: ${subjects.slice(0, 2).join(', ')}`
        });
      }
    }

    // Create insights based on actual email patterns
    const insights = this.createContentBasedInsights(batch, trendingTopics);

    return {
      insights,
      trendingTopics,
      keyFindings: this.generateContentBasedFindings(batch, trendingTopics),
      executiveSummary: this.createContentBasedSummary(batch, trendingTopics),
      sentimentBreakdown: {
        positive: Math.floor(batch.length * 0.4),
        negative: Math.floor(batch.length * 0.1),
        neutral: Math.ceil(batch.length * 0.5)
      }
    };
  }

  private capitalizeWord(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  private determineUrgency(keyword: string): 'low' | 'medium' | 'high' {
    const urgentKeywords = ['issue', 'problem', 'deadline', 'urgent', 'critical'];
    const highKeywords = ['opportunity', 'revenue', 'customer', 'client'];

    if (urgentKeywords.some(k => keyword.includes(k))) return 'high';
    if (highKeywords.some(k => keyword.includes(k))) return 'medium';
    return 'low';
  }

  private determineSentiment(keyword: string): 'positive' | 'negative' | 'neutral' {
    const positiveKeywords = ['opportunity', 'growth', 'success', 'achievement', 'launch', 'sale'];
    const negativeKeywords = ['problem', 'issue', 'complaint', 'delay', 'cancel'];

    if (positiveKeywords.some(k => keyword.includes(k))) return 'positive';
    if (negativeKeywords.some(k => keyword.includes(k))) return 'negative';
    return 'neutral';
  }

  private createBusinessDescription(keyword: string, count: number, example: string): string {
    const descriptions: Record<string, string> = {
      'customer': `${count} customer-related communications require attention`,
      'project': `${count} project updates indicate active development work`,
      'meeting': `${count} meeting requests suggest coordination needs`,
      'support': `${count} support inquiries may need follow-up`,
      'sales': `${count} sales activities show business pipeline activity`,
      'feedback': `${count} feedback items provide improvement opportunities`
    };

    return descriptions[keyword] || `${count} communications about ${keyword} - review for actionable items`;
  }

  private createContentBasedInsights(batch: EmailData[], topics: any[]): any[] {
    const insights = [];

    // Create insights based on actual content
    if (topics.length > 0) {
      topics.forEach(topic => {
        insights.push({
          id: `content-${topic.topic.toLowerCase()}-${Date.now()}`,
          topic: `${topic.topic} Activity`,
          description: topic.description,
          urgency: topic.urgency,
          priority: topic.urgency,
          frequency: topic.frequency,
          sentiment: topic.sentiment,
          confidence: 70
        });
      });
    } else {
      // Fallback insight based on volume
      insights.push({
        id: `general-${Date.now()}`,
        topic: 'Communication Activity',
        description: `${batch.length} communications received - individual review recommended for specific business insights`,
        urgency: 'medium' as const,
        priority: 'medium' as const,
        frequency: batch.length,
        sentiment: 'neutral' as const,
        confidence: 50
      });
    }

    return insights;
  }

  private generateContentBasedFindings(batch: EmailData[], topics: any[]): string[] {
    const findings = [];

    if (topics.length > 0) {
      findings.push(`Active discussions around: ${topics.map(t => t.topic).join(', ')}`);

      const urgentTopics = topics.filter(t => t.urgency === 'high');
      if (urgentTopics.length > 0) {
        findings.push(`High priority areas: ${urgentTopics.map(t => t.topic).join(', ')}`);
      }
    }

    findings.push(`${batch.length} communications analyzed for business intelligence`);

    // Add sender diversity if available
    const senders = batch.map(item => item.sender || item.createdBy).filter(Boolean);
    const uniqueSenders = new Set(senders).size;
    if (uniqueSenders > 1) {
      findings.push(`${uniqueSenders} participants contributing to discussions`);
    }

    return findings.slice(0, 4);
  }

  private createContentBasedSummary(batch: EmailData[], topics: any[]): string {
    if (topics.length > 0) {
      const topTopic = topics[0];
      return `Primary focus area: ${topTopic.topic} with ${topTopic.frequency} related communications. ${topTopic.description}`;
    }

    return `${batch.length} communications received across various topics. Individual review recommended for specific business opportunities and action items.`;
  }

  /**
   * Combine results from multiple batches
   */
  private combineBatchResults(
    batchResults: any[],
    originalData: EmailData[],
    context: any
  ): BulkAnalysisResult {
    console.log(`🤖 [BULK-AI] Combining ${batchResults.length} batch results`);

    // Combine insights from all batches
    const allInsights = batchResults.flatMap(batch => batch.insights || []);
    const allTrendingTopics = batchResults.flatMap(batch => batch.trendingTopics || []);
    const allKeyFindings = batchResults.flatMap(batch => batch.keyFindings || []);

    // Calculate source breakdown
    const sourceBreakdown = originalData.reduce((acc: any, item: any) => {
      const key = `${item.sourceAgent}_${item.source}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    // Calculate metrics
    const uniqueContributors = new Set(
      originalData.map(item => item.sender || item.createdBy || 'Unknown')
    ).size;

    const sentimentCounts = batchResults.reduce((acc, batch) => {
      const breakdown = batch.sentimentBreakdown || { positive: 0, negative: 0, neutral: 0 };
      acc.positive += breakdown.positive;
      acc.negative += breakdown.negative;
      acc.neutral += breakdown.neutral;
      return acc;
    }, { positive: 0, negative: 0, neutral: 0 });

    const totalSentiment = sentimentCounts.positive + sentimentCounts.negative + sentimentCounts.neutral;
    const sentimentScore = totalSentiment > 0
      ? Math.round(((sentimentCounts.positive - sentimentCounts.negative) / totalSentiment) * 50 + 50)
      : 50;

    const dedupedTopics = this.deduplicateTopics(allTrendingTopics);
    const priorityRank: Record<'high' | 'medium' | 'low', number> = { high: 3, medium: 2, low: 1 };

    const getPriorityScore = (value: unknown) => {
      if (!value) {
        return 0;
      }
      const key = String(value) as keyof typeof priorityRank;
      return priorityRank[key] ?? 0;
    };

    const prioritizedInsights = [...allInsights].sort((a, b) => {
      const priorityDiff = getPriorityScore(b?.priority) - getPriorityScore(a?.priority);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return (b?.frequency || 0) - (a?.frequency || 0);
    });

    const insightStatements = prioritizedInsights
      .map(insight => this.ensureSentence(insight?.description || insight?.topic))
      .filter((value): value is string => Boolean(value));

    const topTopics = dedupedTopics.slice(0, 3);
    const topicStatement = topTopics.length
      ? this.ensureSentence(`Frequent themes: ${this.formatList(topTopics.map(topic => topic.topic))}`)
      : undefined;

    const contributorMap = originalData.reduce((acc, item) => {
      const sender = (item.sender || item.createdBy || 'Unknown').trim();
      if (!sender) {
        return acc;
      }
      acc.set(sender, (acc.get(sender) || 0) + 1);
      return acc;
    }, new Map<string, number>());

    const contributorEntries = Array.from(contributorMap.entries()).sort((a, b) => b[1] - a[1]);
    const topContributor = contributorEntries[0];
    const contributorStatement = topContributor
      ? this.ensureSentence(
          `${topContributor[0]} shared ${topContributor[1]} update${topContributor[1] === 1 ? '' : 's'}`
        )
      : undefined;

    const summaryCandidates = [
      ...insightStatements.slice(0, 2),
      ...(topicStatement ? [topicStatement] : []),
      ...(contributorStatement ? [contributorStatement] : [])
    ];

    if (!summaryCandidates.length) {
      const fallbackSummary = this.ensureSentence(
        `Communications include ${originalData.length} updates across ${Object.keys(sourceBreakdown).length} channels`
      );
      if (fallbackSummary) {
        summaryCandidates.push(fallbackSummary);
      }
    }

    const executiveSummary =
      summaryCandidates[0] || 'Communications are active but require further review for specifics.';
    const summaryHighlights = summaryCandidates.slice(1);

    const recommendedInsight =
      prioritizedInsights.find(insight => insight?.priority === 'high') || prioritizedInsights[0];

    let rawRecommendation: string | undefined;
    if (recommendedInsight) {
      rawRecommendation = `Prioritize ${recommendedInsight.topic || 'the highlighted work'}: ${recommendedInsight.description || recommendedInsight.topic}`;
    } else if (topTopics[0]) {
      rawRecommendation = `Coordinate next steps on ${topTopics[0].topic} to keep momentum`;
    }

    const recommendedAction =
      this.ensureSentence(rawRecommendation) || 'Review recent communications for actionable follow-ups.';

    const keyFindingsSet = new Set<string>();
    [executiveSummary, ...summaryHighlights].forEach(item => keyFindingsSet.add(item));
    dedupedTopics.slice(0, 3).forEach(topic => {
      const topicLine = this.ensureSentence(`${topic.topic}: ${topic.description}`);
      if (topicLine) {
        keyFindingsSet.add(topicLine);
      }
    });
    allKeyFindings.slice(0, 3).forEach(finding => {
      const sentence = this.ensureSentence(finding) || finding;
      keyFindingsSet.add(sentence);
    });
    const keyFindings = Array.from(keyFindingsSet).slice(0, 6);

    return {
      insights: prioritizedInsights.slice(0, 10), // Top 10 insights
      trendingTopics: dedupedTopics.slice(0, 5),
      keyFindings,
      executiveSummary,
      summaryHighlights,
      recommendedAction,
      metrics: {
        emailVolume: originalData.length,
        participationRate: uniqueContributors,
        sentimentScore,
        alertCount: prioritizedInsights.filter(insight => insight?.urgency === 'high').length
      },
      sourceBreakdown
    };
  }

  /**
   * Remove duplicate topics and merge frequencies
   */
  private deduplicateTopics(topics: any[]): any[] {
    const topicMap = new Map();

    topics.forEach(topic => {
      if (topicMap.has(topic.topic)) {
        const existing = topicMap.get(topic.topic);
        existing.frequency += topic.frequency;
      } else {
        topicMap.set(topic.topic, { ...topic });
      }
    });

    return Array.from(topicMap.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  private formatList(items: string[]): string {
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
  }

  private ensureSentence(text?: string): string | undefined {
    if (!text) {
      return undefined;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return undefined;
    }
    const lastChar = trimmed.slice(-1);
    return ['.', '!', '?'].includes(lastChar) ? trimmed : `${trimmed}.`;
  }

  /**
   * Create empty result when no data to analyze
   */
  private createEmptyResult(): BulkAnalysisResult {
    return {
      insights: [],
      trendingTopics: [],
      keyFindings: ['No data available for analysis'],
      executiveSummary: 'No data available for intelligence analysis',
      summaryHighlights: [],
      recommendedAction: 'No immediate actions available.',
      metrics: {
        emailVolume: 0,
        participationRate: 0,
        sentimentScore: 0,
        alertCount: 0
      },
      sourceBreakdown: {}
    };
  }
}

// Export singleton instance
export const bulkIntelligenceService = new BulkIntelligenceService();
