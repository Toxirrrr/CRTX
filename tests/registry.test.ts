import * as assert from 'node:assert';
import { loadRegistry } from '../core/registry';
import { validateRegistry } from '../core/validation';
import { SkillStage, Priority } from '../core/types';

async function runTests() {
  console.log('Running Registry Tests...');
  
  let skills = loadRegistry();
  assert.ok(skills.length > 0, 'Registry loads all skills');
  console.log('✓ Registry loads all skills');

  assert.doesNotThrow(() => validateRegistry(skills), 'Registry metadata is valid');
  console.log('✓ No duplicate IDs or invalid YAML in real registry');

  // Test Missing metadata rejected
  assert.throws(() => validateRegistry([{ source: 'mock.md', metadata: undefined as any }]), /Missing metadata/);
  console.log('✓ Missing metadata rejected');

  // Test duplicate IDs
  const mockSkills = [
    { metadata: { id: 'test1', version: '1.0.0', stage: SkillStage.Engineering, priority: Priority.P0, depends: [] }, source: '1' },
    { metadata: { id: 'test1', version: '1.0.0', stage: SkillStage.Engineering, priority: Priority.P0, depends: [] }, source: '2' },
  ];
  assert.throws(() => validateRegistry(mockSkills), /Duplicate skill id/);
  console.log('✓ Duplicate ids rejected');

  // Test unknown dependency
  const mockSkillsDep = [
    { metadata: { id: 'test1', version: '1.0.0', stage: SkillStage.Engineering, priority: Priority.P0, depends: ['unknown-skill'] }, source: '1' },
  ];
  assert.throws(() => validateRegistry(mockSkillsDep), /depends on unknown skill/);
  console.log('✓ Unknown dependency rejected');

  // Test cycle detection
  const mockSkillsCycle = [
    { metadata: { id: 'test1', version: '1.0.0', stage: SkillStage.Engineering, priority: Priority.P0, depends: ['test2'] }, source: '1' },
    { metadata: { id: 'test2', version: '1.0.0', stage: SkillStage.Engineering, priority: Priority.P0, depends: ['test1'] }, source: '2' },
  ];
  assert.throws(() => validateRegistry(mockSkillsCycle), /Cyclic dependency detected/);
  console.log('✓ Cycle detection works');

  console.log('All tests passed!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
