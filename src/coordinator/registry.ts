import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CoordTask, CoordResourceLock, CoordChatEntry, CoordConflict,
  CoordAuditEvent, CoordEventType, CoordTaskStatus, CoordScope,
  CoordIntent, CoordValidationEvidence, CoordHandoff,
  WorkspaceDiff, StatusOutput, ConflictType, CoordinatorState, ClaimTaskConflict, HeartbeatRequest,
  CoordPeerMessage, CoordFileLock, AgentRoleConfig
} from './types';
import { AutomaticCoordination, AutomaticRequest, AutomaticSnapshot, AutomaticRole, AutomaticDirectMessage, Artifact, Cycle, Gate, CrtxEventEnvelope } from './types';

const CRTX_ROOT = path.resolve(__dirname, '..', '..');
const COORD_DIR = process.env.CRTX_COORDINATOR_TEST_ROOT || path.join(CRTX_ROOT, 'coordinator');
const STATE_FILE = path.join(COORD_DIR, 'state.json');
const EVENTS_FILE = path.join(COORD_DIR, 'events.jsonl');
const LOCK_FILE = path.join(COORD_DIR, 'coordinator.lock');

const STALE_THRESHOLD_MS = 15 * 60 * 1000;

const AUTOMATIC_LEASE_MS = 60_000;
const AUTOMATIC_ROLES: AutomaticRole[] = ['WRITER', 'REVIEWER', 'QA', 'RESERVE'];

function automaticState(state: CoordinatorState): AutomaticCoordination {
  const auto = state.automatic ??= { agents: {}, work: {}, managerId: null, managerUntil: 0, epoch: 0 };
  if (!auto.cycles) auto.cycles = {};
  if (!auto.gates) auto.gates = {};
  if (!auto.artifacts) auto.artifacts = {};
  return auto;
}

export async function isAutomaticAgent(id: string): Promise<boolean> {
  return readOnly(state => Boolean(state.automatic?.agents[id]));
}

function checkedId(id: string): void {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(id)) throw new Error('Invalid stable identifier');
}

function checkedCapabilities(capabilities: string[]): void {
  if (!Array.isArray(capabilities) || capabilities.length > 32 || capabilities.some(capability => typeof capability !== 'string' || !/^[a-z][a-z0-9:-]{0,63}$/.test(capability))) throw new Error('Invalid bounded capabilities');
}

function authenticateAutomatic(state: CoordinatorState, agentId: string, token: string): void {
  checkedId(agentId);
  if (typeof token !== 'string' || token.length > 256) throw new Error('Unauthorized agent');
  const agent = state.automatic?.agents[agentId];
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  if (!agent || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(agent.tokenHash))) throw new Error('Unauthorized agent');
}

export async function claimAutomaticDirectMessage(recipientId: string, token: string, messageId: string, prompt: string): Promise<{ launch: boolean; message: AutomaticDirectMessage }> {
  checkedId(messageId);
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 2048) throw new Error('Bounded direct prompt required');
  return withCoordinatorLock(async state => {
    authenticateAutomatic(state, recipientId, token);
    const automatic = automaticState(state);
    const messages = automatic.direct ??= {};
    const now = Date.now();
    for (const message of Object.values(messages)) if (['CLAIMED', 'STARTED'].includes(message.status) && message.leaseUntil <= now) {
      message.status = 'BLOCKED'; message.blocker = 'TIMEOUT';
    }
    if (messages[messageId]) {
      if (messages[messageId].recipientId !== recipientId || messages[messageId].prompt !== prompt) throw new Error('Message ID identity/content conflict');
      return { result: { launch: false, message: messages[messageId] }, events: [] };
    }
    if (Object.keys(messages).length >= 64) throw new Error('Direct mailbox capacity reached');
    const agent = automatic.agents[recipientId];
    const busy = Object.values(messages).some(message => message.recipientId === recipientId && ['CLAIMED', 'STARTED'].includes(message.status));
    const allowed = agent.canManage && automatic.managerId === recipientId && automatic.managerUntil > now;
    const message: AutomaticDirectMessage = { messageId, recipientId, prompt, status: allowed && !busy ? 'CLAIMED' : 'BLOCKED', runId: crypto.randomUUID(), leaseUntil: now + 180_000, createdAt: now, output: allowed && !busy ? '' : 'Manager-only read-only adapter unavailable or recipient already executing' };
    if (!allowed || busy) message.blocker = 'NO_ADAPTER';
    messages[messageId] = message;
    return { result: { launch: allowed && !busy, message }, events: [] };
  });
}

