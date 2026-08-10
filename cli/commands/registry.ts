import { loadRegistry } from '../../core/registry';

export function runRegistry() {
  try {
    const skills = loadRegistry();
    console.log(`Loaded ${skills.length} skills:`);
    for (const skill of skills) {
      console.log(`- ${skill.metadata.id} (v${skill.metadata.version}) [${skill.metadata.stage}]`);
    }
  } catch (err: any) {
    console.error('Failed to load registry:', err.message);
    process.exit(1);
  }
}
