import { runDoctor } from './commands/doctor';
import { runRegistry } from './commands/registry';
import { runGraph } from './commands/graph';
import { runDiff } from './commands/diff';
import { runOrchestrate } from './commands/orchestrate';
import { runRelease } from './commands/release';
import { runLearn } from './commands/learn';
import { runLock, runUnlock } from './commands/lock';

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'doctor':
    runDoctor();
    break;
  case 'registry':
    runRegistry();
    break;
  case 'graph':
    runGraph();
    break;
  case 'diff':
    runDiff();
    break;
  case 'orchestrate':
    runOrchestrate(args).catch(console.error);
    break;
  case 'release':
    runRelease(args).catch(console.error);
    break;
  case 'learn':
    runLearn(args);
    break;
  case 'lock':
    runLock(args);
    break;
  case 'unlock':
    runUnlock(args);
    break;
  default:
    console.log(`Usage: npx tsx crtx/cli/index.ts <command> [args...]`);
    console.log(`Commands:`);
    console.log(`  doctor      - Run registry validation checks`);
    console.log(`  registry    - List all loaded skills`);
    console.log(`  graph       - Print skill dependency graph`);
    console.log(`  diff        - Show files modified in current workspace`);
    console.log(`  orchestrate - Run the AI-QOS master orchestration pipeline`);
    console.log(`  release     - Run orchestrator and generate release folder`);
    console.log(`  learn       - Generate a knowledge base recommendation from an incident report`);
    console.log(`  lock        - Acquire a lock on a resource (Usage: lock <resource> <agent_id>)`);
    console.log(`  unlock      - Release a lock on a resource (Usage: unlock <resource> <agent_id>)`);
    process.exit(1);
}
