import { PolicyResolver, GovernanceRecord } from '../src/orchestration/PolicyResolver';
import { GovernanceGate } from '../src/orchestration/GovernanceGate';

let passedCount = 0;
let totalCount = 0;

function assertResult(name: string, passed: boolean, expectedPassed: boolean) {
  totalCount++;
  if (passed === expectedPassed) {
    console.log(`вњ… [PASS] ${name}`);
    passedCount++;
  } else {
    console.error(`вќЊ [FAIL] ${name} - Expected ${expectedPassed} but got ${passed}.`);
  }
}

async function runTests() {
  console.log('--- MA-11 & MA-12 TESTS ---');

  const resolver = new PolicyResolver(require('path').resolve(process.cwd(), '../docs/active'));

  function testParse(name: string, yaml: string, expectPass: boolean) {
    // @ts-ignore
    resolver.getAllMarkdownFiles = () => [require('path').resolve(process.cwd(), '../docs/active/01_PROJECT/RELEASE_RULES.md')];
    // @ts-ignore
    resolver.extractYamlBlocks = () => [yaml];
    try {
      // @ts-ignore
      resolver.resolve();
      assertResult(name, true, expectPass);
    } catch (e: any) {
      // console.log('DEBUG:', e.message);
      assertResult(name, false, expectPass);
    }
  }

  // MA-11: DECISION combinations
  testParse('DECISION + ACTIVE -> PASS', `id: T1\ntype: DECISION\nstatus: ACTIVE\nscope:\n  - GLOBAL`, true);
  testParse('DECISION + UNKNOWN -> PASS', `id: T2\ntype: DECISION\nstatus: UNKNOWN\nscope:\n  - GLOBAL`, true);
  testParse('DECISION + VIOLATION -> PASS', `id: T3\ntype: DECISION\nstatus: VIOLATION\nscope:\n  - GLOBAL`, true);
  testParse('DECISION + DRIFT -> PASS', `id: T4\ntype: DECISION\nstatus: DRIFT\nscope:\n  - GLOBAL`, true);
  testParse('DECISION + FROZEN -> PASS', `id: T5\ntype: DECISION\nstatus: FROZEN\nscope:\n  - GLOBAL`, true);

  // MA-11: RULE combinations
  testParse('RULE + ACTIVE -> PASS', `id: T6\ntype: RULE\nstatus: ACTIVE\nscope:\n  - GLOBAL`, true);
  testParse('RULE + UNKNOWN -> PASS', `id: T7\ntype: RULE\nstatus: UNKNOWN\nscope:\n  - GLOBAL`, true);
  testParse('RULE + VIOLATION -> PASS', `id: T8\ntype: RULE\nstatus: VIOLATION\nscope:\n  - GLOBAL`, true);
  testParse('RULE + DRIFT -> PASS', `id: T9\ntype: RULE\nstatus: DRIFT\nscope:\n  - GLOBAL`, true);
  testParse('RULE + FROZEN -> BLOCK', `id: T10\ntype: RULE\nstatus: FROZEN\nscope:\n  - GLOBAL`, false);

  // MA-11: RELEASE_STATE combinations
  testParse('RELEASE_STATE + ACTIVE -> PASS', `id: T11\ntype: RELEASE_STATE\nstatus: ACTIVE\nscope:\n  - GLOBAL`, true);
  testParse('RELEASE_STATE + FROZEN -> PASS', `id: T12\ntype: RELEASE_STATE\nstatus: FROZEN\nscope:\n  - GLOBAL`, true);
  testParse('RELEASE_STATE + UNKNOWN -> BLOCK', `id: T13\ntype: RELEASE_STATE\nstatus: UNKNOWN\nscope:\n  - GLOBAL`, false);
  testParse('RELEASE_STATE + VIOLATION -> BLOCK', `id: T14\ntype: RELEASE_STATE\nstatus: VIOLATION\nscope:\n  - GLOBAL`, false);
  testParse('RELEASE_STATE + DRIFT -> BLOCK', `id: T15\ntype: RELEASE_STATE\nstatus: DRIFT\nscope:\n  - GLOBAL`, false);

  testParse('invalid type -> BLOCK', `id: T16\ntype: BOGUS\nstatus: ACTIVE\nscope:\n  - GLOBAL`, false);
  testParse('invalid status -> BLOCK', `id: T17\ntype: DECISION\nstatus: BOGUS\nscope:\n  - GLOBAL`, false);
  testParse('invalid type/status combination -> BLOCK', `id: T18\ntype: RULE\nstatus: FROZEN\nscope:\n  - GLOBAL`, false);

  // MA-12: Engineering Cycle Logic
  const mockRecords: GovernanceRecord[] = [
    { id: 'REL-01', type: 'RELEASE_STATE', status: 'FROZEN', scope: ['GLOBAL'], sourceFile: 'test' },
    { id: 'CYCLE-22', type: 'DECISION', status: 'ACTIVE', scope: ['GLOBAL'], sourceFile: 'test' }
  ];
  const gate = new GovernanceGate(mockRecords);
  const gateActive = new GovernanceGate([]);

  assertResult('ACTIVE + FEATURE + no cycle -> ALLOW', gateActive.check(['foo.ts'], 'FEATURE').passed, true);
  assertResult('FROZEN + FEATURE + no cycle -> BLOCK', gate.check(['foo.ts'], 'FEATURE').passed, false);
  assertResult('FROZEN + FEATURE + unknown cycle -> BLOCK', gate.check(['foo.ts'], 'FEATURE', 'CYCLE-BOGUS').passed, false);
  assertResult('FROZEN + FEATURE + authorized cycle -> ALLOW', gate.check(['foo.ts'], 'FEATURE', 'CYCLE-22').passed, true);

  // Remainder
  assertResult('FROZEN + BUGFIX -> ALLOW', gate.check(['foo.ts'], 'BUGFIX').passed, true);
  assertResult('FROZEN + SECURITY_FIX -> ALLOW', gate.check(['foo.ts'], 'SECURITY_FIX').passed, true);
  assertResult('FROZEN + PERFORMANCE -> ALLOW', gate.check(['foo.ts'], 'PERFORMANCE').passed, true);
  assertResult('FROZEN + HOTFIX -> ALLOW', gate.check(['foo.ts'], 'HOTFIX').passed, true);
  assertResult('FROZEN + REMEDIATION -> BLOCK', gate.check(['foo.ts'], 'REMEDIATION').passed, false);

  console.log(`\nResults: ${passedCount}/${totalCount} passed.`);
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Test crashed:', e);
  process.exit(1);
});
