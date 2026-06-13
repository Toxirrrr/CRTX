import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { ResultCache } from '../token/ResultCache';

const ROOT       = path.join(__dirname, '..', '..');
const TASKS_DIR  = path.join(ROOT, 'tasks');
const LOCKS_DIR  = path.join(ROOT, 'locks');
const LOGS_DIR   = path.join(ROOT, 'logs');
const CAPS_DIR   = path.join(ROOT, 'memory', 'file_capsules');

const POLL_MS          = Number(process.env.WATCHDOG_POLL_MS    ?? 60_000);
const STALL_MS         = Number(process.env.WATCHDOG_STALL_MS   ?? 15 * 60_000);
const PENDING_MS       = Number(process.env.WATCHDOG_PENDING_MS ?? 20 * 60_000);
const HEARTBEAT_STALE  = Number(process.env.HEARTBEAT_STALE_MS  ??  5 * 60_000);
/** cleanOrphanedLocks runs every N ticks */
const LOCK_CLEAN_EVERY = Number(process.env.LOCK_CLEAN_EVERY    ?? 5);

type Engine = 'claude' | 'antigravity';
const flip = (e: string): Engine => (e === 'antigravity' ? 'claude' : 'antigravity');

interface WatchedTask {
  id: string;
  status?: string;
  owner?: string;
  engine?: string;
  agent?: string;
  updatedAt?: string;
  watchdog?: { attempts: number; lastAction: string; lastEscalatedAt: string };
  [k: string]: unknown;
}

/**
 * Supervises tasks while the human is away. Escalation ladder (from the
 * orchestrator BRIEFING): a stalled task is first RETRIED (nudge), then
 * REASSIGNED to the other engine, then BLOCKED for human review. Runs inside
 * the always-on PM2 process, so failover happens autonomously.
 *
 * Honest boundary: the watchdog reassigns/flags on the board — it cannot force
 * a provider's LLM to execute. The PM2 process itself is the agent that gets
 * "restarted": PM2 auto-restarts this daemon on crash/OOM (max_memory_restart).
 */
import { BoardStore } from '../coordination/boardStore';
import { TaskBus } from './taskBus';

