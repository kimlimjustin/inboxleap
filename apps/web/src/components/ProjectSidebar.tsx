import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Users, User, ChevronRight, Trash2, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import type { Project, Task } from "@email-task-router/shared";

interface ProjectSidebarProps {
  selectedProject: Project | null;
  onProjectSelect: (project: Project | null) => void;
  onTaskCreate?: (task: Task) => void;
}

export default function ProjectSidebar({ selectedProject, onProjectSelect, onTaskCreate }: ProjectSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    retry: false,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    retry: false,
  });

  const { data: projectParticipants = [] } = useQuery<any[]>({
    queryKey: ['/api/project-participants'],
    retry: false,
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete project');
      }
      return response.json();
    },
    onSuccess: (data, deletedProjectId) => {
      // If the deleted project was selected, clear the selection
      if (selectedProject?.id === deletedProjectId) {
        onProjectSelect(null);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleProjectExpansion = (projectId: number) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const getProjectTasks = (projectId: number) => {
    return (tasks as any[]).filter((task: any) => task.projectId === projectId);
  };

  const getProjectParticipants = (projectId: number) => {
    return (projectParticipants as any[]).filter((participant: any) => participant.projectId === projectId);
  };

  const getTaskCountByStatus = (projectId: number) => {
    const projectTasks = getProjectTasks(projectId);
    const statuses = Array.from(new Set(projectTasks.map((task: any) => task.status)));
    
    return statuses.reduce((acc: any, status: string) => {
      acc[status] = projectTasks.filter((task: any) => task.status === status).length;
      return acc;
    }, {});
  };

  const handleDeleteProject = (projectId: number) => {
    deleteProjectMutation.mutate(projectId);
  };

  const handleCreateTask = async () => {
    if (!selectedProject) {
      toast({
        title: "Error",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: 'New Task',
          description: 'Task description',
          status: 'pending',
          priority: 'medium',
        }),
      });
      
      if (response.ok) {
        const newTask = await response.json();
        queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject.id, 'tasks'] });
        if (onTaskCreate) {
          onTaskCreate(newTask);
        }
        toast({
          title: "Success",
          description: "New task created successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="w-80 h-full bg-gradient-to-br from-white via-gray-50/30 to-white border border-gray-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="h-6 bg-gradient-to-r from-gray-300 to-gray-400 rounded w-24 animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80 h-full flex flex-col bg-gradient-to-br from-white via-gray-50/30 to-white border border-gray-200 shadow-lg">
      <CardHeader className="flex-shrink-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white">
        <CardTitle className="flex items-center justify-between text-white font-semibold">
          <span>Projects</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-2">
            {(projects as any[]).length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <p className="text-sm font-medium">No projects yet</p>
                <p className="text-xs text-gray-500">Projects will appear here when created from emails</p>
              </div>
            ) : (
              (projects as any[])
                .filter((project: any) => !project.name.startsWith('[DELETED]'))
                .map((project: any) => {
                const isSelected = selectedProject?.id === project.id;
                const isExpanded = expandedProjects.has(project.id);
                const projectTasks = getProjectTasks(project.id);
                const participants = getProjectParticipants(project.id);
                const taskCounts = getTaskCountByStatus(project.id);
                const isTeamProject = project.type === 'team';
                const canDelete = true; // Allow deletion of all projects including Personal Tasks

                return (
                  <div key={project.id} className="space-y-2">
                    <div
                      className={cn(
                        "flex flex-col p-3 rounded-lg cursor-pointer transition-all duration-200 group shadow-sm",
                        isSelected
                          ? "bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-300 border shadow-md"
                          : "bg-gradient-to-br from-white to-gray-50/30 hover:from-gray-50 hover:to-gray-100/50 border border-gray-200 hover:shadow-md"
                      )}
                    >
                      <div 
                        className="flex items-center space-x-3 flex-1 mb-2"
                        onClick={() => onProjectSelect(project)}
                      >
                        <div className="flex-shrink-0">
                          {isTeamProject ? (
                            <Users className="h-5 w-5 text-blue-600" />
                          ) : (
                            <User className="h-5 w-5 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 break-words">
                            {project.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {projectTasks.length} tasks
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant={isTeamProject ? "default" : "secondary"}
                          className={cn(
                            "text-xs shadow-sm",
                            isTeamProject 
                              ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white" 
                              : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300"
                          )}
                        >
                          {isTeamProject ? "Team" : "Personal"}
                        </Badge>
                        <div className="flex items-center space-x-1">
                        <div className="flex items-center space-x-1">
                          {canDelete && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem 
                                      className="text-red-600 focus:text-red-600"
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Project
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-gradient-to-br from-white via-gray-50/30 to-white border border-gray-200 shadow-xl">
                                    <AlertDialogHeader className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white p-6 -m-6 mb-6 rounded-t-lg">
                                      <AlertDialogTitle className="text-white font-semibold">Delete Project</AlertDialogTitle>
                                      <AlertDialogDescription className="text-white/90">
                                        Are you sure you want to delete "{project.name}"? This action cannot be undone and will remove all tasks in this project.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    {project.name === 'Personal Tasks' && project.type === 'individual' && (
                                      <div className="mb-4 p-3 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-300 rounded-lg text-orange-900 text-sm shadow-sm">
                                        <span className="font-semibold">⚠️ Warning:</span> This is your default Personal Tasks project. A new one will be created automatically when you receive new emails.
                                      </div>
                                    )}
                                    <AlertDialogFooter className="border-t border-gray-200 pt-4">
                                      <AlertDialogCancel className="border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteProject(project.id)}
                                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 font-medium shadow-sm"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          {isTeamProject && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectExpansion(project.id);
                              }}
                            >
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  isExpanded && "rotate-90"
                                )}
                              />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && isTeamProject && (
                      <div className="ml-8 space-y-3 p-3 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-700">Task Progress</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {Object.entries(taskCounts).slice(0, 3).map(([status, count]) => (
                            <div key={status} className="text-center">
                              <div className="font-medium">{count as number}</div>
                              <div className="text-gray-500 capitalize">
                                {status.replace('-', ' ')}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {participants.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Team Members</h4>
                              <div className="space-y-2">
                                {participants.slice(0, 3).map((participant: any) => (
                                  <div key={participant.id} className="flex items-center space-x-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={participant.profileImageUrl} />
                                      <AvatarFallback className="text-xs">
                                        {participant.firstName?.[0] || participant.userId[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm text-gray-600 truncate">
                                      {participant.firstName || participant.userId}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {participant.role}
                                    </Badge>
                                  </div>
                                ))}
                                {participants.length > 3 && (
                                  <div className="text-xs text-gray-500">
                                    +{participants.length - 3} more
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}