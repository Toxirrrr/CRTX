const http = require('http');

async function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4100,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAudit() {
  const chatId = 'audit-chat-2';
  const agent = 'auditor';

  console.log("1. Registering Chat...");
  const regRes = await request('POST', '/api/coordinator/register', { chatId, agent });
  console.log("Register:", regRes.body);

  console.log("2. Creating a Task...");
  const createRes = await request('POST', '/api/coordinator/tasks', {
    title: 'Audit Task',
    description: 'Auditing Chat State vs Task State'
  });
  console.log("Create Task:", createRes.body);
  const taskId = createRes.body.task?.taskId || 'unknown';

  console.log("3. Claiming the Task...");
  const claimRes = await request('POST', `/api/coordinator/tasks/${taskId}/claim`, {
    chatId,
    agent,
    intent: 'IMPLEMENT',
    scope: { directories: [], files: [], expectedChanges: 'audit' }
  });
  console.log("Claim Task:", claimRes.body);

  console.log("4. Sending Heartbeat...");
  const hbRes = await request('POST', '/api/coordinator/heartbeat', {
    chatId,
    agent,
    taskId,
    phase: 'IMPLEMENTING',
    intent: 'IMPLEMENT',
    timestamp: new Date().toISOString()
  });
  console.log("Heartbeat:", hbRes.body);

  console.log("5. Fetching Chats to verify heartbeat didn't override Task...");
  let chatsRes = await request('GET', '/api/coordinator/chats');
  let chat = chatsRes.body.chats.find(c => c.chatId === chatId);
  console.log("Chat state after heartbeat:", chat.chatState);
  console.log("Task owned after heartbeat:", chat.currentTaskId);
  
  console.log("6. Simulating Disconnect...");
  const discRes = await request('POST', '/api/coordinator/disconnect', { chatId });
  console.log("Disconnect:", discRes.body);

  chatsRes = await request('GET', '/api/coordinator/chats');
  chat = chatsRes.body.chats.find(c => c.chatId === chatId);
  console.log("Chat state after disconnect:", chat.chatState);
  console.log("Task owned after disconnect:", chat.currentTaskId);
  console.log("Locks held after disconnect:", chat.locks.length);

  console.log("7. Sending Heartbeat from DISCONNECTED state...");
  await request('POST', '/api/coordinator/heartbeat', {
    chatId,
    agent,
    taskId,
    phase: 'IMPLEMENTING',
    intent: 'IMPLEMENT',
    timestamp: new Date().toISOString()
  });
  chatsRes = await request('GET', '/api/coordinator/chats');
  chat = chatsRes.body.chats.find(c => c.chatId === chatId);
  console.log("Chat state after recovery heartbeat:", chat.chatState);

  console.log("8. Testing STALE collector...");
  const staleRes = await request('POST', '/api/coordinator/stale');
  console.log("Stale Run:", staleRes.body);

  chatsRes = await request('GET', '/api/coordinator/chats');
  chat = chatsRes.body.chats.find(c => c.chatId === chatId);
  console.log("Chat state after stale check (should be STALE since timestamp is old or new enough, wait maybe not stale yet):", chat.chatState);

}

runAudit().catch(console.error);
