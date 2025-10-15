import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import KanbanBoard from "@/components/KanbanBoard";
import EmailChainModal from "@/components/EmailChainModal";
import TaskModal from "@/components/TaskModal";
import DismissibleHint from "@/components/DismissibleHint";
import { RefreshCw, Mail, Users, ListTodo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function TodoPage() {
  console.log('🔍 [TODO] TodoPage component initializing...');

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [emailChainModalOpen, setEmailChainModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  // Get URL search parameters
  const projectIdFromUrl = getProjectIdFromLocation(location);

  console.log('🔍 [TODO] Initial state:', {
    user: !!user,
    location,
    projectIdFromUrl
  });


  // Get projects
  const { data: projectsResponse, refetch: refetchProjects } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      console.log('📡 [TODO] Fetching projects from API...');
      const response = await apiRequest('GET', '/api/projects');
      const data = await response.json();
      console.log('📡 [TODO] Received API response:', data);
      console.log('📡 [TODO] Projects count:', data?.projects?.length || 0);
      console.log('📡 [TODO] Projects:', data?.projects);
      return data;
    },
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const projects = projectsResponse?.projects || [];
  console.log('📋 [TODO] Raw projects from API:', projects.length, projects);


  // Filter projects - Show all projects excluding collaboration invites
  const filteredProjects = projects.filter((p: any) => {
    // Filter out collaboration invitation emails
    const isCollaborationInvite =
      p.name && (
        p.name.includes('wants to collaborate with you') ||
        p.name.includes('InboxLeap:') ||
        p.name.includes('no-reply@inboxleap.com') ||
        p.name.includes('kimlimjustin@gmail.com wants to collaborate')
      );

    if (isCollaborationInvite) {
      console.log('🚫 [TODO] Filtering out collaboration invite:', p.name);
    }

    return !isCollaborationInvite;
  });

  console.log('✅ [TODO] Filtered projects:', filteredProjects.length, filteredProjects);

  // Auto-select project from URL parameter
  useEffect(() => {
    if (projectIdFromUrl && projects.length > 0) {
      const projectFromUrl = projects.find((p: any) => p.id.toString() === projectIdFromUrl);
      if (projectFromUrl && selectedProject?.id !== projectFromUrl.id) {
        setSelectedProject(projectFromUrl);
        console.log('🎯 [TODO] Auto-selected project from URL:', projectFromUrl.name);
      }
    } else if (!projectIdFromUrl && selectedProject) {
      setSelectedProject(null);
    }
  }, [projectIdFromUrl, projects, selectedProject]);

  // S3 refresh mutation
  const s3RefreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/s3-refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to trigger S3 refresh');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Refresh Triggered",
        description: "Checking for new emails...",
      });
      setTimeout(() => refetchProjects(), 2000);
    },
    onError: () => {
      toast({
        title: "Refresh Failed",
        description: "Failed to trigger email refresh",
        variant: "destructive",
      });
    },
  });

  // Calculate stats
  const totalEmailCount = filteredProjects.reduce((sum: number, p: any) => sum + (p.emailCount || 0), 0);
  const totalParticipantCount = new Set(
    filteredProjects.flatMap((p: any) => p.participants?.map((part: any) => part.userId) || [])
  ).size;
  const selectedProjectEmailCount = selectedProject?.emailCount || 0;
  const selectedProjectParticipantCount = selectedProject?.participants?.length || 0;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to access Task Manager</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-12">
      {/* Main Dashboard Content */}
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="space-y-6">
          {/* Main Content Area with Two-Panel Layout */}
          <div className="flex flex-col gap-6 xl:flex-row xl:h-[calc(100vh-8rem)]">
            {/* Left Sidebar - Projects List */}
            <div className="w-80 flex-shrink-0">
              <Card className="h-full border border-slate-200/70 shadow-xl bg-white/85 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-200/70 bg-slate-50/80 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                      <ListTodo className="h-5 w-5 text-slate-600" />
                      Projects
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => s3RefreshMutation.mutate()}
                      disabled={s3RefreshMutation.isPending}
                      className="border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-100"
                    >
                      <RefreshCw className={`w-4 h-4 text-slate-600 ${s3RefreshMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <CardDescription className="mt-2 text-xs text-slate-600">
                    {filteredProjects.length} projects
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
                    {!projectsResponse ? (
                      <div className="text-center py-8 px-4">
                        <div className="animate-pulse space-y-3">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
                          <div className="h-3 bg-gray-200 rounded w-2/3 mx-auto"></div>
                        </div>
                        <p className="text-gray-500 mt-2">Loading projects...</p>
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 px-4">
                        No projects found
                      </div>
                    ) : (
                      <div className="space-y-2 p-3">
                        {filteredProjects.map((project: any) => (
                          <div
                            key={project.id}
                            className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md ${
                              selectedProject?.id === project.id
                                ? 'bg-gradient-to-br from-purple-100 to-purple-50 border-purple-300 shadow-md'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                            onClick={() => {
                              setSelectedProject(project);
                              setLocation(`/todo?project=${project.id}`);
                            }}
                          >
                            <div className="font-semibold text-sm truncate text-slate-900">
                              {project.name}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 border-slate-300">
                                {project.type}
                              </Badge>
                              {project.sourceEmail && (
                                <span className="text-xs text-slate-600 truncate font-mono">
                                  {project.sourceEmail}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {project.emailCount || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {project.participantCount || 0}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Main Area - Kanban Board */}
            <div className="flex-1 space-y-4">
              {selectedProject && (
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div>
                      <CardTitle className="text-lg">{selectedProject.name}</CardTitle>
                      <CardDescription>
                        Project emails and tasks
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEmailChainModalOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      View Emails
                    </Button>
                  </CardHeader>
                </Card>
              )}

              {selectedProject ? (
                <KanbanBoard
                  selectedProject={selectedProject}
                  onTaskClick={(task) => {
                    setSelectedTask(task);
                    setTaskModalOpen(true);
                  }}
                  hideAssistant={true}
                />
              ) : (
                <Card className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <ListTodo className="w-6 h-6 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Select a Project
                    </h3>
                    <p className="text-sm text-gray-500">
                      Choose a project from the sidebar to view and manage its tasks
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EmailChainModal
        isOpen={emailChainModalOpen}
        onClose={() => setEmailChainModalOpen(false)}
        projectId={selectedProject?.id ?? null}
        projectName={selectedProject?.name}
      />

      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          refetchProjects();
        }}
        task={selectedTask}
      />
    </div>
  );
}

