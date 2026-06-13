import fs from 'node:fs';
import path from 'node:path';
import { htmlEscape, DetailLevel } from './telegram';

const ROOT = path.join(__dirname, '..', '..');
const TASKS_DIR = path.join(ROOT, 'tasks');
const DECISIONS_DIR = path.join(ROOT, 'decisions');

export interface TaskFile {
  id: string;
  title?: string;
  status?: string;
  owner?: string;
  risk?: string;
  notes?: string;
}

function statusIcon(status?: string): string {
  switch (status) {
    case 'done':
      return '✅';
    case 'in_progress':
      return '🔧';
    case 'blocked':
      return '⛔';
    default:
      return '⬜';
  }
}

export function readTasks(): TaskFile[] {
  if (!fs.existsSync(TASKS_DIR)) return [];
  return fs
    .readdirSync(TASKS_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => {
      try {
        return JSON.parse(
          fs.readFileSync(path.join(TASKS_DIR, f), 'utf8'),
        ) as TaskFile;
      } catch {
        return null;
      }
    })
    .filter((t): t is TaskFile => Boolean(t?.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function readDecisions(): string[] {
  if (!fs.existsSync(DECISIONS_DIR)) return [];
  return fs
    .readdirSync(DECISIONS_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md')
    .map((f) => {
      const raw = fs.readFileSync(path.join(DECISIONS_DIR, f), 'utf8');
      const h = raw.split('\n').find((l) => l.startsWith('# '));
      return h ? h.replace(/^#\s*/, '') : f.replace(/\.md$/, '');
    });
}

/**
 * Build the digest HTML for one recipient.
 *   owner '*'  → all tasks + decisions
 *   owner name → only that owner's tasks (no decisions block)
 */
export function buildOwnerDigest(
  label: string,
  owner: string,
  detail: DetailLevel,
  tasks: TaskFile[],
  decisions: string[],
): string {
  const mine =
    owner === '*'
      ? tasks
      : tasks.filter((t) => (t.owner ?? 'unassigned') === owner);
  const open = mine.filter((t) => t.status !== 'done');

  const taskLines = mine.map((t) => {
    const risk = t.risk ? ` · ⚠️ ${htmlEscape(t.risk)}` : '';
    const notes =
      detail === 'full' && t.notes
        ? `\n   <i>${htmlEscape(t.notes.slice(0, 300))}</i>`
        : '';
    return `${statusIcon(t.status)} <b>${htmlEscape(t.id)}</b> ${htmlEscape(
      t.title ?? '',
    )} — ${htmlEscape(t.status ?? '')}${risk}${notes}`;
  });

  const scope = owner === '*' ? 'all agents' : `owner: ${htmlEscape(owner)}`;
  const decisionBlock =
    owner === '*' && decisions.length
      ? `\n\n<b>Decisions</b>\n${decisions
          .map((d) => `🧭 ${htmlEscape(d)}`)
          .join('\n')}`
      : '';

  return (
    `📋 <b>Agent Ops — ${htmlEscape(label)}</b>\n` +
    `${scope} · ${mine.length} tasks (${open.length} open) · detail=${detail}\n\n` +
    `<b>Tasks</b>\n${taskLines.join('\n') || '—'}` +
    decisionBlock
  );
}
