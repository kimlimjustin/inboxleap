// This file maintains backwards compatibility while using the new refactored email service
import { emailService as newEmailService } from './email';

// Re-export for backwards compatibility
export const emailService = newEmailService;

// Re-export types
export type { EmailData, EmailConfig, EmailRoute } from './email';