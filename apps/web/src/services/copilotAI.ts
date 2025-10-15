import { CopilotContext } from '@/contexts/CopilotContext';

export interface AIResponse {
  response: string;
  suggestions: string[];
  actionItems?: Array<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

class CopilotAIService {
  private apiUrl = typeof window !== 'undefined' && window.location.origin ? 
    `${window.location.origin.replace(':5173', ':3001')}` : 'http://localhost:3001';

  /**
   * Generate AI-powered response based on user query and context
   */
  async generateResponse(
    userQuery: string, 
    context: CopilotContext | null
  ): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/api/copilot/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userQuery,
          context: context
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Fallback response
      return {
        response: "I apologize, but I'm having trouble connecting to the AI service right now. Please try again in a moment.",
        suggestions: [
          "Check your internet connection",
          "Try refreshing the page",
          "Contact support if the issue persists"
        ]
      };
    }
  }

  /**
   * Generate contextual suggestions based on current view
   */
  async generateContextualSuggestions(context: CopilotContext | null): Promise<string[]> {
    try {
      const response = await fetch(`${this.apiUrl}/api/copilot/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.suggestions || [];
    } catch (error) {
      console.error('Error generating contextual suggestions:', error);
      return [];
    }
  }

  /**
   * Analyze current context and provide proactive insights
   */
  async analyzeContext(context: CopilotContext | null): Promise<{
    insights: string[];
    recommendations: Array<{
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
      action: string;
    }>;
    alerts?: Array<{
      type: 'warning' | 'info' | 'success';
      message: string;
    }>;
  }> {
    try {
      const response = await fetch(`${this.apiUrl}/api/copilot/insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error analyzing context:', error);
      return {
        insights: [],
        recommendations: []
      };
    }
  }
}

export const copilotAI = new CopilotAIService();
