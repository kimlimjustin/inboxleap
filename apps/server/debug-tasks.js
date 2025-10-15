// Debug script to check tasks for current user
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = postgres(process.env.DATABASE_URL);

async function checkTasks() {
  try {
    const result = await client`
      SELECT 
        t.id, 
        t.title, 
        t.description, 
        t.status,
        t.priority,
        t.project_id as "projectId",
        p.name as "projectName"
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE p.created_by = '117731485754683416670'
      ORDER BY t.created_at DESC 
    `;
    
    console.log('📋 Tasks found for personal projects:');
    console.log(`Total tasks: ${result.length}`);
    
    if (result.length > 0) {
      console.log('\nTask details:');
      result.forEach(task => {
        console.log(`  - Task ${task.id}: "${task.title}" (Project: ${task.projectName}) [Status: ${task.status}]`);
        if (task.description) {
          console.log(`    Description: ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}`);
        }
      });
      
      // Group by project
      const tasksByProject = {};
      result.forEach(task => {
        if (!tasksByProject[task.projectName]) {
          tasksByProject[task.projectName] = [];
        }
        tasksByProject[task.projectName].push(task);
      });
      
      console.log('\n📊 Tasks by project:');
      Object.entries(tasksByProject).forEach(([projectName, tasks]) => {
        console.log(`  - ${projectName}: ${tasks.length} tasks`);
      });
    } else {
      console.log('No tasks found in personal projects.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkTasks();