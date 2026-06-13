import { route } from '../orchestration/router';
import * as path from 'path';
import fsp from 'node:fs/promises';

const CRTX_DIR = process.cwd();
const TASKS_DIR = path.resolve(CRTX_DIR, 'tasks');

async function main() {
  const text = process.argv.slice(2).join(' ');
  if (!text) {
    console.error('Usage: npm run route "Your directive here"');
    process.exit(1);
  }

  console.log(`[CRTX Router] Analyzing directive: "${text}"\n`);
  
  try {
    const routingInfo = await route(text);
    console.log('[CRTX Router] Routing Decision:');
    console.log(`Domain:  ${routingInfo.domain}`);
    console.log(`Agent:   ${routingInfo.agent}`);
    console.log(`Model:   ${routingInfo.model}`);
    console.log(`Risk:    ${routingInfo.risk}`);
    console.log(`Context: ${routingInfo.contextBudget ?? 'auto'}\n`);
    console.log(`Analysis:\n${routingInfo.analysis}\n`);

    if (routingInfo.subTasks && routingInfo.subTasks.length > 0) {
      console.log(`[CRTX Router] Generating ${routingInfo.subTasks.length} sub-tasks...\n`);
      
      await fsp.mkdir(TASKS_DIR, { recursive: true });
      
      for (const [index, subTask] of routingInfo.subTasks.entries()) {
        const taskId = `task-${Date.now()}-${index}`;
        const taskFile = path.join(TASKS_DIR, `${taskId}.json`);
        
        const taskObj = {
          id: taskId,
          title: subTask.title,
          owner: subTask.agent,
          reviewer: subTask.reviewer,
          status: 'pending',
          instruction: subTask.instruction,
          contextBudget: subTask.contextBudget,
          dependsOn: subTask.dependsOn ?? [],
          stateCapsule: subTask.stateCapsule ?? {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: ''
        };
        
        await fsp.writeFile(taskFile, JSON.stringify(taskObj, null, 2) + '\n', 'utf8');
        console.log(`  -> Created ${taskId}.json (Owner: ${subTask.agent})`);
      }
      console.log('\n[CRTX Router] Success. Tasks are queued for listeners.');
    } else {
      console.log('[CRTX Router] No sub-tasks generated.');
    }
  } catch (err) {
    console.error('[CRTX Router] Fatal Error:', err);
    process.exit(1);
  }
}

void main();
