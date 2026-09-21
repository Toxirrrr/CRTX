import { ExecutionEngine } from './src/orchestration/ExecutionEngine';
class MockAllocator {
  async createSnapshot() {
    console.log('SNAPSHOT CREATED (FAIL)');
    return 'snap-1';
  }
}
const engine = new ExecutionEngine(
  new MockAllocator() as any, 
  {} as any, 
  { triggerRecovery: async (t: string, e: string) => console.log('RECOVERY:', e) } as any, 
  { get: async () => null, set: async () => null } as any
);

async function run() {
  console.log('Testing missing type:');
  await engine.executeTask('test', 'test', { files: ['foo.ts'] } as any);

  console.log('Testing invalid type:');
  await engine.executeTask('test', 'test', { type: 'BOGUS', files: ['foo.ts'] });
}
run();
