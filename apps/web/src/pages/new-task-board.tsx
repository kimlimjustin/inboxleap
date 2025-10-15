import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import PersonalKanbanBoard from "@/components/PersonalKanbanBoard";
import TodoAssistant from "@/components/TodoAssistant";
import TaskBoardFilters from "@/components/TaskBoardFilters";
import ComposeEmailModal from "@/components/ComposeEmailModal";

export default function NewTaskBoard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showComposeModal, setShowComposeModal] = useState(false);

  // Get projects for filters
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    retry: false,
    enabled: isAuthenticated,
  });

  // Get all tasks for the assistant context
  const { data: allTasks = [] } = useQuery({
    queryKey: ['/api/tasks'],
    retry: false,
    enabled: isAuthenticated,
  });

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

  const handleSendEmail = async (emailData: any) => {
    try {
      // TODO: Implement actual email sending
      toast({
        title: "Email Sent",
        description: "Your task email has been sent to Todo",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your task board...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="h-full flex bg-background">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-background border-b px-6 py-4">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold">Task Board</h1>
              <p className="text-sm text-muted-foreground">Personal task management across all projects</p>
            </div>
            
            {/* New Tasks Button - Centered */}
            <Button 
              onClick={() => setShowComposeModal(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Tasks
            </Button>

            {/* Filters */}
            <div className="flex-1 max-w-4xl mx-4">
              <TaskBoardFilters
                projects={projects as any[]}
                selectedProject={selectedProject}
                onProjectChange={setSelectedProject}
                selectedPriority={selectedPriority}
                onPriorityChange={setSelectedPriority}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />
            </div>
          </div>
        </div>

        {/* Task Board */}
        <div className="flex-1 overflow-auto p-6">
          <PersonalKanbanBoard
            selectedProject={selectedProject}
            selectedPriority={selectedPriority}
            selectedStatus={selectedStatus}
            selectedCategory={selectedCategory}
            enableDragAndDrop={false}
          />
        </div>
      </div>

      {/* AI Assistant Sidebar */}
      <div className="w-96 flex-shrink-0">
        <TodoAssistant tasks={allTasks as any[]} projects={projects as any[]} />
      </div>

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={showComposeModal}
        onClose={() => setShowComposeModal(false)}
        onSend={handleSendEmail}
      />
    </div>
  );
}
