import { users, type User, type UpsertUser } from "@email-task-router/shared";

// Test to see what fields are actually available
const testUser: User = {
  id: "test",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  profileImageUrl: "test.jpg",
  password: "test", // This should be valid if the schema is correct
  authProvider: "email", // This should be valid if the schema is correct
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testUpsert: UpsertUser = {
  id: "test",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  profileImageUrl: "test.jpg",
  password: "test",
  authProvider: "email",
};

console.log('Type test passed');
