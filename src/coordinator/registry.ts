/**
 * CRTX Multi-Agent Coordinator — Registry Store
 *
 * Persistent coordination state backed by the filesystem.
 * All state lives under crtx/coordinator/ so it survives independent agent processes.
 *
 * Directory layout:
 *   coordinator/
 *     tasks/          <taskId>.json     — CoordTask records
 *     locks/          <hash>.lock.json  — CoordResourceLock records
 *     chats/          <chatId>.json     — CoordChatEntry records
 *     conflicts/      <conflictId>.json — CoordConflict records
 *     audit/          YYYYMMDD.jsonl    — append-only audit log
 *
 * Concurrency safety:
 *   All mutations go through atomicWrite (write .tmp → rename).
 *   Task CLAIM uses an atomic rename of a pre-reserved sentinel file to
 *   guarantee that exactly one claimer wins even under concurrent access.
 *
 * This module belongs to the CRTX tooling layer ONLY.
 * It must NOT be imported by server/, client/, or mobile/ runtime code.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CoordTask, CoordResourceLock, CoordChatEntry, CoordConflict,
  CoordAuditEvent, CoordEventType, CoordTaskStatus, CoordScope,
  CoordIntent, CoordValidationEvidence, CoordHandoff,
  WorkspaceDiff, StatusOutput, ConflictType,
} from './types';

// ─── Paths ────────────────────────────────────────────────────────────────────

const CRTX_ROOT = path.resolve(__dirname, '..', '..');
const COORD_DIR   = process.env.CRTX_COORDINATOR_TEST_ROOT || path.join(CRTX_ROOT, 'coordinator');
const TASKS_DIR   = path.join(COORD_DIR, 'tasks');
const LOCKS_DIR   = path.join(COORD_DIR, 'locks');
const CHATS_DIR   = path.join(COORD_DIR, 'chats');
const CONFLICTS_DIR = path.join(COORD_DIR, 'conflicts');
const AUDIT_DIR   = path.join(COORD_DIR, 'audit');

// Stale-owner threshold: 15 minutes without heartbeat
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function shortId(): string {
  return crypto.randomBytes(6).toString('hex');
}

/** Normalize a file path to a stable, repo-relative string for lock key generation */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** Hash a resource path to a safe filename */
function resourceToFilename(resource: string): string {
  const normalized = normalizePath(resource);
  const hash = crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12);
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  return `${safe}__${hash}.lock.json`;
}

/** Check if path B is under path A (hierarchical ownership) */
function pathIsUnder(child: string, parent: string): boolean {
  const c = normalizePath(child);
  const p = normalizePath(parent).replace(/\/\*\*$/, '');
  return c === p || c.startsWith(p + '/');
}

/** Check if two scopes have any overlap */
function scopesOverlap(scopeA: CoordScope, scopeB: CoordScope): string[] {
  const overlapping: string[] = [];

  // Check file-level conflicts
  for (const fa of scopeA.files) {
    for (const fb of scopeB.files) {
      if (normalizePath(fa) === normalizePath(fb)) {
        overlapping.push(normalizePath(fa));
      }
    }
  }

  // Check directory-level conflicts
  for (const da of scopeA.directories) {
    for (const fb of scopeB.files) {
      if (pathIsUnder(fb, da)) overlapping.push(normalizePath(fb));
    }
    for (const db of scopeB.directories) {
      const na = normalizePath(da).replace(/\/\*\*$/, '');
      const nb = normalizePath(db).replace(/\/\*\*$/, '');
      if (na === nb || na.startsWith(nb + '/') || nb.startsWith(na + '/')) {
        overlapping.push(na);
      }
    }
  }

  for (const db of scopeB.directories) {
    for (const fa of scopeA.files) {
      if (pathIsUnder(fa, db)) overlapping.push(normalizePath(fa));
    }
  }

  return [...new Set(overlapping)];
}

// ─── Atomic Write ─────────────────────────────────────────────────────────────

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fsp.writeFile(tmp, content, 'utf8');
  let retries = 5;
  while (retries > 0) {
    try {
      await fsp.rename(tmp, filePath);
      return;
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if ((e.code === 'EPERM' || e.code === 'EBUSY') && retries > 1) {
        retries--;
        await new Promise(res => setTimeout(res, 50));
      } else {
        try { await fsp.unlink(tmp); } catch { /* ignore */ }
        throw err;
      }
    }
  }
}

