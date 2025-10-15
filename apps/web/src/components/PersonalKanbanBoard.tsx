import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useIdentity } from '@/contexts/IdentityContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  pointerWithin,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import TaskModal from './TaskModal';
import type { Task } from '@email-task-router/shared';

interface ExtendedTask extends Task {
  assignees?: Array<{
    id: number;
    userId: string;
    assignedAt: Date;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      profileImageUrl: string | null;
    };
  }>;
  project?: {
    id: number;
    name: string;
  };
  projectName?: string;
  assignedByMe?: boolean;
}

interface TaskCardProps {
  task: ExtendedTask;
  onClick: (task: ExtendedTask) => void;
  onProjectClick?: (projectId: number) => void;
  enableDragAndDrop?: boolean;
  projectNames?: Record<string, string>;
  onNavigateToProject?: (projectId: string) => void;
}

// Column IDs as constants
const COLUMN_IDS = {
  MY_TASKS: 'my-tasks',
  FOLLOW_UP: 'follow-up',
  MONITOR: 'monitor',
  DONE: 'done'
} as const;

const PERSONAL_COLUMNS = [
  { id: COLUMN_IDS.MY_TASKS, title: 'My Tasks', description: 'Tasks assigned to me' },
  { id: COLUMN_IDS.FOLLOW_UP, title: 'Tasks Assigned to Others', description: 'Tasks I assigned to others' },
  { id: COLUMN_IDS.MONITOR, title: 'Tasks I\'m Monitoring', description: 'Tasks I\'m keeping track of' },
  { id: COLUMN_IDS.DONE, title: 'Done', description: 'Completed and deleted tasks' },
];

