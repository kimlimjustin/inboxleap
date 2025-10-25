import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';

export interface TodoContext {
  type: 'todo';
  selectedProject?: any;
  projects?: any[];
  tasks?: any[];
  agentInfo: {
    name: string;
    type: string;
    description: string;
  };
}

export interface TanyaContext {
  type: 't5t';
  companyAgents?: any[];
  reportData?: any;
  statusData?: any;
  agentInfo: {
    name: string;
    type: string;
    description: string;
  };
}

export interface AlexContext {
  type: 'analyzer';
  selectedProject?: any;
  projects?: any[];
  attachments?: any[];
  agentInfo: {
    name: string;
    type: string;
    description: string;
  };
}

export interface FAQContext {
  type: 'faq';
  selectedProject?: any;
  projects?: any[];
  sopDocuments?: any[];
  faqEntries?: any[];
  organization?: any;
  agentInfo: {
    name: string;
    type: string;
    description: string;
  };
}

export interface TaskBoardContext {
  type: 'task-board';
  selectedProject?: any;
  tasks?: any[];
  filters?: any;
}

export interface GeneralContext {
  type: 'general' | 'intelligence' | 'teams' | 'tasks';
  currentTab?: string;
}

export type CopilotContext = TodoContext | TanyaContext | AlexContext | FAQContext | TaskBoardContext | GeneralContext;

interface CopilotContextState {
  context: CopilotContext | null;
  setContext: (context: CopilotContext | null) => void;
  updateContext: (updates: Partial<CopilotContext>) => void;
}

const CopilotContextContext = createContext<CopilotContextState | undefined>(undefined);

export function CopilotContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContextState] = useState<CopilotContext | null>(null);
  const [location] = useLocation();

  // Auto-detect context based on URL changes
  useEffect(() => {
    const updateContextFromLocation = () => {
      let newContext: CopilotContext | null = null;

      if (location.startsWith('/intelligence/t5t') || location === '/intelligence/t5t') {
        newContext = {
          type: 't5t',
          agentInfo: {
            name: 'Tanya',
            type: 'T5T Intelligence Agent',
            description: 'Analyzes team feedback and generates actionable insights from organizational communication.'
          }
        };
      } else if (location.startsWith('/teams/todo') || location === '/teams/todo') {
        newContext = {
          type: 'todo',
          agentInfo: {
            name: 'Todo',
            type: 'Project Management Agent',
            description: 'Manages email-based project threads and task coordination.'
          }
        };
      } else if (location.startsWith('/teams/analyzer') || location === '/teams/analyzer') {
        newContext = {
          type: 'analyzer',
          agentInfo: {
            name: 'Alex',
            type: 'Attachment Analyzer Agent',
            description: 'Analyzes email attachments and extracts insights from documents and files.'
          }
        };
      } else if (location.startsWith('/teams/faq') || location === '/teams/faq') {
        newContext = {
          type: 'faq',
          agentInfo: {
            name: 'FAQ',
            type: 'SOP Knowledge Base Agent',
            description: 'Maintains organization SOPs and documentation, answers team questions based on knowledge base.'
          }
        };
      } else if (location.startsWith('/todo')) {
        newContext = {
          type: 'task-board'
        };
      } else if (location.startsWith('/intelligence')) {
        newContext = {
          type: 'intelligence',
          currentTab: 'intelligence'
        };
      } else if (location.startsWith('/teams')) {
        newContext = {
          type: 'teams',
          currentTab: 'teams'
        };
      } else if (location.startsWith('/tasks')) {
        newContext = {
          type: 'tasks',
          currentTab: 'tasks'
        };
      } else {
        newContext = {
          type: 'general'
        };
      }

      // Only update if the context type has actually changed
      setContextState(current => {
        if (!current || current.type !== newContext?.type) {
          return newContext;
        }
        return current;
      });
    };

    updateContextFromLocation();
  }, [location]);

  const setContext = (newContext: CopilotContext | null) => {
    setContextState(current => {
      // Only update if different (simplified comparison)
      if (!current && !newContext) return current;
      if (!current || !newContext) return newContext;
      if (current.type !== newContext.type) return newContext;
      return current; // Don't update if same type to prevent loops
    });
  };

  const updateContext = (updates: Partial<CopilotContext>) => {
    setContextState(current => {
      if (!current) return null;
      const updated = { ...current, ...updates } as CopilotContext;
      // Simple comparison to prevent unnecessary updates
      if (current.type === updated.type) {
        return updated;
      }
      return current;
    });
  };

  return (
    <CopilotContextContext.Provider value={{ context, setContext, updateContext }}>
      {children}
    </CopilotContextContext.Provider>
  );
}