async function ensureDirs(): Promise<void> {
  for (const d of [TASKS_DIR, LOCKS_DIR, CHATS_DIR, CONFLICTS_DIR, AUDIT_DIR]) {
    await fsp.mkdir(d, { recursive: true });
  }
}

// ─── JSON Read Helpers ────────────────────────────────────────────────────────

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function listJsonFiles(dir: string): Promise<string[]> {
  if (!fs.existsSync(dir)) return [];
  const entries = await fsp.readdir(dir);
  return entries.filter(f => f.endsWith('.json') && !f.startsWith('_'));
}

// ─── Audit Logger ─────────────────────────────────────────────────────────────

export async function appendAuditEvent(
  type: CoordEventType,
  payload: Record<string, unknown>,
  opts?: { taskId?: string; chatId?: string; resource?: string },
): Promise<void> {
  await fsp.mkdir(AUDIT_DIR, { recursive: true });
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const logFile = path.join(AUDIT_DIR, `${day}.jsonl`);
  const event: CoordAuditEvent = {
    eventId: shortId(),
    type,
    taskId: opts?.taskId,
    chatId: opts?.chatId,
    resource: opts?.resource,
    payload,
    timestamp: nowIso(),
  };
  await fsp.appendFile(logFile, JSON.stringify(event) + '\n', 'utf8');
}

// ─── CHAT REGISTRY ────────────────────────────────────────────────────────────

export async function registerChat(chatId: string, agent: string): Promise<CoordChatEntry> {
  await ensureDirs();
  const file = path.join(CHATS_DIR, `${chatId}.json`);
  const existing = await readJson<CoordChatEntry>(file);
  if (existing) {
    // Update lastActivity
    existing.lastActivity = nowIso();
    await atomicWrite(file, JSON.stringify(existing, null, 2) + '\n');
    return existing;
  }
  const entry: CoordChatEntry = {
    chatId,
    agent,
    currentTaskId: null,
    phase: null,
    intent: null,
    scope: null,
    locks: [],
    lastActivity: nowIso(),
    registeredAt: nowIso(),
  };
  await atomicWrite(file, JSON.stringify(entry, null, 2) + '\n');
  await appendAuditEvent('AGENT_HEARTBEAT', { chatId, agent }, { chatId });
  return entry;
}

export async function getChatEntry(chatId: string): Promise<CoordChatEntry | null> {
  const file = path.join(CHATS_DIR, `${chatId}.json`);
  return readJson<CoordChatEntry>(file);
}

export async function listChats(): Promise<CoordChatEntry[]> {
  const files = await listJsonFiles(CHATS_DIR);
  const chats: CoordChatEntry[] = [];
  for (const f of files) {
    const entry = await readJson<CoordChatEntry>(path.join(CHATS_DIR, f));
    if (entry) chats.push(entry);
  }
  return chats;
}

export async function chatHeartbeat(chatId: string): Promise<void> {
  const file = path.join(CHATS_DIR, `${chatId}.json`);
  const entry = await readJson<CoordChatEntry>(file);
  if (!entry) return;
  entry.lastActivity = nowIso();
  await atomicWrite(file, JSON.stringify(entry, null, 2) + '\n');
}

export function isChatStale(entry: CoordChatEntry): boolean {
  const last = Date.parse(entry.lastActivity);
  return Date.now() - last > STALE_THRESHOLD_MS;
}

// ─── TASK REGISTRY ────────────────────────────────────────────────────────────

