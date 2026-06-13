import path from 'node:path';
import fsp from 'node:fs/promises';
import { createServer } from 'node:http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { TaskBus } from './orchestration/taskBus';
import { HandshakeStatus } from './orchestration/types';
import { MemoryStore } from './rag/memoryStore';
import { BoardStore } from './coordination/boardStore';
import { Inbox, DirectiveTarget } from './coordination/inbox';
import { route, Engine } from './orchestration/router';
import { Watchdog } from './orchestration/watchdog';
import { NotificationService } from './notifications/notificationService';
import { startListener } from './agents/listen-for-work';
import { startHeartbeat } from './agents/heartbeat-client';
import { RuntimeSelector } from './runtime/RuntimeSelector';
import { ClaudeCodeAdapter } from './runtime/adapters/ClaudeCodeAdapter';
import { AntigravityAdapter } from './runtime/adapters/AntigravityAdapter';
import { NullAdapter } from './runtime/adapters/NullAdapter';

// Agents directory — single trusted path, prevents path traversal in heartbeat
const AGENTS_DIR = path.resolve(__dirname, '..', 'agents');

// Whitelist of valid agent names for the heartbeat endpoint
const ALLOWED_AGENTS = new Set(['claude', 'antigravity', 'fable', 'human']);

// Optional API key for heartbeat (set ORCHESTRATOR_API_KEY in .env to enable)
const API_KEY = process.env.ORCHESTRATOR_API_KEY ?? '';

// Per-agent rate limit for heartbeat: minimum ms between calls
const HEARTBEAT_RATE_LIMIT_MS = Number(process.env.HEARTBEAT_RATE_LIMIT_MS ?? 10_000);
const heartbeatLastSeen = new Map<string, number>();

const app = express();

// CORS: restrict to localhost only — this is an internal orchestrator, not a public API.
// Override ORCHESTRATOR_CORS_ORIGIN env var if you need a specific external origin.
const CORS_ORIGIN = process.env.ORCHESTRATOR_CORS_ORIGIN ?? 'http://localhost';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, server-to-server, same-origin)
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin === CORS_ORIGIN) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '512kb' })); // Body size cap — prevents large payload DoS

const taskBus = new TaskBus();
const memory = new MemoryStore();
const board = new BoardStore();
const inbox = new Inbox();

// Runtime Abstraction Layer
const runtimeSelector = new RuntimeSelector();
runtimeSelector.register(new ClaudeCodeAdapter());
runtimeSelector.register(new AntigravityAdapter());
runtimeSelector.register(new NullAdapter());

taskBus.on('task', (task) => {
  // Headless: emitted on bus
});

board.on('change', (snapshot) => {
  // Headless: board state changed
});
board.start();

// Autonomous failover supervisor: stalled task → retry → reassign → block.
const watchdog = new Watchdog(board, taskBus);
watchdog.on('change', async () => {});
watchdog.start();

// Local notification feed: persists every task/decision change to
// data/notifications.json and streams it to the dashboard. No off-box egress.
const notifications = new NotificationService(board);
notifications.on('notification', (n) => {});
void notifications.start();

// ── Core data endpoints ───────────────────────────────────────────────────────

/**
 * Health check — reports both subsystems:
 *   - boardTasks: file-based tasks in tasks/*.json (authoritative)
 *   - busTasks: in-memory agent-to-agent handshake tasks (TaskBus)
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  const b = await board.read();
  res.json({
    status: 'ok',
    boardTasks: b.tasks.length,
    busTasks: taskBus.list().length,
    agents: b.agents.length,
    locks: b.locks.length,
  });
});

/**
 * Returns tasks from BOTH systems so callers always see the full picture.
 *   source="bus"   → in-memory agent handshake tasks (TaskBus)
 *   source="board" → file-based board tasks (tasks/*.json)
 *   source=<omit>  → both merged
 */
