import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, User, Users, MoreHorizontal } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import TaskItem from "./TaskItem";
import { useEffect } from "react";
import type { Project, Task } from "@email-task-router/shared";

interface ProjectListProps {
  onTaskClick: (task: Task) => void;
}

export default function ProjectList({ onTaskClick }: ProjectListProps) {
  const { toast } = useToast();
  
  const { data: projects = [], isLoading, error } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    retry: false,
  });

  // Handle errors in useEffect for React Query v5
  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    retry: false,
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-300 rounded w-32"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-300 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <p className="text-red-600">Failed to load projects</p>
        </CardContent>
      </Card>
    );
  }

  // Group tasks by project
  const tasksByProject = tasks.reduce((acc: Record<number, Task[]>, task) => {
    if (!acc[task.projectId]) {
      acc[task.projectId] = [];
    }
    acc[task.projectId].push(task);
    return acc;
  }, {});

  return (
    <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
          <div className="flex items-center space-x-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1" />
              New Project
            </Button>
            <select className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
              <option>All Projects</option>
              <option>Individual</option>
              <option>Team</option>
            </select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-6">
          {projects.map((project) => {
            const projectTasks = tasksByProject[project.id] || [];
            const isIndividual = project.type === 'individual';
            
            return (
              <div key={project.id} className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    {isIndividual ? (
                      <User className="h-5 w-5 text-gray-400 mr-2" />
                    ) : (
                      <Users className="h-5 w-5 text-gray-400 mr-2" />
                    )}
                    <h3 className="text-md font-medium text-gray-900">{project.name}</h3>
                    <Badge 
                      variant={isIndividual ? "secondary" : "default"}
                      className="ml-2"
                    >
                      {isIndividual ? "Individual" : "Team"}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {projectTasks.length} tasks
                    </span>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {projectTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No tasks yet</p>
                      <p className="text-sm">Tasks will appear here when created from emails</p>
                    </div>
                  ) : (
                    projectTasks.map((task: any) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        isTeamProject={!isIndividual}
                        onClick={() => onTaskClick(task)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
          
          {(projects as Project[]).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No projects yet</p>
              <p className="text-sm">Projects will be created automatically when you receive emails</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