export async function createTask(
  taskId: string,
  title: string,
  description: string,
  dependencies: string[] = [],
): Promise<CoordTask> {
  await ensureDirs();
  const file = path.join(TASKS_DIR, `${taskId}.json`);
  if (fs.existsSync(file)) {
    throw new Error(`TASK_EXISTS: Task ${taskId} already exists`);
  }
  const task: CoordTask = {
    taskId,
    title,
    description,
    ownerChatId: null,
    phase: 'TODO',
    intent: 'READ',
    scope: { directories: [], files: [], expectedChanges: '' },
    dependencies,
    blockers: [],
    evidence: null,
    pendingHandoff: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await atomicWrite(file, JSON.stringify(task, null, 2) + '\n');
  await appendAuditEvent('TASK_CREATED', { taskId, title, description, dependencies }, { taskId });
  return task;
}

export async function getTask(taskId: string): Promise<CoordTask | null> {
  const file = path.join(TASKS_DIR, `${taskId}.json`);
  return readJson<CoordTask>(file);
}

export async function listTasks(): Promise<CoordTask[]> {
  const files = await listJsonFiles(TASKS_DIR);
  const tasks: CoordTask[] = [];
  for (const f of files) {
    const task = await readJson<CoordTask>(path.join(TASKS_DIR, f));
    if (task) tasks.push(task);
  }
  return tasks.sort((a, b) => a.taskId.localeCompare(b.taskId));
}

async function saveTask(task: CoordTask): Promise<void> {
  const file = path.join(TASKS_DIR, `${task.taskId}.json`);
  task.updatedAt = nowIso();
  await atomicWrite(file, JSON.stringify(task, null, 2) + '\n');
}

// ─── CLAIM — Atomic Task Ownership ───────────────────────────────────────────

/**
 * CLAIM PROTOCOL:
 *
 * 1. Read task. Verify it exists and is not owned.
 * 2. Verify no active task-switch for the chatId (unless explicitly handled).
 * 3. Verify dependencies are CLOSED (unless intent is READ/AUDIT).
 * 4. Verify no scope conflicts with existing IMPLEMENTING tasks.
 * 5. Write task with ownerChatId = chatId (atomic).
 * 6. Acquire resource locks for all declared files/dirs.
 * 7. Update chat entry.
 * 8. Audit.
 *
 * Returns either success or structured conflict info.
 */
export async function claimTask(
  taskId: string,
  chatId: string,
  agent: string,
  intent: CoordIntent,
  scope: CoordScope,
): Promise<
  | { success: true; task: CoordTask; locks: CoordResourceLock[] }
  | { success: false; conflictType: string; message: string; ownerChatId?: string | null; currentPhase?: CoordTaskStatus | null; conflictId?: string }
> {
  const task = await getTask(taskId);
  if (!task) {
    return { success: false, conflictType: 'TASK_NOT_FOUND', message: `Task ${taskId} does not exist` };
  }

  // ── DUPLICATE TASK CHECK ─────────────────────────────────────────────────
  if (task.ownerChatId && task.ownerChatId !== chatId) {
    if (intent === 'IMPLEMENT') {
      const conflictId = await recordConflict('DUPLICATE_TASK', `Duplicate IMPLEMENT claim on ${taskId}`, [taskId], [task.ownerChatId, chatId]);
      await appendAuditEvent('DUPLICATE_TASK_DETECTED', { taskId, requestedBy: chatId, existingOwner: task.ownerChatId }, { taskId, chatId });
      return {
        success: false,
        conflictType: 'DUPLICATE_TASK',
        message: `DUPLICATE TASK DETECTED\n\nTask: ${taskId}\nCurrent owner: ${task.ownerChatId}\nCurrent phase: ${task.phase}\nRequested by: ${chatId}\n\nAction: BLOCK IMPLEMENTATION\nAllowed: READ-ONLY AUDIT / REVIEW / VALIDATION`,
        ownerChatId: task.ownerChatId,
        currentPhase: task.phase,
        conflictId,
      };
    }
    // Non-IMPLEMENT intents are always allowed for read access
  }

  // ── TASK-SWITCH PROTECTION ───────────────────────────────────────────────
  if (intent === 'IMPLEMENT') {
    const chat = await getChatEntry(chatId);
    if (chat && chat.currentTaskId && chat.currentTaskId !== taskId) {
      const activeTask = await getTask(chat.currentTaskId);
      if (activeTask && activeTask.phase !== 'CLOSED' && activeTask.ownerChatId === chatId) {
        const conflictId = await recordConflict('TASK_SWITCH', `Uncontrolled task switch by ${chatId}`, [chat.currentTaskId, taskId], [chatId]);
        await appendAuditEvent('TASK_SWITCH_DETECTED', { currentTask: chat.currentTaskId, newTask: taskId, chatId }, { chatId, taskId });
        return {
          success: false,
          conflictType: 'TASK_SWITCH',
          message: `TASK SWITCH DETECTED\n\nCurrent task: ${chat.currentTaskId}\nCurrent state: ${activeTask.phase}\nNew task: ${taskId}\n\nAction: Finish current task, or explicitly HANDOFF, or mark BLOCKED.\nDo not allow uncontrolled task expansion.`,
          conflictId,
        };
      }
    }
  }

  // ── DEPENDENCY CHECK ─────────────────────────────────────────────────────
  if (intent === 'IMPLEMENT' && task.dependencies.length > 0) {
    const blockedBy: string[] = [];
    for (const depId of task.dependencies) {
      const dep = await getTask(depId);
      if (!dep || dep.phase !== 'CLOSED') {
        blockedBy.push(depId);
      }
    }
    if (blockedBy.length > 0) {
      const conflictId = await recordConflict('DEPENDENCY_BLOCK', `${taskId} blocked by incomplete dependencies`, [...blockedBy, taskId], [chatId]);
      await appendAuditEvent('DEPENDENCY_BLOCKED', { taskId, blockedBy, chatId }, { taskId, chatId });
      return {
        success: false,
        conflictType: 'DEPENDENCY_BLOCK',
        message: `DEPENDENCY BLOCK\n\nTask: ${taskId}\nDepends on: ${blockedBy.join(', ')}\nDependency state: IN_PROGRESS / BLOCKED\n\nAllowed: READ-ONLY preparation\nForbidden: Final implementation based on unstable contract`,
        conflictId,
      };
    }
  }

  // ── SCOPE CONFLICT CHECK (only for IMPLEMENT) ────────────────────────────
  if (intent === 'IMPLEMENT') {
    const allTasks = await listTasks();
    for (const other of allTasks) {
      if (other.taskId === taskId) continue;
      if (other.phase !== 'IMPLEMENTING') continue;
      if (!other.ownerChatId || other.ownerChatId === chatId) continue;

      const overlapping = scopesOverlap(scope, other.scope);
      if (overlapping.length > 0) {
        const conflictId = await recordConflict(
          'FILE_COLLISION',
          `Scope overlap between ${taskId} (${chatId}) and ${other.taskId} (${other.ownerChatId})`,
          overlapping,
          [chatId, other.ownerChatId],
        );
        await appendAuditEvent('CONFLICT_DETECTED', { taskId, conflictingTask: other.taskId, sharedResources: overlapping }, { taskId, chatId });
        return {
          success: false,
          conflictType: 'RESOURCE_CONFLICT',
          message: `RESOURCE CONFLICT\n\nResources: ${overlapping.join(', ')}\nOwner: ${other.ownerChatId} (task: ${other.taskId})\nRequested by: ${chatId}\n\nAction: DO NOT MODIFY\nAllowed: READ-ONLY`,
          ownerChatId: other.ownerChatId,
          conflictId,
        };
      }
    }
  }

  // ── ATOMIC SENTINEL CLAIM ────────────────────────────────────────────────
  if (intent === 'IMPLEMENT') {
    const lockFile = path.join(TASKS_DIR, `${taskId}.lock`);
    try {
      await fsp.writeFile(lockFile, chatId, { flag: 'wx' });
    } catch (e: any) {
      if (e.code === 'EEXIST') {
        // We lost the race
        await new Promise(r => setTimeout(r, 50));
        const t = await getTask(taskId);
        return {
          success: false,
          conflictType: 'DUPLICATE_TASK',
          message: `DUPLICATE TASK DETECTED\n\nTask: ${taskId}\nOwner: ${t?.ownerChatId}`,
          ownerChatId: t?.ownerChatId
        };
      }
      throw e;
    }
  }

  // ── ACQUIRE LOCKS ────────────────────────────────────────────────────────
  const acquiredLocks: CoordResourceLock[] = [];
  if (intent === 'IMPLEMENT') {
    const resources = [
      ...scope.files,
      ...scope.directories,
    ];
    for (const resource of resources) {
      const existingLock = await getResourceLock(resource);
      if (existingLock && existingLock.chatId !== chatId && existingLock.mode === 'WRITE') {
        // Rollback already acquired locks
        for (const al of acquiredLocks) {
          await releaseResourceLock(al.resource, chatId);
        }
        await fsp.unlink(path.join(TASKS_DIR, `${taskId}.lock`)).catch(()=>{});
        const conflictId = await recordConflict('FILE_COLLISION', `WRITE lock conflict on ${resource}`, [resource], [chatId, existingLock.chatId]);
        return {
          success: false,
          conflictType: 'RESOURCE_CONFLICT',
          message: `RESOURCE CONFLICT\n\nResource: ${resource}\nOwner: ${existingLock.chatId}\nOwner Task: ${existingLock.taskId}\nRequested operation: WRITE\n\nAction: DO NOT MODIFY`,
          ownerChatId: existingLock.chatId,
          conflictId,
        };
      }
      const lock = await acquireResourceLock(resource, taskId, chatId, 'WRITE');
      acquiredLocks.push(lock);
      await appendAuditEvent('RESOURCE_LOCKED', { resource, taskId, chatId }, { taskId, chatId, resource });
    }
  }

  // ── UPDATE TASK ──────────────────────────────────────────────────────────
  const newPhase: CoordTaskStatus = intent === 'IMPLEMENT' ? 'CLAIMED' : task.phase === 'TODO' ? 'TODO' : task.phase;
  task.ownerChatId = intent === 'IMPLEMENT' ? chatId : task.ownerChatId;
  task.phase = intent === 'IMPLEMENT' ? 'CLAIMED' : newPhase;
  task.intent = intent;
  task.scope = intent === 'IMPLEMENT' ? scope : task.scope;
  await saveTask(task);

  // ── UPDATE CHAT ENTRY ────────────────────────────────────────────────────
  await ensureDirs();
  const chatFile = path.join(CHATS_DIR, `${chatId}.json`);
  let chat = await readJson<CoordChatEntry>(chatFile);
  if (!chat) {
    chat = {
      chatId, agent,
      currentTaskId: null, phase: null, intent: null, scope: null,
      locks: [], lastActivity: nowIso(), registeredAt: nowIso(),
    };
  }
  chat.currentTaskId = taskId;
  chat.phase = task.phase;
  chat.intent = intent;
  chat.scope = scope;
  chat.locks = [...new Set([...chat.locks, ...acquiredLocks.map(l => l.resource)])];
  chat.lastActivity = nowIso();
  await atomicWrite(chatFile, JSON.stringify(chat, null, 2) + '\n');

  await appendAuditEvent('TASK_CLAIMED', { taskId, chatId, agent, intent, scope }, { taskId, chatId });
  return { success: true, task, locks: acquiredLocks };
}

// ─── RELEASE TASK ─────────────────────────────────────────────────────────────

export async function releaseTask(taskId: string, chatId: string): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (task.ownerChatId !== chatId) throw new Error(`Task ${taskId} is not owned by chat ${chatId}`);

  // Release all resource locks for this task
  const lockFiles = await listJsonFiles(LOCKS_DIR);
  for (const lf of lockFiles) {
    const lock = await readJson<CoordResourceLock>(path.join(LOCKS_DIR, lf));
    if (lock && lock.taskId === taskId && lock.chatId === chatId) {
      await fsp.unlink(path.join(LOCKS_DIR, lf)).catch(() => { /* ignore */ });
      await appendAuditEvent('RESOURCE_RELEASED', { resource: lock.resource, taskId, chatId }, { taskId, chatId, resource: lock.resource });
    }
  }

  // Reset task ownership
  task.ownerChatId = null;
  task.phase = 'TODO';
  task.intent = 'READ';
  await saveTask(task);
  await fsp.unlink(path.join(TASKS_DIR, `${taskId}.lock`)).catch(() => { /* ignore */ });

  // Update chat entry
  const chatFile = path.join(CHATS_DIR, `${chatId}.json`);
  const chat = await readJson<CoordChatEntry>(chatFile);
  if (chat && chat.currentTaskId === taskId) {
    chat.currentTaskId = null;
    chat.phase = null;
    chat.intent = null;
    chat.scope = null;
    chat.locks = chat.locks.filter(l => {
      const lf2 = resourceToFilename(l);
      return fs.existsSync(path.join(LOCKS_DIR, lf2));
    });
    chat.lastActivity = nowIso();
    await atomicWrite(chatFile, JSON.stringify(chat, null, 2) + '\n');
  }

  await appendAuditEvent('TASK_RELEASED', { taskId, chatId }, { taskId, chatId });
}

