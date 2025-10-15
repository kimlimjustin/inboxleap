// Re-export from the new modular storage system
export * from './storage/index';

// For backward compatibility, import and re-export the main storage instance
export { storage } from './storage/index';
export { storage as default } from './storage/index';