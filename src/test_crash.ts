import { fork } from 'child_process';
import fs from 'fs';
import path from 'path';

const COORD_DIR = path.join(__dirname, '..', 'coordinator');
const LOCK_FILE = path.join(COORD_DIR, 'coordinator.lock');

if (process.argv[2] === 'worker_a') {
  // Worker A acquires lock and dies without releasing
  const fd = fs.openSync(LOCK_FILE, 'wx');
  fs.writeSync(fd, JSON.stringify({ pid: process.pid, token: 'worker_a_token', acquiredAt: new Date().toISOString() }));
  fs.closeSync(fd);
  console.log('[Worker A] Lock acquired, simulating hard crash...');
  process.exit(1); // Crash
} else if (process.argv[2] === 'worker_b') {
  // Worker B attempts to do something which needs lock
  const { registerChat } = require('./coordinator/registry');
  async function run() {
    try {
      console.log('[Worker B] Attempting to register chat (requires lock)...');
      await registerChat('chat-b', 'agent-b');
      console.log('[Worker B] Successfully acquired lock and registered chat after A crashed.');
      process.send!({ success: true, workerId: 'B' });
    } catch (e: any) {
      console.error('[Worker B] Failed:', e.message);
      process.send!({ success: false, workerId: 'B', error: e.message });
    }
  }
  run();
} else if (process.argv[2] === 'worker_a_alive') {
  // Worker A acquires lock and stays alive
  const fd = fs.openSync(LOCK_FILE, 'wx');
  fs.writeSync(fd, JSON.stringify({ pid: process.pid, token: 'worker_a_alive_token', acquiredAt: new Date().toISOString() }));
  fs.closeSync(fd);
  console.log('[Worker A Alive] Lock acquired, sleeping...');
  setTimeout(() => {
    // Release eventually just to clean up
    fs.unlinkSync(LOCK_FILE);
  }, 15000);
} else if (process.argv[2] === 'worker_b_timeout') {
  const { registerChat } = require('./coordinator/registry');
  async function run() {
    try {
      console.log('[Worker B Timeout] Attempting to register chat... should timeout.');
      await registerChat('chat-b-timeout', 'agent-b');
      process.send!({ success: false, error: 'Should have timed out' });
    } catch (e: any) {
      if (e.message.includes('Timeout')) {
        console.log('[Worker B Timeout] Successfully timed out waiting for live owner.');
        process.send!({ success: true });
      } else {
        process.send!({ success: false, error: e.message });
      }
    }
  }
  run();
} else {
  // Main test runner
  if (!fs.existsSync(COORD_DIR)) fs.mkdirSync(COORD_DIR, { recursive: true });
  // Ensure clear state
  if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);

  console.log('--- TEST 1: Crash Recovery (Orphaned Lock) ---');
  const workerA = fork(__filename, ['worker_a']);
  
  workerA.on('exit', () => {
    console.log('[Main] Worker A exited. Lock file should still exist.');
    const workerB = fork(__filename, ['worker_b']);
    workerB.on('message', (msg: any) => {
      if (msg.success) console.log('TEST 1: PASS');
      else console.error('TEST 1: FAIL');
      
      // Clear lock for test 2
      if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
      
      console.log('\n--- TEST 2: Live Owner Protection ---');
      const workerAAlive = fork(__filename, ['worker_a_alive']);
      
      setTimeout(() => {
        const workerBTimeout = fork(__filename, ['worker_b_timeout']);
        workerBTimeout.on('message', (msg2: any) => {
          if (msg2.success) console.log('TEST 2: PASS');
          else console.error('TEST 2: FAIL');
          workerAAlive.kill();
        });
      }, 1000); // Give A time to acquire
    });
  });
}