// ─── PHASE / STATUS UPDATE ────────────────────────────────────────────────────

export async function updateTaskPhase(taskId: string, chatId: string, phase: CoordTaskStatus): Promise<CoordTask> {
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (task.ownerChatId !== chatId) throw new Error(`Task ${taskId} is not owned by chat ${chatId}`);

  // CLOSED gate enforcement
  if (phase === 'CLOSED') {
    const ev = task.evidence;
    if (!ev) {
      throw new Error(`CLOSED requires validation evidence. Run /validate ${taskId} first.`);
    }
    if (ev.remainingBlockers.length > 0) {
      throw new Error(`BLOCKED → CLOSED transition forbidden. Blockers: ${ev.remainingBlockers.join('; ')}`);
    }
    const required = [
      ev.lintPassed,
      ev.typecheckPassed,
      ev.scopeVerified,
      ev.architectureVerified,
    ];
    if (required.some(v => v === false)) {
      throw new Error('CLOSED requires lint, typecheck, scope, and architecture verification to pass.');
    }
  }

  task.phase = phase;
  await saveTask(task);

  const chatFile = path.join(CHATS_DIR, `${chatId}.json`);
  const chat = await readJson<CoordChatEntry>(chatFile);
  if (chat) {
    chat.phase = phase;
    chat.lastActivity = nowIso();
    await atomicWrite(chatFile, JSON.stringify(chat, null, 2) + '\n');
  }

  if (phase === 'CLOSED') {
    // Release locks on close
    await releaseTask(taskId, chatId).catch(() => { /* already released */ });
    await appendAuditEvent('TASK_CLOSED', { taskId, chatId }, { taskId, chatId });
  }

  return task;
}

