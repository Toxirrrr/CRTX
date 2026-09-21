import { ExecutionEngine } from './src/orchestration/ExecutionEngine';
class MockAllocator {
  async createSnapshot() {
    console.log('SNAPSHOT CREATED (FAIL)');
    return 'snap-1';
  }
}
class MockRecovery {
  async triggerRecovery(taskId: string, error: string) {
    console.log('RECOVERY TRIGGERED WITH ERROR: ' + error);
  }
}
const engine = new ExecutionEngine(
  new MockAllocator() as any, 
  {} as any, 
  new MockRecovery() as any, 
  { get: async () => null, set: async () => null } as any
);

async function test() {
  try {
    const res = await engine.executeTask('test-cycle', 'agent-test', {
      type: 'FEATURE',
      files: ['client/middleware/platform-auth.ts']
    });
    console.log('Task returned: ', res);
  } catch (err: any) {
    console.log('Caught exception: ' + err.message);
  }
}
test().catch(e => console.error(e));
