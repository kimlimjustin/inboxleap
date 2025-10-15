import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, MoreHorizontal, Clock, User, ListTodo, GripVertical, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import TaskModal from "./TaskModal";
import KanbanFilters, { FilterState } from "./KanbanFilters";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  closestCorners,
  useDroppable,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useCopilotContext } from "@/contexts/CopilotContext";

interface KanbanBoardProps {
  selectedProject?: any;
  highlightedTaskId?: number | null;
  // Allow hiding the AI Assistant section in KanbanFilters (used by Todo)
  hideAssistant?: boolean;
  // Callback for task clicks
  onTaskClick?: (task: any) => void;
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
    case 'todo':
    case 'backlog':
      return 'bg-blue-50 border-blue-200 text-blue-800';
    case 'in-progress':
    case 'in progress':
    case 'ongoing':
    case 'active':
    case 'working':
      return 'bg-orange-50 border-orange-200 text-orange-800';
    case 'completed':
    case 'done':
    case 'finished':
      return 'bg-green-50 border-green-200 text-green-800';
    case 'blocked':
    case 'waiting':
      return 'bg-red-50 border-red-200 text-red-800';
    case 'review':
    case 'testing':
      return 'bg-purple-50 border-purple-200 text-purple-800';
    default:
      return 'bg-gray-50 border-gray-200 text-gray-800';
  }
};

