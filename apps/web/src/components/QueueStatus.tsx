import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Activity, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Pause
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QueueStatusProps {
  showAssistantHistory?: boolean;
  projectId?: string | number;
}

interface QueueItem {
  id: string;
  subject: string;
  sender: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
  error?: string;
}

interface QueueStatusData {
  active: number;
  pending: number;
  completed: number;
  failed: number;
}

export default function QueueStatus({ showAssistantHistory, projectId }: QueueStatusProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Create project-specific localStorage key
  const getChatHistoryKey = () => {
    return projectId ? `queue-ai-chat-history-${projectId}` : 'queue-ai-chat-history';
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

  // Fetch queue status
  const { data: queueStatus, isLoading } = useQuery<QueueStatusData>({
    queryKey: ['/api/queue-status'],
    refetchInterval: 5000, // Refresh every 5 seconds
    retry: false,
  });

  // Fetch queue history
  const { data: queueHistory = [] } = useQuery<QueueItem[]>({
    queryKey: ['/api/queue-history'],
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: false,
  });

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
          message: `You are a queue monitoring assistant. The user has asked: "${llmQuery}"
        
        Current queue status:
        - Active: ${queueStatus?.active || 0}
        - Pending: ${queueStatus?.pending || 0}
        - Completed: ${queueStatus?.completed || 0}
        - Failed: ${queueStatus?.failed || 0}
        
        Recent queue items:
        ${queueHistory.slice(0, 10).map(item => `- ${item.subject} (${item.status}) - ${item.sender}`).join('\n')}
        
        Please analyze the user's message and respond with one of the following actions:
        1. QUEUE_STATUS - User wants to check queue status
        2. QUEUE_CONTROL - User wants to control queue (pause/resume/clear)
        3. QUEUE_INSIGHT - User wants insights about queue performance
        4. QUEUE_TROUBLESHOOT - User wants help with queue issues
        5. QUEUE_HISTORY - User wants to see queue history
        6. GENERAL - General conversation or question
        
        Format your response as JSON:
        {
          "action": "QUEUE_STATUS|QUEUE_CONTROL|QUEUE_INSIGHT|QUEUE_TROUBLESHOOT|QUEUE_HISTORY|GENERAL",
          "suggestion": "Your response to the user",
          "queueActions": [
            {
              "label": "Pause Queue",
              "description": "Pause email processing queue", 
              "actionType": "pause"
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
          actions: result.queueActions || []
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

  const handleQueueAction = async (actionType: string) => {
    try {
      let endpoint = '';
      let method = 'POST';
      
      switch (actionType) {
        case 'pause':
          endpoint = '/api/queue/pause';
          break;
        case 'resume':
          endpoint = '/api/queue/resume';
          break;
        case 'clear':
          endpoint = '/api/queue/clear';
          break;
        case 'refresh':
          queryClient.invalidateQueries({ queryKey: ['/api/queue-status'] });
          queryClient.invalidateQueries({ queryKey: ['/api/queue-history'] });
          toast({
            title: "Refreshed",
            description: "Queue data has been refreshed",
          });
          return;
        default:
          return;
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: "Queue Action",
          description: `Queue ${actionType} successful`,
        });
        
        // Refresh queue data
        queryClient.invalidateQueries({ queryKey: ['/api/queue-status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/queue-history'] });
      } else {
        throw new Error(`Failed to ${actionType} queue`);
      }
    } catch (error) {
      console.error('Error handling queue action:', error);
      toast({
        title: "Error",
        description: `Failed to ${actionType} queue`,
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto flex flex-col">
          {/* Queue Status Section */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Queue Status</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQueueAction('refresh')}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
            
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">Active</div>
                  <div className="text-lg font-semibold text-orange-600">{queueStatus?.active || 0}</div>
                </div>
                <div className="p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">Pending</div>
                  <div className="text-lg font-semibold text-gray-600">{queueStatus?.pending || 0}</div>
                </div>
                <div className="p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">Completed</div>
                  <div className="text-lg font-semibold text-green-600">{queueStatus?.completed || 0}</div>
                </div>
                <div className="p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">Failed</div>
                  <div className="text-lg font-semibold text-red-600">{queueStatus?.failed || 0}</div>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQueueAction('pause')}
                className="flex-1"
              >
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQueueAction('resume')}
                className="flex-1"
              >
                <Play className="h-3 w-3 mr-1" />
                Resume
              </Button>
            </div>
          </div>

          {/* Queue History Section */}
          <div className="p-4 border-b border-gray-200">
            <Label className="text-sm font-medium mb-3 block">Recent Queue Items</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {queueHistory.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No queue items
                </div>
              ) : (
                queueHistory.slice(0, 10).map((item: QueueItem) => (
                  <div key={item.id} className="flex items-start space-x-2 p-2 bg-white rounded border">
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{item.subject}</p>
                      <p className="text-xs text-gray-500 truncate">{item.sender}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-xs ${getStatusColor(item.status)}`}>
                          {item.status}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {formatTime(item.createdAt)}
                        </span>
                      </div>
                      {item.error && (
                        <p className="text-xs text-red-500 mt-1 truncate">{item.error}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
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
                                    onClick={() => handleQueueAction(action.actionType)}
                                    className="text-xs mr-2"
                                  >
                                    {action.label}
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
                  <Label className="text-sm font-medium">Ask AI about the queue</Label>
                  <Textarea
                    placeholder="e.g., 'Why is the queue slow?', 'What's causing failures?', 'How can I optimize processing?'"
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
                      onClick={() => setLlmQuery("Why is the queue processing slowly?")}
                    >
                      Check Performance
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLlmQuery("What emails are failing and why?")}
                    >
                      Analyze Failures
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLlmQuery("How can I optimize queue processing?")}
                    >
                      Optimize Queue
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
