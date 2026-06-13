import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { Board, BoardStore, BoardTask } from '../coordination/boardStore';

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_FILE = path.join(DATA_DIR, 'notifications.json');
const DECISIONS_DIR = path.join(ROOT, 'decisions');
const MAX_ITEMS = 200;

export type NotificationKind = 'task' | 'decision' | 'system';

export interface Notification {
  id: string;
  ts: string;
  kind: NotificationKind;
  refId: string;
  event: string; // created | status | decision
  title: string;
  status?: string;
  owner?: string;
  risk?: string;
}

type RawTask = BoardTask & { risk?: string; priority?: string };

/**
 * LOCAL-ONLY notification feed. Watches the coordination board (tasks/) and
 * decisions/ and turns every new task / status change / decision into a
 * persisted Notification that is:
 *   1. appended to data/notifications.json, and
 *   2. emitted as a 'notification' event for the live dashboard.
 *
 * This module deliberately does NOT send anything off-box. External delivery
 * (e.g. Telegram) is an opt-in, separately-run transport — see
 * src/notifications/telegram-digest.ts and TELEGRAM.md. Keeping egress out of
 * the always-on server keeps internal audit/risk detail inside the trust
 * boundary by default.
 *
 * Baseline is seeded on start() so existing tasks are NOT replayed as "new".
 */
export class NotificationService extends EventEmitter {
  private items: Notification[] = [];
  private readonly lastTaskStatus = new Map<string, string>();
  private readonly knownDecisions = new Set<string>();
  private decisionsWatcher: fs.FSWatcher | null = null;

  constructor(private readonly board: BoardStore) {
    super();
  }

  /** Newest-first list for the UI / API. */
  list(): Notification[] {
    return [...this.items].reverse();
  }

  async start(): Promise<void> {
    await this.load();
    // Seed baseline from current state — do not replay history as notifications.
    const snap = await this.board.read();
    for (const t of snap.tasks) this.lastTaskStatus.set(t.id, t.status);
    for (const d of this.listDecisionFiles()) this.knownDecisions.add(d);

    this.board.on('change', (s: Board) => void this.onBoardChange(s));
    if (fs.existsSync(DECISIONS_DIR)) {
      this.decisionsWatcher = fs.watch(
        DECISIONS_DIR,
        () => void this.onDecisionsChange(),
      );
    }
  }

  stop(): void {
    this.decisionsWatcher?.close();
    this.decisionsWatcher = null;
  }

  // --- internals -------------------------------------------------------------

  private async onBoardChange(snap: Board): Promise<void> {
    for (const t of snap.tasks) {
      const prev = this.lastTaskStatus.get(t.id);
      if (prev === undefined) {
        await this.record(this.fromTask(t, 'created'));
      } else if (prev !== t.status) {
        await this.record(this.fromTask(t, 'status'));
      }
      this.lastTaskStatus.set(t.id, t.status);
    }
  }

  private async onDecisionsChange(): Promise<void> {
    for (const file of this.listDecisionFiles()) {
      if (this.knownDecisions.has(file)) continue;
      this.knownDecisions.add(file);
      await this.record({
        id: cryptoId(),
        ts: new Date().toISOString(),
        kind: 'decision',
        refId: file.replace(/\.md$/, ''),
        event: 'decision',
        title: this.decisionTitle(file),
      });
    }
  }

  private fromTask(t: BoardTask, event: 'created' | 'status'): Notification {
    return {
      id: cryptoId(),
      ts: new Date().toISOString(),
      kind: 'task',
      refId: t.id,
      event,
      title: t.title ?? '',
      status: t.status,
      owner: t.owner,
      risk: (t as RawTask).risk,
    };
  }

  private async record(n: Notification): Promise<void> {
    this.items.push(n);
    if (this.items.length > MAX_ITEMS) this.items = this.items.slice(-MAX_ITEMS);
    await this.persist();
    this.emit('notification', n);
  }

  private listDecisionFiles(): string[] {
    if (!fs.existsSync(DECISIONS_DIR)) return [];
    return fs
      .readdirSync(DECISIONS_DIR)
      .filter(
        (f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md',
      );
  }

  private decisionTitle(file: string): string {
    try {
      const raw = fs.readFileSync(path.join(DECISIONS_DIR, file), 'utf8');
      const heading = raw.split('\n').find((l) => l.startsWith('# '));
      return heading ? heading.replace(/^#\s*/, '') : file;
    } catch {
      return file;
    }
  }

  private async load(): Promise<void> {
    try {
      const raw = await fsp.readFile(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Notification[];
      if (Array.isArray(parsed)) this.items = parsed.slice(-MAX_ITEMS);
    } catch {
      this.items = [];
    }
  }

  private async persist(): Promise<void> {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.writeFile(STORE_FILE, JSON.stringify(this.items, null, 2), 'utf8');
  }
}

function cryptoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