export async function updateAutomaticDirectMessage(recipientId: string, token: string, messageId: string, runId: string, update: { status: AutomaticDirectMessage['status']; output?: string; blocker?: AutomaticDirectMessage['blocker']; preflight?: AutomaticDirectMessage['preflight'] }): Promise<AutomaticDirectMessage> {
  return withCoordinatorLock(async state => {
    authenticateAutomatic(state, recipientId, token);
    const message = state.automatic?.direct?.[messageId];
    if (!message || message.recipientId !== recipientId || message.runId !== runId || !['CLAIMED', 'STARTED'].includes(message.status) || message.leaseUntil <= Date.now()) throw new Error('Current direct execution lease required');
    if (!['STARTED', 'COMPLETED', 'BLOCKED'].includes(update.status)) throw new Error('Invalid direct transition');
    message.status = update.status;
    message.progressAt = Date.now();
    if (update.status === 'STARTED') message.startedAt ??= Date.now();
    if (update.output) message.output = update.output.slice(0, 8192);
    message.blocker = update.blocker;
    if (update.preflight) message.preflight = update.preflight;
    return { result: message, events: [] };
  });
}

export async function getAutomaticDirectMessages(recipientId: string, token: string): Promise<AutomaticDirectMessage[]> {
  return readOnly(state => { authenticateAutomatic(state, recipientId, token); return Object.values(state.automatic?.direct ?? {}).filter(message => message.recipientId === recipientId); });
}

/** Local CLI provisioning is a trusted user action, never a WebSocket operation. */
export async function authorizeAutomaticAgent(id: string, token: string, capabilities: string[], roles: AutomaticRole[], canManage: boolean): Promise<void> {
  checkedId(id);
  checkedCapabilities(capabilities);
  if (typeof token !== 'string' || token.length < 32 || token.length > 256) throw new Error('Agent token must contain 32..256 characters');
  if (!Array.isArray(roles) || roles.length < 1 || roles.length > 4 || roles.some(role => !AUTOMATIC_ROLES.includes(role))) throw new Error('Invalid roles');
  await withCoordinatorLock(async state => {
    const automatic = automaticState(state);
    if (!automatic.agents[id] && Object.keys(automatic.agents).length >= 32) throw new Error('Agent registry capacity reached');
    if (automatic.agents[id]) throw new Error('Agent already authorized; identity cannot be overwritten');
    automatic.agents[id] = { id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), capabilities: [...new Set(capabilities)], roles: [...new Set(roles)], canManage, leaseUntil: 0, credits: 'AVAILABLE', model: '' };
    return { result: undefined, events: [] };
  });
}

function automaticTick(state: CoordinatorState, now: number): void {
  const automatic = automaticState(state);
  const eligible = Object.values(automatic.agents).filter(agent => agent.leaseUntil > now && agent.credits === 'AVAILABLE');
  const current = automatic.managerId ? automatic.agents[automatic.managerId] : undefined;
  if (!current || automatic.managerUntil <= now || current.leaseUntil <= now || current.credits !== 'AVAILABLE' || !current.canManage) {
    const candidate = eligible.filter(agent => agent.canManage).sort((left, right) => left.id.localeCompare(right.id))[0];
    if (automatic.managerId !== (candidate?.id ?? null) || automatic.managerUntil <= now) automatic.epoch += 1;
    automatic.managerId = candidate?.id ?? null;
    automatic.managerUntil = candidate ? now + AUTOMATIC_LEASE_MS : 0;
  }
  for (const work of Object.values(automatic.work)) {
    if (work.ownerId && ['OFFERED', 'ACKNOWLEDGED', 'RUNNING'].includes(work.phase) && work.leaseUntil <= now) {
      if (work.phase === 'OFFERED') {
        for (const [resource, lock] of Object.entries(state.locks)) if (lock.taskId === work.taskId) delete state.locks[resource];
        state.tasks[work.taskId].ownerChatId = null;
        state.tasks[work.taskId].phase = 'TODO';
        work.ownerId = null;
        work.phase = 'QUEUED';
      } else {
        work.phase = 'BLOCKED';
        work.notes = 'Lease expired; preserve dirty files and locks pending explicit manager handoff';
        state.tasks[work.taskId].phase = 'BLOCKED';
      }
    }
  }
  if (!automatic.managerId) return;
  for (const work of Object.values(automatic.work).sort((left, right) => left.taskId.localeCompare(right.taskId))) {
    if (work.phase !== 'QUEUED') continue;
    const task = state.tasks[work.taskId];
    if (task.ownerChatId || task.dependencies.some(id => state.tasks[id]?.phase !== 'CLOSED')) continue;
    if (task.scope.files.some(file => state.locks[file] || (state.fileLocks?.[file] && state.fileLocks[file].expiresAt > now))) continue;

    // ----- GATE EVALUATION -----
    const taskGates = Object.values(automatic.gates || {}).filter(g => g.targetId === work.taskId);
    if (taskGates.length > 0) {
      const blockedByGate = taskGates.some(g => g.status !== 'PASS');
      if (blockedByGate) continue;
    }
    // ---------------------------
    const agent = eligible.filter(candidate => candidate.id !== automatic.managerId && candidate.id !== work.authorId && candidate.roles.includes(work.role) && work.capabilities.every(capability => candidate.capabilities.includes(capability)) && !Object.values(automatic.work).some(existing => existing.ownerId === candidate.id && !['ACCEPTED'].includes(existing.phase))).sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!agent) continue;
    work.ownerId = agent.id;
    work.phase = 'OFFERED';
    work.assignmentId = crypto.randomUUID();
    work.leaseUntil = now + AUTOMATIC_LEASE_MS;
    task.ownerChatId = agent.id;
    task.phase = 'CLAIMED';
    task.intent = work.role === 'WRITER' ? 'IMPLEMENT' : 'AUDIT';
    for (const file of task.scope.files) state.locks[file] = { resource: file, taskId: task.taskId, chatId: agent.id, mode: work.role === 'WRITER' ? 'WRITE' : 'READ_ONLY', acquiredAt: nowIso() };
  }
}

