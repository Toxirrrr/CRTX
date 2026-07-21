import { route } from '../orchestration/router';
import * as path from 'path';
import fsp from 'node:fs/promises';

const CRTX_DIR = path.resolve(__dirname, '../../');
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

    if (routingInfo.cycles && routingInfo.cycles.length > 0) {
      console.log(`[CRTX Router] Generating ${routingInfo.cycles.length} Engineering Cycles...\n`);
      
      const CYCLES_DIR = path.resolve(CRTX_DIR, 'cycles');
      await fsp.mkdir(CYCLES_DIR, { recursive: true });
      
      for (const [index, cycle] of routingInfo.cycles.entries()) {
        const cycleFile = path.join(CYCLES_DIR, `${cycle.id}.json`);
        
        await fsp.writeFile(cycleFile, JSON.stringify(cycle, null, 2) + '\n', 'utf8');
        console.log(`  -> Created ${cycle.id}.json (Owner: ${cycle.execution.targetAgent})`);
      }
      console.log('\n[CRTX Router] Success. Cycles are queued for Autonomous Engineering.');
    } else {
      console.log('[CRTX Router] No cycles generated.');
    }
  } catch (err) {
    console.error('[CRTX Router] Fatal Error:', err);
    process.exit(1);
  }
}

void main();