export function useCopilotContext() {
  const context = useContext(CopilotContextContext);
  if (context === undefined) {
    throw new Error('useCopilotContext must be used within a CopilotContextProvider');
  }
  return context;
}

// Helper functions to generate context summaries for the Copilot
export function generateContextSummary(context: CopilotContext): string {
  switch (context.type) {
    case 't5t':
      const tanyaCtx = context as TanyaContext;
      let summary = `You are currently in the ${tanyaCtx.agentInfo.name} (${tanyaCtx.agentInfo.type}) section. ${tanyaCtx.agentInfo.description}\n\n`;
      
      if (tanyaCtx.companyAgents?.length) {
        summary += `Company has ${tanyaCtx.companyAgents.length} intelligence agent(s) configured.\n`;
      }
      
      if (tanyaCtx.statusData) {
        summary += `Status: ${tanyaCtx.statusData.healthStatus || 'unknown'}, `;
        summary += `${tanyaCtx.statusData.submissionsThisWeek || 0} submissions this week, `;
        summary += `${tanyaCtx.statusData.participantCount || 0} participants.\n`;
      }
      
      if (tanyaCtx.reportData) {
        summary += `Latest analysis available with ${tanyaCtx.reportData.keyFindings?.length || 0} key findings and `;
        summary += `${tanyaCtx.reportData.actionableInsights?.length || 0} actionable insights.\n`;
      }
      
      summary += `\nI can help you understand the intelligence insights, interpret reports, explain trends, and guide you on next steps.`;
      return summary;

    case 'todo':
      const todoCtx = context as TodoContext;
      let todoSummary = `You are currently in the ${todoCtx.agentInfo.name} (${todoCtx.agentInfo.type}) section. ${todoCtx.agentInfo.description}\n\n`;
      
      if (todoCtx.projects?.length) {
        todoSummary += `${todoCtx.projects.length} email thread project(s) available.\n`;
      }
      
      if (todoCtx.selectedProject) {
        todoSummary += `Currently viewing: "${todoCtx.selectedProject.title || todoCtx.selectedProject.name || 'Untitled Project'}"\n`;
        if (todoCtx.selectedProject.sourceEmailSubject) {
          todoSummary += `Email Subject: "${todoCtx.selectedProject.sourceEmailSubject}"\n`;
        }
        if (todoCtx.selectedProject.emailCount) {
          todoSummary += `${todoCtx.selectedProject.emailCount} emails in this thread.\n`;
        }
      }
      
      if (todoCtx.tasks?.length) {
        const tasksByStatus = todoCtx.tasks.reduce((acc: any, task: any) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {});
        todoSummary += `Tasks: ${Object.entries(tasksByStatus).map(([status, count]) => `${count} ${status}`).join(', ')}.\n`;
      }
      
      todoSummary += `\nI can help you manage tasks, understand project status, organize work, and coordinate team activities.`;
      return todoSummary;

    case 'task-board':
      let taskSummary = `You are currently viewing the Task Board for project management.\n\n`;
      const taskCtx = context as TaskBoardContext;
      
      if (taskCtx.selectedProject) {
        taskSummary += `Project: "${taskCtx.selectedProject.title || taskCtx.selectedProject.name || 'Untitled Project'}"\n`;
      }
      
      if (taskCtx.tasks?.length) {
        const tasksByStatus = taskCtx.tasks.reduce((acc: any, task: any) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {});
        taskSummary += `Tasks: ${Object.entries(tasksByStatus).map(([status, count]) => `${count} ${status}`).join(', ')}.\n`;
      }
      
      taskSummary += `\nI can help you organize tasks, understand project progress, and manage your workflow.`;
      return taskSummary;

    case 'intelligence':
    case 'teams':
    case 'tasks':
      return `You are currently in the ${context.type} section of InboxLeap. I can help you navigate the platform, understand different agents and their capabilities, and assist with email management and task coordination.`;

    case 'general':
    default:
      return `Welcome to InboxLeap! I can help you with questions about agents, task management, email processing, and general platform usage. Navigate to specific sections for more targeted assistance.`;
  }
}

