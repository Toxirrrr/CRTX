import { route as routeCycle, Engine, Domain, Risk } from './router';
import { Cycle } from './types';
import { LegacyExporter } from './adapters/LegacyExporter';

export interface LegacySubTask {
  title: string;
  agent: string;
  instruction: string;
  contextBudget?: number;
  stateCapsule?: any;
  reviewer?: string;
}

export interface LegacyRouting {
  domain: Domain;
  agent: string;
  engine: Engine;
  model: string;
  risk: Risk;
  rationale: string;
  analysis: string;
  contextBudget?: number;
  subTasks?: LegacySubTask[];
  cycles?: any[]; // For some clients that expected cycles but with legacy shape
}

/**
 * Orchestration Facade for backward compatibility.
 * Calls the Cycle-pure router and maps the resulting Cycles to Legacy SubTasks 
 * using LegacyExporter, preserving the API contract for old consumers (like Inbox or CLI).
 */
export async function route(text: string, override?: Engine): Promise<LegacyRouting> {
  // Call the pure cycle-based router
  const routing = await routeCycle(text, override);
  
  const legacyRouting: LegacyRouting = {
    domain: routing.domain,
    agent: routing.agent,
    engine: routing.engine,
    model: routing.model,
    risk: routing.risk,
    rationale: routing.rationale,
    analysis: routing.analysis,
    contextBudget: routing.contextBudget,
    subTasks: [],
    cycles: [] // populate both for clients that might expect either
  };

  if (routing.cycles && routing.cycles.length > 0) {
    for (const cycle of routing.cycles) {
      // Map Cycle to AgentTask to extract legacy fields
      const legacyTask = LegacyExporter.toLegacyTask(cycle);
      
      const subTask: LegacySubTask = {
        title: cycle.objective.slice(0, 80), // Fallback title
        agent: legacyTask.targetAgent || legacyRouting.agent,
        instruction: legacyTask.payload?.instruction || cycle.objective,
        contextBudget: cycle.budget?.maxFiles ? cycle.budget.maxFiles * 1000 : undefined,
        stateCapsule: legacyTask.payload?.stateCapsule || {},
        reviewer: legacyTask.payload?.reviewer
      };
      
      legacyRouting.subTasks!.push(subTask);
      legacyRouting.cycles!.push(subTask);
    }
  }

  return legacyRouting;
}
