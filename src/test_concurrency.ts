import { fork } from 'child_process';
import path from 'path';

if (process.argv[2] === 'worker') {
  // Worker process
  const { processHeartbeat, disconnectChat, registerChat } = require('./coordinator/registry');
  
  async function run() {
    const workerId = process.argv[3];
    const chatId = 'chat-concurrency-test';
    
    try {
      if (workerId === '1') {
        await registerChat(chatId, 'agent-1');
        await processHeartbeat({ chatId, agent: 'agent-1', taskId: null, phase: null, intent: null, timestamp: new Date().toISOString() });
      } else if (workerId === '2') {
        await disconnectChat(chatId);
      } else if (workerId === '3') {
        await processHeartbeat({ chatId, agent: 'agent-1', taskId: null, phase: null, intent: null, timestamp: new Date().toISOString() });
      }
      process.send!({ success: true, workerId });
    } catch (e: any) {
      process.send!({ success: false, workerId, error: e.message });
    }
  }
  
  run();
} else {
  // Main process
  const fs = require('fs');
  const COORD_DIR = path.join(__dirname, '..', 'coordinator');
  if (!fs.existsSync(COORD_DIR)) fs.mkdirSync(COORD_DIR, { recursive: true });

  console.log('Starting concurrency test...');
  const promises = [];
  
  for (let i = 1; i <= 3; i++) {
    promises.push(new Promise((resolve) => {
      const worker = fork(__filename, ['worker', i.toString()]);
      worker.on('message', resolve);
    }));
  }
  
  Promise.all(promises).then((results) => {
    console.log('Concurrency test results:', results);
    // Read state to verify it hasn't been corrupted
    const state = JSON.parse(fs.readFileSync(path.join(COORD_DIR, 'state.json'), 'utf8'));
    console.log('Final state version:', state.version);
    console.log('Final chat state:', state.chats['chat-concurrency-test']?.chatState);
    if (state.version >= 3) {
      console.log('PASS: State version incremented correctly, indicating serialized atomic writes.');
    } else {
      console.error('FAIL: State version indicates lost updates.');
    }
  });
}
