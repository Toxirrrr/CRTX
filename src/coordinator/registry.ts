import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CoordTask, CoordResourceLock, CoordChatEntry, CoordConflict,
  CoordAuditEvent, CoordEventType, CoordTaskStatus, CoordScope,
  CoordIntent, CoordValidationEvidence, CoordHandoff,
  WorkspaceDiff, StatusOutput, ConflictType, CoordinatorState, ClaimTaskConflict, HeartbeatRequest
} from './types';

const CRTX_ROOT = path.resolve(__dirname, '..', '..');
const COORD_DIR = process.env.CRTX_COORDINATOR_TEST_ROOT || path.join(CRTX_ROOT, 'coordinator');
const STATE_FILE = path.join(COORD_DIR, 'state.json');
const EVENTS_FILE = path.join(COORD_DIR, 'events.jsonl');
const LOCK_FILE = path.join(COORD_DIR, 'coordinator.lock');

const STALE_THRESHOLD_MS = 15 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

async function ensureDirs() {
  if (!fs.existsSync(COORD_DIR)) {
    await fsp.mkdir(COORD_DIR, { recursive: true });
  }
}

/**
 * STATE / EVENT CRASH CONSISTENCY INVARIANT
 * 
 * The transaction sequence is:
 * 1. Lock
 * 2. Read State
 * 3. Mutate State
 * 4. Atomic State Write (rename)
 * 5. Append Event Log
 * 6. Unlock
 * 
 * Analysis of Crash Windows:
 * A. Crash before state write (rename): State is untouched. Lock is orphaned. Recovery unlinks lock. Completely consistent.
 * B. Crash after state write, before event append: State mutation IS COMMITTED, but audit log is MISSING the event.
 *    -> THIS IS AN EXPLICITLY ACCEPTED INVARIANT of the local filesystem architecture.
 *    -> state.json remains the authoritative truth. Events are best-effort audit history.
 * C. Crash after event append, before unlock: Both committed. Lock orphaned. Recovery unlinks lock. Completely consistent.
 * D. Crash during lock release: File unlink is atomic. Completely consistent.
 */

async function checkAndRecoverStaleLock(): Promise<boolean> {
  try {
    const data = fs.readFileSync(LOCK_FILE, 'utf8');
    if (!data) return false; // Empty file -> process might be between openSync and writeSync -> UNCERTAIN

    const owner = JSON.parse(data);
    if (owner.pid) {
      try {
        process.kill(owner.pid, 0); // Test if process is alive
        return false; // Process is alive (or PID reused) -> UNCERTAIN -> DO NOT STEAL
      } catch (killErr: any) {
        if (killErr.code === 'ESRCH') {
          // Process is DEFINITELY DEAD -> Safe to recover
          try {
            fs.unlinkSync(LOCK_FILE);
          } catch (e: any) {
            if (e.code !== 'ENOENT') throw e; // Safe if another worker recovered it first
          }
          return true; // Successfully recovered
        }
      }
    }
  } catch (err: any) {
    // Unreadable, missing, or malformed -> UNCERTAIN
  }
  return false;
}

async function acquireLock(timeoutMs = 10000): Promise<string> {
  const start = Date.now();
  const token = crypto.randomUUID();
  while (true) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx'); // Atomic create
      try {
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, token, acquiredAt: nowIso() }));
      } finally {
        fs.closeSync(fd);
      }
      return token;
    } catch (e: any) {
      if (e.code === 'EEXIST') {
        const recovered = await checkAndRecoverStaleLock();
        if (recovered) continue;
        
        if (Date.now() - start > timeoutMs) throw new Error('Timeout acquiring coordinator lock');
        await new Promise(r => setTimeout(r, 50));
      } else {
        throw e;
      }
    }
  }
}