/** Shared atomic state protects both hubs and CLI processes from split-brain. No shell/model execution. */
export async function automaticRequest(request: AutomaticRequest): Promise<AutomaticSnapshot> {
  checkedId(request.agentId);
  if (typeof request.token !== 'string' || request.token.length > 256) throw new Error('Unauthorized agent');
  if (request.notes && (typeof request.notes !== 'string' || request.notes.length > 4096)) throw new Error('Notes exceed bound');
  if (request.evidence && (!Array.isArray(request.evidence) || request.evidence.length > 16 || request.evidence.some(item => typeof item !== 'string' || item.length > 2048))) throw new Error('Evidence exceeds bound');
  return withCoordinatorLock(async state => {
    const automatic = automaticState(state);
    const agent = automatic.agents[request.agentId];
    const digest = crypto.createHash('sha256').update(request.token).digest('hex');
    if (!agent || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(agent.tokenHash))) throw new Error('Unauthorized agent');
    const now = Date.now();
    if (request.action === 'REGISTER' || request.action === 'HEARTBEAT') {
      agent.leaseUntil = now + AUTOMATIC_LEASE_MS;
      if (request.credits) {
        if (!['AVAILABLE', 'EXHAUSTED'].includes(request.credits)) throw new Error('Invalid credits state');
        agent.credits = request.credits;
      }
      if (request.model) {
        if (typeof request.model !== 'string' || request.model.length > 128) throw new Error('Invalid model label');
        agent.model = request.model;
      }
      if (automatic.managerId === agent.id && automatic.managerUntil > now) automatic.managerUntil = now + AUTOMATIC_LEASE_MS;
      for (const work of Object.values(automatic.work)) if (work.ownerId === agent.id && work.phase === 'RUNNING' && agent.credits === 'EXHAUSTED') {
        work.phase = 'BLOCKED'; work.notes = 'Credits exhausted; preserve dirty files and locks'; state.tasks[work.taskId].phase = 'BLOCKED';
      }
    }
    automaticTick(state, now);
    const managerAction = ['ENQUEUE', 'HANDOFF', 'ACCEPT', 'CREATE_CYCLE', 'CREATE_GATE'].includes(request.action);
    if (managerAction && (automatic.managerId !== agent.id || request.epoch !== automatic.epoch)) throw new Error('Current manager lease and fencing epoch required');

    // --- NEW ACTION HANDLERS ---
    const snapshotResult: AutomaticSnapshot = { managerId: automatic.managerId, epoch: automatic.epoch, role: (agent.roles as string[]).includes('MANAGER') ? 'MANAGER' : agent.roles[0], assignments: Object.values(automatic.work).filter(w => w.ownerId === agent.id), execution: 'TRANSPORT_ONLY_NO_MODEL_ADAPTER' };

    if (request.action === 'SUBMIT_ARTIFACT') {
      const artifact = request.artifact;
      if (!artifact || !artifact.id || !request.taskId) throw new Error('Artifact id and taskId required');
      const work = automatic.work[request.taskId];
      if (!work) throw new Error('Automatic task not found');
      
      // Idempotency: Return early if already exists
      if (automatic.artifacts && automatic.artifacts[artifact.id]) {
        return { result: snapshotResult, events: [] };
      }
      
      // Enforce Artifact <-> Task consistency
      const newArtifact: Artifact = {
        id: artifact.id,
        taskId: work.taskId,
        agentId: agent.id,
        type: artifact.type || 'UNKNOWN',
        status: (artifact.status as any) || 'UNKNOWN',
        content: artifact.content || '',
        timestamp: now,
        executionId: artifact.executionId,
        sessionId: artifact.sessionId
      };
      
      if (!automatic.artifacts) automatic.artifacts = {};
      automatic.artifacts[newArtifact.id] = newArtifact;
      
      if (!work.artifactIds) work.artifactIds = [];
      if (!work.artifactIds.includes(newArtifact.id)) work.artifactIds.push(newArtifact.id);
      
      return { result: snapshotResult, events: [] };
    }

    if (request.action === 'EVALUATE_GATE') {
      const isManager = (automatic.managerId === agent.id);
      const isEvaluator = (agent.roles as string[]).includes('MANAGER') || (agent.roles as string[]).includes('CODE_REVIEWER') || (agent.roles as string[]).includes('SUPERVISOR') || (agent.roles as string[]).includes('ANALYZER');
      if (!isManager && !isEvaluator) throw new Error('Unauthorized: Only an Evaluator or Manager can evaluate gates');
      
      const gateUpdate = request.gate;
      if (!gateUpdate || !gateUpdate.id) throw new Error('Gate ID required');
      if (!automatic.gates) automatic.gates = {};
      const gate = automatic.gates[gateUpdate.id];
      if (!gate) throw new Error('Gate not found');
      if (!['PASS', 'FAIL', 'BLOCKED', 'PENDING'].includes(gateUpdate.status || '')) throw new Error('Invalid gate status');
      
      gate.status = gateUpdate.status as any;
      gate.evaluatedBy = agent.id;
      gate.evaluatedAt = now;
      gate.evaluationArtifactIds = gateUpdate.evaluationArtifactIds || [];
      gate.reason = gateUpdate.reason || '';
      
      return { result: snapshotResult, events: [] };
    }

    if (request.action === 'CREATE_CYCLE') {
      const cycle = request.cycle;
      if (!cycle || !cycle.id) throw new Error('Cycle ID required');
      if (!automatic.cycles) automatic.cycles = {};
      automatic.cycles[cycle.id] = {
        id: cycle.id,
        status: (cycle.status as any) || 'PENDING',
        tasks: Array.isArray(cycle.tasks) ? cycle.tasks : []
      };
      return { result: snapshotResult, events: [] };
    }

    if (request.action === 'CREATE_GATE') {
      const gate = request.gate;
      if (!gate || !gate.id || !gate.targetId) throw new Error('Gate ID and targetId required');
      if (!automatic.gates) automatic.gates = {};
      automatic.gates[gate.id] = {
        id: gate.id,
        targetId: gate.targetId,
        type: (gate.type as any) || 'EVIDENCE',
        status: (gate.status as any) || 'PENDING',
        requiredArtifactTypes: Array.isArray(gate.requiredArtifactTypes) ? gate.requiredArtifactTypes : [],
        policyId: gate.policyId
      };
      return { result: snapshotResult, events: [] };
    }
    // ---------------------------
    if (request.action === 'ENQUEUE') {
      if (!request.taskId || !request.capabilities || !request.role || request.role === 'RESERVE') throw new Error('Task role and capabilities required');
      checkedCapabilities(request.capabilities);
      if (!AUTOMATIC_ROLES.includes(request.role)) throw new Error('Invalid task role');
      const task = state.tasks[request.taskId];
      if (!task || task.ownerChatId || task.phase !== 'TODO' || automatic.work[task.taskId]) throw new Error('Task must be existing unclaimed TODO; duplicate queue rejected');
      if (Object.keys(automatic.work).length >= 256) throw new Error('Bounded queue capacity reached');
      if (request.scope) task.scope = request.scope;
    if (!Array.isArray(task.scope.files) || !Array.isArray(task.scope.directories) || task.scope.directories.length || task.scope.files.length > 32 || task.scope.files.some(file => typeof file !== 'string' || file.length > 256 || path.isAbsolute(file) || file.includes('..') || /[*?\\]/.test(file))) throw new Error('Automatic scope requires bounded exact repo-relative files');
      const original = request.reviewOf ? automatic.work[request.reviewOf] : undefined;
      if (request.reviewOf && (!original || original.phase !== 'COMPLETED' || request.role === 'WRITER')) throw new Error('Independent review requires completed original task');
      automatic.work[task.taskId] = { taskId: task.taskId, capabilities: request.capabilities, role: request.role, reviewOf: request.reviewOf, authorId: original?.ownerId ?? undefined, ownerId: null, phase: 'QUEUED', leaseUntil: 0, assignmentId: '', notes: '', evidence: [] };
    } else if (!['REGISTER', 'HEARTBEAT'].includes(request.action)) {
      const work = request.taskId ? automatic.work[request.taskId] : undefined;
      if (!work) throw new Error('Automatic task not found');
      const task = state.tasks[work.taskId];
      if (request.action === 'HANDOFF') {
        const target = request.targetAgentId ? automatic.agents[request.targetAgentId] : undefined;
        if (!target || work.phase !== 'BLOCKED' || !request.notes || target.leaseUntil <= now || target.credits !== 'AVAILABLE' || !target.roles.includes(work.role) || work.capabilities.some(capability => !target.capabilities.includes(capability)) || target.id === work.authorId || Object.values(automatic.work).some(existing => existing.ownerId === target.id && existing.phase !== 'ACCEPTED')) throw new Error('Explicit capable idle handoff and preservation notes required');
        const previousOwner = work.ownerId;
        work.ownerId = target.id; work.assignmentId = crypto.randomUUID(); work.phase = 'OFFERED'; work.leaseUntil = now + AUTOMATIC_LEASE_MS; work.notes = request.notes;
        task.ownerChatId = target.id; task.phase = 'CLAIMED';
        for (const lock of Object.values(state.locks)) if (lock.taskId === task.taskId) lock.chatId = target.id;
        for (const file of task.scope.files) if (state.fileLocks?.[file]?.agent === previousOwner) state.fileLocks[file].agent = target.id;
      } else if (request.action === 'ACCEPT') {
        if (work.phase !== 'COMPLETED' || !work.evidence.length) throw new Error('Completion evidence required');
        if (work.role === 'WRITER' && !Object.values(automatic.work).some(review => review.reviewOf === work.taskId && review.phase === 'ACCEPTED' && review.ownerId !== work.ownerId)) throw new Error('Accepted independent review required');
        work.phase = 'ACCEPTED'; task.phase = 'CLOSED'; task.ownerChatId = null;
      } else {
        if (work.ownerId !== agent.id || work.assignmentId !== request.assignmentId || work.leaseUntil <= now || agent.leaseUntil <= now || agent.credits !== 'AVAILABLE') throw new Error('Current task owner and live assignment lease required');
        if (request.action === 'ACK' && ['OFFERED', 'ACKNOWLEDGED'].includes(work.phase)) { work.phase = 'ACKNOWLEDGED'; work.acknowledgedAt ??= now; }
        else if (request.action === 'START' && work.phase === 'ACKNOWLEDGED') { work.phase = 'RUNNING'; work.startedAt = now; task.phase = 'IMPLEMENTING'; }
        else if (request.action === 'PROGRESS' && work.phase === 'RUNNING') { work.notes = request.notes ?? work.notes; work.progressAt = now; }
        else if (request.action === 'BLOCK' && ['RUNNING', 'ACKNOWLEDGED'].includes(work.phase) && request.notes) { work.phase = 'BLOCKED'; task.phase = 'BLOCKED'; work.notes = request.notes; }
        else if (request.action === 'COMPLETE' && work.phase === 'RUNNING' && request.evidence?.length) {
          work.phase = 'COMPLETED'; work.evidence = request.evidence; work.notes = request.notes ?? '';
          task.phase = 'VALIDATING';
          // Completion stops writing; reviewed scope may now be claimed read-only.
          for (const [resource, lock] of Object.entries(state.locks)) if (lock.taskId === work.taskId) delete state.locks[resource];
          for (const file of task.scope.files) if (state.fileLocks?.[file]?.agent === agent.id) delete state.fileLocks[file];
        } else throw new Error('Invalid lifecycle transition');
        work.leaseUntil = now + AUTOMATIC_LEASE_MS;
      }
    }
    automaticTick(state, now);
    return { result: { managerId: automatic.managerId, epoch: automatic.epoch, role: automatic.managerId === agent.id ? 'MANAGER' : agent.roles[0], assignments: Object.values(automatic.work).filter(work => work.ownerId === agent.id), execution: 'TRANSPORT_ONLY_NO_MODEL_ADAPTER' }, events: [] };
  });
}

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
  await fsp.writeFile(tmp, JSON.stringify(state) + '\n', 'utf8');
  try {
    await fsp.rename(tmp, STATE_FILE);
  } catch (err: any) {
    if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EEXIST') {
      await fsp.copyFile(tmp, STATE_FILE);
      await fsp.unlink(tmp).catch(() => {});
    } else {
      throw err;
    }
  }
}

