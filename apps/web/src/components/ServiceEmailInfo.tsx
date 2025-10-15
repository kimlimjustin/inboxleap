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
  Info,
  Copy,
  CheckCircle,
  XCircle,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ServiceEmailInfoProps {
  showAssistantHistory?: boolean;
  projectId?: string | number;
}

export default function ServiceEmailInfo({ showAssistantHistory, projectId }: ServiceEmailInfoProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Create project-specific localStorage key
  const getChatHistoryKey = () => {
    return projectId ? `service-email-ai-chat-history-${projectId}` : 'service-email-ai-chat-history';
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
  const [copied, setCopied] = useState(false);

  // Service email configuration
  const serviceEmail = 'todo@yourservice.app';
  const isConfigured = true; // This would come from API in real app

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
          message: `You are a service email configuration assistant. The user has asked: "${llmQuery}"
        
        Current service email configuration:
        - Service Email: ${serviceEmail}
        - Status: ${isConfigured ? 'Configured' : 'Not Configured'}
        - Monitoring: ${isConfigured ? 'Active' : 'Inactive'}
        
        Please analyze the user's message and respond with one of the following actions:
        1. EMAIL_SETUP - User wants to set up service email
        2. EMAIL_TROUBLESHOOT - User needs help with email issues
        3. EMAIL_USAGE - User wants to know how to use service email
        4. EMAIL_SECURITY - User has questions about email security
        5. EMAIL_FEATURES - User wants to know about email features
        6. GENERAL - General conversation or question
        
        Format your response as JSON:
        {
          "action": "EMAIL_SETUP|EMAIL_TROUBLESHOOT|EMAIL_USAGE|EMAIL_SECURITY|EMAIL_FEATURES|GENERAL",
          "suggestion": "Your response to the user",
          "serviceActions": [
            {
              "label": "Copy Email Address",
              "description": "Copy service email to clipboard", 
              "actionType": "copy"
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
          actions: result.serviceActions || []
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

  const handleServiceAction = async (actionType: string) => {
    try {
      switch (actionType) {
        case 'copy':
          await navigator.clipboard.writeText(serviceEmail);
          setCopied(true);
          toast({
            title: "Copied!",
            description: "Service email address copied to clipboard",
          });
          setTimeout(() => setCopied(false), 2000);
          break;
        case 'test':
          // Test service email configuration
          const response = await fetch('/api/test-service-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          
          if (response.ok) {
            toast({
              title: "Test Successful",
              description: "Service email is working correctly",
            });
          } else {
            throw new Error('Service email test failed');
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error handling service action:', error);
      toast({
        title: "Error",
        description: "Failed to perform service action",
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

  return (
    <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto flex flex-col">
          {/* Service Email Info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-blue-500" />
              <Label className="text-sm font-medium">Service Email</Label>
              {isConfigured ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
            
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-blue-800">{serviceEmail}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleServiceAction('copy')}
                    className="h-6 w-6 p-0"
                  >
                    {copied ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-blue-500" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Status:</span>
                  <Badge 
                    className={isConfigured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                  >
                    {isConfigured ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Monitoring:</span>
                  <Badge 
                    className={isConfigured ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}
                  >
                    {isConfigured ? 'Running' : 'Stopped'}
                  </Badge>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleServiceAction('test')}
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                Test Configuration
              </Button>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="p-4 border-b border-gray-200">
            <Label className="text-sm font-medium mb-3 block">How to Use</Label>
            <div className="space-y-3 text-xs text-gray-600">
              <div className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">1</span>
                <span>Send an email to <span className="font-mono font-medium">{serviceEmail}</span></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">2</span>
                <span>Your email will be automatically processed</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">3</span>
                <span>Tasks will be created based on email content</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">4</span>
                <span>You'll receive a confirmation email</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="p-4 border-b border-gray-200">
            <Label className="text-sm font-medium mb-3 block">Features</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Automatic task extraction</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Priority detection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Due date parsing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Team assignment</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Reply processing</span>
              </div>
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
                                    onClick={() => handleServiceAction(action.actionType)}
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
                  <Label className="text-sm font-medium">Ask AI about service email</Label>
                  <Textarea
                    placeholder="e.g., 'How do I set up email forwarding?', 'Why aren't my emails being processed?', 'What email formats work best?'"
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
                      onClick={() => setLlmQuery("How do I format emails for best task extraction?")}
                    >
                      Email Format Tips
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLlmQuery("Why isn't my email being processed?")}
                    >
                      Troubleshoot Issues
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLlmQuery("What are the security features of service email?")}
                    >
                      Security Info
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