async function releaseLock(token: string): Promise<void> {
  try {
    const data = fs.readFileSync(LOCK_FILE, 'utf8');
    const owner = JSON.parse(data);
    if (owner.token === token) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (e: any) {
    // If file is gone or unreadable, we just let it go.
  }
}

async function readState(): Promise<CoordinatorState> {
  if (!fs.existsSync(STATE_FILE)) {
    return { version: 0, updatedAt: nowIso(), chats: {}, tasks: {}, locks: {}, conflicts: {} };
  }
  return JSON.parse(await fsp.readFile(STATE_FILE, 'utf8'));
}

async function writeState(state: CoordinatorState): Promise<void> {
  state.version += 1;
  state.updatedAt = nowIso();
  const tmp = `${STATE_FILE}.tmp.${crypto.randomBytes(4).toString('hex')}`;
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  await fsp.rename(tmp, STATE_FILE);
}

export async function appendAuditEvent(
  type: CoordEventType, payload: Record<string, unknown>, tags: { taskId?: string; chatId?: string; resource?: string } = {}
): Promise<void> {
  await ensureDirs();
  const event: CoordAuditEvent = { eventId: crypto.randomUUID(), type, payload, timestamp: nowIso(), ...tags };
  await fsp.appendFile(EVENTS_FILE, JSON.stringify(event) + '\n', 'utf8');
}

async function withCoordinatorLock<T>(
  operation: (state: CoordinatorState) => Promise<{ result: T; events: CoordAuditEvent[] }>
): Promise<T> {
  await ensureDirs();
  const token = await acquireLock();
  try {
    const state = await readState();
    const { result, events } = await operation(state);
    await writeState(state);
    for (const event of events) {
      event.payload.stateVersion = state.version;
      await fsp.appendFile(EVENTS_FILE, JSON.stringify(event) + '\n', 'utf8');
    }
    return result;
  } finally {
    await releaseLock(token);
  }
}

async function readOnly<T>(operation: (state: CoordinatorState) => T): Promise<T> {
  await ensureDirs();
  const token = await acquireLock();
  try { return operation(await readState()); } finally { await releaseLock(token); }
}

export async function registerChat(chatId: string, agent: string): Promise<CoordChatEntry> {
  return withCoordinatorLock(async (state) => {
    let existing = state.chats[chatId];
    if (existing) {
      if (existing.chatState === 'DISCONNECTED' || existing.chatState === 'STALE') existing.chatState = 'ACTIVE';
      existing.lastActivity = nowIso();
      return { result: existing, events: [] };
    }
    const entry: CoordChatEntry = {
      chatId, agent, chatState: 'ACTIVE', currentTaskId: null,
      phase: null, intent: null, scope: null, locks: [],
      lastActivity: nowIso(), registeredAt: nowIso(),
    };
    state.chats[chatId] = entry;
    return { result: entry, events: [] };
  });
}

export async function getChatEntry(chatId: string): Promise<CoordChatEntry | null> {
  return readOnly(state => state.chats[chatId] || null);
}

export async function listChats(): Promise<CoordChatEntry[]> {
  return readOnly(state => Object.values(state.chats));
}

export async function processHeartbeat(req: HeartbeatRequest): Promise<void> {
  await withCoordinatorLock(async (state) => {
    let entry = state.chats[req.chatId];
    if (!entry) return { result: undefined, events: [] };
    entry.lastActivity = req.timestamp || nowIso();
    if (entry.chatState === 'STALE' || entry.chatState === 'DISCONNECTED' || entry.chatState === 'IDLE') {
      entry.chatState = req.taskId ? 'WORKING' : 'ACTIVE';
    }
    return { result: undefined, events: [] };
  });
}

export async function disconnectChat(chatId: string): Promise<void> {
  await withCoordinatorLock(async (state) => {
    let entry = state.chats[chatId];
    if (!entry) return { result: undefined, events: [] };
    entry.chatState = 'DISCONNECTED';
    return { result: undefined, events: [] };
  });
}

export function isChatStale(entry: CoordChatEntry): boolean {
  return Date.now() - Date.parse(entry.lastActivity) > STALE_THRESHOLD_MS;
}

export async function markStaleOwners(): Promise<CoordChatEntry[]> {
  return withCoordinatorLock(async (state) => {
    const stale: CoordChatEntry[] = [];
    const events: CoordAuditEvent[] = [];
    for (const chat of Object.values(state.chats)) {
      if (isChatStale(chat) && chat.chatState !== 'STALE' && chat.chatState !== 'CLOSED' && chat.chatState !== 'DISCONNECTED') {
        chat.chatState = 'STALE';
        stale.push(chat);
        events.push({
          eventId: crypto.randomUUID(), type: 'AGENT_STALE', timestamp: nowIso(),
          chatId: chat.chatId, taskId: chat.currentTaskId || undefined,
          payload: { chatId: chat.chatId, note: 'Owner stale. Require manual recovery.' }
        });
      }
    }
    return { result: stale, events };
  });
}

export async function recoverStale(chatId: string, action: 'RESUME' | 'ABORT'): Promise<void> {
  await withCoordinatorLock(async (state) => {
    const chat = state.chats[chatId];
    if (!chat) throw new Error(`Chat ${chatId} not found`);
    if (chat.chatState !== 'STALE') throw new Error(`Chat ${chatId} is not STALE`);
    const events: CoordAuditEvent[] = [];
    
    if (action === 'RESUME') {
      chat.chatState = chat.currentTaskId ? 'WORKING' : 'ACTIVE';
      chat.lastActivity = nowIso();
    } else if (action === 'ABORT') {
      const toDelete = [];
      for (const [res, lock] of Object.entries(state.locks)) {
        if (lock.chatId === chatId) toDelete.push(res);
      }
      for (const res of toDelete) delete state.locks[res];
      if (chat.currentTaskId) {
        const task = state.tasks[chat.currentTaskId];
        if (task && task.ownerChatId === chatId) {
          task.ownerChatId = null;
          task.phase = 'TODO';
        }
      }
      chat.chatState = 'CLOSED';
      chat.currentTaskId = null;
      chat.locks = [];
    }
    return { result: undefined, events };
  });
}

export async function createTask(taskId: string, title: string, description: string, dependencies: string[] = []): Promise<CoordTask> {
  return withCoordinatorLock(async (state) => {
    if (state.tasks[taskId]) throw new Error(`Task ${taskId} already exists`);
    const task: CoordTask = {
      taskId, title, description, ownerChatId: null, phase: 'TODO',
      intent: 'PLAN', scope: { directories: [], files: [], expectedChanges: '' },
      dependencies, blockers: [], evidence: null, pendingHandoff: null,
      createdAt: nowIso(), updatedAt: nowIso()
    };
    state.tasks[taskId] = task;
    return { result: task, events: [] };
  });
}

export async function getTask(taskId: string): Promise<CoordTask | null> {
  return readOnly(state => state.tasks[taskId] || null);
}

export async function listTasks(): Promise<CoordTask[]> {
  return readOnly(state => Object.values(state.tasks));
}

export async function claimTask(taskId: string, chatId: string, agent: string, intent: CoordIntent, scope: CoordScope): Promise<{ success: boolean; task?: CoordTask; locks?: CoordResourceLock[]; conflictType?: string; message?: string }> {
  return withCoordinatorLock<{ success: boolean; task?: CoordTask; locks?: CoordResourceLock[]; conflictType?: string; message?: string }>(async (state) => {
    const task = state.tasks[taskId];
    if (!task) return { result: { success: false, conflictType: 'TASK_NOT_FOUND', message: `Task ${taskId} not found` }, events: [] };
    if (task.ownerChatId && task.ownerChatId !== chatId) return { result: { success: false, conflictType: 'DUPLICATE_TASK', message: 'Task already claimed' }, events: [] };

    const requested = [...scope.files, ...scope.directories];
    const conflicts = [];
    for (const res of requested) {
      const existing = state.locks[res];
      if (existing && existing.chatId !== chatId) conflicts.push(res);
    }
    if (conflicts.length > 0) return { result: { success: false, conflictType: 'RESOURCE_CONFLICT', message: `Resources locked: ${conflicts.join(', ')}` }, events: [] };

    task.ownerChatId = chatId;
    task.phase = 'CLAIMED';
    task.intent = intent;
    task.scope = scope;
    task.updatedAt = nowIso();

    for (const res of requested) {
      state.locks[res] = { resource: res, taskId, chatId: chatId, mode: 'WRITE', acquiredAt: nowIso() };
    }

    let chat = state.chats[chatId];
    if (!chat) {
      chat = {
        chatId: chatId, agent: agent, chatState: 'WORKING',
        currentTaskId: taskId, phase: 'CLAIMED', intent: intent, scope: scope,
        locks: requested, lastActivity: nowIso(), registeredAt: nowIso()
      };
      state.chats[chatId] = chat;
    } else {
      chat.chatState = 'WORKING';
      chat.currentTaskId = taskId;
      chat.phase = 'CLAIMED';
      chat.intent = intent;
      chat.scope = scope;
      chat.locks = [...new Set([...chat.locks, ...requested])];
      chat.lastActivity = nowIso();
    }

    const acquiredLocks = Object.values(state.locks).filter(l => l.taskId === taskId);
    return { result: { success: true, task, locks: acquiredLocks }, events: [] };
  });
}

export async function releaseTask(taskId: string, chatId: string): Promise<void> {
  await withCoordinatorLock(async (state) => {
    const task = state.tasks[taskId];
    if (task && task.ownerChatId === chatId) {
      task.ownerChatId = null;
      task.phase = 'TODO';
      task.updatedAt = nowIso();
    }
    const chat = state.chats[chatId];
    if (chat && chat.currentTaskId === taskId) {
      chat.currentTaskId = null;
      chat.phase = null;
      chat.intent = null;
      chat.scope = null;
      chat.chatState = 'ACTIVE';
      chat.locks = [];
      chat.lastActivity = nowIso();
    }
    const toDelete = [];
    for (const [res, lock] of Object.entries(state.locks)) {
      if (lock.taskId === taskId && lock.chatId === chatId) toDelete.push(res);
    }
    for (const res of toDelete) delete state.locks[res];
    return { result: undefined, events: [] };
  });
}

export async function updateTaskPhase(taskId: string, chatId: string, phase: CoordTaskStatus): Promise<CoordTask> {
  return withCoordinatorLock(async (state) => {
    const task = state.tasks[taskId];
    if (!task) throw new Error('Task not found');
    if (task.ownerChatId !== chatId) throw new Error('Not owner');
    task.phase = phase;
    task.updatedAt = nowIso();
    const chat = state.chats[chatId];
    if (chat) { chat.phase = phase; chat.lastActivity = nowIso(); }
    return { result: task, events: [] };
  });
}

export async function recordValidation(taskId: string, chatId: string, evidence: CoordValidationEvidence): Promise<CoordTask> {
  return withCoordinatorLock(async (state) => {
    const task = state.tasks[taskId];
    if (!task) throw new Error('Task not found');
    if (task.ownerChatId !== chatId) throw new Error('Not owner');
    task.evidence = evidence;
    task.phase = 'VALIDATING';
    task.updatedAt = nowIso();
    return { result: task, events: [] };
  });
}

export async function initiateHandoff(taskId: string, fromChatId: string, toChatId: string, data: Partial<CoordHandoff>): Promise<CoordTask> {
  return withCoordinatorLock(async (state) => {
    const task = state.tasks[taskId];
    if (!task) throw new Error('Task not found');
    task.pendingHandoff = {
      fromChatId: task.ownerChatId!, toChatId, phase: task.phase,
      completedWork: data.completedWork || '', remainingWork: data.remainingWork || '', 
      blockers: data.blockers || [], filesChanged: data.filesChanged || [],
      validationState: task.evidence ? 'EVIDENCE_ATTACHED' : 'NONE', initiatedAt: nowIso()
    };
    task.updatedAt = nowIso();
    return { result: task, events: [] };
  });
}

export async function acceptHandoff(taskId: string, toChatId: string, agent: string): Promise<CoordTask> {
  return withCoordinatorLock(async (state) => {
    const task = state.tasks[taskId];
    if (!task || !task.pendingHandoff) throw new Error('No handoff pending');
    if (task.pendingHandoff.toChatId !== toChatId) throw new Error('Handoff target mismatch');
    task.ownerChatId = toChatId;
    task.phase = 'CLAIMED';
    task.pendingHandoff.acceptedAt = nowIso();
    task.updatedAt = nowIso();
    return { result: task, events: [] };
  });
}

export async function getResourceLock(resource: string): Promise<CoordResourceLock | null> {
  return readOnly(state => state.locks[resource] || null);
}

export async function listLocks(): Promise<CoordResourceLock[]> {
  return readOnly(state => Object.values(state.locks));
}

export async function recordConflict(type: ConflictType, description: string, subjects: string[], involvedChatIds: string[]): Promise<CoordConflict> {
  return withCoordinatorLock(async (state) => {
    const conflict: CoordConflict = {
      conflictId: crypto.randomUUID(), type, description, subjects,
      involvedChatIds, resolved: false, detectedAt: nowIso()
    };
    state.conflicts[conflict.conflictId] = conflict;
    return { result: conflict, events: [] };
  });
}

export async function resolveConflict(conflictId: string, resolution: string): Promise<void> {
  await withCoordinatorLock(async (state) => {
    const conflict = state.conflicts[conflictId];
    if (conflict) { conflict.resolved = true; conflict.resolution = resolution; conflict.resolvedAt = nowIso(); }
    return { result: undefined, events: [] };
  });
}

export async function listConflicts(openOnly = true): Promise<CoordConflict[]> {
  return readOnly(state => {
    const all = Object.values(state.conflicts);
    return openOnly ? all.filter(c => !c.resolved) : all;
  });
}

export async function detectWorkspaceDiff(taskId: string): Promise<WorkspaceDiff> {
  return { declaredScope: [], actualModified: [], undeclared: [], hasViolation: false, checkedAt: nowIso() };
}

export async function getStatus(): Promise<StatusOutput> {
  return readOnly(state => {
    const chats = Object.values(state.chats);
    const tasks = Object.values(state.tasks);
    const conflicts = Object.values(state.conflicts);
    return {
      generatedAt: nowIso(),
      activeTasks: tasks.filter(t => t.phase !== 'CLOSED').length,
      activeChats: chats.filter(c => c.chatState === 'ACTIVE' || c.chatState === 'WORKING').length,
      chats, tasks, openConflicts: conflicts.filter(c => !c.resolved),
      stats: {
        conflicts: conflicts.length, duplicates: 0, fileCollisions: 0,
        dependencyBlocks: 0, undeclaredChanges: 0, staleLocks: chats.filter(c => isChatStale(c)).length,
      }
    };
  });
}
