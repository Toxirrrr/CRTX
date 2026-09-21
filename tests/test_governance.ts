import { PolicyResolver } from '../src/orchestration/PolicyResolver';
import { GovernanceGate } from '../src/orchestration/GovernanceGate';

async function runTests() {
  console.log('--- CRTX GOVERNANCE GATE TESTS ---');

  const resolver = new PolicyResolver(require('path').resolve(process.cwd(), '../docs/active'));
  const records = resolver.resolve();
  const gate = new GovernanceGate(records);

  let passedCount = 0;
  let totalCount = 0;

  function assertResult(name: string, result: { passed: boolean, reason: string }, expectedPassed: boolean) {
    totalCount++;
    if (result.passed === expectedPassed) {
      console.log(`вњ… [PASS] ${name}`);
      passedCount++;
    } else {
      console.error(`вќЊ [FAIL] ${name} - Expected ${expectedPassed} but got ${result.passed}. Reason: ${result.reason}`);
    }
  }

  // Remove global FROZEN to test local violation logic
  const nonFrozenRecords = records.filter(r => r.id !== 'REL-01');
  const gateNonFrozen = new GovernanceGate(nonFrozenRecords);

  // A. UNKNOWN + FEATURE
  assertResult('TEST A: UNKNOWN + FEATURE -> BLOCK', gateNonFrozen.check(['prisma/schema.prisma'], 'FEATURE'), false);

  // B. UNKNOWN + REMEDIATION
  assertResult('TEST B: UNKNOWN + REMEDIATION -> BLOCK', gateNonFrozen.check(['prisma/schema.prisma'], 'REMEDIATION'), false);

  // C. VIOLATION + FEATURE
  assertResult('TEST C: VIOLATION + FEATURE -> BLOCK', gateNonFrozen.check(['client/middleware/platform-auth.ts'], 'FEATURE'), false);

  // D. VIOLATION + REMEDIATION
  assertResult('TEST D: VIOLATION + REMEDIATION -> ALLOW', gateNonFrozen.check(['client/middleware/platform-auth.ts'], 'REMEDIATION'), true);

  // E. DRIFT + FEATURE -> BLOCK (Needs a DRIFT mock or we just assume it behaves same as VIOLATION. Let's create a DRIFT record artificially for test)
  nonFrozenRecords.push({ id: 'TEST-DRIFT', type: 'DECISION', status: 'DRIFT', scope: ['some/drift/file.ts'], sourceFile: 'test' });
  assertResult('TEST E: DRIFT + FEATURE -> BLOCK', gateNonFrozen.check(['some/drift/file.ts'], 'FEATURE'), false);

  // F. DRIFT + REMEDIATION -> ALLOW
  assertResult('TEST F: DRIFT + REMEDIATION -> ALLOW', gateNonFrozen.check(['some/drift/file.ts'], 'REMEDIATION'), true);

  // G. FROZEN + FEATURE -> BLOCK
  assertResult('TEST G: FROZEN + FEATURE -> BLOCK', gate.check(['mobile/app.ts'], 'FEATURE'), false);

  // H. FROZEN + BUGFIX -> ALLOW
  assertResult('TEST H: FROZEN + BUGFIX -> ALLOW', gate.check(['mobile/app.ts'], 'BUGFIX'), true);

  // I. FROZEN + SECURITY_FIX -> ALLOW
  assertResult('TEST I: FROZEN + SECURITY_FIX -> ALLOW', gate.check(['mobile/app.ts'], 'SECURITY_FIX'), true);

  // J. FROZEN + PERFORMANCE -> ALLOW
  assertResult('TEST J: FROZEN + PERFORMANCE -> ALLOW', gate.check(['mobile/app.ts'], 'PERFORMANCE'), true);

  // K. FROZEN + HOTFIX -> ALLOW
  assertResult('TEST K: FROZEN + HOTFIX -> ALLOW', gate.check(['mobile/app.ts'], 'HOTFIX'), true);

  // L. FROZEN + REMEDIATION -> BLOCK
  assertResult('TEST L: FROZEN + REMEDIATION -> BLOCK', gate.check(['mobile/app.ts'], 'REMEDIATION'), false);

  // O. ../ scope -> BLOCK
  assertResult('TEST O: ../ scope -> BLOCK', gate.check(['../outside.ts'], 'FEATURE'), false);

  // U. Unrestricted valid FEATURE -> ALLOW
  assertResult('TEST U: unrestricted valid FEATURE -> ALLOW', gateNonFrozen.check(['server/src/main.ts'], 'FEATURE'), true);

  // Path traversing variations
  assertResult('TEST O2: foo/../../bar.ts -> BLOCK', gate.check(['foo/../../bar.ts'], 'FEATURE'), false);
  assertResult('TEST O3: \\..\\ -> BLOCK', gate.check(['foo\\..\\bar.ts'], 'FEATURE'), false);

  console.log(`\nResults: ${passedCount}/${totalCount} passed.`);
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Test crashed:', e);
  process.exit(1);
});
