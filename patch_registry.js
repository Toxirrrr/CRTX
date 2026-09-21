import * as fs from 'fs';

const file = 'src/coordinator/registry.ts';
let code = fs.readFileSync(file, 'utf8');

// Update registerChat
code = code.replace(
  `    const entry: CoordChatEntry = {
      chatId,
      agent,
      currentTaskId: null,
      phase: null,
      intent: null,
      scope: null,
      locks: [],
      lastActivity: nowIso(),
      registeredAt: nowIso(),
    };`,
  `    const entry: CoordChatEntry = {
      chatId,
      agent,
      chatState: 'ACTIVE',
      currentTaskId: null,
      phase: null,
      intent: null,
      scope: null,
      locks: [],
      lastActivity: nowIso(),
      registeredAt: nowIso(),
    };`
);

// Update existing registerChat when finding existing entry
code = code.replace(
  `    if (existing) {
      // Update lastActivity
      existing.lastActivity = nowIso();`,
  `    if (existing) {
      // Update lastActivity and make ACTIVE if it was DISCONNECTED or STALE
      if (existing.chatState === 'DISCONNECTED' || existing.chatState === 'STALE') {
        existing.chatState = 'ACTIVE';
      }
      existing.lastActivity = nowIso();`
);

// Replace chatHeartbeat
code = code.replace(
  `export async function chatHeartbeat(chatId: string): Promise<void> {
  const file = path.join(CHATS_DIR, \`\${chatId}.json\`);
  const entry = await readJson<CoordChatEntry>(file);
  if (!entry) return;
  entry.lastActivity = nowIso();
  await atomicWrite(file, JSON.stringify(entry, null, 2) + '\\n');
}`,
  `export async function processHeartbeat(req: import('./types').HeartbeatRequest): Promise<void> {
  const file = path.join(CHATS_DIR, \`\${req.chatId}.json\`);
  const entry = await readJson<CoordChatEntry>(file);
  if (!entry) {
    // Optionally register if not found?
    return;
  }
  
  entry.lastActivity = req.timestamp || nowIso();
  
  // Transition back to active/working if stale/disconnected
  if (entry.chatState === 'STALE' || entry.chatState === 'DISCONNECTED' || entry.chatState === 'IDLE') {
    entry.chatState = req.taskId ? 'WORKING' : 'ACTIVE';
  }

  // Heartbeat confirms liveness only, does not change intent or task phase blindly
  // but we can log the received intent/phase in audit.
  
  await atomicWrite(file, JSON.stringify(entry, null, 2) + '\\n');
  
  await appendAuditEvent('AGENT_HEARTBEAT', { 
    chatId: req.chatId, 
    agent: req.agent,
    reportedTaskId: req.taskId,
    reportedPhase: req.phase,
    reportedIntent: req.intent,
    timestamp: req.timestamp
  }, { chatId: req.chatId, taskId: req.taskId || undefined });
}

export async function disconnectChat(chatId: string): Promise<void> {
  const file = path.join(CHATS_DIR, \`\${chatId}.json\`);
  const entry = await readJson<CoordChatEntry>(file);
  if (!entry) return;
  entry.chatState = 'DISCONNECTED';
  // Keep task, ownership, and resource locks.
  await atomicWrite(file, JSON.stringify(entry, null, 2) + '\\n');
  await appendAuditEvent('AGENT_DISCONNECTED', { chatId }, { chatId });
}`
);

// Replace markStaleOwners logic
code = code.replace(
  `export async function markStaleOwners(): Promise<CoordChatEntry[]> {
  const chats = await listChats();
  const stale: CoordChatEntry[] = [];
  for (const chat of chats) {
    if (chat.currentTaskId && isChatStale(chat)) {
      stale.push(chat);
      await appendAuditEvent('AGENT_STALE', {
        chatId: chat.chatId,
        currentTask: chat.currentTaskId,
        lastActivity: chat.lastActivity,
        note: 'Owner stale. Do NOT steal lock automatically. Require explicit recovery or HANDOFF.',
      }, { chatId: chat.chatId, taskId: chat.currentTaskId });
    }
  }
  return stale;
}`,
  `export async function markStaleOwners(): Promise<CoordChatEntry[]> {
  const chats = await listChats();
  const stale: CoordChatEntry[] = [];
  for (const chat of chats) {
    if (isChatStale(chat) && chat.chatState !== 'STALE' && chat.chatState !== 'CLOSED' && chat.chatState !== 'DISCONNECTED') {
      chat.chatState = 'STALE';
      const file = path.join(CHATS_DIR, \`\${chat.chatId}.json\`);
      await atomicWrite(file, JSON.stringify(chat, null, 2) + '\\n');
      
      stale.push(chat);
      await appendAuditEvent('AGENT_STALE', {
        chatId: chat.chatId,
        currentTask: chat.currentTaskId,
        lastActivity: chat.lastActivity,
        note: 'Owner stale. Do NOT steal lock automatically. Require explicit recovery or HANDOFF.',
      }, { chatId: chat.chatId, taskId: chat.currentTaskId || undefined });
    }
  }
  return stale;
}`
);

fs.writeFileSync(file, code);
console.log('registry.ts patched');
