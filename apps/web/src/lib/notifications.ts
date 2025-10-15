import { toast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

interface NotificationOptions {
  title?: string;
  description: string;
  duration?: number;
}

export const notifications = {
  success: ({ title = "Success", description, duration = 5000 }: NotificationOptions) =>
    toast({
      title,
      description,
      variant: "success" as any,
      duration,
    }),

  error: ({ title = "Error", description, duration = 8000 }: NotificationOptions) =>
    toast({
      title,
      description,
      variant: "destructive",
      duration,
    }),

  warning: ({ title = "Warning", description, duration = 6000 }: NotificationOptions) =>
    toast({
      title,
      description,
      variant: "warning" as any,
      duration,
    }),

  info: ({ title = "Info", description, duration = 4000 }: NotificationOptions) =>
    toast({
      title,
      description,
      variant: "info" as any,
      duration,
    }),

  // Specific utility functions for common use cases
  taskCreated: (taskTitle: string) =>
    notifications.success({
      title: "Task Created",
      description: `"${taskTitle}" has been created successfully.`,
    }),

  taskUpdated: (taskTitle: string) =>
    notifications.success({
      title: "Task Updated",
      description: `"${taskTitle}" has been updated successfully.`,
    }),

  taskDeleted: (taskTitle: string) =>
    notifications.success({
      title: "Task Deleted",
      description: `"${taskTitle}" has been deleted successfully.`,
    }),

  agentResponse: (agentName: string) =>
    notifications.info({
      title: "Agent Response",
      description: `${agentName} has processed your request.`,
    }),

  emailSent: (recipient?: string) =>
    notifications.success({
      title: "Email Sent",
      description: recipient
        ? `Email sent successfully to ${recipient}.`
        : "Email sent successfully.",
    }),

  saveSuccess: () =>
    notifications.success({
      title: "Changes Saved",
      description: "Your changes have been saved successfully.",
    }),

  saveFailed: (error?: string) =>
    notifications.error({
      title: "Save Failed",
      description: error || "Failed to save changes. Please try again.",
    }),

  loadFailed: (resource: string) =>
    notifications.error({
      title: "Loading Failed",
      description: `Failed to load ${resource}. Please refresh the page.`,
    }),

  unauthorized: () =>
    notifications.warning({
      title: "Session Expired",
      description: "Your session has expired. Please log in again.",
    }),

  networkError: () =>
    notifications.error({
      title: "Network Error",
      description: "Unable to connect. Please check your internet connection.",
    }),

  copyToClipboard: () =>
    notifications.success({
      title: "Copied",
      description: "Content copied to clipboard.",
      duration: 2000,
    }),

  formValidationError: (message?: string) =>
    notifications.error({
      title: "Validation Error",
      description: message || "Please check your input and try again.",
    }),
};

// Export individual functions for convenience
export const { success, error, warning, info } = notifications;