function TaskCard({ task, onClick, onProjectClick, enableDragAndDrop = true, projectNames = {}, onNavigateToProject }: TaskCardProps) {
  const [, setLocation] = useLocation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task: task
    },
    disabled: !enableDragAndDrop
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rawProjectId = task.project?.id ?? task.projectId ?? null;
  const projectKey =
    rawProjectId !== null && rawProjectId !== undefined ? rawProjectId.toString() : null;
  const projectIdNumber =
    rawProjectId !== null && rawProjectId !== undefined && !Number.isNaN(Number(rawProjectId))
      ? Number(rawProjectId)
      : null;
  const projectLabel =
    task.project?.name ??
    task.projectName ??
    (projectKey && projectNames[projectKey] ? projectNames[projectKey] : null) ??
    (projectKey ? `Project ${projectKey}` : null);

  const navigateToProject = (targetProjectKey: string) => {
    if (onNavigateToProject) {
      onNavigateToProject(targetProjectKey);
    } else {
      setLocation(`/todo?project=${targetProjectKey}`);
    }
  };

  const handleCardClick = () => {
    if (!enableDragAndDrop && projectKey) {
      // Navigate to task manager view for matching project
      navigateToProject(projectKey);
      return;
    }

    onClick(task);
  };

  const getPriorityColor = (priority: string) => {
    // Return empty string to use default text color
    return '';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0) return `In ${diffDays} days`;
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(enableDragAndDrop ? attributes : {})}
      {...(enableDragAndDrop ? listeners : {})}
      className={cn(
        "mb-3 cursor-pointer transition-all duration-200",
        isDragging && "opacity-50 rotate-2 scale-105",
        !enableDragAndDrop && "hover:scale-[1.02] hover:shadow-lg"
      )}
      onClick={handleCardClick}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="mb-2">
                <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
              </div>
              
              {task.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {task.description}
                </p>
              )}
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {projectKey && projectLabel && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToProject(projectKey);
                          if (projectIdNumber !== null) {
                            onProjectClick?.(projectIdNumber);
                          }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 underline hover:text-blue-800 font-medium bg-transparent border-none p-0 cursor-pointer"
                      >
                        {projectLabel}
                      </button>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                      task.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700'
                        : task.status === 'todo'
                        ? 'bg-purple-100 text-purple-700'
                        : task.status === 'done'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {task.status === 'in_progress' ? 'In Progress' : task.status === 'todo' ? 'Created' : task.status}
                    </span>
                  </div>
                  
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                    task.priority === 'high'
                      ? 'bg-red-100 text-red-700'
                      : task.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {task.priority}
                  </span>
                </div>
                
                {task.dueDate && (
                  <div className="text-xs text-muted-foreground">
                    Due: {formatDate(task.dueDate.toString())}
                  </div>
                )}
              </div>

              {task.assignees && task.assignees.length > 0 && (
                <div className="mt-2 flex -space-x-1">
                  {task.assignees.slice(0, 3).map((assignee) => (
                    <div
                      key={assignee.id}
                      className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center border-2 border-white"
                      title={assignee.user?.firstName || assignee.user?.email || 'Unknown'}
                    >
                      {(assignee.user?.firstName || assignee.user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {task.assignees.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center border-2 border-white">
                      +{task.assignees.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Droppable Column Component
interface DroppableColumnProps {
  column: { id: string; title: string; description: string };
  tasks: ExtendedTask[];
  onTaskClick: (task: ExtendedTask) => void;
  onProjectClick?: (projectId: number) => void;
  enableDragAndDrop?: boolean;
  projectNames?: Record<string, string>;
  onNavigateToProject?: (projectId: string) => void;
}

function DroppableColumn({ column, tasks, onTaskClick, onProjectClick, enableDragAndDrop = true, projectNames = {}, onNavigateToProject }: DroppableColumnProps) {
  // Only allow dropping on the "Done" column
  const isDroppable = column.id === COLUMN_IDS.DONE && enableDragAndDrop;

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      column: column,
    },
    disabled: !isDroppable, // Disable dropping for all columns except "Done"
  });

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {tasks.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{column.description}</p>
        </CardHeader>
        <CardContent 
          ref={setNodeRef}
          className={cn(
            "flex-1 pt-0 transition-all duration-200",
            isDroppable && isOver && "bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg",
            !isDroppable && "opacity-75" // Make non-droppable columns slightly dimmed
          )}
        >
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className={cn(
              "space-y-2 min-h-[200px] p-2 rounded-lg",
              isDroppable && isOver && "bg-blue-50/50"
            )}>
              {tasks.length === 0 ? (
                <div className={cn(
                  "text-center text-muted-foreground text-sm py-8 rounded-lg border-2 border-dashed bg-gray-50/50",
                  isDroppable ? "border-gray-200" : "border-gray-100"
                )}>
                  <p className="font-medium">No tasks</p>
                  {isDroppable && <p className="text-xs mt-1 opacity-75">Drop tasks here</p>}
                </div>
              ) : (
                tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    onProjectClick={onProjectClick}
                    enableDragAndDrop={enableDragAndDrop}
                    projectNames={projectNames}
                    onNavigateToProject={onNavigateToProject}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
}

interface PersonalKanbanBoardProps {
  onTaskSelect?: (task: ExtendedTask | null) => void;
  selectedProject?: string | null;
  selectedPriority?: string | null;
  selectedStatus?: string | null;
  selectedCategory?: string | null;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  enableDragAndDrop?: boolean; // New prop to control drag and drop
  projectNames?: Record<string, string>;
  onProjectNavigate?: (projectId: string) => void;
}

export default function PersonalKanbanBoard({
  onTaskSelect,
  selectedProject,
  selectedPriority,
  selectedStatus,
  selectedCategory,
  sortBy = "created",
  sortOrder = "desc",
  enableDragAndDrop = true, // Default to true for backward compatibility
  projectNames = {},
  onProjectNavigate
}: PersonalKanbanBoardProps) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { currentIdentity, isLoading: isIdentityLoading } = useIdentity();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ExtendedTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isTaskQueryEnabled = isAuthenticated && !isIdentityLoading;

  // Get user's assigned tasks
  const { data: assignedTasks = [], error: assignedError, isLoading: assignedLoading } = useQuery({
    queryKey: ['/api/tasks/assigned'],
    retry: false,
    enabled: isTaskQueryEnabled,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Get tasks assigned by user
  const { data: assignedByMeTasks = [], error: assignedByMeError, isLoading: assignedByMeLoading } = useQuery({
    queryKey: ['/api/tasks/assigned-by-me'],
    retry: false,
    enabled: isTaskQueryEnabled,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Get tasks user is monitoring (could be based on project participation or other criteria)
  const { data: monitorTasks = [], error: monitorError, isLoading: monitorLoading } = useQuery({
    queryKey: ['/api/tasks/monitor'],
    retry: false,
    enabled: isTaskQueryEnabled,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Get done tasks
  const { data: doneTasks = [], error: doneError, isLoading: doneLoading } = useQuery({
    queryKey: ['/api/tasks/done'],
    retry: false,
    enabled: isTaskQueryEnabled,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Update task status mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: Partial<ExtendedTask> }) => {
      console.log('🔄 Mutation starting - Task ID:', taskId, 'Updates:', updates);
      
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not ok:', errorText);
        throw new Error(`Failed to update task: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Update successful, result:', result);
      return result;
    },
    onSuccess: (data, variables) => {
      console.log('🎉 Mutation onSuccess - Data:', data, 'Variables:', variables);
      
      // Invalidate all task-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/assigned'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/assigned-by-me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/monitor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/done'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      
      // Force immediate refetch of all task queries
      setTimeout(() => {
        console.log('🔄 Refetching queries...');
        queryClient.refetchQueries({ queryKey: ['/api/tasks/assigned'] });
        queryClient.refetchQueries({ queryKey: ['/api/tasks/assigned-by-me'] });
        queryClient.refetchQueries({ queryKey: ['/api/tasks/monitor'] });
        queryClient.refetchQueries({ queryKey: ['/api/tasks/done'] });
      }, 100);
      
      // Don't show generic success toast since we show specific toast in drag handler
    },
    onError: (error, variables) => {
      console.error('❌ Error updating task:', error);
      console.error('   Variables:', variables);
      console.error('   Full error:', JSON.stringify(error, null, 2));
      toast({
        title: "Error",
        description: `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  // Listen for identity changes and invalidate queries
  useEffect(() => {
    const handleIdentityChange = () => {
      console.log('🔄 Identity changed, invalidating all task queries');
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/assigned'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/assigned-by-me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/monitor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/done'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    };

    window.addEventListener('identity-changed', handleIdentityChange);
    return () => window.removeEventListener('identity-changed', handleIdentityChange);
  }, [queryClient]);

  // Filter and sort tasks based on selected filters
  const filterAndSortTasks = (tasks: ExtendedTask[]): ExtendedTask[] => {
    // First apply filters
    const filtered = tasks.filter((task) => {
      // Project filter
      if (selectedProject && selectedProject !== "all") {
        const rawProjectId = task.project?.id ?? task.projectId;
        const projectKey =
          rawProjectId !== null && rawProjectId !== undefined ? rawProjectId.toString() : null;
        if (!projectKey || projectKey !== selectedProject) {
          return false;
        }
      }

      // Priority filter
      if (selectedPriority && selectedPriority !== "all") {
        if (task.priority !== selectedPriority) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus && selectedStatus !== "all") {
        if (task.status !== selectedStatus) {
          return false;
        }
      }

      // Category filter (placeholder for now)
      if (selectedCategory && selectedCategory !== "all") {
        // Add category filtering logic when categories are implemented
      }

      return true;
    });

    // Then apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case "created":
          aValue = a.createdAt ? new Date(a.createdAt) : new Date(0);
          bValue = b.createdAt ? new Date(b.createdAt) : new Date(0);
          break;
        case "updated":
          aValue = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
          bValue = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
          break;
        case "due":
          aValue = a.dueDate ? new Date(a.dueDate) : new Date(0);
          bValue = b.dueDate ? new Date(b.dueDate) : new Date(0);
          break;
        case "priority":
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        default:
          aValue = a.createdAt ? new Date(a.createdAt) : new Date(0);
          bValue = b.createdAt ? new Date(b.createdAt) : new Date(0);
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return sorted;
  };

  // Get all task IDs that appear in other columns to avoid duplicates
  const getAllTaskIds = (): Set<number> => {
    const allTasks = [
      ...(assignedTasks as ExtendedTask[]),
      ...(assignedByMeTasks as ExtendedTask[]),
      ...(monitorTasks as ExtendedTask[]),
      ...(doneTasks as ExtendedTask[])
    ];
    return new Set(allTasks.map(task => task.id));
  };

  // Organize tasks by column with smart deduplication
  const getTasksForColumn = (columnId: string): ExtendedTask[] => {
    let tasks: ExtendedTask[];

    switch (columnId) {
      case COLUMN_IDS.MY_TASKS:
        tasks = assignedTasks as ExtendedTask[];
        break;
      case COLUMN_IDS.FOLLOW_UP:
        tasks = assignedByMeTasks as ExtendedTask[];
        // Remove tasks that also appear in MY_TASKS (prioritize assigned to me)
        const myTaskIds = new Set((assignedTasks as ExtendedTask[]).map(t => t.id));
        tasks = tasks.filter(task => !myTaskIds.has(task.id));
        break;
      case COLUMN_IDS.MONITOR:
        tasks = monitorTasks as ExtendedTask[];
        // Remove tasks that appear in MY_TASKS or FOLLOW_UP
        const assignedIds = new Set([
          ...(assignedTasks as ExtendedTask[]).map(t => t.id),
          ...(assignedByMeTasks as ExtendedTask[]).map(t => t.id)
        ]);
        tasks = tasks.filter(task => !assignedIds.has(task.id));
        break;
      case COLUMN_IDS.DONE:
        tasks = doneTasks as ExtendedTask[];
        break;
      default:
        tasks = [];
    }

    // Additional deduplication within the column itself
    const uniqueTasks = tasks.filter((task, index, array) =>
      array.findIndex(t => t.id === task.id) === index
    );

    return filterAndSortTasks(uniqueTasks);
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!enableDragAndDrop) return;
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!enableDragAndDrop) return;

    const { active, over } = event;
    setActiveId(null);

    console.log('🎯 Personal Board DragEnd - Active:', active?.id, 'Over:', over?.id);
    console.log('   Active data:', active?.data?.current);
    console.log('   Over data:', over?.data?.current);

    if (!over) {
      console.log('❌ No drop target');
      return;
    }

    const activeTaskId = active.id as number;
    let targetColumnId: string | null = null;

    // Determine target column
    if (over.data?.current?.type === 'column') {
      targetColumnId = over.data.current.column.id;
      console.log('✅ Dropped on column:', targetColumnId);
    } else if (over.data?.current?.type === 'task') {
      // Find which column the target task is in
      for (const column of PERSONAL_COLUMNS) {
        const tasks = getTasksForColumn(column.id);
        if (tasks.find(t => t.id === over.id)) {
          targetColumnId = column.id;
          break;
        }
      }
      console.log('✅ Dropped on task in column:', targetColumnId);
    } else if (PERSONAL_COLUMNS.some(col => col.id === over.id)) {
      targetColumnId = over.id as string;
      console.log('✅ Dropped directly on column id:', targetColumnId);
    }

    // Only allow drops to the "Done" column
    if (targetColumnId !== COLUMN_IDS.DONE) {
      console.log('❌ Can only drop tasks to Done column');
      toast({
        title: "Invalid Move",
        description: "Tasks can only be moved to the Done column to mark them as completed.",
        variant: "destructive",
      });
      return;
    }

    // Find the task being dragged
    let draggedTask: ExtendedTask | undefined;
    let sourceColumn: string | undefined;

    for (const column of PERSONAL_COLUMNS) {
      const tasks = getTasksForColumn(column.id);
      const task = tasks.find(t => t.id === activeTaskId);
      if (task) {
        draggedTask = task;
        sourceColumn = column.id;
        break;
      }
    }

    if (!draggedTask || !sourceColumn) {
      console.log('❌ Task not found in source columns');
      return;
    }

    // Don't do anything if dropped on the same column
    if (sourceColumn === targetColumnId) {
      console.log('⏭️ Same column - no change needed');
      return;
    }

    console.log('📋 Task:', draggedTask.title, 'from', sourceColumn, 'to Done');

    // Mark task as completed (using 'done' status to match backend)
    console.log('✅ Marking task as completed - ID:', draggedTask.id, 'Current status:', draggedTask.status);
    updateTaskMutation.mutate({
      taskId: draggedTask.id,
      updates: { status: 'done' }
    });
    
    toast({
      title: "Task Completed",
      description: `"${draggedTask.title}" has been marked as completed`,
    });
  };

  const handleTaskClick = (task: ExtendedTask) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
    onTaskSelect?.(task);
  };

  const handleCloseModal = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleProjectClick = (projectId: number) => {
    if (onProjectNavigate) {
      onProjectNavigate(projectId.toString());
    } else {
      setLocation(`/todo?project=${projectId}`);
    }
  };

  // Handle errors
  if (assignedError || assignedByMeError || monitorError || doneError) {
    // Check if the error is due to no identity selected
    const errorMessage = (assignedError as any)?.message || '';
    const isIdentityError = errorMessage.includes('No identity selected');

    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4 text-2xl">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">
            {isIdentityError ? 'Identity Not Selected' : 'Error Loading Tasks'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {isIdentityError ? (
              <>Your session needs to be initialized. Please reload the page to set up your workspace.</>
            ) : (
              <>
                {assignedError && "Failed to load assigned tasks. "}
                {assignedByMeError && "Failed to load follow-up tasks. "}
                {monitorError && "Failed to load monitor tasks. "}
                {doneError && "Failed to load done tasks. "}
              </>
            )}
          </p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  // Handle loading
  if (isIdentityLoading || assignedLoading || assignedByMeLoading || monitorLoading || doneLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isIdentityLoading ? 'Initializing workspace...' : 'Loading your task board...'}
          </p>
        </div>
      </div>
    );
  }

  const renderColumns = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
      {PERSONAL_COLUMNS.map((column) => {
        const tasks = getTasksForColumn(column.id);

        return (
          <DroppableColumn
            key={column.id}
            column={column}
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onProjectClick={handleProjectClick}
            enableDragAndDrop={enableDragAndDrop}
            projectNames={projectNames}
            onNavigateToProject={onProjectNavigate}
          />
        );
      })}
    </div>
  );

  return (
    <div className="h-full">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-foreground mb-2">Task Board</h2>
        <p className="text-muted-foreground">Personal task management across all projects</p>
      </div>

      {enableDragAndDrop ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {renderColumns()}
        </DndContext>
      ) : (
        renderColumns()
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={handleCloseModal}
        task={selectedTask}
      />

    </div>
  );
}
