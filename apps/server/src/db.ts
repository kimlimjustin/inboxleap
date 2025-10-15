import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@email-task-router/shared";
import dotenv from "dotenv";

// Only load .env in non-production to avoid overriding ECS-injected env vars
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure postgres client: enable SSL for non-local DBs (e.g., RDS)
const pgOpts: any = {
  // Connection pool settings
  max: 20, // Maximum number of connections in pool
  idle_timeout: 30, // Close idle connections after 30 seconds
  connect_timeout: 30, // Connection timeout in seconds
  // Retry settings
  max_lifetime: 60 * 30, // Maximum lifetime of connections (30 minutes)
};

const dbUrl = process.env.DATABASE_URL.toLowerCase();
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
if (!isLocal) {
  pgOpts.ssl = { rejectUnauthorized: false, require: true };
  if (!process.env.SUPPRESS_SSL_LOG) {
    console.log('[db] Using SSL with rejectUnauthorized=false (non-local DB)');
  }
}

const sql = postgres(process.env.DATABASE_URL, pgOpts);

export const db = drizzle(sql, { schema });
export { sql };