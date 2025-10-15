import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// Load environment variables from .env file
const result = dotenv.config();

// Force override the DATABASE_URL to use the Neon database
// This is needed because the environment variable might be overridden by shell or Docker
process.env.DATABASE_URL = result.parsed?.DATABASE_URL || process.env.DATABASE_URL;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Normalize URL and configure SSL for non-local databases
let dbUrl = process.env.DATABASE_URL as string;
const lowerUrl = dbUrl.toLowerCase();
const isLocal =
  lowerUrl.includes("localhost") ||
  lowerUrl.includes("127.0.0.1") ||
  lowerUrl.includes("://postgres") ||
  lowerUrl.includes("@postgres") ||
  lowerUrl.includes("host.docker.internal");

// Append ssl=true in the URL for tools that read it (harmless if already present)
if (!isLocal) {
  const hasSslParam = /[?&]ssl(=|$)/i.test(dbUrl);
  if (!hasSslParam) {
    dbUrl += dbUrl.includes("?") ? "&ssl=true" : "?ssl=true";
  }
}

// For drizzle-kit (pg), pass an SSL object so it won’t validate RDS cert chain
const sslConfig = isLocal ? false : { rejectUnauthorized: false } as const;

export default defineConfig({
  out: "./migrations",
  schema: "../../packages/shared/src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: sslConfig,
  },
});