app.get('/api/tasks', async (req: Request, res: Response) => {
  const source = String(req.query.source ?? 'all');
  if (source === 'bus') {
    res.json(taskBus.list());
    return;
  }
  if (source === 'board') {
    res.json((await board.read()).tasks);
    return;
  }
  // Default: merge both, board tasks first
  const boardTasks = (await board.read()).tasks.map(t => ({ ...t, _source: 'board' }));
  const busTasks   = taskBus.list().map(t => ({ ...t, _source: 'bus' }));
  res.json([...boardTasks, ...busTasks]);
});

app.get('/api/board', async (_req: Request, res: Response) => {
  res.json(await board.read());
});

app.get('/api/notifications', (_req: Request, res: Response) => {
  res.json(notifications.list());
});

// ── Runtime abstraction endpoints ─────────────────────────────────────────────

/**
 * Resolve the best available runtime for a capability.
 * GET /api/runtime/resolve?capability=coding
 * Returns: { runtimeName, provider, model, online }
 */
app.get('/api/runtime/resolve', async (req: Request, res: Response) => {
  const capability = String(req.query.capability ?? '');
  if (!capability.trim()) {
    res.status(400).json({ error: 'capability is required' });
    return;
  }
  const fakeTask = { id: 'probe', capability };
  const selection = await runtimeSelector.resolve(capability, fakeTask);
  res.json({
    capability,
    runtimeName: selection.runtimeName,
    provider: selection.provider,
    model: selection.model,
    available: selection.result.success,
  });
});

/**
 * List all registered adapters and their current health.
 * GET /api/runtime/adapters
 */
app.get('/api/runtime/adapters', (_req: Request, res: Response) => {
  res.json({ adapters: runtimeSelector.registeredAdapters() });
});

// --- Human control channel ---------------------------------------------------
app.get('/api/directives', async (_req: Request, res: Response) => {
  res.json(await inbox.list());
});

// Live routing preview — the orchestrator's decision before you commit.
app.get('/api/route', async (req: Request, res: Response) => {
  const text = String(req.query.text ?? '');
  const t = String(req.query.target ?? 'auto');
  const override: Engine | undefined = t === 'claude' || t === 'antigravity' ? t : undefined;
  if (!text.trim()) {
    res.json(null);
    return;
  }
  res.json(await route(text, override));
});

app.post('/api/directive', async (req: Request, res: Response) => {
  const { text, target } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  const result = await inbox.create(text, (target as DirectiveTarget) ?? 'any');
  res.status(201).json(result);
});

