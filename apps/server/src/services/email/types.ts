export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  contentId?: string;
}

export interface EmailData {
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  body: string;
  date: Date;
  attachments?: EmailAttachment[];
  // Thread tracking fields
  inReplyTo?: string;
  references?: string[];
  threadId?: string;
  // Test mode flag to bypass batch processing for immediate results
  testMode?: boolean;
}

export interface EmailConfig {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

export type EmailRoute = 'task' | 'intelligence' | 'load_balancer' | null;

export interface SMTPUser {
  username: string;
  password: string;
}

export interface EmailOptOut {
  id: number;
  email: string;
  createdAt: Date;
  reason?: string | null;
}
