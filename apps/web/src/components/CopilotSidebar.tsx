import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Bot, User, Minimize2, Maximize2, RefreshCw, Lightbulb } from "lucide-react";
import { useCopilotContext, generateContextSummary, getContextualSuggestions, CopilotContext } from "@/contexts/CopilotContext";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Generate contextual responses based on user input and current context
function generateContextualResponse(userInput: string, context: CopilotContext | null): string {
  const lowerInput = userInput.toLowerCase();
  
  // Debug logging
  console.log('🤖 Copilot Debug - User Input:', userInput);
  console.log('🤖 Copilot Debug - Context:', context);
  
  if (!context) {
    console.log('🤖 Copilot Debug - No context provided, returning generic response');
    return `I understand you asked about "${userInput}". Here are some general suggestions:

• Navigate to specific sections (Intelligence, Teams, Tasks) for targeted help
• Check your agents in the Intelligence tab
• Review tasks in your project boards
• Use email integration for automated processing

Is there something specific you'd like help with?`;
  }
  
  console.log('🤖 Copilot Debug - Context type:', context.type);

  // Context-specific responses with real data
  switch (context.type) {
    case 't5t':
      console.log('🤖 Copilot Debug - Processing t5t context');
      const tanyaContext = context as import('@/contexts/CopilotContext').TanyaContext;
      
      if (lowerInput.includes('insight') || lowerInput.includes('trend') || lowerInput.includes('analysis')) {
        let response = `📊 **Tanya Intelligence Analysis:**\n\n`;
        
        if (tanyaContext.reportData) {
          response += `**Current Status:**\n`;
          response += `• ${tanyaContext.reportData.keyFindings?.length || 0} key findings identified\n`;
          response += `• ${tanyaContext.reportData.actionableInsights?.length || 0} actionable insights available\n`;
          response += `• Sentiment Score: ${tanyaContext.reportData.metrics?.sentimentScore || 0}\n\n`;
          
          if (tanyaContext.reportData.keyFindings?.length > 0) {
            response += `**Top Findings:**\n`;
            tanyaContext.reportData.keyFindings.slice(0, 3).forEach((finding: string, i: number) => {
              response += `${i + 1}. ${finding}\n`;
            });
            response += `\n`;
          }
          
          if (tanyaContext.reportData.actionableInsights?.length > 0) {
            response += `**Priority Actions:**\n`;
            tanyaContext.reportData.actionableInsights
              .filter((insight: any) => insight.priority === 'high')
              .slice(0, 2)
              .forEach((insight: any, i: number) => {
                response += `• **${insight.title}** - ${insight.description}\n`;
              });
          }
        } else {
          response += `No recent analysis data available. Try refreshing the Tanya intelligence to get the latest insights.`;
        }
        
        return response;
      }
      
      if (lowerInput.includes('setup') || lowerInput.includes('configure') || lowerInput.includes('email')) {
        let response = `🔧 **Tanya Setup & Configuration:**\n\n`;
        
        if (tanyaContext.companyAgents && tanyaContext.companyAgents.length > 0) {
          response += `**Current Setup:**\n`;
          response += `• ${tanyaContext.companyAgents.length} intelligence agent(s) configured\n`;
          tanyaContext.companyAgents.forEach((agent: any) => {
            response += `• ${agent.name}: ${agent.submissionEmail}\n`;
          });
          response += `\n**Next Steps:**\n`;
          response += `• Share the submission email with your team\n`;
          response += `• Team members can send T5T updates to this email\n`;
          response += `• Reports are generated automatically\n`;
        } else {
          response += `**Setup Required:**\n`;
          response += `• No intelligence agents configured yet\n`;
          response += `• Click "Setup Intelligence" to get started\n`;
          response += `• You'll get a unique submission email for your team\n`;
        }
        
        return response;
      }
      break;

    case 'todo':
      console.log('🤖 Copilot Debug - Processing todo context');
      const todoContext = context as import('@/contexts/CopilotContext').TodoContext;
      
      if (lowerInput.includes('task') || lowerInput.includes('project') || lowerInput.includes('manage')) {
        let response = `📋 **Todo Project Management:**\n\n`;
        
        if (todoContext.selectedProject) {
          response += `**Current Project:** ${todoContext.selectedProject.name || 'Unnamed Project'}\n`;
          response += `**Topic:** ${todoContext.selectedProject.topic || 'General'}\n\n`;
        }
        
        if (todoContext.tasks && todoContext.tasks.length > 0) {
          const tasksByStatus = todoContext.tasks.reduce((acc: any, task: any) => {
            acc[task.status] = (acc[task.status] || 0) + 1;
            return acc;
          }, {});
          
          response += `**Task Summary:**\n`;
          Object.entries(tasksByStatus).forEach(([status, count]) => {
            response += `• ${status}: ${count} tasks\n`;
          });
          
          const highPriorityTasks = todoContext.tasks.filter(t => t.priority?.toLowerCase() === 'high');
          const inProgressTasks = todoContext.tasks.filter(t => t.status?.toLowerCase().includes('progress'));
          
          if (highPriorityTasks.length > 0) {
            response += `\n⚠️ **High Priority Tasks (${highPriorityTasks.length}):**\n`;
            highPriorityTasks.slice(0, 3).forEach((task: any) => {
              response += `• ${task.title} (${task.status})\n`;
            });
          }
          
          if (inProgressTasks.length > 0) {
            response += `\n🔄 **In Progress (${inProgressTasks.length}):**\n`;
            inProgressTasks.slice(0, 3).forEach((task: any) => {
              response += `• ${task.title}\n`;
            });
          }
          
          response += `\n**Recommendations:**\n`;
          if ((tasksByStatus as any).todo > 5) {
            response += `• Consider breaking down large tasks into smaller ones\n`;
          }
          response += `• Use drag-and-drop to update task statuses\n`;
        } else {
          response += `**No tasks found.** \n\n`;
          response += `**Getting Started:**\n`;
          response += `• Click the "+" button to create your first task\n`;
          response += `• Tasks can be created from email threads\n`;
          response += `• Use the kanban board to track progress\n`;
        }
        
        return response;
      }
      
      if (lowerInput.includes('email') || lowerInput.includes('thread') || lowerInput.includes('integration')) {
        let response = `📧 **Todo Email Integration:**\n\n`;
        
        if (todoContext.selectedProject) {
          response += `**Current Thread:** ${todoContext.selectedProject.name}\n`;
          response += `**Original Subject:** ${todoContext.selectedProject.originalSubject || 'N/A'}\n`;
          response += `**Created:** ${new Date(todoContext.selectedProject.createdAt).toLocaleDateString()}\n\n`;
        }
        
        response += `**Email Features:**\n`;
        response += `• Projects are automatically created from email threads\n`;
        response += `• Team members are identified from email participants\n`;
        response += `• Tasks can be extracted from email content\n`;
        response += `• Use S3 refresh to check for new email threads\n\n`;
        
        response += `**Tips:**\n`;
        response += `• Reply to project emails to maintain thread context\n`;
        response += `• Use clear subject lines for better organization\n`;
        response += `• Tag team members in emails for automatic assignment\n`;
        
        return response;
      }
      break;

    case 'task-board':
      console.log('🤖 Copilot Debug - Processing task-board context');
      const taskBoardContext = context as import('@/contexts/CopilotContext').TaskBoardContext;
      
      if (lowerInput.includes('status') || lowerInput.includes('organize') || lowerInput.includes('summary')) {
        if (taskBoardContext.tasks?.length) {
          let response = `📊 **Task Board Analysis:**\n\n`;
          
          const tasksByStatus = taskBoardContext.tasks.reduce((acc: any, task: any) => {
            acc[task.status] = (acc[task.status] || 0) + 1;
            return acc;
          }, {});
          
          const tasksByPriority = taskBoardContext.tasks.reduce((acc: any, task: any) => {
            const priority = task.priority?.toLowerCase() || 'none';
            acc[priority] = (acc[priority] || 0) + 1;
            return acc;
          }, {});
          
          response += `**Status Distribution:**\n`;
          Object.entries(tasksByStatus).forEach(([status, count]) => {
            response += `• ${status}: ${count} tasks\n`;
          });
          
          response += `\n**Priority Breakdown:**\n`;
          Object.entries(tasksByPriority).forEach(([priority, count]) => {
            response += `• ${priority}: ${count} tasks\n`;
          });
          
          const priorityTasks = taskBoardContext.tasks.filter(t => t.priority?.toLowerCase() === 'high');
          const stalledTasks = taskBoardContext.tasks.filter(t => 
            t.status?.toLowerCase().includes('progress') && 
            new Date(t.updatedAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          );
          
          response += `\n**Insights:**\n`;
          if (priorityTasks.length > 0) {
            response += `⚠️ ${priorityTasks.length} high-priority tasks need attention\n`;
          }
          if (stalledTasks.length > 0) {
            response += `🚨 ${stalledTasks.length} tasks haven't been updated in over a week\n`;
          }
          
          const completionRate = Math.round(
            ((tasksByStatus as any).completed || 0) / taskBoardContext.tasks.length * 100
          );
          response += `📈 Completion rate: ${completionRate}%\n`;
          
          response += `\n**Recommendations:**\n`;
          if (priorityTasks.length > 3) {
            response += `• Focus on high-priority tasks first\n`;
          }
          if (stalledTasks.length > 0) {
            response += `• Review and update stalled tasks\n`;
          }
          if (completionRate < 30) {
            response += `• Consider breaking down complex tasks\n`;
          }
          
          return response;
        } else {
          return `📋 **Task Board Status:**\n\nThe task board is currently empty.\n\n**Getting Started:**\n• Click the "+" button to create your first task\n• Import tasks from email threads\n• Organize tasks by status and priority\n• Use filters to focus on specific work`;
        }
      }
      break;

    default:
      console.log('🤖 Copilot Debug - Processing default/general context, type:', context.type);
      if (lowerInput.includes('agent') || lowerInput.includes('intelligence')) {
        return `🤖 **Available InboxLeap Agents:**\n\n• **Tanya (T5T)**: Intelligence agent for team feedback analysis\n• **Todo**: Project management from email threads\n• **Polly**: Polling and survey management\n• **Han**: General task and email assistance\n\nEach agent specializes in different aspects of email and task management. Navigate to their sections for specific help!`;
      }
  }

  // Fallback response with context awareness
  const contextName = context.type === 't5t' ? 'Tanya Intelligence' : 
                      context.type === 'todo' ? 'Todo Projects' :
                      context.type === 'task-board' ? 'Task Board' :
                      `${context.type} section`;

  const fallbackResponse = `I understand you asked about "${userInput}" in the ${contextName}.\n\nBased on your current context, here are some relevant suggestions:\n\n${getContextualSuggestions(context).slice(0, 3).map(s => `• ${s}`).join('\n')}\n\nFeel free to ask more specific questions about your current view or any InboxLeap features!`;
  
  console.log('🤖 Copilot Debug - Returning fallback response:', fallbackResponse);
  return fallbackResponse;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // Optional: actionable intents detected by backend (e.g., change status)
  intents?: Array<{ label: string; status: string; taskId?: number }>;
}

interface CopilotSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function CopilotSidebar({ isOpen, onToggle }: CopilotSidebarProps) {
  const { context } = useCopilotContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track in-flight requests to avoid race conditions
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const suggestionsReqIdRef = useRef(0);
  const chatReqIdRef = useRef(0);

  // Memoize the context to prevent unnecessary re-renders
  const memoizedContext = useMemo(() => context, [context?.type, JSON.stringify(context)]);

  // Build a minimal context payload to send to backend (avoids huge objects and loops)
  const buildMinimalContextPayload = useCallback((ctx: CopilotContext | null) => {
    if (!ctx) return null;
    if (ctx.type === 'todo') {
      const t = ctx as any;
      return {
        type: 'todo',
        selectedProject: t.selectedProject ? {
          id: t.selectedProject.id,
          name: t.selectedProject.name,
          topic: t.selectedProject.topic,
          createdAt: t.selectedProject.createdAt,
        } : null,
        tasks: Array.isArray(t.tasks) ? t.tasks.map((x: any) => ({
          id: x.id,
          title: x.title,
          status: x.status,
          priority: x.priority,
          updatedAt: x.updatedAt,
          dueDate: x.dueDate,
        })) : [],
      };
    }
    if (ctx.type === 't5t') {
      const t = ctx as any;
      return {
        type: 't5t',
        metrics: t.reportData?.metrics ? {
          emailVolume: t.reportData.metrics.emailVolume,
          participationRate: t.reportData.metrics.participationRate,
          sentimentScore: t.reportData.metrics.sentimentScore,
          alertCount: t.reportData.metrics.alertCount,
        } : null,
        keyFindingsCount: t.reportData?.keyFindings?.length || 0,
        actionableInsightsCount: t.reportData?.actionableInsights?.length || 0,
        healthStatus: t.statusData?.healthStatus || null,
      };
    }
    if (ctx.type === 'task-board') {
      const t = ctx as any;
      return {
        type: 'task-board',
        selectedProject: t.selectedProject ? { id: t.selectedProject.id, name: t.selectedProject.name } : null,
        tasks: Array.isArray(t.tasks) ? t.tasks.map((x: any) => ({
          id: x.id,
          status: x.status,
          priority: x.priority,
          updatedAt: x.updatedAt,
        })) : [],
      };
    }
    return { type: ctx.type };
  }, []);

  // Stable signature of minimal context for change detection (prevents rapid loops)
  const contextSignature = useMemo(() => {
    try {
      return JSON.stringify(buildMinimalContextPayload(context));
    } catch {
      return String(context?.type || 'none');
    }
  }, [context, buildMinimalContextPayload]);
  
  // Initialize welcome message only once when component mounts
  useEffect(() => {
    const contextSummary = context ? generateContextSummary(context) : 
      'Hello! I\'m InboxLeap Copilot. I can help you with questions about your agents, tasks, and email management. What would you like to know?';
    
    setMessages([{
      id: '1',
      type: 'assistant',
      content: contextSummary,
      timestamp: new Date()
    }]);
  }, []); // Remove context dependency to prevent message reset

  // Fetch AI-powered suggestions when context changes (memoized and debounced)
  const fetchAISuggestions = useCallback(async () => {
    if (!context) {
      setAiSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    const reqId = ++suggestionsReqIdRef.current;

    // Abort any previous suggestions request
    if (suggestionsAbortRef.current) {
      suggestionsAbortRef.current.abort();
    }
    const controller = new AbortController();
    suggestionsAbortRef.current = controller;

    try {
      const minimal = buildMinimalContextPayload(context);

      const response = await fetch('/api/copilot/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          context: context.type,
          contextData: minimal,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const suggestionsData = await response.json();
      if (reqId === suggestionsReqIdRef.current) {
        setAiSuggestions(suggestionsData.suggestions || getContextualSuggestions(context));
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // Silently ignore aborted requests
      } else {
        console.error('Error fetching AI suggestions:', error);
        setAiSuggestions(getContextualSuggestions(context));
      }
    } finally {
      if (reqId === suggestionsReqIdRef.current) {
        setIsLoadingSuggestions(false);
      }
    }
  }, [context?.type, contextSignature, buildMinimalContextPayload]);

  // Debounced effect to fetch suggestions (prevent rapid API calls)
  useEffect(() => {
    if (memoizedContext?.type) {
      const timeoutId = setTimeout(() => {
        fetchAISuggestions();
      }, 400); // slight debounce

      return () => clearTimeout(timeoutId);
    }
  }, [memoizedContext?.type, contextSignature, fetchAISuggestions]);

  const suggestions = aiSuggestions.length > 0 ? aiSuggestions : (context ? getContextualSuggestions(context) : []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setShowSuggestions(false);

    const reqId = ++chatReqIdRef.current;

    // Abort any previous chat request
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }
    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const minimal = buildMinimalContextPayload(context || { type: 'general' } as any);

      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          userQuestion: userMessage.content,
          context: context?.type || 'general',
          contextData: minimal,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const aiResponse = await response.json();

      if (reqId !== chatReqIdRef.current) return; // outdated
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse.response || generateContextualResponse(userMessage.content, context),
        timestamp: new Date(),
        intents: aiResponse.taskIntents || []
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Add actionable items as separate messages if available
      if (aiResponse.actionableItems && aiResponse.actionableItems.length > 0) {
        const actionMessage: Message = {
          id: (Date.now() + 2).toString(),
          type: 'assistant', 
          content: `📋 **Action Items:**\n\n${aiResponse.actionableItems.map((item: any) => 
            `• **${item.title}** (${item.priority} priority)\n  ${item.description}\n  ➤ ${item.action}`
          ).join('\n\n')}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, actionMessage]);
      }
      
      // Add insights as separate messages if available
      if (aiResponse.insights && aiResponse.insights.length > 0) {
        const insightMessage: Message = {
          id: (Date.now() + 3).toString(),
          type: 'assistant',
          content: `💡 **Key Insights:**\n\n${aiResponse.insights.map((insight: any) => 
            `${insight.type === 'warning' ? '⚠️' : insight.type === 'opportunity' ? '🚀' : insight.type === 'trend' ? '📈' : '💭'} **${insight.title}**\n  ${insight.description}${insight.confidence ? ` (${insight.confidence}% confidence)` : ''}`
          ).join('\n\n')}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, insightMessage]);
      }

      setIsLoading(false);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // Ignore aborted requests
        return;
      }

      console.error('Error sending message:', error);
      
      const fallback = generateContextualResponse(userMessage.content, context);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: fallback,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  // Helper to perform task status update from actionable intent
  const handleIntentAction = useCallback(async (status: string, taskId?: number) => {
    try {
      if (!taskId) return;
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error(`Failed to update task ${taskId}`);
      // Append confirmation message
      setMessages(prev => [...prev, {
        id: String(Date.now()),
        type: 'assistant',
        content: `✅ Updated task ${taskId} to "${status}"`,
        timestamp: new Date()
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: String(Date.now()),
        type: 'assistant',
        content: `❌ Failed to update task${taskId ? ` ${taskId}` : ''}: ${e.message}`,
        timestamp: new Date()
      }]);
    }
  }, []);

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed right-4 bottom-4 z-50">
        <Button
          onClick={onToggle}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 h-12 shadow-lg flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-4 bottom-4 w-80 z-50 flex flex-col">
      {/* Solid background card to avoid transparency over page content */}
      <Card className="flex-1 flex flex-col shadow-xl border-l-4 border-l-blue-600 bg-white dark:bg-slate-900 backdrop-blur-none">
        {/* Header */}
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <CardTitle className="text-lg">InboxLeap Copilot</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-8 w-8 p-0"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <>
            {/* Messages */}
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 px-4 overflow-y-auto">
                <div className="space-y-4 py-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.type === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.type === 'assistant' && (
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="w-4 h-4 text-blue-600" />
                        </div>
                      )}
                      
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {message.type === 'assistant' ? (
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                            {message.intents && message.intents.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {message.intents.map((intent, idx) => (
                                  <Button
                                    key={idx}
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleIntentAction(intent.status, intent.taskId)}
                                  >
                                    {intent.label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                        <span className="text-xs opacity-70 mt-1 block">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>

                      {message.type === 'user' && (
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Context-aware suggestions */}
                  {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && messages.length === 1 && (
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">
                          {isLoadingSuggestions ? 'Generating intelligent suggestions...' : 'AI-powered suggestions for this context:'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {isLoadingSuggestions ? (
                          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                            <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                            <span className="text-sm text-gray-600">Analyzing your current context...</span>
                          </div>
                        ) : (
                          suggestions.slice(0, 3).map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="w-full text-left p-2 text-sm bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Input */}
              <div className="border-t p-4 flex-shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={`Ask about ${context?.type === 't5t' ? 'intelligence insights and trends' : 
                                             context?.type === 'todo' ? 'project management and tasks' :
                                             context?.type === 'task-board' ? 'task organization and workflow' :
                                             'agents, tasks, or email management'}...`}
                    className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                    rows={1}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 self-end"
                    size="sm"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