export function getContextualSuggestions(context: CopilotContext): string[] {
  switch (context.type) {
    case 't5t':
      return [
        "What are the latest intelligence insights?",
        "Explain the trending topics in our organization",
        "How can we improve team sentiment?",
        "What actionable insights should we prioritize?",
        "How do I set up more intelligence agents?"
      ];

    case 'todo':
      const todoContext = context as TodoContext;
      const suggestions = [];
      
      // Generic suggestions
      suggestions.push("How do I create tasks from this email thread?");
      
      if (todoContext.tasks && todoContext.tasks.length > 0) {
        const pendingTasks = todoContext.tasks.filter(t => 
          t.status?.toLowerCase() === 'pending' || t.status?.toLowerCase() === 'todo'
        );
        const ongoingTasks = todoContext.tasks.filter(t => 
          t.status?.toLowerCase() === 'ongoing' || t.status?.toLowerCase() === 'in-progress'
        );
        
        if (pendingTasks.length > 0) {
          suggestions.push(`What should I do about the ${pendingTasks.length} pending tasks?`);
        }
        if (ongoingTasks.length > 0) {
          suggestions.push(`How can I progress the ${ongoingTasks.length} ongoing tasks?`);
        }
        
        // Add specific task suggestions
        const priorityTasks = todoContext.tasks.filter(t => 
          t.priority?.toLowerCase() === 'high' || t.priority?.toLowerCase() === 'urgent'
        );
        if (priorityTasks.length > 0) {
          suggestions.push(`Tell me about the ${priorityTasks.length} high-priority tasks`);
        }
        
        suggestions.push("What are the most important tasks right now?");
      } else {
        suggestions.push("How do I add tasks to this project?");
      }
      
      if (todoContext.selectedProject) {
        suggestions.push(`What's the status of "${todoContext.selectedProject.name}" project?`);
      }
      
      return suggestions.slice(0, 5);

    case 'task-board':
      const taskBoardContext = context as TaskBoardContext;
      const taskSuggestions = [];
      
      taskSuggestions.push("How do I create a new task?");
      
      if (taskBoardContext.tasks && taskBoardContext.tasks.length > 0) {
        taskSuggestions.push("What's the best way to organize these tasks?");
        taskSuggestions.push("Which tasks need immediate attention?");
        taskSuggestions.push("How do I assign tasks to team members?");
      } else {
        taskSuggestions.push("How do I get started with task management?");
      }
      
      taskSuggestions.push("How do I track project progress?");
      
      return taskSuggestions.slice(0, 5);

    case 'intelligence':
      return [
        "What intelligence agents are available?",
        "How do I set up team feedback collection?",
        "What insights can I get from our emails?",
        "How do polling agents work?",
        "What's the difference between intelligence agents?"
      ];

    case 'teams':
      return [
        "How do I create a new team project?",
        "What agents help with team coordination?",
        "How do I manage email-based projects?",
        "What's the best way to track team tasks?",
        "How do I integrate email workflows?"
      ];

    case 'tasks':
      return [
        "How do I manage my personal tasks?",
        "What's the difference between personal and team tasks?",
        "How do I prioritize my work?",
        "Can I link tasks to email threads?",
        "How do I track task completion?"
      ];

    default:
      return [
        "What can InboxLeap help me with?",
        "How do I get started with agents?",
        "What's the best way to organize my emails?",
        "How do I set up automated task creation?",
        "Can you explain the different features?"
      ];
  }
}