export class Watchdog extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private board: BoardStore;
  /** Prevents two tick() calls from running simultaneously under slow I/O */
  private ticking = false;
  /** Counter used to run cleanOrphanedLocks every LOCK_CLEAN_EVERY ticks */
  private tickCount = 0;
  private cache = new ResultCache();
  private taskBus?: TaskBus;

  constructor(board: BoardStore, taskBus?: TaskBus) {
    super();
    this.board = board;
    this.taskBus = taskBus;
  }

  start(): void {
    if (this.timer) return;
    // Run lock janitor immediately on boot, before the first regular tick
    setTimeout(() => void this.cleanOrphanedLocks(), 1_000);
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    setTimeout(() => void this.tick(), 5_000);
    // Run capsule TTL sweep shortly after boot
    setTimeout(() => void this.capsuleTTLSweep(), 3_000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lock Janitor — watches locks/ and deletes orphaned / expired entries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Scans every *.lock file in locks/ and removes it ONLY when it is safe to do so:
   *
   *   (a) ORPHANED — lock.taskId does not match any task file in tasks/.
   *       The task that created this lock no longer exists on the board.
   *
   *   (b) COMPLETED — lock.taskId exists but the task status is 'done' or
   *       'cancelled', meaning the fix has been applied and verified.
   *
   *   (c) CORRUPT — the lock file cannot be parsed as JSON.
   *
   * A lock whose task is still pending / assigned / in_progress / review is
   * NEVER touched — even if it is very old. Age alone is NOT a reason to
   * remove a lock; only task completion or absence is.
   *
   * Safe to call at any time. Every eviction is logged to logs/watchdog-<date>.md.
   * Emits 'change' if any locks were removed so the dashboard updates live.
   */
  async cleanOrphanedLocks(): Promise<void> {
    if (!fs.existsSync(LOCKS_DIR) || !fs.existsSync(TASKS_DIR)) return;

    // Build taskId → status map from actual task files on disk
    const taskStatusById = new Map<string, string>();
    try {
      const taskFiles = (await fsp.readdir(TASKS_DIR))
        .filter(f => f.endsWith('.json') && !f.startsWith('_'));
      for (const tf of taskFiles) {
        try {
          const raw = await fsp.readFile(path.join(TASKS_DIR, tf), 'utf8');
          const t = JSON.parse(raw) as { id?: string; status?: string };
          if (t.id) taskStatusById.set(t.id, t.status ?? 'unknown');
        } catch { /* malformed task file — skip */ }
      }
    } catch {
      return; // tasks dir unreadable — bail safely, do not delete anything
    }

    const lockFiles = (await fsp.readdir(LOCKS_DIR))
      .filter(f => f.endsWith('.lock') && !f.startsWith('_'));

    let evicted = 0;

    for (const lf of lockFiles) {
      const full = path.join(LOCKS_DIR, lf);
      let lock: { taskId?: string; owner?: string; resource?: string } = {};

      // (c) Corrupt — unreadable JSON
      try {
        lock = JSON.parse(await fsp.readFile(full, 'utf8'));
      } catch {
        await this.evictLock(full, lf, 'corrupt lock file (unreadable JSON)');
        evicted++;
        continue;
      }

      // No taskId at all — cannot verify ownership, leave it alone
      if (!lock.taskId) continue;

      const taskStatus = taskStatusById.get(lock.taskId);

      // (a) ORPHANED — taskId not found in tasks/
      if (taskStatus === undefined) {
        await this.evictLock(full, lf, `taskId "${lock.taskId}" not found in tasks/ (orphaned)`);
        evicted++;
        continue;
      }

      // (b) COMPLETED — task is done or cancelled → fix applied, lock no longer needed
      if (taskStatus === 'done' || taskStatus === 'cancelled') {
        await this.evictLock(full, lf, `task ${lock.taskId} is ${taskStatus} — fix applied, releasing lock`);
        evicted++;
        continue;
      }

      // All other statuses (pending / assigned / in_progress / review / blocked)
      // → task is still active, do NOT touch the lock
    }

    if (evicted > 0) {
      await this.log(`lock-janitor: released ${evicted} lock(s) — tasks done/cancelled or orphaned`);
      this.emit('change');
    }
  }

  /** Delete a single lock file and log the reason */
  private async evictLock(fullPath: string, fileName: string, reason: string): Promise<void> {
    try {
      await fsp.unlink(fullPath);
      await this.log(`lock-janitor: deleted ${fileName} — ${reason}`);
    } catch (err) {
      await this.log(`lock-janitor: FAILED to delete ${fileName} — ${(err as Error).message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Capsule TTL Sweep — removes expired file_capsules
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Scans memory/file_capsules/ and removes capsules that have exceeded
   * their TTL. TTLs are read from memory/cost_policy.json capsuleTTL section:
   *   file:      86400s (24h)
   *   review:   604800s (7d)
   *   execution: 259200s (3d)
   *   default:   86400s (24h)
   *
   * Capsules with an explicit expiresAt field use that value directly.
   * Capsules without either field use the default TTL from policy.
   */
  async capsuleTTLSweep(): Promise<void> {
    if (!fs.existsSync(CAPS_DIR)) return;

    // Load TTL policy
    let ttlPolicy: Record<string, number> = { default: 86400 };
    try {
      const cp = JSON.parse(await fsp.readFile(path.join(ROOT, 'memory', 'cost_policy.json'), 'utf8'));
      if (cp.capsuleTTL) ttlPolicy = { ...ttlPolicy, ...cp.capsuleTTL };
    } catch { /* use defaults */ }

    let evicted = 0;
    const files = (await fsp.readdir(CAPS_DIR)).filter(f => f.endsWith('.json'));
    const now = Date.now();

    for (const file of files) {
      const full = path.join(CAPS_DIR, file);
      try {
        const capsule = JSON.parse(await fsp.readFile(full, 'utf8'));

        let expired = false;

        if (capsule.expiresAt) {
          // Explicit expiry set on capsule
          expired = new Date(capsule.expiresAt).getTime() < now;
        } else if (capsule.createdAt) {
          // Use TTL from policy based on capsule type
          const capsuleType: string = capsule.type ?? 'default';
          const ttlSec = ttlPolicy[capsuleType] ?? ttlPolicy['default'] ?? 86400;
          const createdMs = new Date(capsule.createdAt).getTime();
          expired = (now - createdMs) > ttlSec * 1000;
        }
        // Capsule with neither field: leave untouched (permanent)

        if (expired) {
          await fsp.unlink(full);
          await this.log(`capsule-ttl: expired capsule deleted — ${file}`);
          evicted++;
        }
      } catch { /* malformed — skip */ }
    }

    if (evicted > 0) {
      await this.log(`capsule-ttl: swept ${evicted} expired capsule(s)`);
      this.emit('change');
    }
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Result Cache Sweep — removes expired cache entries
  // ─────────────────────────────────────────────────────────────────────────

  /** Trigger a background sweep of the result cache. */
  private async sweepResultCache(): Promise<void> {
    const evicted = await this.cache.sweepExpired();
    if (evicted > 0) {
      await this.log(`cache-sweep: evicted ${evicted} expired result cache entries`);
    }
  }



  /**
   * Crash-safe write: write content to <filePath>.tmp, then atomically rename
   * to <filePath>. On POSIX rename is a single syscall and atomic. On Windows
   * Node ≥14 implements it as MoveFileExW(MOVEFILE_REPLACE_EXISTING) which is
   * also close to atomic (no partial-read window). Either way, a crash during
   * the write leaves the original file intact — the .tmp is simply discarded.
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tmp = `${filePath}.tmp`;
    await fsp.writeFile(tmp, content, 'utf8');
    await fsp.rename(tmp, filePath);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main tick — task supervision and auto-dispatch
  // ─────────────────────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    if (this.ticking) return; // prevent concurrent overlapping ticks
    this.ticking = true;
    try {
      await this._tick();
    } finally {
      this.ticking = false;
    }
  }

  private async _tick(): Promise<void> {
    if (!fs.existsSync(TASKS_DIR)) return;
    
    const boardState = await this.board.read();
    const agents = boardState.agents;
    const locks = boardState.locks;
    
    const files = (await fsp.readdir(TASKS_DIR)).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
    const now = Date.now();
    let changed = false;

    // 1. Stale-task recovery
    for (const file of files) {
      const full = path.join(TASKS_DIR, file);
      let task: WatchedTask;
      try {
        task = JSON.parse(await fsp.readFile(full, 'utf8')) as WatchedTask;
      } catch {
        continue;
      }
      const status = task.status ?? 'pending';
      if (status !== 'assigned' && status !== 'in_progress') continue;

      const agent = agents.find(a => a.agent === task.owner);
      if (agent && agent.lastSeen) {
        // Only apply stale recovery to agents that have sent at LEAST ONE heartbeat.
        // Agents without lastSeen are in "fallback mode" (no heartbeat daemon running yet)
        // and are never timed out — their tasks are considered actively owned.
        const lastSeenMs = Date.parse(agent.lastSeen);
        if (now - lastSeenMs > HEARTBEAT_STALE) {
          task.status = 'pending';
          task.owner = '';
          task.watchdog = { attempts: (task.watchdog?.attempts || 0) + 1, lastAction: 'stale-recovery', lastEscalatedAt: new Date().toISOString() };
          task.updatedAt = new Date().toISOString();
          await this.atomicWrite(full, JSON.stringify(task, null, 2) + '\n');
          await this.log(`${task.id}: assigned to offline/stalled agent ${agent.agent} → returned to queue`);
          changed = true;
        }
      }
      // if agent.lastSeen is undefined: agent in fallback mode, skip stale check
    }

    // 2. Auto-dispatch removed.
    // Tasks stay in 'pending' until a listener script strictly wakes up its agent.

    for (const file of files) {
      const full = path.join(TASKS_DIR, file);
      let task: WatchedTask;
      try {
        task = JSON.parse(await fsp.readFile(full, 'utf8')) as WatchedTask;
      } catch {
        continue;
      }
      const status = task.status ?? 'pending';
      if (status === 'done' || status === 'blocked' || status === 'review' || status === 'assigned') continue;

      const threshold = status === 'pending' ? PENDING_MS : STALL_MS;
      const base = Date.parse(task.watchdog?.lastEscalatedAt ?? task.updatedAt ?? '') || 0;
      if (!base || now - base < threshold) continue;

      const attempts = (task.watchdog?.attempts ?? 0) + 1;
      let action: string;

      if (attempts === 1) {
        action = 'retry';
        task.status = 'pending';
      } else if (attempts === 2) {
        const next = flip(String(task.engine ?? task.owner ?? 'claude'));
        action = `reassign→${next}`;
        task.owner = next;
        task.engine = next;
        task.status = 'pending';
      } else {
        action = 'blocked-for-human';
        task.status = 'blocked';
      }

      task.watchdog = { attempts, lastAction: action, lastEscalatedAt: new Date().toISOString() };
      task.updatedAt = new Date().toISOString();
      await this.atomicWrite(full, JSON.stringify(task, null, 2) + '\n');
      await this.log(`${task.id}: stalled (${status}, attempt ${attempts}) → ${action}`);
      changed = true;
    }

    if (changed) this.emit('change');

    // 3. Max Runtime Sweep (Combating Over-Orchestration)
    let maxRuntimeMs = 120 * 60_000;
    try {
      const cp = JSON.parse(await fsp.readFile(path.join(ROOT, 'memory', 'cost_policy.json'), 'utf8'));
      if (cp.maxRuntimeMinutes) maxRuntimeMs = cp.maxRuntimeMinutes * 60_000;
    } catch {}

    for (const file of files) {
      const full = path.join(TASKS_DIR, file);
      let task: WatchedTask;
      try {
        task = JSON.parse(await fsp.readFile(full, 'utf8')) as WatchedTask;
      } catch { continue; }

      const status = task.status ?? 'pending';
      if (status === 'done' || status === 'cancelled' || status === 'PARKED' || status === 'REVIEW' || status === 'blocked') continue;

      const started = Date.parse((task.createdAt as string) || (task.updatedAt as string) || '') || now;
      if (now - started > maxRuntimeMs) {
        task.status = 'PARKED';
        task.watchdog = { attempts: (task.watchdog?.attempts || 0) + 1, lastAction: 'max-runtime-exceeded', lastEscalatedAt: new Date().toISOString() };
        task.updatedAt = new Date().toISOString();
        if (task.notes) task.notes += `\n[Watchdog] Task parked after exceeding max runtime of ${maxRuntimeMs / 60_000} minutes.`;
        await this.atomicWrite(full, JSON.stringify(task, null, 2) + '\n');
        await this.log(`${task.id}: exceeded max runtime (${maxRuntimeMs / 60_000}m) → PARKED`);
        changed = true;
      }
    }

    if (changed) this.emit('change');

    // Periodically run the lock janitor, capsule TTL, and cache sweep (not every tick)
    this.tickCount++;
    if (this.tickCount % LOCK_CLEAN_EVERY === 0) {
      await this.cleanOrphanedLocks();
      await this.capsuleTTLSweep();
      await this.sweepResultCache();
      
      // Memory Leak Prevention: sweep completed tasks from memory
      if (this.taskBus) {
        const sweptTasks = this.taskBus.sweep();
        if (sweptTasks > 0) {
          await this.log(`taskbus-memory: swept ${sweptTasks} terminal tasks from memory`);
        }
      }
    }
  }

  private async log(line: string): Promise<void> {
    await fsp.mkdir(LOGS_DIR, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(LOGS_DIR, `watchdog-${day}.md`);
    const header = fs.existsSync(file) ? '' : `# watchdog — ${day}\n\n`;
    await fsp.appendFile(file, `${header}- ${new Date().toISOString()} — ${line}\n`, 'utf8');
  }
}
