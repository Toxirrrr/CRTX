import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SkillDefinition, SkillMetadata } from './types';
import { validateRegistry } from './validation';

const SKILLS_DIR = path.join(__dirname, '..', 'policies', 'skills');

export function loadRegistry(): SkillDefinition[] {
  const skills: SkillDefinition[] = [];

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && fullPath.endsWith('.md') && !fullPath.endsWith('README.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        
        let metadata: SkillMetadata | undefined;
        if (match && match[1]) {
          try {
            metadata = yaml.load(match[1]) as SkillMetadata;
          } catch (e) {
            // will be caught by validateRegistry
          }
        }
        
        skills.push({
          metadata: metadata as SkillMetadata,
          source: fullPath
        });
      }
    }
  }

  scanDir(SKILLS_DIR);
  validateRegistry(skills);
  
  return skills;
}
