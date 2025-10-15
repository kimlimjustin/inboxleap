// Core plugin framework interfaces

export interface EmailData {
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  body: string;
  date: Date;
  // Thread tracking fields
  inReplyTo?: string;
  references?: string[];
  threadId?: string;
}

export interface VisibilityContext {
  isTo: boolean;      // Command was in To field (public)
  isCc: boolean;      // Command was in CC field (transparent assistance)
  isBcc: boolean;     // Command was in BCC field (private concierge)
  recipients: string[];
  sender: string;
}

export interface UIConfig {
  type: 'kanban' | 'poll' | 'analytics' | 'data-profiler' | 'generic';
  url: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  ui?: UIConfig;
  followUpRequired?: boolean;
  scheduledActions?: ScheduledAction[];
}

export interface ScheduledAction {
  type: 'reminder' | 'follow-up' | 'expiration';
  scheduledAt: Date;
  action: string;
  metadata?: Record<string, any>;
}

export interface IEmailCommand {
  commandKeyword: string;
  description: string;
  
  // Core processing method
  process(email: EmailData, context: VisibilityContext): Promise<CommandResult>;
  
  // UI generation
  generateUI(result: CommandResult): UIConfig;
  
  // Handle follow-up emails in the same thread
  handleFollowup(followup: EmailData, originalContext: VisibilityContext): Promise<CommandResult>;
  
  // Plugin lifecycle
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
  
  // Configuration
  getConfig?(): Record<string, any>;
  setConfig?(config: Record<string, any>): void;
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  dependencies?: string[];
}