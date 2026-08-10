import { SkillDefinition } from './types';

export function buildDependencyGraph(skills: SkillDefinition[]): string {
  const output: string[] = [];
  
  // We want to visualize the graph. For simplicity, we just print each skill and its dependencies.
  output.push('Dependency Graph:');
  
  const skillMap = new Map(skills.map(s => [s.metadata.id, s]));
  
  for (const skill of skills) {
    if (skill.metadata.depends.length === 0) continue; // Skip root notes for visual simplicity in the basic graph, or list them all
    output.push(`${skill.metadata.id}`);
    for (let i = 0; i < skill.metadata.depends.length; i++) {
      const dep = skill.metadata.depends[i];
      const isLast = i === skill.metadata.depends.length - 1;
      output.push(`  ${isLast ? '└──' : '├──'} ${dep}`);
    }
  }

  return output.join('\n');
}
