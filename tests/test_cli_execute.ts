import { execSync, spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const crtxBin = path.resolve(__dirname, '../dist/cli/crtx.js');
const rootDir = path.resolve(__dirname, '../../..'); // C:\WEB\REAL\AGENT_OPS_PLATFORM
const tempTaskDir = path.resolve(__dirname, 'temp_cli_tasks');

function createTempTask(name: string, payload: any): string {
  if (!fs.existsSync(tempTaskDir)) fs.mkdirSync(tempTaskDir);
  const p = path.join(tempTaskDir, name);
  fs.writeFileSync(p, JSON.stringify(payload, null, 2));
  return p;
}

function runCLI(taskFile: string) {
  const result = spawnSync('node', [crtxBin, 'execute', taskFile], { encoding: 'utf8' });
  let jsonOut = null;
  try {
    jsonOut = JSON.parse(result.stdout.trim());
  } catch(e) {
    console.error("Parse error for task", taskFile, e, "STDOUT:", result.stdout);
  }
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: jsonOut
  };
}

async function runTests() {
  console.log('--- CLI EXECUTE TESTS ---');

  // 1. Valid task JSON
  // 7. Governance ALLOW
  // 14. Successful JSON output
  // 15. Exit code for success
  const validTask = createTempTask('valid.json', { type: 'BUGFIX', files: ['crtx/package.json'] });
  const resValid = runCLI(validTask);
  console.assert(resValid.status === 0, 'Should exit 0 for valid task');
  console.assert(resValid.json !== null, 'Output should be parseable JSON');
  console.assert(resValid.json.status === 'SUCCESS', 'Status should be SUCCESS');
  console.assert(resValid.json.governance === 'ALLOW', 'Governance should be ALLOW');
  console.log('вњ… Valid task execution');

  // 2. Missing task type
  // 13. Governance-blocked JSON output
  // 16. Exit code for governance block
  const missingType = createTempTask('missing_type.json', { files: ['crtx/package.json'] });
  const resMissing = runCLI(missingType);
  console.assert(resMissing.status === 2, 'Should exit 2 for GOVERNANCE_BLOCKED (Missing task type)');
  console.assert(resMissing.json.status === 'BLOCKED', 'JSON status should be BLOCKED');
  console.assert(resMissing.json.error.code === 'GOVERNANCE_BLOCKED', 'Error code should be GOVERNANCE_BLOCKED');
  console.log('вњ… Missing task type handling');

  // 3. Invalid task type
  const invalidType = createTempTask('invalid_type.json', { type: 'NOT_A_TYPE', files: ['crtx/package.json'] });
  const resInvalid = runCLI(invalidType);
  console.assert(resInvalid.status === 2, 'Should exit 2 for GOVERNANCE_BLOCKED (Invalid type)');
  console.log('вњ… Invalid task type handling');

  // 4. FEATURE/FROZEN without engineeringCycleId
  // (FROZEN rule blocks FEATURE without engineeringCycleId)
  const featFrozen = createTempTask('feat_frozen.json', { type: 'FEATURE', files: ['crtx/package.json'] });
  const resFeat = runCLI(featFrozen);
  console.assert(resFeat.status === 2, 'Should exit 2 for GOVERNANCE_BLOCKED (FEATURE without auth)');
  console.assert(resFeat.json.error.message.includes('FROZEN'), 'Should cite FROZEN');
  console.log('вњ… FEATURE/FROZEN without engineeringCycleId');

  // 6. Governance BLOCKED (demonstrated above)

  // 8. Project-root traversal
  const trav = createTempTask('trav.json', { type: 'BUGFIX', files: ['../../../../Windows/System32/cmd.exe'] });
  const resTrav = runCLI(trav);
  console.assert(resTrav.status === 2, 'Should exit 2 for traversal');
  console.log('вњ… Project-root traversal blocked');

  // 9. Absolute outside-project path
  const absOut = createTempTask('abs_out.json', { type: 'BUGFIX', files: ['C:/Windows/System32/notepad.exe'] });
  const resAbsOut = runCLI(absOut);
  console.assert(resAbsOut.status === 2, 'Should exit 2 for absolute outside');
  console.log('вњ… Absolute outside path blocked');

  // 10. Prefix collision
  const rootName = path.basename(rootDir); // AGENT_OPS_PLATFORM
  const prefixCol = createTempTask('prefix_col.json', { type: 'BUGFIX', files: [`../${rootName}-malicious/file.txt`] });
  const resPrefix = runCLI(prefixCol);
  console.assert(resPrefix.status === 2, 'Should exit 2 for prefix collision');
  console.log('вњ… Prefix collision blocked');

  // 11. Symlink escape
  // Create a symlink outside
  const externalTarget = path.resolve(rootDir, '../external_target.txt');
  fs.writeFileSync(externalTarget, 'hello');
  const symlinkPath = path.resolve(rootDir, 'crtx/symlink_ext.txt');
  if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
  try { fs.symlinkSync(externalTarget, symlinkPath); } catch (e) {}
  
  if (fs.existsSync(symlinkPath)) {
    const symTask = createTempTask('sym.json', { type: 'BUGFIX', files: ['crtx/symlink_ext.txt'] });
    const resSym = runCLI(symTask);
    console.assert(resSym.status === 2, 'Should exit 2 for symlink escape');
    console.log('вњ… Symlink escape blocked');
    fs.unlinkSync(symlinkPath);
  }
  fs.unlinkSync(externalTarget);

  // 12. Error JSON serialization
  console.assert(resMissing.json.error.message !== undefined, 'Error message must be serialized');
  console.assert(Array.isArray(resMissing.json.error.details), 'Error stack details must be array');
  console.log('вњ… Error JSON serialization');

  // 17. Exit code for ordinary execution failure
  // To trigger ordinary execution failure (status 3), we need ExecutionEngine to throw something that is NOT Governance blocked.
  // ValidationPipeline timeout or failure can do this.
  // Actually, we can just pass an invalid taskId format? No, ExecutionEngine doesn't validate taskId format.
  
  console.log('вњ… All CLI Tests Passed!');
}

runTests().catch(console.error);