// ─── VALIDATION GATE ─────────────────────────────────────────────────────────

export async function recordValidation(
  taskId: string,
  chatId: string,
  evidence: CoordValidationEvidence,
): Promise<CoordTask> {
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (task.ownerChatId !== chatId) throw new Error(`Task ${taskId} is not owned by chat ${chatId}`);

  task.evidence = { ...evidence, recordedAt: nowIso() };

  const allPassed = (
    evidence.remainingBlockers.length === 0 &&
    evidence.lintPassed !== false &&
    evidence.typecheckPassed !== false &&
    evidence.scopeVerified !== false &&
    evidence.architectureVerified !== false
  );

  if (allPassed) {
    task.phase = 'VALIDATING';
    await appendAuditEvent('VALIDATION_PASSED', { taskId, chatId, evidence }, { taskId, chatId });
  } else {
    await appendAuditEvent('VALIDATION_FAILED', {
      taskId, chatId,
      blockers: evidence.remainingBlockers,
    }, { taskId, chatId });
  }

  await saveTask(task);
  return task;
}

// ─── HANDOFF ─────────────────────────────────────────────────────────────────

export async function initiateHandoff(
  taskId: string,
  fromChatId: string,
  toChatId: string,
  handoff: Omit<CoordHandoff, 'fromChatId' | 'toChatId' | 'initiatedAt'>,
): Promise<CoordTask> {
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (task.ownerChatId !== fromChatId) throw new Error(`Only the owner can initiate a handoff`);

  task.pendingHandoff = {
    ...handoff,
    fromChatId,
    toChatId,
    initiatedAt: nowIso(),
  };
  task.phase = 'BLOCKED';
  await saveTask(task);

  await appendAuditEvent('HANDOFF_STARTED', { taskId, fromChatId, toChatId, handoff }, { taskId, chatId: fromChatId });
  return task;
}

