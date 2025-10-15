// Re-export canonical email types to keep consistency across services
export type { EmailData, EmailAttachment } from '../email/types';

export interface QueuedEmail {
  id: string;
  email: import('../email/types').EmailData;
  userId: string;
  timestamp: Date;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}
