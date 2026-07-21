import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const ROOT = path.join(__dirname, '..', '..');
const CYCLES_DIR = path.join(ROOT, 'cycles');
const LOCKS_DIR = path.join(ROOT, 'locks');
const AGENTS_DIR = path.join(ROOT, 'agents');

export interface BoardTask {
  id: string;
  title?: string;
  owner: string;
  status: string;
  domain?: string;
  files?: string[];
  updatedAt?: string;
  notes?: string;
}

export interface BoardLock {
  resource: string;
  taskId?: string;
  owner?: string;
  acquiredAt?: string;
  reason?: string;
  file: string;
}

export interface AgentStatus {
  agent: string;
  /** First few non-empty lines of the agent's status markdown. */
  preview: string;
  status?: string;
  lastSeen?: string;
  capacity?: number;
  activeTasks?: number;
}

export interface Board {
  tasks: BoardTask[];
  locks: BoardLock[];
  agents: AgentStatus[];
  generatedAt: string;
}

/**
 * Reads the file-based coordination state (tasks/, locks/, agents/) from disk
 * and emits 'change' whenever any of those directories change. This is what
 * makes "who owns what / what's locked" visible live on the dashboard.
 */
export class BoardStore extends EventEmitter {
  private watchers: fs.FSWatcher[] = [];
  private debounce: NodeJS.Timeout | null = null;

  start(): void {
    for (const dir of [CYCLES_DIR, LOCKS_DIR, AGENTS_DIR]) {
      if (!fs.existsSync(dir)) continue;
      const watcher = fs.watch(dir, { recursive: false }, () => this.scheduleEmit());
      this.watchers.push(watcher);
    }
  }

  stop(): void {
    this.watchers.forEach((w) => w.close());
    this.watchers = [];
  }

  private scheduleEmit(): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(async () => {
      this.emit('change', await this.read());
    }, 150);
  }

  async read(): Promise<Board> {
    const tasks = await this.readTasks();
    const [locks, agents] = await Promise.all([
      this.readLocks(),
      this.readAgents(tasks),
    ]);
    return { tasks, locks, agents, generatedAt: new Date().toISOString() };
  }

  private async readTasks(): Promise<BoardTask[]> {
    const files = await this.listFiles(CYCLES_DIR, '.json');
    const tasks: BoardTask[] = [];
    for (const file of files) {
      if (file.startsWith('_')) continue; // skip _TEMPLATE.json
      try {
        const raw = await fsp.readFile(path.join(CYCLES_DIR, file), 'utf8');
        const cycle = JSON.parse(raw); // This is a Cycle object
        // Map Cycle to BoardTask format for dashboard/compat
        tasks.push({
          id: cycle.id,
          title: cycle.objective,
          owner: cycle.execution?.targetAgent || 'unassigned',
          status: cycle.execution?.status?.toLowerCase() || 'pending',
          domain: cycle.domain || 'META',
          files: cycle.artifacts || [],
          updatedAt: cycle.updatedAt,
          notes: cycle.audit?.notes || ''
        });
      } catch {
        // ignore malformed/partial writes — next change event re-reads
      }
    }
    return tasks.sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));
  }

  private async readLocks(): Promise<BoardLock[]> {
    const files = await this.listFiles(LOCKS_DIR, '.lock');
    const locks: BoardLock[] = [];
    for (const file of files) {
      if (file.startsWith('_')) continue; // skip _TEMPLATE.lock
      try {
        const raw = await fsp.readFile(path.join(LOCKS_DIR, file), 'utf8');
        locks.push({ ...(JSON.parse(raw) as Omit<BoardLock, 'file'>), file });
      } catch {
        locks.push({ resource: file, file });
      }
    }
    return locks;
  }

  private async readAgents(tasks: BoardTask[]): Promise<AgentStatus[]> {
    const candidates = ['claude', 'antigravity', 'opus'];
    const agents: AgentStatus[] = [];

    for (const name of candidates) {
      const fullMd   = path.join(AGENTS_DIR, `${name}.md`);
      const fullJson = path.join(AGENTS_DIR, `${name}.status.json`);

      // Preview from .md file
      const hasMd = fs.existsSync(fullMd);
      let preview = '';
      if (hasMd) {
        const raw = await fsp.readFile(fullMd, 'utf8');
        preview = raw
          .split('\n')
          .filter((l) => l.trim() && !l.startsWith('#'))
          .slice(0, 4)
          .join(' ');
      }

      // Heartbeat from .status.json (written by POST /api/agents/:agent/heartbeat)
      let statusData: { status?: string; capacity?: number; lastSeen?: string } = {};
      const hasJson = fs.existsSync(fullJson);
      if (hasJson) {
        try {
          statusData = JSON.parse(await fsp.readFile(fullJson, 'utf8'));
        } catch { /* corrupt — treat as missing */ }
      }

      // Fallback: if the agent has a .md file but has never sent a heartbeat,
      // assume online/capacity=1 so auto-dispatch works out-of-the-box without
      // requiring manual heartbeat setup. Explicit heartbeat overrides this default.
      // If neither .md nor .status.json exists → truly offline (agent not configured).
      const defaultStatus   = hasMd ? 'online' : 'offline';
      const defaultCapacity = hasMd ? 1         : 0;

      const activeTasks = tasks.filter(
        (t) => t.owner === name && (['in_progress', 'assigned', 'running', 'initializing', 'validating', 'qa_review'].includes(t.status)),
      ).length;

      agents.push({
        agent:      name,
        preview,
        status:     statusData.status   ?? defaultStatus,
        lastSeen:   statusData.lastSeen,   // undefined means "no heartbeat yet — using fallback"
        capacity:   statusData.capacity ?? defaultCapacity,
        activeTasks,
      });
    }
    return agents;
  }

  private async listFiles(dir: string, ext: string): Promise<string[]> {
    if (!fs.existsSync(dir)) return [];
    const entries = await fsp.readdir(dir);
    return entries.filter((f) => f.endsWith(ext));
  }
}