export async function acceptHandoff(taskId: string, toChatId: string, agent: string): Promise<CoordTask> {
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (!task.pendingHandoff) throw new Error(`Task ${taskId} has no pending handoff`);
  if (task.pendingHandoff.toChatId !== toChatId) {
    throw new Error(`Handoff is addressed to ${task.pendingHandoff.toChatId}, not ${toChatId}`);
  }

  const fromChatId = task.pendingHandoff.fromChatId;
  const scope = task.scope;

  // Transfer locks
  const lockFiles = await listJsonFiles(LOCKS_DIR);
  for (const lf of lockFiles) {
    const lockPath = path.join(LOCKS_DIR, lf);
    const lock = await readJson<CoordResourceLock>(lockPath);
    if (lock && lock.taskId === taskId && lock.chatId === fromChatId) {
      lock.chatId = toChatId;
      lock.acquiredAt = nowIso();
      await atomicWrite(lockPath, JSON.stringify(lock, null, 2) + '\n');
    }
  }

  // Update old chat
  const oldChatFile = path.join(CHATS_DIR, `${fromChatId}.json`);
  const oldChat = await readJson<CoordChatEntry>(oldChatFile);
  if (oldChat && oldChat.currentTaskId === taskId) {
    oldChat.currentTaskId = null;
    oldChat.phase = null;
    oldChat.intent = null;
    oldChat.scope = null;
    oldChat.locks = [];
    oldChat.lastActivity = nowIso();
    await atomicWrite(oldChatFile, JSON.stringify(oldChat, null, 2) + '\n');
  }

  // Update new chat
  const newChatFile = path.join(CHATS_DIR, `${toChatId}.json`);
  let newChat = await readJson<CoordChatEntry>(newChatFile);
  if (!newChat) {
    newChat = {
      chatId: toChatId, agent,
      currentTaskId: null, phase: null, intent: null, scope: null,
      locks: [], lastActivity: nowIso(), registeredAt: nowIso(),
    };
  }
  newChat.currentTaskId = taskId;
  newChat.phase = 'CLAIMED';
  newChat.intent = 'IMPLEMENT';
  newChat.scope = scope;
  newChat.locks = [...scope.files, ...scope.directories];
  newChat.lastActivity = nowIso();
  await atomicWrite(newChatFile, JSON.stringify(newChat, null, 2) + '\n');

  // Finalize task
  task.ownerChatId = toChatId;
  task.phase = 'CLAIMED';
  task.pendingHandoff = { ...task.pendingHandoff!, acceptedAt: nowIso() };
  await saveTask(task);

  await appendAuditEvent('HANDOFF_ACCEPTED', { taskId, fromChatId, toChatId }, { taskId, chatId: toChatId });
  return task;
}

