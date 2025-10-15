// Main EmailService - the new, smaller orchestrator
export { EmailService, emailService } from './EmailService';

// Individual service components
export { EmailConnectionManager, emailConnectionManager } from './EmailConnectionManager';
export { EmailConfigManager, emailConfigManager } from './EmailConfigManager';
export { EmailParser, emailParser } from './EmailParser';
export { EmailRouter, emailRouter } from './EmailRouter';
export { SMTPServerManager, smtpServerManager } from './SMTPServerManager';
export { ReplyProcessor, replyProcessor } from './ReplyProcessor';
export { OptOutManager, optOutManager } from './OptOutManager';

// Types
export * from './types';
