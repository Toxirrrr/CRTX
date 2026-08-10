import { minimatch } from 'minimatch';
import { SkillDefinition } from './types';

export interface PolicyCondition {
  changed?: string[];
  // Future conditions could be added here (e.g. branch name, time, etc.)
}

export interface PolicyRule {
  name: string;
  if: PolicyCondition;
  run: string[]; // List of skill IDs
}

export class PolicyEngine {
  private rules: PolicyRule[];

  constructor(rules: PolicyRule[]) {
    this.rules = rules;
  }

  public evaluate(changedFiles: string[]): Set<string> {
    const requiredSkills = new Set<string>();

    for (const rule of this.rules) {
      if (this.matchesCondition(rule.if, changedFiles)) {
        for (const skillId of rule.run) {
          requiredSkills.add(skillId);
        }
      }
    }

    return requiredSkills;
  }

  private matchesCondition(condition: PolicyCondition, changedFiles: string[]): boolean {
    if (!condition.changed || condition.changed.length === 0) {
      return true; // No file conditions means always match (or depending on design, false. Let's say true).
    }

    for (const file of changedFiles) {
      for (const pattern of condition.changed) {
        if (minimatch(file, pattern, { matchBase: true })) {
          return true; // If any file matches any pattern, the condition is met
        }
      }
    }

    return false;
  }
}

// Example default policies. In the future, this can be loaded from a config file.
export const DEFAULT_POLICIES: PolicyRule[] = [
  {
    name: 'Vue Frontend Changes',
    if: { changed: ['**/*.vue', 'client/**/*.ts'] },
    run: ['ux-consistency-auditor', 'performance-budget-auditor', 'memory-leak-scanner']
  },
  {
    name: 'Backend API Changes',
    if: { changed: ['**/*.dto.ts', '**/*controller.ts', 'server/**/*.ts'] },
    run: ['dto-contract-snapshot', 'architecture-drift-detector', 'production-logic-auditor']
  },
  {
    name: 'Global Default Governance',
    if: { changed: ['**/*'] },
    run: ['release-freeze-validator', 'evidence-registry']
  }
];
