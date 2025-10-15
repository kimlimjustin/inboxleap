import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useRoute, useLocation } from "wouter";
import ProjectSidebar from "@/components/ProjectSidebar";
import KanbanBoard from "@/components/KanbanBoard";
import TrustPromptDialog from "@/components/TrustPromptDialog";


export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null);
  const [showTrustDialog, setShowTrustDialog] = useState(false);
  const [pendingTrustUsers, setPendingTrustUsers] = useState<any[]>([]);
  const [, setLocation] = useLocation();

  // Check for project ID in URL
  const [match, params] = useRoute("/project/:projectId");
  const urlProjectId = match ? params?.projectId : null;

  // Check for highlight task parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightTask = urlParams.get('highlightTask');
    if (highlightTask) {
      setHighlightedTaskId(parseInt(highlightTask));
      // Clear the highlight after 3 seconds
      setTimeout(() => {
        setHighlightedTaskId(null);
        // Clean up URL without refreshing
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }, 3000);
    }
  }, []);

  // Get projects to set default selection
  const { data: projects = [], error: projectsError } = useQuery({
    queryKey: ['/api/projects'],
    retry: false,
    enabled: isAuthenticated,
  });

  // Get pending trust decisions
  const { data: pendingTrustDecisions = [] } = useQuery({
    queryKey: ['/api/trust/pending'],
    retry: false,
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  // Clean up duplicate Personal Tasks projects on load
  const cleanupDuplicates = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/cleanup-duplicate-projects', {
        method: 'POST',
        credentials: 'include',
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.keptProject) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        toast({
          title: "Projects Cleaned Up",
          description: "Removed duplicate Personal Tasks projects",
        });
      }
    },
  });

  // Handle authentication errors
  useEffect(() => {
    if (projectsError && isUnauthorizedError(projectsError as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [projectsError, toast]);

  // Create default project if none exists
  const createDefaultProject = async () => {
    if (isCreatingProject) return; // Prevent multiple simultaneous calls
    
    setIsCreatingProject(true);
    try {
      // First, check if a "Personal Tasks" project already exists
      const existingPersonalProject = (projects as any[]).find(
        (p: any) => p.name === 'Personal Tasks' && p.type === 'individual'
      );
      
      if (existingPersonalProject) {
        setSelectedProject(existingPersonalProject);
        return;
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: 'Personal Tasks',
          type: 'individual',
        }),
      });
      
      if (response.ok) {
        const newProject = await response.json();
        // Refresh projects query
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        setSelectedProject(newProject);
        toast({
          title: "Welcome!",
          description: "We've created your first project to get you started.",
        });
      }
    } catch (error) {
      console.error('Error creating default project:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Auto-select project based on URL or default selection
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const projectList = projects as any[];
    
    // If we're already creating a project, don't do anything
    if (isCreatingProject) return;
    
    if (projectList.length > 0) {
      // If there's a project ID in the URL, try to select that project
      if (urlProjectId) {
        const projectIdNumber = parseInt(urlProjectId);
        console.log('Looking for project with ID:', projectIdNumber, 'in projects:', projectList.map(p => ({ id: p.id, name: p.name })));
        const urlProject = projectList.find(p => p.id === projectIdNumber);
        if (urlProject && urlProject.id !== selectedProject?.id) {
          console.log('Found and selecting project:', urlProject.name, urlProject.id);
          setSelectedProject(urlProject);
          return;
        } else {
          console.log('Project not found or already selected. urlProject:', urlProject, 'selectedProject:', selectedProject);
        }
      }
      
      // If no project selected yet, select the first available project
      if (!selectedProject) {
        const defaultProject = projectList[0];
        setSelectedProject(defaultProject);
        // Update URL to reflect the selected project
        setLocation(`/project/${defaultProject.id}`);
      }
    } else if (projectList.length === 0 && selectedProject) {
      // If all projects were deleted, clear the selection
      setSelectedProject(null);
    }
  }, [projects, selectedProject, isAuthenticated, isCreatingProject, urlProjectId, setLocation]);

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

  // Check for pending trust decisions and show dialog
  useEffect(() => {
    if (!isAuthenticated) return;

    if (Array.isArray(pendingTrustDecisions) && pendingTrustDecisions.length > 0) {
      setPendingTrustUsers(pendingTrustDecisions);
      setShowTrustDialog(true);
    }
  }, [isAuthenticated, pendingTrustDecisions]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log('Connected to WebSocket');
      };
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'task_update') {
          // Handle real-time task updates
          console.log('Task update received:', data.data);
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
          queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
          toast({
            title: "Task Updated",
            description: "A task has been updated in real-time",
          });
        } else if (data.type === 'task_deleted') {
          // Handle real-time task deletions
          console.log('Task deletion received:', data.data);
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
          queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
          toast({
            title: "Task Deleted",
            description: "A task has been deleted",
          });
        } else if (data.type === 'queue_update') {
          // Handle real-time queue updates
          console.log('Queue update received:', data.subType, data.data);
          
          switch (data.subType) {
            case 'emailQueued':
              toast({
                title: "📧 Email Queued",
                description: `Email "${data.data.subject}" added to processing queue`,
              });
              break;
            case 'emailProcessingStarted':
              toast({
                title: "🔄 Processing Email",
                description: `Started processing "${data.data.subject}"`,
              });
              break;
            case 'emailProcessingCompleted':
              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
              queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
              queryClient.invalidateQueries({ queryKey: ['/api/recent-emails'] });
              toast({
                title: "✅ Email Processed",
                description: `Successfully processed "${data.data.subject}"`,
              });
              break;
            case 'tasksCreated':
              // Invalidate queries to refresh data and show new tasks
              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
              queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
              queryClient.invalidateQueries({ queryKey: ['/api/recent-emails'] });
              
              // If no project is selected and tasks were created, we should select the project
              if (!selectedProject && data.data.projectId) {
                // Wait a bit for the queries to update, then select the project
                setTimeout(async () => {
                  const projectsResponse = await fetch('/api/projects', { credentials: 'include' });
                  if (projectsResponse.ok) {
                    const updatedProjects = await projectsResponse.json();
                    const newProject = updatedProjects.find((p: any) => p.id === data.data.projectId);
                    if (newProject) {
                      setSelectedProject(newProject);
                    }
                  }
                }, 500);
              }
              
              toast({
                title: "📋 Tasks Created",
                description: `Created ${data.data.tasksCreated} tasks from email`,
              });
              break;
            case 'emailProcessingFailed':
              toast({
                title: "❌ Processing Failed",
                description: `Failed to process "${data.data.subject}"`,
                variant: "destructive",
              });
              break;
            case 'reply_processed':
              // Invalidate queries to refresh data and show updated tasks
              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
              queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
              queryClient.invalidateQueries({ queryKey: ['/api/recent-emails'] });
              toast({
                title: "💬 Reply Processed",
                description: `Updated ${data.data.updatedTasks} tasks from email reply`,
              });
              break;
          }
        }
      };
      
      socket.onclose = () => {
        console.log('Disconnected from WebSocket');
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      return () => {
        socket.close();
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }, [isAuthenticated, toast]);

  const handleProjectSelect = (project: any) => {
    setSelectedProject(project);
    if (project) {
      // Update URL to reflect the selected project
      setLocation(`/project/${project.id}`);
    } else {
      // Clear URL when no project is selected
      setLocation('/');
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'block' : 'hidden'} flex-shrink-0 transition-all duration-300 ease-in-out min-w-[320px]`}>
        <div className="h-full bg-background/80 backdrop-blur-sm border-r border-border/20">
          <ProjectSidebar 
            selectedProject={selectedProject}
            onProjectSelect={handleProjectSelect}
          />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Hero Section */}
        {selectedProject && (
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white p-6 shadow-lg">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl font-bold mb-2">{selectedProject.name}</h1>
              <p className="text-blue-100 opacity-90">
                {selectedProject.type === 'individual' ? 'Personal workspace' : 'Team collaboration'} • 
                {selectedProject.description || 'Manage your tasks and projects'}
              </p>
            </div>
          </div>
        )}
        
        {/* Kanban Board */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <KanbanBoard 
              selectedProject={selectedProject} 
              highlightedTaskId={highlightedTaskId}
            />
          </div>
        </div>
      </div>
      
      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <button 
          className="w-14 h-14 bg-gradient-primary text-white rounded-full shadow-xl hover:shadow-glow transition-all duration-300 flex items-center justify-center px-1"
          onClick={() => setShowSidebar(!showSidebar)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Trust Prompt Dialog */}
      <TrustPromptDialog
        isOpen={showTrustDialog}
        onClose={() => setShowTrustDialog(false)}
        pendingUsers={pendingTrustUsers}
      />
    </div>
  );
}
