/**
 * test_orchestration.ts — verifies that two stub agents can exchange a task
 * and its context through the shared TaskBus handshake protocol.
 *
 * Run: npm run test:orchestration
 */
import { TaskBus } from '../src/orchestration/taskBus';
import { AgentTask } from '../src/orchestration/types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function main(): Promise<void> {
  const bus = new TaskBus();
  const received: AgentTask[] = [];
  bus.on('task', (task: AgentTask) => received.push(task));

  // 1. Claude (stub) hands a task + context to Antigravity (stub).
  const handed = await bus.submit({
    sourceAgent: 'claude',
    targetAgent: 'antigravity',
    payload: {
      instruction: 'Analyze tracking.service.ts for tenant-isolation gaps',
      context: { module: 'tracking', organizationScoped: true },
    },
  });
  assert(handed.status === 'REQUESTED', 'new task starts as REQUESTED');
  assert(handed.sourceAgent === 'claude', 'source recorded');
  assert(handed.targetAgent === 'antigravity', 'target recorded');

  // 2. Antigravity accepts the task.
  const accepted = bus.updateStatus(handed.taskId, 'ACCEPTED');
  assert(accepted.status === 'ACCEPTED', 'task transitions to ACCEPTED');

  // 3. Antigravity completes and returns enriched context back.
  const completed = bus.updateStatus(handed.taskId, 'COMPLETED', {
    instruction: handed.payload.instruction,
    findings: ['organizationId filter present on all queries — OK'],
  });
  assert(completed.status === 'COMPLETED', 'task transitions to COMPLETED');
  assert(
    Array.isArray((completed.payload as { findings?: unknown }).findings),
    'context (findings) transferred back to caller',
  );

  // 4. The bus emitted an event for every transition (realtime feed works).
  assert(received.length === 3, `expected 3 emitted events, got ${received.length}`);

  // 5. The task is retrievable by id and reflects the final state.
  const fetched = bus.get(handed.taskId);
  assert(fetched?.status === 'COMPLETED', 'final state persisted and queryable');

  // eslint-disable-next-line no-console
  console.log('test_orchestration: PASS — context/task transfer between two stub agents verified');
}

void main();
