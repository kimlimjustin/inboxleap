import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KanbanSquare, Users, Filter, SortAsc, SortDesc, X } from "lucide-react";
import PersonalKanbanBoard from "@/components/PersonalKanbanBoard";
import TodoAgentPage from "./agents/todo";
import type { Project } from "@email-task-router/shared";

const getProjectIdFromLocation = (location: string): string | null => {
  let search = '';

  if (location.includes('?')) {
    search = location.split('?')[1] ?? '';
  } else if (typeof window !== 'undefined') {
    search = window.location.search.slice(1);
  }

  if (!search) {
    return null;
  }

  const urlParams = new URLSearchParams(search);
  return urlParams.get('project');
};

interface TaskBoardContentProps {
  onProjectNavigate: (projectId: string) => void;
}

// TaskBoardContent component - simplified version without authentication redirects
function TaskBoardContent({ onProjectNavigate }: TaskBoardContentProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Filter and sort state
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Get projects for filter dropdown
  const { data: projectsResponse } = useQuery({
    queryKey: ['/api/projects'],
    enabled: isAuthenticated,
  });

  // Extract projects array from API response
  const projects: Project[] = (projectsResponse as any)?.projects || [];

  const projectNames = useMemo(() => {
    const map: Record<string, string> = {};

    for (const project of projects) {
      if (!project) continue;
      const projectId = project.id;
      if (projectId !== undefined && projectId !== null) {
        const label =
          project.name ??
          (project as any)?.title ??
          (project as any)?.projectName ??
          (project as any)?.displayName ??
          (project as any)?.topic ??
          null;

        map[projectId.toString()] = label ?? `Project ${projectId}`;
      }
    }

    return map;
  }, [projects]);

  if (isLoading) {
    return (
      <div className="h-full bg-background flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your task board...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full bg-background flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to view your tasks.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter and Sort Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:space-x-4 lg:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            {/* Project Filter */}
            <div className="flex flex-col space-y-1 lg:space-y-0">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project: Project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="flex flex-col space-y-1 lg:space-y-0">
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger className="w-full lg:w-32">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col space-y-1 lg:space-y-0">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full lg:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 lg:ml-auto">
              <span className="text-sm font-medium">Sort:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full lg:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Created Date</SelectItem>
                  <SelectItem value="updated">Updated Date</SelectItem>
                  <SelectItem value="due">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="px-2"
              >
                {sortOrder === "asc" ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Clear Filters */}
            {(selectedProject !== "all" || selectedPriority !== "all" || selectedStatus !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedProject("all");
                  setSelectedPriority("all");
                  setSelectedStatus("all");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>

          {/* Active Filters Display */}
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedProject !== "all" && (
              <Badge variant="secondary" className="text-xs">
                Project: {projects.find((p: Project) => p.id.toString() === selectedProject)?.name || selectedProject}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedProject("all")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {selectedPriority !== "all" && (
              <Badge variant="secondary" className="text-xs">
                Priority: {selectedPriority}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedPriority("all")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {selectedStatus !== "all" && (
              <Badge variant="secondary" className="text-xs">
                Status: {selectedStatus}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedStatus("all")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <PersonalKanbanBoard
        selectedProject={selectedProject === "all" ? null : selectedProject}
        selectedPriority={selectedPriority === "all" ? null : selectedPriority}
        selectedStatus={selectedStatus === "all" ? null : selectedStatus}
        sortBy={sortBy}
        sortOrder={sortOrder}
        enableDragAndDrop={false}
        projectNames={projectNames}
        onProjectNavigate={onProjectNavigate}
      />
    </div>
  );
}

export default function TodoPage() {
  const [location, setLocation] = useLocation();
  const [activeView, setActiveView] = useState<"task-board" | "todo">(() => (getProjectIdFromLocation(location) ? 'todo' : 'task-board'));

  // Set page title
  useEffect(() => {
    document.title = 'My Tasks - InboxLeap';
  }, []);

  const handleProjectNavigate = useCallback((projectId: string) => {
    const targetPath = `/todo?project=${projectId}`;
    if (location !== targetPath) {
      setLocation(targetPath);
    }
    setActiveView('todo');
  }, [location, setLocation]);

  // Auto-switch to Task Manager view when URL has project parameter
  useEffect(() => {
    const projectIdFromUrl = getProjectIdFromLocation(location);

    if (projectIdFromUrl && activeView !== 'todo') {
      setActiveView('todo');
      console.log('🎯 [TODO-PAGE] Auto-switched to Task Manager view for project:', projectIdFromUrl);
    }
  }, [location, activeView]);


  return (
    <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Todo Management</h1>
              <p className="text-lg text-muted-foreground mt-1">
                Manage your tasks with different organizational views
              </p>
            </div>

            {/* View Toggle */}
            <div className="flex bg-muted rounded-lg p-1">
              <Button
                variant={activeView === "task-board" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setActiveView("task-board");
                  if (getProjectIdFromLocation(location)) {
                    setLocation('/todo');
                  }
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2"
              >
                <KanbanSquare className="h-4 w-4" />
                Task Board
                <Badge variant="outline" className="ml-1 text-xs">
                  Unified
                </Badge>
              </Button>
              <Button
                variant={activeView === "todo" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveView("todo")}
                className="flex items-center gap-2 rounded-md px-3 py-2"
              >
                <Users className="h-4 w-4" />
                Task Manager
                <Badge variant="outline" className="ml-1 text-xs">
                  Projects
                </Badge>
              </Button>
            </div>
          </div>
        </div>

        {/* View Description */}
        <Card className="mb-6 border-l-4 border-l-primary">
          <CardContent className="pt-4">
            {activeView === "task-board" ? (
              <div className="flex items-start gap-3">
                <KanbanSquare className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm">Unified Task Board</h3>
                  <p className="text-sm text-muted-foreground">
                    View and manage all your tasks across different agents and projects in a single kanban board.
                    Filter by project, priority, and status to focus on what matters most.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm">Task Manager Projects</h3>
                  <p className="text-sm text-muted-foreground">
                    Organize tasks by email topics and projects. Each email thread becomes its own project board
                    with dedicated email addresses and project organization.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content */}
        <div className="relative">
          {activeView === "task-board" ? (
            <div className="animate-in fade-in-50 duration-300">
              <TaskBoardContent onProjectNavigate={handleProjectNavigate} />
            </div>
          ) : (
            <div className="animate-in fade-in-50 duration-300 -mx-4 -mt-6">
              <TodoAgentPage />
            </div>
          )}
        </div>
    </div>
  );
}
