import { TaskBus } from '../src/orchestration/taskBus';
import * as assert from 'assert';

async function runTests() {
  const bus = new TaskBus();
  
  console.log('--- Running Stress Tests ---');

  // Test 1: Dependency Graph (F25 depends on F24)
  console.log('Test 1: Dependency Graph');
  const tF24 = await bus.submit({ sourceAgent: 'system', targetAgent: 'claude', payload: { title: 'F24' } });
  const tF25 = await bus.submit({ sourceAgent: 'system', targetAgent: 'claude', payload: { title: 'F25', dependsOn: [tF24.taskId] } });
  
  try {
    bus.updateStatus(tF25.taskId, 'ACCEPTED');
    assert.fail('Should not be able to accept F25 while F24 is not COMPLETED');
  } catch (e: any) {
    assert.ok(e.message.includes('DependencyBlockedError'));
    console.log('  [PASS] F25 blocked by F24 dependency');
  }

  bus.updateStatus(tF24.taskId, 'COMPLETED');
  bus.updateStatus(tF25.taskId, 'ACCEPTED'); // Should succeed now
  console.log('  [PASS] F25 started after F24 completed');

  // Test 2: Runtime Health (offline agent fallback)
  console.log('Test 2: Runtime Health & Fallback Chain');
  const tFable = await bus.submit({ sourceAgent: 'system', targetAgent: 'fable', payload: { title: 'Review' } });
  // Since fable is offline in runtime_health.json, it should fallback to claude (or the first available in chain)
  assert.strictEqual(tFable.targetAgent, 'claude');
  console.log('  [PASS] Reassigned from offline fable to claude');

  // Test 3: Escalation Policy
  console.log('Test 3: Escalation Policy');
  const tEscalated = await bus.submit({ sourceAgent: 'system', targetAgent: 'antigravity', payload: { domain: 'RBAC', title: 'Modify permissions' } });
  assert.strictEqual(tEscalated.status, 'ESCALATED');
  console.log('  [PASS] Task touching RBAC automatically escalated');

  // Test 4: Context Budget
  console.log('Test 4: Context Budget');
  const tHuge = await bus.submit({ sourceAgent: 'system', targetAgent: 'claude', payload: { contextSize: 130000 } });
  assert.strictEqual(tHuge.payload.requiresCompression, true);
  console.log('  [PASS] >100k context automatically flagged for compression');

  // Test 5: Release Gate
  console.log('Test 5: Release Gate');
  const tCode = await bus.submit({ sourceAgent: 'system', targetAgent: 'claude', payload: { title: 'Write code' } });
  bus.updateStatus(tCode.taskId, 'IN_PROGRESS');
  const tDone = bus.updateStatus(tCode.taskId, 'COMPLETED', { validation: { lint: false, tests: true } });
  assert.strictEqual(tDone.status, 'REVIEW_FAILED');
  console.log('  [PASS] Lint fail prevented COMPLETED status and set REVIEW_FAILED');

  // Test 6: Cyclic Dependencies
  console.log('Test 6: Cyclic Dependencies');
  const tCycleA = await bus.submit({ taskId: 'C-A', sourceAgent: 'system', targetAgent: 'claude', payload: { dependsOn: ['C-B'] } });
  try {
    await bus.submit({ taskId: 'C-B', sourceAgent: 'system', targetAgent: 'claude', payload: { dependsOn: ['C-A'] } });
    assert.fail('Should not be able to create cyclic dependency');
  } catch (e: any) {
    assert.ok(e.message.includes('CyclicDependencyError'));
    console.log('  [PASS] Blocked cyclic dependency C-B -> C-A -> C-B');
  }

  // Test 7: Self Dependency
  console.log('Test 7: Self Dependency');
  try {
    await bus.submit({ taskId: 'S-A', sourceAgent: 'system', targetAgent: 'claude', payload: { dependsOn: ['S-A'] } });
    assert.fail('Should not be able to depend on itself');
  } catch (e: any) {
    assert.ok(e.message.includes('SelfDependencyError'));
    console.log('  [PASS] Blocked self dependency S-A -> S-A');
  }

  // Test 8: Escalated Review Requirement
  console.log('Test 8: Escalated tasks require review');
  const tEscRev = await bus.submit({ sourceAgent: 'system', targetAgent: 'antigravity', payload: { domain: 'RBAC' } });
  assert.strictEqual(tEscRev.status, 'ESCALATED');
  try {
    bus.updateStatus(tEscRev.taskId, 'COMPLETED');
    assert.fail('Should not complete escalated task directly');
  } catch (e: any) {
    assert.ok(e.message.includes('EscalationReviewError'));
    console.log('  [PASS] Escalated task blocked from skipping review');
  }

  // Test 9: Runtime Oscillation Fallback Counter
  console.log('Test 9: Runtime Oscillation');
  const tOscillate = await bus.submit({ sourceAgent: 'system', targetAgent: 'fable', payload: { fallbackAttempts: 4 } });
  assert.strictEqual(tOscillate.status, 'PARKED');
  console.log('  [PASS] Infinite reassignment loop prevented by marking PARKED');

  // Test 10: Compression Cascade
  console.log('Test 10: Compression Cascade');
  const tCascade = await bus.submit({ sourceAgent: 'system', targetAgent: 'claude', payload: { contextSize: 125000, compressionDone: true } });
  assert.strictEqual(tCascade.status, 'ESCALATED');
  console.log('  [PASS] Infinite compression loop prevented by escalating');

  console.log('--- All Stress Tests Passed! ---');
}

void runTests();
