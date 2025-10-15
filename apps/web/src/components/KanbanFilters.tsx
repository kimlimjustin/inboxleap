import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Filter, 
  SortAsc, 
  SortDesc, 
  Search, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  User,
  Flag,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface KanbanFiltersProps {
  tasks: any[];
  onFiltersChange: (filters: FilterState) => void;
  onTasksReorder: (tasks: any[]) => void;
  showAssistantHistory?: boolean;
  projectId?: string | number;
  // New: allow hiding the AI Assistant section (e.g., in Todo)
  hideAssistant?: boolean;
}

export interface FilterState {
  search: string;
  priority: string;
  assignee: string;
  dueDate: string;
  status: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export default function KanbanFilters({ tasks, onFiltersChange, onTasksReorder, showAssistantHistory, projectId, hideAssistant = false }: KanbanFiltersProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Create project-specific localStorage key
  const getChatHistoryKey = () => {
    return projectId ? `kanban-ai-chat-history-${projectId}` : 'kanban-ai-chat-history';
  };
  
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; message: string; actions?: any[]; newTask?: any }[]>(() => {
    // Load chat history from localStorage on component mount
    if (showAssistantHistory && projectId) {
      const saved = localStorage.getItem(getChatHistoryKey());
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    priority: '',
    assignee: '',
    dueDate: '',
    status: '',
    sortBy: 'createdAt',
    // Collapsed by default
    sortOrder: 'desc'
  });
  
  const [llmQuery, setLlmQuery] = useState('');
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  // Collapsed by default
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isLlmOpen, setIsLlmOpen] = useState(false);
  // Add state to control sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load chat history when project changes
  useEffect(() => {
    if (showAssistantHistory && projectId) {
      const saved = localStorage.getItem(getChatHistoryKey());
      setChatHistory(saved ? JSON.parse(saved) : []);
    } else {
      setChatHistory([]);
    }
  }, [projectId, showAssistantHistory]);