// Default columns that will always be shown
const DEFAULT_COLUMNS = [
  { id: 'pending', title: 'Pending', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { id: 'ongoing', title: 'Ongoing', color: 'bg-orange-50 border-orange-200 text-orange-800' },
  { id: 'done', title: 'Done', color: 'bg-green-50 border-green-200 text-green-800' },
];

export default function KanbanBoard({ selectedProject, highlightedTaskId, hideAssistant, onTaskClick }: KanbanBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    priority: '',
    assignee: '',
    dueDate: '',
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const { updateContext } = useCopilotContext();
  const lastContextSigRef = useRef<string>('');


  // Set up drag sensors with better activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/projects', selectedProject?.id, 'tasks'],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const response = await fetch(`/api/projects/${selectedProject.id}/tasks`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      return response.json();
    },
    enabled: !!selectedProject,
    retry: false,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling in background
  });

  // Handle authentication errors
  useEffect(() => {
    // This will be handled by the global error handler
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log('🔌 Connecting to WebSocket for real-time updates...');
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected for real-time Kanban updates');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📡 Received WebSocket message:', message);
        
        if (message.type === 'tasks_created' || 
            message.type === 'reply_processed' || 
            message.type === 'task_update') {
          // Invalidate tasks query to refetch latest data
          queryClient.invalidateQueries({ queryKey: ["tasks", selectedProject?.id] });
          
          toast({
            title: "Tasks Updated",
            description: message.type === 'tasks_created' 
              ? "New tasks have been created from your email"
              : "Tasks have been updated from your reply",
            duration: 3000,
          });
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket connection closed');
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
    
    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [queryClient, selectedProject?.id, toast]);

  // Map task statuses to default columns
  const mapTaskStatusToColumn = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'todo':
      case 'backlog':
        return 'pending';
      case 'in-progress':
      case 'in progress':
      case 'ongoing':
      case 'active':
      case 'working':
        return 'ongoing';
      case 'completed':
      case 'done':
      case 'finished':
        return 'done';
      case 'blocked':
      case 'waiting':
      case 'review':
      case 'testing':
        // For now, map these to ongoing, but you can extend columns later
        return 'ongoing';
      default:
        return 'pending';
    }
  };

  // Map column to task status
  const mapColumnToTaskStatus = (columnId: string) => {
    switch (columnId) {
      case 'pending':
        return 'pending';
      case 'ongoing':
        return 'in-progress';
      case 'done':
        return 'completed';
      default:
        return 'pending';
    }
  };

  // Get all tasks and categorize them by mapped columns
  const taskList = tasks as any[];
  
  // Apply filters and sorting
  const filteredTasks = taskList.filter(task => {
    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const matchesSearch = task.title.toLowerCase().includes(searchTerm) ||
                          task.description?.toLowerCase().includes(searchTerm) ||
                          task.sourceEmail?.toLowerCase().includes(searchTerm);
      if (!matchesSearch) return false;
    }
    
    // Priority filter
    if (filters.priority && task.priority !== filters.priority) return false;
    
    // Assignee filter
    if (filters.assignee) {
      const hasAssignee = task.assignees?.some((a: any) => a.user?.email === filters.assignee);
      if (!hasAssignee) return false;
    }
    
    // Status filter
    if (filters.status && task.status !== filters.status) return false;
    
    return true;
  }).sort((a, b) => {
    const { sortBy, sortOrder } = filters;
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'priority':
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 } as any;
        aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
        bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
        break;
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'dueDate':
        aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        break;
      case 'createdAt':
      default:
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
  
  const tasksByColumn = DEFAULT_COLUMNS.reduce((acc, column) => {
    acc[column.id] = filteredTasks.filter(task => mapTaskStatusToColumn(task.status) === column.id);
    return acc;
  }, {} as Record<string, any[]>);

  // Push minimal, stable context into Copilot for Todo
  const minimalTasksForContext = useMemo(() => {
    return filteredTasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      updatedAt: t.updatedAt,
      dueDate: t.dueDate,
    }));
  }, [filteredTasks]);

  useEffect(() => {
    if (!selectedProject) return;
    const sig = JSON.stringify({
      projectId: selectedProject?.id,
      taskSig: minimalTasksForContext.map(t => `${t.id}-${t.status}-${t.priority}-${t.updatedAt || ''}`).join('|'),
    });
    if (sig === lastContextSigRef.current) return;
    lastContextSigRef.current = sig;

    updateContext({
      type: 'todo',
      selectedProject: {
        id: selectedProject.id,
        name: selectedProject.name,
        topic: selectedProject.topic,
        createdAt: selectedProject.createdAt,
        sourceEmailSubject: selectedProject.sourceEmailSubject,
        emailCount: selectedProject.emailCount,
      },
      tasks: minimalTasksForContext,
    } as any);
  }, [selectedProject?.id, selectedProject?.name, selectedProject?.topic, selectedProject?.createdAt, selectedProject?.sourceEmailSubject, selectedProject?.emailCount, minimalTasksForContext, updateContext]);

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: any }) => {
      const response = await apiRequest('PATCH', `/api/tasks/${taskId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject?.id, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/assigned'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const response = await fetch(`/api/projects/${selectedProject.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(taskData),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create task: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject?.id, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/assigned'] });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
      // Open the task modal to edit the newly created task
      setSelectedTask(newTask);
      setIsTaskModalOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateTaskMutation.mutate({ taskId, updates: { status: newStatus } });
  };

  const handleCreateTask = () => {
    if (!selectedProject) {
      toast({
        title: "Error",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    const newTaskData = {
      title: 'New Task',
      description: 'Task description',
      status: 'pending',
      priority: 'medium',
      assignToMe: selectedProject.type === 'individual', // Auto-assign for individual projects
      // projectId is set by the server from URL params
      // createdBy is set by the server from authentication
    };

    createTaskMutation.mutate(newTaskData);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    console.log('🎯 DragEnd - Active:', active?.id, 'Over:', over?.id);
    console.log('   Active data:', active?.data?.current);
    console.log('   Over data:', over?.data?.current);

    if (!over) {
      console.log('❌ No drop target');
      return;
    }

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Find the dragged task
    const activeTask = filteredTasks.find(task => task.id.toString() === activeTaskId);
    if (!activeTask) {
      console.log('❌ Active task not found');
      return;
    }

    // Determine the target column
    let targetColumnId = null;

    // Check if dropped on a column droppable
    if (over.data?.current?.type === 'column') {
      targetColumnId = over.data.current.column.id;
      console.log('✅ Dropped on column:', targetColumnId);
    }
    // Check if dropped on another task
    else if (over.data?.current?.type === 'task') {
      targetColumnId = over.data.current.column;
      console.log('✅ Dropped on task in column:', targetColumnId);
    }
    // Fallback: check if over id matches a column id
    else if (DEFAULT_COLUMNS.some(col => col.id === overId)) {
      targetColumnId = overId;
      console.log('✅ Dropped directly on column id:', targetColumnId);
    }

    if (!targetColumnId) {
      console.log('❌ Could not determine target column');
      return;
    }

    // Check if we're moving to a different column
    const currentColumnId = mapTaskStatusToColumn(activeTask.status);
    if (currentColumnId === targetColumnId) {
      console.log('⏭️ Same column - no change needed');
      return;
    }

    // Update the task status
    const newStatus = mapColumnToTaskStatus(targetColumnId);
    console.log('🔄 Updating task:', activeTask.title, 'from', activeTask.status, 'to', newStatus);

    handleStatusChange(activeTask.id, newStatus);

    // Force immediate refetch to update UI
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject?.id, 'tasks'] });
      refetch();
    }, 100);

    // Show success toast
    const targetColumn = DEFAULT_COLUMNS.find(col => col.id === targetColumnId);
    toast({
      title: "Task Moved",
      description: `"${activeTask.title}" moved to ${targetColumn?.title}`,
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Simple drag over handling - just for visual feedback
    // The actual logic is handled in handleDragEnd
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-300';
      case 'medium': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'low': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Droppable Column Component
    interface DroppableColumnProps {
    column: any;
    tasks: any[];
    onTaskClick: (task: any) => void;
    getPriorityColor: (priority: string) => string;
    formatDate: (dateString: string) => string | null;
    highlightedTaskId?: number | null;
  }

  function DroppableColumn({ column, tasks, onTaskClick, getPriorityColor, formatDate, highlightedTaskId }: DroppableColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
      id: column.id,
      data: {
        type: 'column',
        column: column,
      },
    });

    return (
      <Card 
        className={cn(
          "flex flex-col h-full transition-all duration-200 shadow-lg border", 
          column.color,
          isOver && "ring-2 ring-blue-400 ring-opacity-75 scale-[1.02] shadow-xl"
        )}
        style={{ height: 'calc(100vh - 300px)' }}
      >
        <CardHeader className="pb-3 flex-shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
          <CardTitle className="flex items-center justify-between">
            <span className="text-lg font-semibold">{column.title}</span>
            <Badge variant="secondary" className="text-xs bg-white border shadow-sm">
              {tasks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent 
          ref={setNodeRef}
          className={cn(
            "flex-1 overflow-y-auto p-2 transition-all duration-200",
            isOver && "bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg"
          )}
        >
          <SortableContext 
            items={tasks.map(task => task.id.toString())}
            strategy={rectSortingStrategy}
          >
            <div className={cn(
              "space-y-3 min-h-full p-2 rounded-lg",
              tasks.length === 0 && "min-h-[400px]"
            )}>
              {tasks.length === 0 ? (
                <div className="text-center py-16 text-gray-500 min-h-[300px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-gray-50/50">
                  <p className="text-sm font-medium">No tasks</p>
                  <p className="text-xs mt-1 opacity-75">Drop tasks here to change status</p>
                </div>
              ) : (
                tasks.map((task: any) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onTaskClick={onTaskClick}
                    getPriorityColor={getPriorityColor}
                    formatDate={formatDate}
                    isHighlighted={highlightedTaskId === task.id}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </CardContent>
      </Card>
    );
  }

  // Draggable Task Card Component
  interface TaskCardProps {
    task: any;
    onTaskClick: (task: any) => void;
    getPriorityColor: (priority: string) => string;
    formatDate: (dateString: string) => string | null;
    isHighlighted?: boolean;
  }

  function TaskCard({ task, onTaskClick, getPriorityColor, formatDate, isHighlighted }: TaskCardProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: task.id.toString(),
      data: {
        type: 'task',
        task: task,
        status: task.status,
        column: mapTaskStatusToColumn(task.status),
      },
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 1000 : 1,
    } as any;

    return (
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "bg-gradient-to-br from-white via-gray-50/30 to-white border shadow-sm hover:shadow-lg transition-all cursor-pointer group",
          isDragging && "opacity-75 rotate-1 scale-105 shadow-xl bg-gradient-to-br from-blue-50 to-purple-50",
          isHighlighted && "ring-2 ring-blue-500 ring-offset-2 bg-gradient-to-br from-blue-50 to-blue-100 animate-pulse shadow-lg"
        )}
        onClick={() => onTaskClick(task)}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <h4 className="font-medium text-gray-900 line-clamp-2 flex-1 mr-2">
                {task.title}
              </h4>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div
                  className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gradient-to-r hover:from-blue-100 hover:to-purple-100 opacity-60 group-hover:opacity-100 transition-all duration-200"
                  {...listeners}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to move task"
                >
                  <GripVertical className="h-4 w-4 text-gray-500" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskClick(task);
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {task.description && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {task.description}
              </p>
            )}
            
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className={cn("text-xs shadow-sm border", getPriorityColor(task.priority))}
              >
                {task.priority}
              </Badge>
              
              {task.dueDate && (
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDate(task.dueDate)}
                </div>
              )}
            </div>
            
            {task.sourceEmail && (
              <div className="flex items-center text-xs text-gray-500">
                <User className="h-3 w-3 mr-1" />
                <span className="truncate">{task.sourceEmail}</span>
              </div>
            )}
            
            {task.assignees && task.assignees.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {task.assignees.slice(0, 3).map((assignee: any) => (
                    <Avatar key={assignee.id} className="h-6 w-6 border-2 border-white">
                      <AvatarImage src={assignee.user.profileImageUrl || ""} alt={assignee.user.email} />
                      <AvatarFallback className="text-xs bg-blue-500 text-white">
                        {assignee.user.firstName?.[0] || assignee.user.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {task.assignees.length > 3 && (
                    <div className="h-6 w-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center">
                      <span className="text-xs text-gray-600">+{task.assignees.length - 3}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {task.assignees.map((assignee: any, index: number) => (
                    <span key={assignee.id}>
                      {assignee.user.firstName || assignee.user.email.split('@')[0]}
                      {index < task.assignees.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 text-gray-300">
            <svg fill="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Project</h3>
          <p className="text-gray-500 mb-6">Choose a project from the sidebar to view and manage its tasks</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              💡 <strong>Quick tip:</strong> Send an email to create tasks automatically
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="mb-6">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-300 rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...Array(2)].map((_, j) => (
                    <div key={j} className="h-32 bg-gray-300 rounded"></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{selectedProject.name}</h2>
            <p className="text-gray-500 capitalize">{selectedProject.type} Project</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button 
              onClick={handleCreateTask}
              disabled={!selectedProject || createTaskMutation.isPending}
            >
              {createTaskMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {taskList.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="mb-4">
              <ListTodo className="h-16 w-16 text-gray-300 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
            <p className="text-gray-500 mb-4">Send an email to create your first task automatically</p>
            <div className="space-y-2 text-sm text-gray-400">
              <p>📧 Send emails to create tasks</p>
              <p>🤖 AI will extract tasks and organize them for you</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                {DEFAULT_COLUMNS.map((column) => {
                  const columnTasks = tasksByColumn[column.id] || [];
                  
                  return (
                    <DroppableColumn
                      key={column.id}
                      column={column}
                      tasks={columnTasks}
                      onTaskClick={handleTaskClick}
                      getPriorityColor={getPriorityColor}
                      formatDate={formatDate}
                      highlightedTaskId={highlightedTaskId}
                    />
                  );
                })}
              </div>
              <DragOverlay>
                {activeId ? (() => {
                  const draggedTask = filteredTasks.find(task => task.id.toString() === activeId);
                  return draggedTask ? (
                    <TaskCard
                      task={draggedTask}
                      onTaskClick={() => {}}
                      getPriorityColor={getPriorityColor}
                      formatDate={formatDate}
                    />
                  ) : null;
                })() : null}
              </DragOverlay>
            </DndContext>
          </div>
          <KanbanFilters
            tasks={taskList}
            onFiltersChange={setFilters}
            onTasksReorder={() => {}}
            showAssistantHistory={true}
            projectId={selectedProject?.id}
            // Pass through prop to hide AI Assistant when desired (e.g., in Todo)
            hideAssistant={!!hideAssistant}
          />
        </div>
      )}

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={handleCloseModal}
        task={selectedTask}
      />
    </div>
  );
}