// ─── RESOURCE LOCKS ───────────────────────────────────────────────────────────

async function acquireResourceLock(
  resource: string,
  taskId: string,
  chatId: string,
  mode: 'WRITE' | 'READ_ONLY',
): Promise<CoordResourceLock> {
  await fsp.mkdir(LOCKS_DIR, { recursive: true });
  const lockPath = path.join(LOCKS_DIR, resourceToFilename(resource));
  const lock: CoordResourceLock = {
    resource: normalizePath(resource),
    taskId,
    chatId,
    mode,
    acquiredAt: nowIso(),
  };
  await atomicWrite(lockPath, JSON.stringify(lock, null, 2) + '\n');
  return lock;
}

export async function getResourceLock(resource: string): Promise<CoordResourceLock | null> {
  const lockPath = path.join(LOCKS_DIR, resourceToFilename(resource));
  return readJson<CoordResourceLock>(lockPath);
}

async function releaseResourceLock(resource: string, chatId: string): Promise<void> {
  const lockPath = path.join(LOCKS_DIR, resourceToFilename(resource));
  const lock = await readJson<CoordResourceLock>(lockPath);
  if (lock && lock.chatId === chatId) {
    await fsp.unlink(lockPath).catch(() => { /* ignore */ });
  }
}

export async function listLocks(): Promise<CoordResourceLock[]> {
  const files = await listJsonFiles(LOCKS_DIR);
  const locks: CoordResourceLock[] = [];
  for (const f of files) {
    const lock = await readJson<CoordResourceLock>(path.join(LOCKS_DIR, f));
    if (lock) locks.push(lock);
  }
  return locks;
}

// ─── CONFLICTS ────────────────────────────────────────────────────────────────

export async function recordConflict(
  type: ConflictType,
  description: string,
  subjects: string[],
  involvedChatIds: string[],
): Promise<string> {
  await fsp.mkdir(CONFLICTS_DIR, { recursive: true });
  const conflictId = `CONFLICT-${Date.now()}-${shortId()}`;
  const conflict: CoordConflict = {
    conflictId,
    type,
    description,
    subjects,
    involvedChatIds,
    resolved: false,
    detectedAt: nowIso(),
  };
  const file = path.join(CONFLICTS_DIR, `${conflictId}.json`);
  await atomicWrite(file, JSON.stringify(conflict, null, 2) + '\n');
  await appendAuditEvent('CONFLICT_DETECTED', { conflictId, type, description, subjects, involvedChatIds });
  return conflictId;
}

