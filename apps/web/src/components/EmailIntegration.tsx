import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Mail, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  Settings,
  Activity,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailIntegrationProps {
  emails: any[];
  onEmailAction?: (action: string, email: any) => void;
  showAssistantHistory?: boolean;
  projectId?: string | number;
}

export default function EmailIntegration({ emails, onEmailAction, showAssistantHistory, projectId }: EmailIntegrationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Create project-specific localStorage key
  const getChatHistoryKey = () => {
    return projectId ? `email-ai-chat-history-${projectId}` : 'email-ai-chat-history';
  };
  
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; message: string; actions?: any[]; newTask?: any }[]>(() => {
    // Load chat history from localStorage on component mount
    if (showAssistantHistory && projectId) {
      const saved = localStorage.getItem(getChatHistoryKey());
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const [llmQuery, setLlmQuery] = useState('');
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
          message: `You are an email processing assistant. The user has asked: "${llmQuery}"
        
        Here are the recent emails:
        ${emails.map(email => `- ID: ${email.id}, Subject: "${email.subject}", From: ${email.sender}, Status: ${email.status}, Tasks Created: ${email.tasksCreated || 0}`).join('\n')}
        
        Please analyze the user's message and respond with one of the following actions:
        1. EMAIL_FILTER - User wants to filter/search emails
        2. EMAIL_PROCESS - User wants to process or reprocess emails
        3. EMAIL_INSIGHT - User wants insights about email processing
        4. EMAIL_ORGANIZE - User wants organization improvements for emails
        5. EMAIL_STATUS - User wants to check email processing status
        6. EMAIL_CONFIG - User wants to configure email settings
        7. GENERAL - General conversation or question
        
        If the action is EMAIL_PROCESS, try to identify which specific email they're referring to by matching keywords from their message with email subjects.
        
        Format your response as JSON:
        {
          "action": "EMAIL_FILTER|EMAIL_PROCESS|EMAIL_INSIGHT|EMAIL_ORGANIZE|EMAIL_STATUS|EMAIL_CONFIG|GENERAL",
          "suggestion": "Your response to the user",
          "emailActions": [
            {
              "label": "Reprocess Email",
              "description": "Reprocess this email for tasks", 
              "actionType": "reprocess",
              "emailId": "email ID if you can identify specific email"
            }
          ],
          "configActions": [
            {
              "label": "Configure Email Settings",
              "description": "Set up email integration",
              "actionType": "configure"
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
          actions: [...(result.emailActions || []), ...(result.configActions || [])]
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

  const handleEmailAction = async (actionType: string, emailId?: string) => {
    try {
      switch (actionType) {
        case 'reprocess':
          if (emailId) {
            const response = await fetch(`/api/emails/${emailId}/reprocess`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });
            
            if (response.ok) {
              toast({
                title: "Email Reprocessing",
                description: "Email has been queued for reprocessing",
              });
              
              // Invalidate and refetch email data
              queryClient.invalidateQueries({ queryKey: ['/api/recent-emails'] });
            } else {
              throw new Error('Failed to reprocess email');
            }
          }
          break;
        case 'configure':
          // Handle configuration action
          setIsSettingsOpen(true);
          break;
        default:
          onEmailAction?.(actionType, { id: emailId });
      }
    } catch (error) {
      console.error('Error handling email action:', error);
      toast({
        title: "Error",
        description: "Failed to perform email action",
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-orange-100 text-orange-800';
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
          {/* Email Settings Section */}
          <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-4 h-auto border-b border-gray-200"
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Email Settings</span>
                </div>
                {isSettingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-b border-gray-200">
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Service Email</Label>
                  <Input 
                    placeholder="todo@yourservice.app" 
                    value="todo@yourservice.app"
                    readOnly
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500">
                    Send emails to this address to create tasks automatically
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Processing Status</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-700">Active</span>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/recent-emails'] });
                    toast({
                      title: "Refreshed",
                      description: "Email data has been refreshed",
                    });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Email Data
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Recent Emails Section */}
          <div className="p-4 border-b border-gray-200">
            <Label className="text-sm font-medium mb-3 block">Recent Emails</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {emails.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No recent emails
                </div>
              ) : (
                emails.slice(0, 5).map((email: any) => (
                  <div key={email.id} className="flex items-start space-x-2 p-2 bg-white rounded border">
                    <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{email.subject}</p>
                      <p className="text-xs text-gray-500 truncate">{email.sender}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-xs ${getStatusColor(email.status)}`}>
                          {email.status}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {formatTime(email.createdAt)}
                        </span>
                      </div>
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
                                    onClick={() => handleEmailAction(action.actionType, action.emailId)}
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
                  <Label className="text-sm font-medium">Ask AI about email processing</Label>
                  <Textarea
                    placeholder="e.g., 'Show me failed emails', 'Why did this email fail to process?', 'How can I improve email processing?'"
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
                      onClick={() => setLlmQuery("Show me failed email processing attempts")}
                    >
                      Failed Emails
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLlmQuery("What emails are still processing?")}
                    >
                      Processing Status
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLlmQuery("How can I improve email processing?")}
                    >
                      Improve Processing
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Email Stats */}
          <div className="p-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Email Processing Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Emails</span>
                  <span className="font-medium">{emails.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Processed</span>
                  <span className="font-medium">{emails.filter(e => e.status === 'processed').length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Processing</span>
                  <span className="font-medium">{emails.filter(e => e.status === 'processing').length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Failed</span>
                  <span className="font-medium">{emails.filter(e => e.status === 'failed').length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
