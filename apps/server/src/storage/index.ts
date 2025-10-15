export { DatabaseStorage } from './DatabaseStorage';
export { UserStorage } from './UserStorage';
export { ProjectStorage } from './ProjectStorage';
export { CompanyStorage } from './CompanyStorage';
export { AgentStorage } from './AgentStorage';
export type { IStorage } from './interfaces';

// Create and export the main storage instance
import { DatabaseStorage } from './DatabaseStorage';
export const storage = new DatabaseStorage();