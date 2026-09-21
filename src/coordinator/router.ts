/**
 * CRTX Multi-Agent Coordinator — Express Router
 *
 * Mounts coordinator endpoints under /api/coordinator.
 * All endpoints are pure coordination-layer infrastructure.
 * No business logic. No Agent Ops Platform runtime coupling.
 *
 * Endpoints:
 *   POST   /api/coordinator/register           Register a chat/agent
 *   POST   /api/coordinator/heartbeat          Update lastActivity
 *   POST   /api/coordinator/tasks              Create a coordination task
 *   GET    /api/coordinator/tasks              List all tasks
 *   GET    /api/coordinator/tasks/:taskId      Get a single task
 *   POST   /api/coordinator/tasks/:taskId/claim       Claim a task (IMPLEMENT)
 *   POST   /api/coordinator/tasks/:taskId/release     Release ownership
 *   PATCH  /api/coordinator/tasks/:taskId/phase       Update phase
 *   POST   /api/coordinator/tasks/:taskId/validate    Record validation evidence
 *   POST   /api/coordinator/tasks/:taskId/handoff     Initiate handoff
 *   POST   /api/coordinator/tasks/:taskId/handoff/accept  Accept handoff
 *   GET    /api/coordinator/tasks/:taskId/workspace   Workspace diff
 *   GET    /api/coordinator/status             Full status overview
 *   GET    /api/coordinator/chats              List all registered chats
 *   GET    /api/coordinator/locks              List all resource locks
 *   GET    /api/coordinator/conflicts          List open conflicts
 *   POST   /api/coordinator/conflicts/:id/resolve  Resolve a conflict
 *   GET    /api/coordinator/audit              Recent audit log entries
 *   POST   /api/coordinator/stale             Mark stale owners
 */

import { Router, Request, Response } from 'express';
import {
  registerChat,
  processHeartbeat,
  disconnectChat,
  listChats,
  getChatEntry,
  createTask,
  getTask,
  listTasks,
  claimTask,
  releaseTask,
  updateTaskPhase,
  recordValidation,
  initiateHandoff,
  acceptHandoff,
  listLocks,
  listConflicts,
  resolveConflict,
  detectWorkspaceDiff,
  getStatus,
  markStaleOwners,
  recoverStale,
  appendAuditEvent,
} from './registry';
import {
  CoordIntent,
  CoordScope,
  CoordTaskStatus,
  CoordValidationEvidence,
} from './types';
import path from 'node:path';
import fsp from 'node:fs/promises';
import fs from 'node:fs';

export const coordinatorRouter = Router();

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_INTENTS = new Set<string>(['READ', 'AUDIT', 'PLAN', 'IMPLEMENT', 'VALIDATE', 'HANDOFF']);
const VALID_PHASES = new Set<string>(['TODO', 'CLAIMED', 'AUDITING', 'PLANNED', 'IMPLEMENTING', 'VALIDATING', 'BLOCKED', 'CLOSED']);

function requireString(val: unknown, field: string): string {
  if (typeof val !== 'string' || !val.trim()) throw new Error(`${field} must be a non-empty string`);
  return val.trim();
}

function requireIntent(val: unknown): CoordIntent {
  const s = requireString(val, 'intent');
  if (!VALID_INTENTS.has(s)) throw new Error(`intent must be one of: ${[...VALID_INTENTS].join(', ')}`);
  return s as CoordIntent;
}

function requireScope(val: unknown): CoordScope {
  if (!val || typeof val !== 'object') throw new Error('scope must be an object');
  const s = val as Record<string, unknown>;
  return {
    directories: Array.isArray(s.directories) ? s.directories.map(String) : [],
    files: Array.isArray(s.files) ? s.files.map(String) : [],
    expectedChanges: typeof s.expectedChanges === 'string' ? s.expectedChanges : '',
  };
}

function requirePhase(val: unknown): CoordTaskStatus {
  const s = requireString(val, 'phase');
  if (!VALID_PHASES.has(s)) throw new Error(`phase must be one of: ${[...VALID_PHASES].join(', ')}`);
  return s as CoordTaskStatus;
}

