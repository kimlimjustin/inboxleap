import { Anthropic } from '@anthropic-ai/sdk';
import type { EmailData } from '../types/interfaces';
import type { HierarchyRelationship, Department } from '../types/validation';

/**
 * AI-powered hierarchy analysis service
 * Analyzes email patterns to extract organizational structure
 */

interface HierarchyAnalysisResult {
  department?: {
    name: string;
    confidence: number;
    source: 'ai_analysis';
  };
  relationships: HierarchyRelationship[];
  leadership?: {
    email: string;
    role: string;
    confidence: number;
  }[];
}

interface BatchAnalysisInput {
  email: EmailData;
  submitterEmail: string;
  organizationName: string;
}

class HierarchyAnalysisService {
  private anthropic: Anthropic;
  
  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ [HierarchyAnalysis] No Anthropic API key found, hierarchy analysis will be disabled');
    }
    this.anthropic = new Anthropic({
      apiKey: apiKey || ''
    });
  }

  /**
   * Analyze multiple emails in a single AI request for efficiency
   */
  async analyzeBatch(inputs: BatchAnalysisInput[]): Promise<HierarchyAnalysisResult[]> {
    if (!this.anthropic.apiKey || inputs.length === 0) {
      return inputs.map(() => ({ relationships: [] }));
    }

    try {
      const prompt = this.buildBatchAnalysisPrompt(inputs);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307', // Use fastest model for this task
        max_tokens: 2000,
        temperature: 0.1, // Low temperature for consistent structured output
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      return this.parseAnalysisResponse(content.text, inputs.length);
      
    } catch (error) {
      console.error('❌ [HierarchyAnalysis] Error analyzing batch:', error);
      // Return empty results on error to not block email processing
      return inputs.map(() => ({ relationships: [] }));
    }
  }

  /**
   * Analyze a single email (wrapper for batch analysis)
   */
  async analyzeSingle(input: BatchAnalysisInput): Promise<HierarchyAnalysisResult> {
    const results = await this.analyzeBatch([input]);
    return results[0] || { relationships: [] };
  }

  /**
   * Build the prompt for batch hierarchy analysis
   */
  private buildBatchAnalysisPrompt(inputs: BatchAnalysisInput[]): string {
    const emailAnalyses = inputs.map((input, index) => {
      const { email, submitterEmail, organizationName } = input;
      
      return `EMAIL ${index + 1}:
Organization: ${organizationName}
From: ${submitterEmail}
To: ${email.to.join(', ')}
CC: ${email.cc.join(', ')}
Subject: ${email.subject}
Body Preview: ${email.body.substring(0, 300)}...`;
    }).join('\n\n');

    return `You are analyzing organizational emails to extract hierarchy information. For each email below, identify:

1. DEPARTMENT: What department/team does the sender likely belong to? Look for explicit mentions, signatures, or context clues.
2. REPORTING RELATIONSHIPS: Based on CC patterns, who might report to whom? CC'd individuals are often managers or stakeholders.
3. LEADERSHIP INDICATORS: Any mentions of roles like "manager", "director", "VP", etc.

Respond with a JSON array where each object corresponds to the email at that index:

[
  {
    "department": { "name": "Engineering", "confidence": 0.8, "source": "ai_analysis" } or null,
    "relationships": [
      {
        "employee": "sender@company.com",
        "manager": "cc_person@company.com", 
        "confidence": 0.7,
        "source": "ai_analysis"
      }
    ],
    "leadership": [
      { "email": "manager@company.com", "role": "Engineering Manager", "confidence": 0.9 }
    ] or []
  }
]

Guidelines:
- Only extract relationships with confidence > 0.5
- Department names should be normalized (e.g., "Engineering", "Sales", "Marketing", "Operations", "Finance", "HR", "Legal")
- CC patterns suggest reporting but aren't definitive (confidence usually 0.6-0.8)
- Explicit role mentions are high confidence (0.8-0.9)
- Return empty arrays/null for uncertain extractions
- Be conservative - better to extract less than make mistakes

EMAILS TO ANALYZE:
${emailAnalyses}`;
  }

  /**
   * Parse the AI response into structured hierarchy results
   */
  private parseAnalysisResponse(response: string, expectedCount: number): HierarchyAnalysisResult[] {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as HierarchyAnalysisResult[];
      
      // Ensure we have the expected number of results
      if (parsed.length !== expectedCount) {
        console.warn(`⚠️ [HierarchyAnalysis] Expected ${expectedCount} results, got ${parsed.length}`);
      }

      // Validate and normalize the results
      return parsed.slice(0, expectedCount).map(result => ({
        department: result.department || undefined,
        relationships: (result.relationships || []).filter(rel => 
          rel.confidence > 0.5 && 
          rel.employee && 
          rel.manager &&
          rel.employee !== rel.manager
        ),
        leadership: (result.leadership || []).filter(leader =>
          leader.confidence > 0.5 && leader.email && leader.role
        )
      }));

    } catch (error) {
      console.error('❌ [HierarchyAnalysis] Error parsing AI response:', error);
      console.error('Response was:', response);
      
      // Return empty results on parse error
      return Array(expectedCount).fill({ relationships: [] });
    }
  }

  /**
   * Check if hierarchy analysis is available
   */
  isAvailable(): boolean {
    return !!this.anthropic.apiKey;
  }
}

// Export singleton instance
export const hierarchyAnalysisService = new HierarchyAnalysisService();