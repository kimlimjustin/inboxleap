// This is a minimal test to see what UpsertUser actually resolves to
import { users } from "@email-task-router/shared";

// Let's see what the actual inferred type is
type TestInsert = typeof users.$inferInsert;
type TestSelect = typeof users.$inferSelect;

// Log the types for debugging
const testInsert: TestInsert = {} as any;
const testSelect: TestSelect = {} as any;

console.log("Insert type keys:", Object.keys(testInsert || {}));
console.log("Select type keys:", Object.keys(testSelect || {}));

export { TestInsert, TestSelect };