function taskIdParam(req: Request): string {
  const id = String(req.params.taskId ?? '');
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid taskId format');
  return id;
}

function handleError(res: Response, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  res.status(400).json({ error: msg });
}

// ─── Chat / Agent Registry ────────────────────────────────────────────────────

// POST /api/coordinator/register
coordinatorRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const chatId = requireString(req.body?.chatId, 'chatId');
    const agent  = requireString(req.body?.agent, 'agent');
    const entry = await registerChat(chatId, agent);
    res.status(201).json({ ok: true, chat: entry });
  } catch (e) { handleError(res, e); }
});

// POST /api/coordinator/heartbeat
coordinatorRouter.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const chatId = requireString(req.body?.chatId, 'chatId');
    const agent = requireString(req.body?.agent, 'agent');
    const taskId = req.body?.taskId || null;
    const phase = req.body?.phase || null;
    const intent = req.body?.intent || null;
    const timestamp = req.body?.timestamp || new Date().toISOString();

    await processHeartbeat({ chatId, agent, taskId, phase, intent, timestamp });
    res.json({ ok: true, chatId, lastActivity: timestamp });
  } catch (e) { handleError(res, e); }
});

// POST /api/coordinator/disconnect
coordinatorRouter.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const chatId = requireString(req.body?.chatId, 'chatId');
    await disconnectChat(chatId);
    res.json({ ok: true, chatId, status: 'DISCONNECTED' });
  } catch (e) { handleError(res, e); }
});

// GET /api/coordinator/chats
coordinatorRouter.get('/chats', async (_req: Request, res: Response) => {
  try {
    const chats = await listChats();
    res.json({ chats, count: chats.length });
  } catch (e) { handleError(res, e); }
});

// GET /api/coordinator/chats/:chatId
coordinatorRouter.get('/chats/:chatId', async (req: Request, res: Response) => {
  try {
    const chatId = requireString(req.params.chatId, 'chatId');
    const entry = await getChatEntry(chatId);
    if (!entry) { res.status(404).json({ error: 'Chat not found' }); return; }
    res.json({ chat: entry });
  } catch (e) { handleError(res, e); }
});

// ─── Task Registry ────────────────────────────────────────────────────────────

// POST /api/coordinator/tasks
coordinatorRouter.post('/tasks', async (req: Request, res: Response) => {
  try {
    const taskId      = requireString(req.body?.taskId, 'taskId');
    const title       = requireString(req.body?.title, 'title');
    const description = requireString(req.body?.description, 'description');
    const dependencies = Array.isArray(req.body?.dependencies) ? req.body.dependencies.map(String) : [];
    const task = await createTask(taskId, title, description, dependencies);
    res.status(201).json({ ok: true, task });
  } catch (e) { handleError(res, e); }
});

// GET /api/coordinator/tasks
coordinatorRouter.get('/tasks', async (_req: Request, res: Response) => {
  try {
    const tasks = await listTasks();
    res.json({ tasks, count: tasks.length });
  } catch (e) { handleError(res, e); }
});

// GET /api/coordinator/tasks/:taskId
coordinatorRouter.get('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const taskId = taskIdParam(req);
    const task = await getTask(taskId);
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    res.json({ task });
  } catch (e) { handleError(res, e); }
});

// POST /api/coordinator/tasks/:taskId/claim
coordinatorRouter.post('/tasks/:taskId/claim', async (req: Request, res: Response) => {
  try {
    const taskId = taskIdParam(req);
    const chatId = requireString(req.body?.chatId, 'chatId');
    const agent  = requireString(req.body?.agent, 'agent');
    const intent = requireIntent(req.body?.intent);
    const scope  = requireScope(req.body?.scope ?? { directories: [], files: [], expectedChanges: '' });

    const result = await claimTask(taskId, chatId, agent, intent, scope);
    if (result.success) {
      res.json({ ok: true, task: result.task, locks: result.locks });
    } else {
      res.status(409).json({ ok: false, ...result });
    }
  } catch (e) { handleError(res, e); }
});

