import { loadRegistry } from '../../core/registry';
import { buildDependencyGraph } from '../../core/graph';

export function runGraph() {
  try {
    const skills = loadRegistry();
    const graphStr = buildDependencyGraph(skills);
    console.log(graphStr);
  } catch (err: any) {
    console.error('Failed to load registry:', err.message);
    process.exit(1);
  }
}
