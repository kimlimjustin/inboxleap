// Quick debug script to check projects and their company associations
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function debugProjects() {
  console.log('🔍 Debugging project data for current user...\n');
  
  try {
    // Query current user's projects specifically
    const result = await client`
      SELECT 
        id, 
        name, 
        type, 
        created_by as "createdBy",
        company_id as "companyId",
        created_at as "createdAt"
      FROM projects 
      WHERE created_by = '117731485754683416670'
      ORDER BY created_at DESC 
    `;
    
    console.log('📋 Current user projects in database:');
    result.forEach(project => {
      console.log(`  - ID: ${project.id}, Name: "${project.name}", CompanyID: ${project.companyId || 'NULL'}, Type: ${project.type}`);
    });
    
    console.log(`\n📊 Total projects for current user: ${result.length}`);
    const individualProjects = result.filter(p => p.companyId === null);
    const companyProjects = result.filter(p => p.companyId !== null);
    
    console.log(`  - Individual projects (companyId=NULL): ${individualProjects.length}`);
    console.log(`  - Company projects (companyId set): ${companyProjects.length}`);
    
    if (companyProjects.length > 0) {
      console.log('  - Company project breakdown:');
      const companyGrouping = {};
      companyProjects.forEach(p => {
        companyGrouping[p.companyId] = (companyGrouping[p.companyId] || 0) + 1;
      });
      Object.entries(companyGrouping).forEach(([companyId, count]) => {
        console.log(`    - Company ${companyId}: ${count} projects`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

debugProjects();