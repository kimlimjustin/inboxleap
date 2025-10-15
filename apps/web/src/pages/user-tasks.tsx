import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Clock, CheckCircle2, AlertTriangle, Circle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: string;
  dueDate: string | null;
  sourceEmail: string | null;
  sourceEmailSubject: string | null;
  projectId: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: number;
  name: string;
  type: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface TaskAssignee {
  id: number;
  taskId: number;
  userId: string;
  assignedAt: string;
  user: User;
}

interface TaskWithDetails extends Task {
  project: Project;
  assignees: TaskAssignee[];
}

const priorityColors = {
  low: "bg-green-100 text-green-800 hover:bg-green-200",
  medium: "bg-orange-100 text-orange-800 hover:bg-orange-200",
  high: "bg-red-100 text-red-800 hover:bg-red-200",
};

const statusIcons = {
  pending: Circle,
  'in-progress': Clock,
  completed: CheckCircle2,
  blocked: AlertTriangle,
};

export default function UserTasks() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("updatedAt");

  // Get user assigned tasks (includes assignee info and project details)
  const { data: tasks = [], error: tasksError, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['/api/tasks/assigned'],
    retry: false,
    enabled: isAuthenticated,
  });

  // Get projects to map task project names (not needed since tasks/assigned includes project info)
  // const { data: projects = [] } = useQuery({
  //   queryKey: ['/api/projects'],
  //   retry: false,
  //   enabled: isAuthenticated,
  // });

  // Handle authentication errors
  useEffect(() => {
    if (tasksError && isUnauthorizedError(tasksError as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [tasksError, toast]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Cast tasks data to the correct type
  const tasksWithDetails = tasks as TaskWithDetails[];

  // Filter and sort tasks
  const filteredTasks = tasksWithDetails
    .filter((task: TaskWithDetails) => {
      if (filter === "all") return true;
      if (filter === "pending") return task.status === "pending";
      if (filter === "in-progress") return task.status === "in-progress";
      if (filter === "completed") return task.status === "completed";
      if (filter === "high-priority") return task.priority === "high";
      return true;
    })
    .sort((a: TaskWithDetails, b: TaskWithDetails) => {
      if (sortBy === "priority") {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      if (sortBy === "dueDate") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "updatedAt") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return 0;
    });

  const handleTaskUpdate = async (taskId: number, updates: Partial<TaskWithDetails>) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/tasks/assigned'] });
        toast({
          title: "Task Updated",
          description: "Task has been updated successfully",
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const handleViewInProject = (task: TaskWithDetails) => {
    // Navigate to the project page and pass the task ID as a URL parameter to highlight it
    console.log('Navigating to project:', task.projectId, 'with task:', task.id);
    setLocation(`/project/${task.projectId}?highlightTask=${task.id}`);
  };

  if (isLoading || isLoadingTasks) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Tasks</h1>
          <p className="text-muted-foreground">View and manage all tasks assigned to you</p>
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All Tasks
            </Button>
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
            >
              Pending
            </Button>
            <Button
              variant={filter === "in-progress" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("in-progress")}
            >
              In Progress
            </Button>
            <Button
              variant={filter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("completed")}
            >
              Completed
            </Button>
            <Button
              variant={filter === "high-priority" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("high-priority")}
            >
              High Priority
            </Button>
          </div>

          <div className="flex gap-2 ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="updatedAt">Recently Updated</option>
              <option value="priority">Priority</option>
              <option value="dueDate">Due Date</option>
            </select>
          </div>
        </div>

        {/* Task Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {tasksWithDetails.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Tasks</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                {tasksWithDetails.filter((t: TaskWithDetails) => t.status === 'pending').length}
              </div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                {tasksWithDetails.filter((t: TaskWithDetails) => t.status === 'in-progress').length}
              </div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {tasksWithDetails.filter((t: TaskWithDetails) => t.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground">
                  {filter === "all" 
                    ? "No tasks assigned to you yet. Tasks will appear here when they are specifically assigned to you."
                    : `No ${filter} tasks found`}
                </div>
                {filter === "all" && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Tip: Tasks created in individual projects are automatically assigned to you.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredTasks.map((task: TaskWithDetails) => {
              const StatusIcon = statusIcons[task.status as keyof typeof statusIcons] || Circle;
              
              return (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusIcon className="h-4 w-4" />
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                          <Badge className={priorityColors[task.priority]}>
                            {task.priority}
                          </Badge>
                        </div>
                        {task.description && (
                          <CardDescription className="text-sm">
                            {task.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewInProject(task)}
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View in Project
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTaskUpdate(task.id, { 
                            status: task.status === 'completed' ? 'pending' : 'completed' 
                          })}
                        >
                          {task.status === 'completed' ? 'Mark Pending' : 'Mark Complete'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>Project: {task.project?.name || 'Unknown'}</span>
                      </div>
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>Updated: {format(new Date(task.updatedAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    
                    {/* Assignees */}
                    {task.assignees && task.assignees.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Assigned to:</div>
                        <div className="flex flex-wrap gap-1">
                          {task.assignees.map((assignee: TaskAssignee) => (
                            <Badge key={assignee.id} variant="secondary" className="text-xs">
                              {assignee.user.firstName && assignee.user.lastName
                                ? `${assignee.user.firstName} ${assignee.user.lastName}`
                                : assignee.user.email
                              }
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {task.sourceEmail && (
                      <div className="mt-3 p-2 bg-muted rounded text-xs">
                        <div className="font-medium">From Email:</div>
                        <div className="text-muted-foreground">
                          {task.sourceEmailSubject || task.sourceEmail}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