app.post('/api/tasks', async (req: Request, res: Response) => {
  const { sourceAgent, targetAgent, taskId, status, payload } = req.body ?? {};
  if (!sourceAgent || !targetAgent || !payload) {
    res.status(400).json({ error: 'sourceAgent, targetAgent and payload are required' });
    return;
  }
  try {
    const task = await taskBus.submit({ sourceAgent, targetAgent, taskId, status, payload });
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ── Board task read/update endpoints (file-based, for agent self-check) ───────
//
// F5 fix: agents MUST poll GET /api/board/tasks/:taskId during execution.
// If status is no longer 'assigned' / 'in_progress' for their owner name,
// the agent must abort — the watchdog revoked the task (stale recovery).
//
// Agents update their own task via PATCH /api/board/tasks/:taskId
// (e.g. to move from 'assigned' → 'in_progress' → 'done').

const BOARD_TASKS_DIR = path.resolve(__dirname, '..', 'tasks');
const VALID_TASK_STATUSES = new Set(['pending','assigned','in_progress','review','done','blocked','cancelled']);

/** Read a single board task by ID (file-based). Used by agents to check revocation. */
app.get('/api/board/tasks/:taskId', async (req: Request, res: Response) => {
  const taskId = String(req.params.taskId);
  // Sanitize taskId: only alphanumeric, hyphen, underscore
  if (!/^[A-Za-z0-9_-]+$/.test(taskId)) {
    res.status(400).json({ error: 'invalid taskId' });
    return;
  }
  const file = path.join(BOARD_TASKS_DIR, `${taskId}.json`);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const task = JSON.parse(raw);
    // Return only the fields agents need for revocation check
    res.json({
      id: task.id,
      status: task.status,
      owner: task.owner,
      updatedAt: task.updatedAt,
    });
  } catch {
    res.status(404).json({ error: 'task not found' });
  }
});

/**
 * Agent updates a board task status.
 * Allowed transitions an agent can self-report:
 *   assigned     → in_progress
 *   in_progress  → review | done | blocked
 *   review       → done | blocked
 *
 * The agent MUST provide its own name in body.agent for ownership validation.
 */
app.patch('/api/board/tasks/:taskId', async (req: Request, res: Response) => {
  const taskId = String(req.params.taskId);
  if (!/^[A-Za-z0-9_-]+$/.test(taskId)) {
    res.status(400).json({ error: 'invalid taskId' });
    return;
  }

  const { status, agent, notes } = req.body ?? {};

  if (!status || !VALID_TASK_STATUSES.has(status)) {
    res.status(400).json({ error: `status must be one of: ${[...VALID_TASK_STATUSES].join(', ')}` });
    return;
  }
  if (!agent || !ALLOWED_AGENTS.has(agent)) {
    res.status(400).json({ error: 'agent is required and must be a known agent' });
    return;
  }

  const file = path.join(BOARD_TASKS_DIR, `${taskId}.json`);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const task = JSON.parse(raw);

    // Ownership check: only the current owner can update the task
    if (task.owner && task.owner !== agent) {
      res.status(403).json({ error: `task is owned by ${task.owner}, not ${agent}` });
      return;
    }

    task.status = status;
    task.updatedAt = new Date().toISOString();
    if (notes) task.notes = (task.notes ? task.notes + '\n' : '') + `[${agent} ${task.updatedAt}] ${notes}`;

    // Atomic write
    const tmp = `${file}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(task, null, 2) + '\n', 'utf8');
    await fsp.rename(tmp, file);

    // Trigger lock janitor when task reaches done/cancelled
    if (status === 'done' || status === 'cancelled') {
      void watchdog.cleanOrphanedLocks();
    }

    res.json({ ok: true, id: task.id, status: task.status, owner: task.owner });
  } catch {
    res.status(404).json({ error: 'task not found' });
  }
});

// ── Heartbeat endpoint ───────────────────────────────────────────────────────
//
// Agents (claude / antigravity / fable) call this to publish their liveness.
// Guards:
//   1. API key check (optional — skipped if ORCHESTRATOR_API_KEY is not set)
//   2. Agent name whitelist — prevents path traversal and spoofing
//   3. Status whitelist — only 'online' | 'offline' | 'busy'
//   4. Capacity range — 0..20
//   5. Rate limit — max one call per HEARTBEAT_RATE_LIMIT_MS per agent

app.post('/api/agents/:agent/heartbeat', async (req: Request, res: Response) => {
  // 1. API key (opt-in)
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const agent = String(req.params.agent);

  // 2. Whitelist — also prevents path traversal (e.g. "../../etc/passwd")
  if (!ALLOWED_AGENTS.has(agent)) {
    res.status(403).json({ error: 'unknown agent' });
    return;
  }

  // 5. Rate limit
  const now = Date.now();
  const last = heartbeatLastSeen.get(agent) ?? 0;
  if (now - last < HEARTBEAT_RATE_LIMIT_MS) {
    res.status(429).json({ error: 'rate limited', retryAfterMs: HEARTBEAT_RATE_LIMIT_MS - (now - last) });
    return;
  }
  heartbeatLastSeen.set(agent, now);

  // 3. Status whitelist
  const VALID_STATUSES = new Set(['online', 'offline', 'busy']);
  const rawStatus = String(req.body?.status ?? 'online');
  const safeStatus = VALID_STATUSES.has(rawStatus) ? rawStatus : 'online';

  // 4. Capacity range 0..20
  const rawCap = Number(req.body?.capacity);
  const capacity = Number.isFinite(rawCap) && rawCap >= 0 && rawCap <= 20 ? Math.floor(rawCap) : 0;

  // Write to agents/<agent>.status.json — path is fully resolved via AGENTS_DIR
  const file = path.join(AGENTS_DIR, `${agent}.status.json`);
  try {
    await fsp.writeFile(file, JSON.stringify({ status: safeStatus, capacity, lastSeen: new Date().toISOString() }, null, 2));
    res.json({ ok: true, agent, status: safeStatus, capacity });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Lock management endpoints ─────────────────────────────────────────────────

/** Returns all current lock files (same data as /api/board but lock-only) */
app.get('/api/locks', async (_req: Request, res: Response) => {
  const b = await board.read();
  res.json({ locks: b.locks, count: b.locks.length });
});

/**
 * Manually trigger the orphaned-lock janitor.
 * Useful from the dashboard or curl when you know stale locks are blocking dispatch.
 * POST /api/locks/clean
 * Response: { evicted: number, remainingLocks: BoardLock[] }
 */
app.post('/api/locks/clean', async (_req: Request, res: Response) => {
  try {
    await watchdog.cleanOrphanedLocks();
    const b = await board.read();
    res.json({ ok: true, remainingLocks: b.locks, count: b.locks.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.patch('/api/tasks/:taskId', (req: Request, res: Response) => {
  const taskId = String(req.params.taskId ?? '');
  // Validate taskId — same rule as board tasks to prevent prototype pollution
  if (!/^[A-Za-z0-9_-]+$/.test(taskId)) {
    res.status(400).json({ error: 'invalid taskId' });
    return;
  }
  const { status, payload } = req.body ?? {};
  if (!status) {
    res.status(400).json({ error: 'status is required' });
    return;
  }
  try {
    const task = taskBus.updateStatus(taskId, status as HandshakeStatus, payload);
    res.json(task);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

app.post('/api/memory', async (req: Request, res: Response) => {
  const { text, metadata } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required and must be a string' });
    return;
  }
  // Cap text size — large payloads inflate the vector index and consume excessive tokens
  const MAX_TEXT_BYTES = 32_000;
  if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) {
    res.status(413).json({ error: `text exceeds max size (${MAX_TEXT_BYTES} bytes)` });
    return;
  }
  const id = await memory.remember(text, metadata ?? {});
  res.status(201).json({ id });
});

app.get('/api/memory/search', async (req: Request, res: Response) => {
  const query = String(req.query.q ?? '');
  // Cap topK to prevent memory/CPU exhaustion from large vector scans
  const MAX_TOP_K = 20;
  const topK = Math.min(Math.max(1, Number(req.query.topK ?? 5)), MAX_TOP_K);
  if (!query) {
    res.status(400).json({ error: 'q is required' });
    return;
  }
  const results = await memory.recall(query, topK);
  res.json(results);
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[Express Error] ${req.method} ${req.url}:`, err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = Number(process.env.PORT ?? 4100);
const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cortex (Headless) listening on http://localhost:${PORT}`);

  // Embedded Runtime: Run listeners and heartbeats in the same process
  if (process.env.DISABLE_EMBEDDED_RUNTIME !== 'true') {
    console.log('[Embedded Runtime] Bootstrapping local agents...');
    startListener('claude');
    startListener('antigravity');
    startHeartbeat('claude', 2);
    startHeartbeat('antigravity', 3);
  }
});

// ── Global Crash Prevention & Graceful Shutdown ───────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] Server caught an unhandled error but will not crash:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] Unhandled promise rejection at:', promise, 'reason:', reason);
});

let isShuttingDown = false;
function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Graceful Shutdown] Received ${signal}. Stopping Cortex...`);
  
  // Stop background loops
  watchdog.stop();
  
  // Close express server to stop accepting new requests
  server.close(() => {
    console.log('[Graceful Shutdown] Server closed. Exiting process safely.');
    process.exit(0);
  });
  
  // Failsafe: force exit if lingering handles prevent clean shutdown after 5s
  setTimeout(() => {
    console.error('[Graceful Shutdown] Failsafe timeout reached. Forcing exit.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