// POST /api/coordinator/tasks/:taskId/release
coordinatorRouter.post('/tasks/:taskId/release', async (req: Request, res: Response) => {
  try {
    const taskId = taskIdParam(req);
    const chatId = requireString(req.body?.chatId, 'chatId');
    await releaseTask(taskId, chatId);
    res.json({ ok: true, taskId, chatId });
  } catch (e) { handleError(res, e); }
});

// PATCH /api/coordinator/tasks/:taskId/phase
coordinatorRouter.patch('/tasks/:taskId/phase', async (req: Request, res: Response) => {
  try {
    const taskId = taskIdParam(req);
    const chatId = requireString(req.body?.chatId, 'chatId');
    const phase  = requirePhase(req.body?.phase);
    const task   = await updateTaskPhase(taskId, chatId, phase);
    res.json({ ok: true, task });
  } catch (e) { handleError(res, e); }
});

// POST /api/coordinator/tasks/:taskId/validate
coordinatorRouter.post('/tasks/:taskId/validate', async (req: Request, res: Response) => {
  try {
    const taskId = taskIdParam(req);
    const chatId = requireString(req.body?.chatId, 'chatId');
    const rawEv  = req.body?.evidence;
    if (!rawEv || typeof rawEv !== 'object') throw new Error('evidence object is required');
    const evidence: CoordValidationEvidence = {
      lintPassed:             typeof rawEv.lintPassed === 'boolean' ? rawEv.lintPassed : undefined,
      typecheckPassed:        typeof rawEv.typecheckPassed === 'boolean' ? rawEv.typecheckPassed : undefined,
      buildPassed:            typeof rawEv.buildPassed === 'boolean' ? rawEv.buildPassed : undefined,
      unitTestsPassed:        typeof rawEv.unitTestsPassed === 'boolean' ? rawEv.unitTestsPassed : undefined,
      integrationTestsPassed: typeof rawEv.integrationTestsPassed === 'boolean' ? rawEv.integrationTestsPassed : undefined,
      runtimeVerified:        typeof rawEv.runtimeVerified === 'boolean' ? rawEv.runtimeVerified : undefined,
      scopeVerified:          typeof rawEv.scopeVerified === 'boolean' ? rawEv.scopeVerified : undefined,
      architectureVerified:   typeof rawEv.architectureVerified === 'boolean' ? rawEv.architectureVerified : undefined,
      remainingBlockers: Array.isArray(rawEv.remainingBlockers) ? rawEv.remainingBlockers.map(String) : [],
      notes: typeof rawEv.notes === 'string' ? rawEv.notes : '',
      recordedAt: new Date().toISOString(),
    };
    const task = await recordValidation(taskId, chatId, evidence);
    res.json({ ok: true, task });
  } catch (e) { handleError(res, e); }
});

// POST /api/coordinator/tasks/:taskId/handoff
coordinatorRouter.post('/tasks/:taskId/handoff', async (req: Request, res: Response) => {
  try {
    const taskId      = taskIdParam(req);
    const fromChatId  = requireString(req.body?.fromChatId, 'fromChatId');
    const toChatId    = requireString(req.body?.toChatId, 'toChatId');
    const task = await initiateHandoff(taskId, fromChatId, toChatId, {
      phase: req.body?.phase ?? 'IMPLEMENTING',
      completedWork: req.body?.completedWork ?? '',
      remainingWork: req.body?.remainingWork ?? '',
      blockers: Array.isArray(req.body?.blockers) ? req.body.blockers.map(String) : [],
      filesChanged: Array.isArray(req.body?.filesChanged) ? req.body.filesChanged.map(String) : [],
      validationState: req.body?.validationState ?? '',
    });
    res.json({ ok: true, task });
  } catch (e) { handleError(res, e); }
});

// POST /api/coordinator/tasks/:taskId/handoff/accept
coordinatorRouter.post('/tasks/:taskId/handoff/accept', async (req: Request, res: Response) => {
  try {
    const taskId  = taskIdParam(req);
    const toChatId = requireString(req.body?.chatId, 'chatId');
    const agent   = requireString(req.body?.agent, 'agent');
    const task = await acceptHandoff(taskId, toChatId, agent);
    res.json({ ok: true, task });
  } catch (e) { handleError(res, e); }
});