  // Get unique values for filter options
  const uniquePriorities = Array.from(new Set(tasks.map(task => task.priority))).filter(Boolean);
  const uniqueAssignees = Array.from(new Set(tasks.flatMap(task => 
    task.assignees?.map((a: any) => a.user?.email) || []
  ))).filter(Boolean);
  const uniqueStatuses = Array.from(new Set(tasks.map(task => task.status))).filter(Boolean);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleSortChange = (sortBy: string) => {
    const newSortOrder: 'asc' | 'desc' = filters.sortBy === sortBy && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    const newFilters = { ...filters, sortBy, sortOrder: newSortOrder };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: FilterState = {
      search: '',
      priority: '',
      assignee: '',
      dueDate: '',
      status: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

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
          message: `You are a task management assistant. The user has asked: "${llmQuery}"
        
        Here are the current tasks:
        ${tasks.map(task => `- ID: ${task.id}, Title: "${task.title}", Status: ${task.status}, Priority: ${task.priority}, Assignees: ${task.assignees?.map((a: any) => a.user?.email).join(', ') || 'None'}`).join('\n')}
        
        Please analyze the user's message and respond with one of the following actions:
        1. FILTER - User wants to filter/search tasks
        2. SORT - User wants to sort tasks
        3. INSIGHT - User wants insights about tasks
        4. ORGANIZE - User wants organization improvements
        5. TASK_UPDATE - User is indicating they're working on/completing a task (e.g., "I'm working on this", "I finished that", "I'll do this now")
        6. TASK_CREATE - User wants to create a new task (e.g., "add xxx to todolist", "create task for xxx", "remind me to xxx")
        7. GENERAL - General conversation or question
        
        If the action is TASK_UPDATE, try to identify which specific task they're referring to by matching keywords from their message with task titles. If you can identify a specific task, include its ID in the taskActions.
        If the action is TASK_CREATE, extract the task details and provide a creation button.
        
        Format your response as JSON:
        {
          "action": "FILTER|SORT|INSIGHT|ORGANIZE|TASK_UPDATE|TASK_CREATE|GENERAL",
          "suggestion": "Your response to the user",
          "taskActions": [
            {
              "label": "Move to Ongoing",
              "description": "Mark task as in progress", 
              "statusChange": "in-progress",
              "taskId": "task ID if you can identify specific task from user message"
            }
          ],
          "newTask": {
            "title": "Task title extracted from user message",
            "description": "Optional description",
            "priority": "medium"
          },
          "filters": {
            "search": "optional search term",
            "priority": "optional priority filter",
            "assignee": "optional assignee filter",
            "status": "optional status filter"
          },
          "sort": {
            "sortBy": "optional sort field",
            "sortOrder": "asc|desc"
          }
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

      // Apply suggested filters if provided
      if (result.action === 'FILTER' && result.filters) {
        const newFilters = { ...filters, ...result.filters };
        setFilters(newFilters);
        onFiltersChange(newFilters);
      }

      // Apply suggested sorting if provided
      if (result.action === 'SORT' && result.sort) {
        const newFilters = { ...filters, ...result.sort };
        setFilters(newFilters);
        onFiltersChange(newFilters);
      }

      if (showAssistantHistory && projectId) {
        const assistantMessage = { 
          role: 'assistant' as const, 
          message: result.suggestion,
          actions: result.taskActions || [],
          newTask: result.newTask || null
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

  const handleTaskStatusChange = async (statusChange: string, taskId?: string) => {
    try {
      let targetTaskId = taskId;
      
      // If no specific task ID provided, try to find the most relevant task
      if (!targetTaskId) {
        // Find tasks that can be moved to the requested status
        const eligibleTasks = tasks.filter(task => {
          if (statusChange === 'in-progress') return task.status === 'todo';
          if (statusChange === 'done') return task.status === 'in-progress';
          if (statusChange === 'todo') return task.status === 'done' || task.status === 'in-progress';
          return task.status !== statusChange;
        });
        
        if (eligibleTasks.length === 0) {
          toast({
            title: "No Tasks Available",
            description: `No tasks available to move to ${statusChange}`,
            variant: "destructive",
          });
          return;
        }
        
        // If there's only one eligible task, use it
        if (eligibleTasks.length === 1) {
          targetTaskId = eligibleTasks[0].id;
        } else {
          // Multiple tasks available, show selection
          toast({
            title: "Select a Task",
            description: `Choose from: ${eligibleTasks.map(t => t.title).join(', ')}`,
          });
          return;
        }
      }

      // Update the specific task
      const response = await fetch(`/api/tasks/${targetTaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: statusChange })
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      toast({
        title: "Task Updated",
        description: `Task moved to ${statusChange}`,
      });

      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    }
  };

  const handleCreateTask = async (taskData: any) => {
    try {
      if (!projectId) {
        toast({
          title: "Error",
          description: "No project selected",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description || '',
          priority: taskData.priority || 'medium',
          status: 'pending'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      toast({
        title: "Task Created",
        description: `Created task: ${taskData.title}`,
      });

      // Invalidate and refetch tasks for the current project
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create task",
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

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => 
      value !== '' && value !== 'createdAt' && value !== 'desc'
    ).length;
  };

  return (
    <>
      {/* Toggle button when sidebar is closed */}
      {!isSidebarOpen && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSidebarOpen(true)}
            className="bg-white shadow-lg border-gray-300 hover:bg-gray-50 flex items-center gap-2 px-3 py-2"
          >
            <Filter className="h-4 w-4" />
            <span className="text-sm">Filters</span>
          </Button>
        </div>
      )}
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden bg-gray-50 border-l border-gray-200 flex flex-col h-full relative`}>
        {isSidebarOpen && (
          <>
            {/* Close button */}
            <div className="absolute top-4 right-4 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto flex flex-col">
                {/* Search */}
                <div className="p-4 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search tasks..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* AI Assistant Section (hidden on Todo when hideAssistant is true) */}
                {!hideAssistant && (
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
                                            onClick={() => handleTaskStatusChange(action.statusChange, action.taskId)}
                                            className="text-xs mr-2"
                                          >
                                            {action.label}
                                          </Button>
                                        ))}
                                      </div>
                                    )}
                                    {msg.newTask && (
                                      <div className="mt-2">
                                        <Button
                                          variant="default"
                                          size="sm"
                                          onClick={() => handleCreateTask(msg.newTask)}
                                          className="text-xs"
                                        >
                                          Create Task: {msg.newTask.title}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Ask AI about your tasks</Label>
                          <Textarea
                            placeholder="e.g., 'Show me high priority tasks', 'What tasks are overdue?', 'How can I organize better?'"
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
                              onClick={() => setLlmQuery("Show me high priority tasks that are overdue")}
                            >
                              Overdue High Priority
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLlmQuery("What tasks need my attention?")}
                            >
                              Need Attention
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLlmQuery("How can I organize my tasks better?")}
                            >
                              Organize Better
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Filters Section */}
                <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-4 h-auto border-b border-gray-200"
                    >
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        <span>Filters</span>
                        {getActiveFiltersCount() > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {getActiveFiltersCount()}
                          </Badge>
                        )}
                      </div>
                      {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-b border-gray-200">
                    <div className="p-4 space-y-4">
                      {/* Priority Filter */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Priority</Label>
                        <Select value={filters.priority || 'all'} onValueChange={(value) => handleFilterChange('priority', value === 'all' ? '' : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="All priorities" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All priorities</SelectItem>
                            {uniquePriorities.map(priority => (
                              <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Assignee Filter */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Assignee</Label>
                        <Select value={filters.assignee || 'all'} onValueChange={(value) => handleFilterChange('assignee', value === 'all' ? '' : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="All assignees" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All assignees</SelectItem>
                            {uniqueAssignees.map(assignee => (
                              <SelectItem key={assignee} value={assignee}>{assignee}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Status Filter */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Status</Label>
                        <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            {uniqueStatuses.map(status => (
                              <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Clear Filters */}
                      {getActiveFiltersCount() > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearFilters}
                          className="w-full"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Sort Section */}
                <div className="p-4 border-b border-gray-200">
                  <Label className="text-sm font-medium mb-3 block">Sort by</Label>
                  <div className="space-y-2">
                    {[
                      { key: 'createdAt', label: 'Created Date', icon: Calendar },
                      { key: 'priority', label: 'Priority', icon: Flag },
                      { key: 'title', label: 'Title', icon: SortAsc },
                      { key: 'dueDate', label: 'Due Date', icon: Calendar },
                    ].map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        variant={filters.sortBy === key ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleSortChange(key)}
                        className="w-full justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </div>
                        {filters.sortBy === key && (
                          filters.sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Task Stats */}
                <div className="p-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Task Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Tasks</span>
                        <span className="font-medium">{tasks.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Pending</span>
                        <span className="font-medium">{tasks.filter(t => t.status === 'pending').length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">In Progress</span>
                        <span className="font-medium">{tasks.filter(t => t.status === 'in-progress').length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Completed</span>
                        <span className="font-medium">{tasks.filter(t => t.status === 'completed').length}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

