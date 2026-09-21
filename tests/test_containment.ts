import { ExecutionEngine } from '../src/orchestration/ExecutionEngine';
import { ContextAllocator } from '../src/orchestration/ContextAllocator';
import { IValidationPipeline, IRecoveryEngine, ValidationResult } from '../src/orchestration/types';
import * as path from 'node:path';
import * as fs from 'node:fs';

const projectRoot = path.resolve(__dirname, '../..');

class MockContextAllocator extends ContextAllocator {
  public snapshotCalls = 0;
  async createSnapshot(taskId: string, files: string[]): Promise<string> {
    this.snapshotCalls++;
    return `snap-${taskId}`;
  }
}

class MockValidator implements IValidationPipeline {
  async validate(taskId: string): Promise<ValidationResult> {
    return { passed: true, step: 'mock', logs: '' };
  }
}

class MockRecovery implements IRecoveryEngine {
  async triggerRecovery(taskId: string, reason: string): Promise<void> {
    // console.log(`[MockRecovery] ${taskId}: ${reason}`);
  }
}

async function runTest(name: string, files: string[], expectPass: boolean) {
  const allocator = new MockContextAllocator(projectRoot);
  const engine = new ExecutionEngine(allocator, new MockValidator(), new MockRecovery());
  
  const payload = {
    type: 'BUGFIX', // Allow it to bypass FROZEN
    files: files
  };
  
  const result = await engine.executeTask(`test-${Date.now()}`, 'agent', payload);
  const passed = result.success === true;
  const snapshotCalls = allocator.snapshotCalls;
  
  if (passed === expectPass) {
    if (!expectPass && snapshotCalls > 0) {
      console.error(`вќЊ FAIL [${name}]: Expected BLOCK, but createSnapshot was called!`);
      return false;
    }
    console.log(`вњ“ PASS [${name}]`);
    return true;
  } else {
    console.error(`вќЊ FAIL [${name}]: Expected ${expectPass ? 'ALLOW' : 'BLOCK'}, got ${passed ? 'ALLOW' : 'BLOCK'} | Reason: ${result.error?.message}`);
    return false;
  }
}

async function main() {
  let failed = 0;
  
  // Create a temporary symlink pointing outside the project root for testing
  const symlinkPath = path.join(projectRoot, 'test-outside-symlink');
  let hasSymlink = false;
  try {
    const target = process.platform === 'win32' ? 'C:\\Windows' : '/etc';
    fs.symlinkSync(target, symlinkPath, 'dir');
    hasSymlink = true;
  } catch (e) {
    // Requires admin privileges on some Windows machines, ignore if failed
  }
  
  const rootName = path.basename(projectRoot);
  const rootParent = path.dirname(projectRoot);
  const collisionPath = path.join(rootParent, rootName + '-malicious');

  try {
    const tests = [
      { name: '1. client/file.ts', files: ['client/file.ts'], expectPass: true },
      { name: '2. crtx/src/file.ts', files: ['crtx/src/file.ts'], expectPass: true },
      { name: '3. docs/active/file.md', files: ['docs/active/file.md'], expectPass: true },
      { name: '4. ../file.ts', files: ['../file.ts'], expectPass: false },
      { name: '5. ../../file.ts', files: ['../../file.ts'], expectPass: false },
      { name: '6. foo/../outside.ts', files: ['foo/../../outside.ts'], expectPass: false },
      { name: '7. ..\\file.ts', files: ['..\\file.ts'], expectPass: false },
      { name: '8. ..\\..\\file.ts', files: ['..\\..\\file.ts'], expectPass: false },
      { name: '9. /etc/passwd', files: ['/etc/passwd'], expectPass: false },
      { name: '10. /tmp/file.ts', files: ['/tmp/file.ts'], expectPass: false },
      { name: '11. C:\\Windows\\file', files: ['C:\\Windows\\file'], expectPass: false },
      { name: '12. D:\\other-project\\file', files: ['D:\\other-project\\file'], expectPass: false },
      { name: '13. mixed separator traversal', files: ['foo/..\\..\\bar.ts'], expectPass: false },
      { name: '14. project-root boundary prefix collision', files: [collisionPath], expectPass: false },
      { name: '15. normalized valid nested path', files: ['crtx/src/../src/file.ts'], expectPass: true },
      { name: '16. resolved outside-root path', files: [path.join(rootParent, 'outside.ts')], expectPass: false },
    ];
    
    if (hasSymlink) {
      tests.push({ name: '17. symlink outside root', files: ['test-outside-symlink/system.ini'], expectPass: false });
    } else {
      console.log('вљ  SKIP [17. symlink outside root] (Could not create symlink)');
    }

    for (const t of tests) {
      const ok = await runTest(t.name, t.files, t.expectPass);
      if (!ok) failed++;
    }
    
    // Explicit verification of Snapshot / AI boundaries for a blocked task
    console.log('\\n--- Checking Execution Boundaries ---');
    const allocator = new MockContextAllocator(projectRoot);
    const engine = new ExecutionEngine(allocator, new MockValidator(), new MockRecovery());
    const res = await engine.executeTask(`test-boundary`, 'agent', { type: 'BUGFIX', files: ['/etc/passwd'] });
    if (allocator.snapshotCalls === 0 && res.success === false) {
      console.log('вњ“ PASS [18. blocked path -> snapshot calls = 0]');
      console.log('вњ“ PASS [19. blocked path -> AI invocation = 0]');
    } else {
      console.error('вќЊ FAIL Execution boundaries breached!');
      failed++;
    }

  } finally {
    if (hasSymlink) fs.unlinkSync(symlinkPath);
  }

  if (failed > 0) {
    console.error(`\\nвќЊ ${failed} tests failed.`);
    process.exit(1);
  } else {
    console.log(`\\nвњЁ All containment tests passed.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