// GET /api/coordinator/tasks/:taskId/workspace
coordinatorRouter.get('/tasks/:taskId/workspace', async (req: Request, res: Response) => {
  try {
    const taskId = taskIdParam(req);
    const diff = await detectWorkspaceDiff(taskId);
    const status = diff.hasViolation ? 'REVIEW_REQUIRED' : 'CLEAN';
    res.json({ ok: true, status, diff });
  } catch (e) { handleError(res, e); }
});

// ─── Locks ────────────────────────────────────────────────────────────────────

// GET /api/coordinator/locks
coordinatorRouter.get('/locks', async (_req: Request, res: Response) => {
  try {
    const locks = await listLocks();
    res.json({ locks, count: locks.length });
  } catch (e) { handleError(res, e); }
});

// ─── Conflicts ────────────────────────────────────────────────────────────────

// GET /api/coordinator/conflicts
coordinatorRouter.get('/conflicts', async (req: Request, res: Response) => {
  try {
    const openOnly = req.query.all !== 'true';
    const conflicts = await listConflicts(openOnly);
    res.json({ conflicts, count: conflicts.length });
  } catch (e) { handleError(res, e); }
});

// POST /api/coordinator/conflicts/:conflictId/resolve
coordinatorRouter.post('/conflicts/:conflictId/resolve', async (req: Request, res: Response) => {
  try {
    const conflictId = requireString(req.params.conflictId, 'conflictId');
    const resolution = requireString(req.body?.resolution, 'resolution');
    await resolveConflict(conflictId, resolution);
    await appendAuditEvent('MASTER_ARCHITECT_REQUIRED', { conflictId, resolution, note: 'Conflict resolved by operator' });
    res.json({ ok: true, conflictId, resolution });
  } catch (e) { handleError(res, e); }
});

// ─── Status ───────────────────────────────────────────────────────────────────

// GET /api/coordinator/status
coordinatorRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (e) { handleError(res, e); }
});

// ─── Stale detection ─────────────────────────────────────────────────────────

// POST /api/coordinator/stale
coordinatorRouter.post('/stale', async (_req: Request, res: Response) => {
  try {
    const stale = await markStaleOwners();
    res.json({
      ok: true,
      staleChats: stale.map(c => ({
        chatId: c.chatId,
        currentTaskId: c.currentTaskId,
        lastActivity: c.lastActivity,
        note: 'Owner stale. MASTER ARCHITECT or explicit HANDOFF required before lock transfer.',
      })),
      count: stale.length,
    });
  } catch (e) { handleError(res, e); }
});

// ─── Audit log ────────────────────────────────────────────────────────────────

// GET /api/coordinator/audit?limit=50
coordinatorRouter.get('/audit', async (req: Request, res: Response) => {
  try {
    const CRTX_ROOT = path.resolve(__dirname, '..', '..');
    const auditDir = path.join(CRTX_ROOT, 'coordinator', 'audit');
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 50)));

    if (!fs.existsSync(auditDir)) { res.json({ events: [], count: 0 }); return; }

    const files = (await fsp.readdir(auditDir))
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .reverse();

    const events: unknown[] = [];
    for (const f of files) {
      if (events.length >= limit) break;
      const lines = (await fsp.readFile(path.join(auditDir, f), 'utf8'))
        .split('\n')
        .filter(Boolean)
        .reverse();
      for (const line of lines) {
        if (events.length >= limit) break;
        try { events.push(JSON.parse(line)); } catch { /* skip malformed */ }
      }
    }

    res.json({ events, count: events.length });
  } catch (e) { handleError(res, e); }
});

coordinatorRouter.post('/chats/:chatId/recover', async (req: Request, res: Response) => {
  try {
    const { action } = req.body;
    await recoverStale(req.params.chatId as string, action as 'RESUME' | 'ABORT');
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
