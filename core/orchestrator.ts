import { DiffParser, DiffOptions } from './diff-parser';
import { PolicyEngine, DEFAULT_POLICIES } from './policy-engine';
import { EvidenceRunner } from './evidence';
import { loadRegistry } from './registry';
import { SkillDefinition } from './types';

export class MasterOrchestrator {
  public async run(options?: DiffOptions) {
    console.log('[Orchestrator] Starting AI-QOS Phase 2 Run...');

    // 1. Get changed files
    const diffParser = new DiffParser();
    const changedFiles = diffParser.getModifiedFiles(options);
    
    if (changedFiles.length === 0) {
      console.log('[Orchestrator] No changed files detected. Exiting.');
      return;
    }
    console.log(`[Orchestrator] Detected ${changedFiles.length} changed file(s).`);

    // 2. Evaluate policies
    const policyEngine = new PolicyEngine(DEFAULT_POLICIES);
    const requiredSkillIds = policyEngine.evaluate(changedFiles);

    if (requiredSkillIds.size === 0) {
      console.log('[Orchestrator] No skills required for these changes.');
      return;
    }
    console.log(`[Orchestrator] Policy Engine selected ${requiredSkillIds.size} skills.`);

    // 3. Load Registry and filter required skills
    const registry = loadRegistry();
    const skillsToRun: SkillDefinition[] = [];
    
    for (const id of requiredSkillIds) {
      const skill = registry.find(s => s.metadata.id === id);
      if (skill) {
        skillsToRun.push(skill);
      } else {
        console.warn(`[Orchestrator] Warning: Policy selected unknown skill ${id}`);
      }
    }

    // Resolve dependencies (simple approach for now: if A depends on B, ensure B is in the list)
    // For Phase 2, we just list the skills in execution order based on stage and dependencies
    const resolvedIds = new Set<string>();
    
    function addSkill(skillId: string) {
      if (resolvedIds.has(skillId)) return;
      const skill = registry.find(s => s.metadata.id === skillId);
      if (skill) {
        skill.metadata.depends.forEach(addSkill);
        resolvedIds.add(skillId);
      }
    }

    skillsToRun.forEach(s => addSkill(s.metadata.id));
    console.log(`[Orchestrator] Resolved Dependency Graph to ${resolvedIds.size} total skills to run.`);

    // 4. Gather Evidence (TypeCheck, Lint, etc)
    console.log('[Orchestrator] Gathering Evidence...');
    const evidenceRunner = new EvidenceRunner();
    const lintResult = evidenceRunner.runLint();
    const typecheckResult = evidenceRunner.runTypeCheck();
    
    if (lintResult.status === 'FAIL' || typecheckResult.status === 'FAIL') {
      console.log('[Orchestrator] Evidence Gate Failed! Please fix static errors before AI audit.');
      console.log(`Lint: ${lintResult.status}, TypeCheck: ${typecheckResult.status}`);
      // In strict mode we could exit here
    } else {
      console.log('[Orchestrator] Evidence Gate Passed.');
    }

    // 5. Output Execution Pipeline
    console.log('\n--- Final Execution Pipeline ---');
    console.log(`Skills to execute (in dependency order):`);
    
    const finalSkills = Array.from(resolvedIds).map(id => registry.find(s => s.metadata.id === id)!);
    
    // Sort roughly by Stage and Priority for visualization
    const stageOrder: Record<string, number> = {
      'Planning': 1, 'Architecture': 2, 'Engineering': 3, 'UX': 4, 'Infrastructure': 5, 'Learning': 6
    };
    
    finalSkills.sort((a, b) => {
      return (stageOrder[a.metadata.stage] || 99) - (stageOrder[b.metadata.stage] || 99);
    });

    finalSkills.forEach(skill => {
       console.log(`[${skill.metadata.stage}] ${skill.metadata.id} (${skill.metadata.priority})`);
    });

    const data = {
      version: 'temp', // Replaced in release.ts
      filesChanged: changedFiles,
      skillsRun: finalSkills,
      evidence: {
        lint: lintResult,
        typecheck: typecheckResult
      },
      timestamp: new Date().toISOString()
    };
    
    return data;
  }
}
