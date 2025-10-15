// Simple test to check if getTasksWithAssignees method exists
const { storage } = require('./src/storage/index.ts');

console.log('Storage object:', Object.getOwnPropertyNames(storage));
console.log('getTasksWithAssignees method exists:', typeof storage.getTasksWithAssignees);
console.log('Method type:', typeof storage.getTasksWithAssignees);

// List all methods on storage
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(storage))
  .filter(name => typeof storage[name] === 'function');
console.log('All methods:', methods);

// Check if it's in the methods
console.log('Method in list:', methods.includes('getTasksWithAssignees'));