import { db } from './src/db.js';
import { sql } from 'drizzle-orm';

async function checkTable() {
  try {
    const result = await db.execute(sql`SELECT * FROM information_schema.tables WHERE table_name = 'email_opt_outs'`);
    console.log('Table exists:', result.length > 0);
    console.log('Table info:', result);
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkTable();
