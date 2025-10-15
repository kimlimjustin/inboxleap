import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Eye, Edit, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TaskItemProps {
  task: any;
  isTeamProject: boolean;
  onClick: () => void;
}

export default function TaskItem({ task, isTeamProject, onClick }: TaskItemProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateTaskMutation = useMutation({
    mutationFn: async (updates: any) => {
      await apiRequest('PATCH', `/api/tasks/${task.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/tasks/${task.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (completed: boolean) => {
    updateTaskMutation.mutate({
      status: completed ? 'completed' : 'pending'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDueDate = (dueDate: string) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString();
    }
  };

  const isCompleted = task.status === 'completed';
  const canEdit = true; // In real app, this would be based on user permissions

  return (
    <div 
      className={`flex items-center space-x-3 p-3 rounded-lg transition-colors cursor-pointer task-item ${
        isCompleted ? 'bg-green-50 opacity-75' : 'bg-gray-50 hover:bg-gray-100'
      }`}
      onClick={onClick}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleStatusChange}
        disabled={!canEdit || updateTaskMutation.isPending}
        onClick={(e) => e.stopPropagation()}
      />
      
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium text-gray-900 ${isCompleted ? 'line-through' : ''}`}>
          {task.title}
        </p>
        {task.sourceEmail && (
          <p className="text-xs text-gray-500">
            From: {task.sourceEmail}
          </p>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {isCompleted ? (
          <Badge className="bg-green-100 text-green-800">
            Completed
          </Badge>
        ) : (
          <>
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
            
            {isTeamProject && (
              <Badge variant="outline" className="text-xs">
                {canEdit ? (
                  <>
                    <Edit className="h-3 w-3 mr-1" />
                    Can Edit
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    View Only
                  </>
                )}
              </Badge>
            )}
            
            {task.dueDate && (
              <span className="text-xs text-gray-500">
                Due: {formatDueDate(task.dueDate)}
              </span>
            )}
          </>
        )}
        
        {canEdit && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Task</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{task.title}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTaskMutation.mutate();
                  }}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteTaskMutation.isPending}
                >
                  {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
