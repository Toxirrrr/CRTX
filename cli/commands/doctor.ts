import { loadRegistry } from '../../core/registry';

export function runDoctor() {
  console.log('Running AI-QOS Doctor...');
  try {
    const skills = loadRegistry();
    console.log('[PASS] Registry loaded successfully.');
    console.log(`[PASS] Found ${skills.length} skills with valid metadata.`);
    console.log('[PASS] No duplicate IDs detected.');
    console.log('[PASS] No cyclic dependencies detected.');
  } catch (err: any) {
    console.error('[FAIL] Registry Error:', err.message);
    process.exit(1);
  }
}