export async function appendAuditEvent(
  type: CoordEventType, payload: Record<string, unknown>, tags: { taskId?: string; chatId?: string; resource?: string } = {}
): Promise<void> {
  await ensureDirs();
  const event: CoordAuditEvent = { eventId: crypto.randomUUID(), type, payload, timestamp: nowIso(), ...tags };
  await fsp.appendFile(EVENTS_FILE, JSON.stringify(event) + '\n', 'utf8');
}

async function withCoordinatorLock<T>(
  operation: (state: CoordinatorState) => Promise<{ result: T; events: CoordAuditEvent[]; unchanged?: boolean }>
): Promise<T> {
  await ensureDirs();
  const token = await acquireLock();
  try {
    const state = await readState();
    const { result, events, unchanged } = await operation(state);
    if (!unchanged) await writeState(state);
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
    if (state.automatic?.work[taskId]) return { result: { success: false, message: 'Automatic tasks require authenticated lifecycle' }, events: [] };
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

export async function releaseTask(taskId: string, chatId: string, finalPhase?: CoordTaskStatus): Promise<void> {
  await withCoordinatorLock(async (state) => {
    if (state.automatic?.work[taskId]) throw new Error('Automatic tasks require authenticated lifecycle');
    const task = state.tasks[taskId];
    if (task && task.ownerChatId === chatId) {
      task.ownerChatId = null;
      task.phase = finalPhase || (task.phase === 'CLOSED' ? 'CLOSED' : 'TODO');
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
    if (state.automatic?.work[taskId]) throw new Error('Automatic tasks require authenticated lifecycle');
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
    if (state.automatic?.work[taskId]) throw new Error('Automatic tasks require authenticated lifecycle');
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
    if (state.automatic?.work[taskId]) throw new Error('Automatic tasks require authenticated lifecycle');
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

// ─── Real-Time Agent Mesh & Priority Preemption ───────────────────────────────

export const COORD_AGENT_PRIORITIES: Record<string, number> = {
  'Codex': 10,
  'Antigravity': 10,
  'Gemini': 10,
  'Gemini-2': 10
};

export function getCoordAgentPriority(_agent: string): number {
  return 10;
}

export type AcquireCoordFileLockResult = {
  success: boolean;
  file: string;
  priority: number;
  preempted?: boolean;
  previousOwner?: string;
  message?: string;
  expiresAt: string;
};

export async function acquireCoordFileLock(
  file: string,
  agent: string,
  reason = 'Modifying file',
  ttlSeconds = 120,
  lineStart?: number,
  lineEnd?: number
): Promise<AcquireCoordFileLockResult> {
  return withCoordinatorLock<AcquireCoordFileLockResult>(async (state) => {
    state.fileLocks = state.fileLocks || {};
    state.messages = state.messages || [];
    const normalizedFile = file.replace(/\\/g, '/');
    const now = Date.now();
    const priority = getCoordAgentPriority(agent);

    let expiredPurged = false;
    // Purge expired soft locks
    for (const [f, l] of Object.entries(state.fileLocks)) {
      if (l.expiresAt && now > l.expiresAt) {
        delete state.fileLocks[f];
        expiredPurged = true;
      }
    }

    const existing = state.fileLocks[normalizedFile];
    if (existing && existing.agent !== agent && now < existing.expiresAt) {
      const remainingSec = Math.ceil((existing.expiresAt - now) / 1000);
      return { result: { success: false, file: normalizedFile, priority, message: `File is locked by ${existing.agent} (${remainingSec}s remaining): ${existing.reason}`, expiresAt: new Date(existing.expiresAt).toISOString() }, events: [], unchanged: !expiredPurged };
    }

    const expiresAt = now + (ttlSeconds * 1000);
    state.fileLocks[normalizedFile] = {
      file: normalizedFile,
      agent,
      priority,
      reason,
      acquiredAt: nowIso(),
      expiresAt,
      ttlSeconds,
      ...(Number.isSafeInteger(lineStart) && lineStart! > 0 ? { lineStart } : {}),
      ...(Number.isSafeInteger(lineEnd) && lineEnd! > 0 ? { lineEnd } : {})
    };

    return {
      result: {
        success: true,
        file: normalizedFile,
        priority,
        expiresAt: new Date(expiresAt).toISOString()
      },
      events: []
    };
  });
}

export type ReleaseCoordFileLockResult = {
  success: boolean;
  released: string | null;
};

export async function releaseCoordFileLock(
  file: string,
  agent: string
): Promise<ReleaseCoordFileLockResult> {
  return withCoordinatorLock<ReleaseCoordFileLockResult>(async (state) => {
    state.fileLocks = state.fileLocks || {};
    const normalizedFile = file.replace(/\\/g, '/');
    if (state.fileLocks[normalizedFile]?.agent === agent) {
      delete state.fileLocks[normalizedFile];
      return { result: { success: true, released: normalizedFile }, events: [] };
    }
    return { result: { success: false, released: null }, events: [], unchanged: true };
  });
}

export async function expireCoordFileLock(file: string, now = Date.now()): Promise<boolean> {
  return withCoordinatorLock(async state => {
    const normalizedFile = file.replace(/\\/g, '/');
    const lock = state.fileLocks?.[normalizedFile];
    if (!lock || !lock.expiresAt || lock.expiresAt > now) {
      return { result: false, events: [], unchanged: true };
    }
    delete state.fileLocks![normalizedFile];
    return { result: true, events: [] };
  });
}

export async function releaseAllCoordFileLocks(): Promise<{ count: number }> {
  return withCoordinatorLock<{ count: number }>(async (state) => {
    state.fileLocks = state.fileLocks || {};
    const count = Object.keys(state.fileLocks).length;
    state.fileLocks = {};
    return { result: { count }, events: [] };
  });
}

export async function sendCoordPeerMessage(
  from: string,
  to: string,
  text: string
): Promise<{ success: boolean; message: CoordPeerMessage }> {
  return withCoordinatorLock(async (state) => {
    state.messages = state.messages || [];
    const msg: CoordPeerMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      from,
      to: to || 'all',
      text,
      timestamp: nowIso()
    };
    state.messages.push(msg);
    if (state.messages.length > 100) {
      state.messages = state.messages.slice(-100);
    }
    return { result: { success: true, message: msg }, events: [] };
  });
}

export async function getCoordPeerHistory(limit = 10): Promise<CoordPeerMessage[]> {
  return readOnly(state => (state.messages || []).slice(-limit));
}

export async function getCoordFileLocks(): Promise<Record<string, CoordFileLock>> {
  return readOnly(state => state.fileLocks || {});
}

export async function getCoordPeerSnapshot(limit = 0): Promise<{ locks: Record<string, CoordFileLock>; messages: CoordPeerMessage[] }> {
  const boundedLimit = Number.isSafeInteger(limit) ? Math.max(0, Math.min(100, limit)) : 0;
  return readOnly(state => ({
    locks: state.fileLocks || {},
    messages: boundedLimit ? (state.messages || []).slice(-boundedLimit) : []
  }));
}

export const DEFAULT_AGENT_ROLES: Record<string, AgentRoleConfig> = {
  Codex: {
    agent: 'Codex',
    role: 'MANAGER',
    priority: 100,
    status: 'ONLINE',
    currentAction: 'Руководит разработкой • Ставит задачи',
    activeFiles: [],
    lastSeen: new Date().toISOString(),
    model: 'OpenAI Codex / o3'
  },
  Gemini: {
    agent: 'Gemini',
    role: 'WORKER',
    priority: 20,
    status: 'ONLINE',
    currentAction: 'Автономный исполнитель • Пишет код',
    activeFiles: [],
    lastSeen: new Date().toISOString(),
    model: 'Gemini 3.8 Flash'
  },
  Sonnet: {
    agent: 'Sonnet',
    role: 'CODE_REVIEWER',
    priority: 80,
    status: 'ONLINE',
    currentAction: 'Глубокий аудит кода • Проверка типизации',
    activeFiles: [],
    lastSeen: new Date().toISOString(),
    model: 'Claude Sonnet 4.6'
  },
  Antigravity: {
    agent: 'Antigravity',
    role: 'PLATFORM',
    priority: 50,
    status: 'ONLINE',
    currentAction: 'Инфраструктура • CRTX Dual-Mesh Hub',
    activeFiles: [],
    lastSeen: new Date().toISOString(),
    model: 'Gemini 3.1 Pro'
  }
};

export async function getAgentRoles(): Promise<Record<string, AgentRoleConfig>> {
  return readOnly(state => {
    const roles = { ...DEFAULT_AGENT_ROLES, ...(state.agentRoles || {}) };
    // Synchronize active files from current fileLocks
    const locks = state.fileLocks || {};
    for (const key of Object.keys(roles)) {
      roles[key].activeFiles = Object.values(locks)
        .filter(l => l.agent.toLowerCase() === key.toLowerCase())
        .map(l => l.file);
    }
    return roles;
  });
}

export async function setAgentRole(
  agent: string,
  role: 'MANAGER' | 'WORKER' | 'PLATFORM' | 'CODE_REVIEWER' | 'SUPERVISOR' | 'ANALYZER',
  priority?: number,
  model?: string
): Promise<{ success: boolean; config: AgentRoleConfig }> {
  return withCoordinatorLock<{ success: boolean; config: AgentRoleConfig }>(async (state) => {
    state.agentRoles = { ...DEFAULT_AGENT_ROLES, ...(state.agentRoles || {}) };
    const current = state.agentRoles[agent] || {
      agent,
      role: 'WORKER',
      priority: 20,
      status: 'ONLINE',
      currentAction: 'В сети',
      activeFiles: [],
      lastSeen: nowIso(),
      model: model || 'Unknown AI'
    };

    let p = priority;
    if (p === undefined) {
      if (role === 'MANAGER') p = 100;
      else if (role === 'WORKER') p = 20;
      else p = 50;
    }

    current.role = role;
    current.priority = p;
    if (model) current.model = model;
    current.lastSeen = nowIso();
    state.agentRoles[agent] = current;

    return { result: { success: true, config: current }, events: [] };
  });
}

export async function swapAgentRoles(): Promise<{ success: boolean; roles: Record<string, AgentRoleConfig> }> {
  return withCoordinatorLock<{ success: boolean; roles: Record<string, AgentRoleConfig> }>(async (state) => {
    state.agentRoles = { ...DEFAULT_AGENT_ROLES, ...(state.agentRoles || {}) };
    const codex = state.agentRoles['Codex'] || { ...DEFAULT_AGENT_ROLES['Codex'] };
    const gemini = state.agentRoles['Gemini'] || { ...DEFAULT_AGENT_ROLES['Gemini'] };

    // Swap roles and priorities
    const prevCodexRole = codex.role;
    const prevCodexPriority = codex.priority;

    codex.role = gemini.role;
    codex.priority = gemini.priority;
    codex.currentAction = codex.role === 'MANAGER' ? 'Руководит разработкой • Ставит задачи' : 'Автономный исполнитель • Пишет код';
    codex.lastSeen = nowIso();

    gemini.role = prevCodexRole;
    gemini.priority = prevCodexPriority;
    gemini.currentAction = gemini.role === 'MANAGER' ? 'Руководит разработкой • Ставит задачи' : 'Автономный исполнитель • Пишет код';
    gemini.lastSeen = nowIso();

    state.agentRoles['Codex'] = codex;
    state.agentRoles['Gemini'] = gemini;

    return { result: { success: true, roles: state.agentRoles }, events: [] };
  });
}

export async function updateAgentAction(
  agent: string,
  currentAction: string,
  status?: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'IDLE',
  model?: string
): Promise<{ success: boolean; config: AgentRoleConfig }> {
  return withCoordinatorLock<{ success: boolean; config: AgentRoleConfig }>(async (state) => {
    state.agentRoles = { ...DEFAULT_AGENT_ROLES, ...(state.agentRoles || {}) };
    const current = state.agentRoles[agent] || {
      agent,
      role: 'WORKER',
      priority: 20,
      status: 'ONLINE',
      currentAction,
      activeFiles: [],
      lastSeen: nowIso(),
      model: model || 'Unknown AI'
    };

    current.currentAction = currentAction;
    if (status) current.status = status;
    if (model) current.model = model;
    current.lastSeen = nowIso();
    state.agentRoles[agent] = current;

    return { result: { success: true, config: current }, events: [] };
  });
}

export async function releaseAllCoordFileLocksForAgent(agent: string): Promise<{ count: number }> {
  return withCoordinatorLock<{ count: number }>(async (state) => {
    state.fileLocks = state.fileLocks || {};
    let count = 0;
    const normalizedAgent = agent.toLowerCase();
    for (const [file, lock] of Object.entries(state.fileLocks)) {
      if (lock.agent.toLowerCase() === normalizedAgent) {
        delete state.fileLocks[file];
        count++;
      }
    }
    return { result: { count }, events: [] };
  });
}