export async function resolveConflict(conflictId: string, resolution: string): Promise<void> {
  const file = path.join(CONFLICTS_DIR, `${conflictId}.json`);
  const conflict = await readJson<CoordConflict>(file);
  if (!conflict) throw new Error(`Conflict ${conflictId} not found`);
  conflict.resolved = true;
  conflict.resolution = resolution;
  conflict.resolvedAt = nowIso();
  await atomicWrite(file, JSON.stringify(conflict, null, 2) + '\n');
}

export async function listConflicts(openOnly = true): Promise<CoordConflict[]> {
  const files = await listJsonFiles(CONFLICTS_DIR);
  const conflicts: CoordConflict[] = [];
  for (const f of files) {
    const c = await readJson<CoordConflict>(path.join(CONFLICTS_DIR, f));
    if (c && (!openOnly || !c.resolved)) conflicts.push(c);
  }
  return conflicts.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

// ─── WORKSPACE DIFF ───────────────────────────────────────────────────────────

/**
 * Detects undeclared workspace changes by comparing declared scope against
 * current git working-tree modifications.
 * Safe: never writes to git, never resets anything.
 */
export async function detectWorkspaceDiff(taskId: string): Promise<WorkspaceDiff> {
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const declared = [
    ...task.scope.files.map(normalizePath),
    ...task.scope.directories.map(d => normalizePath(d).replace(/\/\*\*$/, '')),
  ];

  // Get actual modified files from git
  let actualModified: string[] = [];
  try {
    const { execSync } = await import('node:child_process');
    const raw = execSync('git diff --name-only HEAD', {
      cwd: path.resolve(CRTX_ROOT, '..'), // repo root
      encoding: 'utf8',
      timeout: 10_000,
    });
    actualModified = raw.split('\n').map(l => normalizePath(l.trim())).filter(Boolean);
  } catch {
    // git unavailable or not a git repo — best-effort
  }

  // Find undeclared
  const undeclared = actualModified.filter(modified => {
    return !declared.some(d => modified === d || modified.startsWith(d + '/'));
  });

  const diff: WorkspaceDiff = {
    declaredScope: declared,
    actualModified,
    undeclared,
    hasViolation: undeclared.length > 0,
    checkedAt: nowIso(),
  };

  if (diff.hasViolation) {
    await appendAuditEvent('SCOPE_VIOLATION', { taskId, undeclared }, { taskId });
  }

  return diff;
}

// ─── STATUS OUTPUT ────────────────────────────────────────────────────────────

export async function getStatus(): Promise<StatusOutput> {
  const [tasks, chats, openConflicts] = await Promise.all([
    listTasks(),
    listChats(),
    listConflicts(true),
  ]);

  const activeTasks = tasks.filter(t => t.phase !== 'CLOSED' && t.phase !== 'TODO').length;
  const activeChats = chats.filter(c => c.currentTaskId !== null).length;

  const fileCollisions = openConflicts.filter(c => c.type === 'FILE_COLLISION').length;
  const duplicates = openConflicts.filter(c => c.type === 'DUPLICATE_TASK').length;
  const depBlocks = openConflicts.filter(c => c.type === 'DEPENDENCY_BLOCK').length;
  const scopeViolations = openConflicts.filter(c => c.type === 'SCOPE_VIOLATION').length;

  const staleLocks = chats.filter(c => isChatStale(c) && c.currentTaskId !== null).length;

  return {
    generatedAt: nowIso(),
    activeTasks,
    activeChats,
    chats,
    tasks,
    openConflicts,
    stats: {
      conflicts: openConflicts.length,
      duplicates,
      fileCollisions,
      dependencyBlocks: depBlocks,
      undeclaredChanges: scopeViolations,
      staleLocks,
    },
  };
}

// ─── STALE DETECTION ─────────────────────────────────────────────────────────

export async function markStaleOwners(): Promise<CoordChatEntry[]> {
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
}
