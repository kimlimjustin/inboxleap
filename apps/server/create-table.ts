import { db } from './src/db.js';
import { sql } from 'drizzle-orm';

async function createTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "email_opt_outs" (
        "id" serial PRIMARY KEY NOT NULL,
        "email" varchar NOT NULL,
        "reason" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "email_opt_outs_email_unique" UNIQUE("email")
      );
    `);
    console.log('Table created successfully');
  } catch (error) {
    console.error('Error creating table:', error);
  }
  process.exit(0);
}

createTable();
