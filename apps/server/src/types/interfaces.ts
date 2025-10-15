// Email agent interfaces and types
export interface EmailData {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  date: Date;
  messageId: string;
  attachments?: EmailAttachment[];
  inReplyTo?: string;
  references?: string[];
  threadId?: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  contentId?: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface IEmailAgent {
  readonly agentName: string;
  readonly agentType: string;
  readonly description: string;
  
  canHandle(email: EmailData): boolean | Promise<boolean>;
  process(email: EmailData): Promise<CommandResult>;
  handleFollowup?(followup: EmailData): Promise<CommandResult>;
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
}