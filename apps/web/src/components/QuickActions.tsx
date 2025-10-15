import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Zap, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  Play,
  RefreshCw,
  Settings,
  Filter,
  Plus,
  BarChart3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuickActionsProps {
  onAction?: (actionType: string, data?: any) => void;
  showAssistantHistory?: boolean;
  projectId?: string | number;
}

export default function QuickActions({ onAction, showAssistantHistory, projectId }: QuickActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Create project-specific localStorage key
  const getChatHistoryKey = () => {
    return projectId ? `quick-actions-ai-chat-history-${projectId}` : 'quick-actions-ai-chat-history';
  };
  
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; message: string; actions?: any[] }[]>(() => {
    // Load chat history from localStorage on component mount
    if (showAssistantHistory && projectId) {
      const saved = localStorage.getItem(getChatHistoryKey());
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const [llmQuery, setLlmQuery] = useState('');
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  const [isLlmOpen, setIsLlmOpen] = useState(false);

  // Load chat history when project changes
  useEffect(() => {
    if (showAssistantHistory && projectId) {
      const saved = localStorage.getItem(getChatHistoryKey());
      setChatHistory(saved ? JSON.parse(saved) : []);
    } else {
      setChatHistory([]);
    }
  }, [projectId, showAssistantHistory]);

  const handleLlmQuery = async () => {
    if (!llmQuery.trim()) return;
    setIsLlmLoading(true);
    if (showAssistantHistory && projectId) {
      const userMessage = { role: 'user' as const, message: llmQuery };
      setChatHistory((prev) => {
        const newHistory = [...prev, userMessage];
        localStorage.setItem(getChatHistoryKey(), JSON.stringify(newHistory));
        return newHistory;
      });
    }
    try {
      const response = await fetch('/api/claude/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: `You are a quick actions assistant. The user has asked: "${llmQuery}"
        
        Available quick actions:
        - Create New Task
        - Trigger Email Processing
        - Refresh All Data
        - View Analytics
        - Filter High Priority
        - Clear All Filters
        - Export Data
        - Import Tasks
        - Bulk Actions
        - System Settings
        
        Please analyze the user's message and respond with one of the following actions:
        1. ACTION_CREATE - User wants to create something new
        2. ACTION_PROCESS - User wants to trigger processing
        3. ACTION_VIEW - User wants to view/analyze data
        4. ACTION_FILTER - User wants to filter or search
        5. ACTION_EXPORT - User wants to export data
        6. ACTION_IMPORT - User wants to import data
        7. ACTION_BULK - User wants to perform bulk operations
        8. ACTION_SETTINGS - User wants to configure settings
        9. GENERAL - General conversation or question
        
        Format your response as JSON:
        {
          "action": "ACTION_CREATE|ACTION_PROCESS|ACTION_VIEW|ACTION_FILTER|ACTION_EXPORT|ACTION_IMPORT|ACTION_BULK|ACTION_SETTINGS|GENERAL",
          "suggestion": "Your response to the user",
          "quickActions": [
            {
              "label": "Create New Task",
              "description": "Create a new task", 
              "actionType": "create_task",
              "icon": "plus"
            }
          ]
        }`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const aiResponse = await response.json();
      
      // Clean up markdown formatting from Claude response
      const cleanedResponse = aiResponse.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const result = JSON.parse(cleanedResponse);

      if (showAssistantHistory && projectId) {
        const assistantMessage = { 
          role: 'assistant' as const, 
          message: result.suggestion,
          actions: result.quickActions || []
        };
        setChatHistory((prev) => {
          const newHistory = [...prev, assistantMessage];
          localStorage.setItem(getChatHistoryKey(), JSON.stringify(newHistory));
          return newHistory;
        });
      } else {
        toast({
          title: "AI Assistant",
          description: result.suggestion,
        });
      }
    } catch (error) {
      const errorMessage = "Failed to process your request. Please try again.";
      if (showAssistantHistory && projectId) {
        const assistantMessage = { role: 'assistant' as const, message: errorMessage };
        setChatHistory((prev) => {
          const newHistory = [...prev, assistantMessage];
          localStorage.setItem(getChatHistoryKey(), JSON.stringify(newHistory));
          return newHistory;
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLlmLoading(false);
      setLlmQuery('');
    }
  };

  const handleQuickAction = async (actionType: string, data?: any) => {
    try {
      switch (actionType) {
        case 'create_task':
          onAction?.('create_task', data);
          break;
        case 'trigger_email_processing':
          const response = await fetch('/api/trigger-email-processing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          
          if (response.ok) {
            toast({
              title: "Processing Triggered",
              description: "Email processing has been triggered",
            });
          } else {
            throw new Error('Failed to trigger processing');
          }
          break;
        case 'refresh_all':
          queryClient.invalidateQueries();
          toast({
            title: "Data Refreshed",
            description: "All data has been refreshed",
          });
          break;
        case 'view_analytics':
          onAction?.('view_analytics', data);
          break;
        case 'filter_high_priority':
          onAction?.('filter_high_priority', data);
          break;
        case 'clear_filters':
          onAction?.('clear_filters', data);
          break;
        case 'export_data':
          onAction?.('export_data', data);
          break;
        case 'import_tasks':
          onAction?.('import_tasks', data);
          break;
        case 'bulk_actions':
          onAction?.('bulk_actions', data);
          break;
        case 'system_settings':
          onAction?.('system_settings', data);
          break;
        default:
          onAction?.(actionType, data);
      }
    } catch (error) {
      console.error('Error handling quick action:', error);
      toast({
        title: "Error",
        description: "Failed to perform quick action",
        variant: "destructive",
      });
    }
  };

  const clearChatHistory = () => {
    setChatHistory([]);
    if (projectId) {
      localStorage.removeItem(getChatHistoryKey());
    }
  };

  const getActionIcon = (iconName: string) => {
    switch (iconName) {
      case 'plus': return <Plus className="h-4 w-4" />;
      case 'play': return <Play className="h-4 w-4" />;
      case 'refresh': return <RefreshCw className="h-4 w-4" />;
      case 'chart': return <BarChart3 className="h-4 w-4" />;
      case 'filter': return <Filter className="h-4 w-4" />;
      case 'settings': return <Settings className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto flex flex-col">
          {/* Quick Actions Grid */}
          <div className="p-4 border-b border-gray-200">
            <Label className="text-sm font-medium mb-3 block">Quick Actions</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('create_task')}
                className="flex flex-col items-center gap-1 h-16"
              >
                <Plus className="h-4 w-4" />
                <span className="text-xs">New Task</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('trigger_email_processing')}
                className="flex flex-col items-center gap-1 h-16"
              >
                <Play className="h-4 w-4" />
                <span className="text-xs">Process Email</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('refresh_all')}
                className="flex flex-col items-center gap-1 h-16"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="text-xs">Refresh All</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('view_analytics')}
                className="flex flex-col items-center gap-1 h-16"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs">Analytics</span>
              </Button>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="p-4 border-b border-gray-200">
            <Label className="text-sm font-medium mb-3 block">Filter Actions</Label>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('filter_high_priority')}
                className="w-full justify-start"
              >
                <Filter className="h-4 w-4 mr-2" />
                High Priority Tasks
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('clear_filters')}
                className="w-full justify-start"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          </div>

          {/* Data Actions */}
          <div className="p-4 border-b border-gray-200">
            <Label className="text-sm font-medium mb-3 block">Data Actions</Label>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('export_data')}
                className="w-full justify-start"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Export Data
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('import_tasks')}
                className="w-full justify-start"
              >
                <Plus className="h-4 w-4 mr-2" />
                Import Tasks
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('bulk_actions')}
                className="w-full justify-start"
              >
                <Zap className="h-4 w-4 mr-2" />
                Bulk Actions
              </Button>
            </div>
          </div>

          {/* AI Assistant Section */}
          <Collapsible open={isLlmOpen} onOpenChange={setIsLlmOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-4 h-auto border-b border-gray-200"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>AI Assistant</span>
                </div>
                {isLlmOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-b border-gray-200">
              <div className="p-4 space-y-4">
                {showAssistantHistory && projectId && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Chat History</Label>
                      {chatHistory.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearChatHistory}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto bg-gray-100 rounded p-2 border border-gray-200">
                      <div className="space-y-3 text-xs">
                        {chatHistory.length === 0 && (
                          <div className="text-gray-400 text-center py-4">No conversation yet for this project.</div>
                        )}
                        {chatHistory.map((msg, idx) => (
                          <div key={idx} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
                            <div className={msg.role === 'user' ? 'bg-blue-100 text-blue-800 rounded-lg px-3 py-2 inline-block max-w-[80%]' : 'bg-white text-gray-800 rounded-lg px-3 py-2 inline-block max-w-[80%] border'}>
                              {msg.message}
                            </div>
                            {msg.actions && msg.actions.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {msg.actions.map((action: any, actionIdx: number) => (
                                  <Button
                                    key={actionIdx}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuickAction(action.actionType, action.data)}
                                    className="text-xs mr-2"
                                  >
                                    {getActionIcon(action.icon)}
                                    <span className="ml-1">{action.label}</span>
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Ask AI for quick actions</Label>
                  <Textarea
                    placeholder="e.g., 'Create a new high priority task', 'Show me overdue tasks', 'Export this week's data'"
                    value={llmQuery}
                    onChange={(e) => setLlmQuery(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <Button
                  onClick={handleLlmQuery}
                  disabled={!llmQuery.trim() || isLlmLoading}
                  className="w-full"
                >
                  {isLlmLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Ask AI
                    </>
                  )}
                </Button>
                {/* Quick AI Actions */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quick Actions</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLlmQuery("Create a new task with high priority")}
                    >
                      Create High Priority Task
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLlmQuery("Show me all overdue tasks")}
                    >
                      Show Overdue Tasks
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLlmQuery("Export all completed tasks from this week")}
                    >
                      Export Weekly Data
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* System Status */}
          <div className="p-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Email Processing</span>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AI Assistant</span>
                  <Badge className="bg-green-100 text-green-800">Online</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Database</span>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Last Sync</span>
                  <span className="text-xs text-gray-500">Just now</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
