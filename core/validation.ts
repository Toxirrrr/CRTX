import { SkillDefinition } from './types';

export class RegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryValidationError';
  }
}

export function validateRegistry(skills: SkillDefinition[]): void {
  const ids = new Set<string>();

  // Check missing metadata and duplicate ids
  for (const skill of skills) {
    if (!skill.metadata) {
      throw new RegistryValidationError(`Missing metadata in skill defined in ${skill.source}`);
    }
    const { id, version, stage, priority, depends } = skill.metadata;
    if (!id || !version || !stage || !priority) {
      throw new RegistryValidationError(`Incomplete metadata in skill ${id || 'unknown'} from ${skill.source}`);
    }

    if (ids.has(id)) {
      throw new RegistryValidationError(`Duplicate skill id detected: ${id}`);
    }
    ids.add(id);
    
    if (!Array.isArray(depends)) {
       throw new RegistryValidationError(`Skill ${id} must have a depends array`);
    }
  }

  // Check unknown dependencies
  for (const skill of skills) {
    for (const dep of skill.metadata.depends) {
      if (!ids.has(dep)) {
        throw new RegistryValidationError(`Skill ${skill.metadata.id} depends on unknown skill: ${dep}`);
      }
    }
  }

  // Check cyclic dependencies
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function dfs(id: string) {
    if (visiting.has(id)) {
      throw new RegistryValidationError(`Cyclic dependency detected at skill: ${id}`);
    }
    if (visited.has(id)) return;

    visiting.add(id);
    const skill = skills.find(s => s.metadata.id === id);
    if (skill) {
      for (const dep of skill.metadata.depends) {
        dfs(dep);
      }
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of ids) {
    dfs(id);
  }
}
