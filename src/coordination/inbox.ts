import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { route, Routing, Engine } from '../orchestration/router';

const ROOT = path.join(__dirname, '..', '..');
const INBOX_DIR = path.join(ROOT, 'inbox');
const TASKS_DIR = path.join(ROOT, 'tasks');

// 'auto' => the orchestrator decides the engine; the others force it.
export type DirectiveTarget = 'auto' | 'claude' | 'antigravity' | 'any';

export interface Directive {
  id: string;
  text: string;
  target: DirectiveTarget;
  routing: Routing;
  createdAt: string;
  file: string;
}

function nextTaskIdNum(existing: string[]): number {
  const nums = existing
    .map((f) => /^F(\d+)\.json$/.exec(f))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

/**
 * The human's command channel. A directive is dropped into inbox/ AND turned
 * into a pending task in tasks/ so it appears on the live board and either
 * agent can claim it.
 */
export class Inbox {
  async create(text: string, target: DirectiveTarget = 'auto'): Promise<{ directive: Directive; taskId: string }> {
    await fsp.mkdir(INBOX_DIR, { recursive: true });
    // The orchestrator decides agent/engine/model/risk. A forced target
    // ('claude'|'antigravity') overrides only the engine.
    const override: Engine | undefined =
      target === 'claude' || target === 'antigravity' ? target : undefined;
    const routing = await route(text, override);
    const id = randomUUID().slice(0, 8);
    const createdAt = new Date().toISOString();
    const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-|-$/g, '');
    const fileName = `${createdAt.replace(/[:.]/g, '-')}-${slug || 'directive'}.md`;
    const body =
      `# Directive ${id}\n\n` +
      `- **Target**: ${target}\n` +
      `- **Created**: ${createdAt}\n` +
      `- **Routed to**: ${routing.agent} on ${routing.engine} (${routing.model}) · risk ${routing.risk}\n` +
      `- **Rationale**: ${routing.rationale}\n\n## Command\n${text}\n`;
    await fsp.writeFile(path.join(INBOX_DIR, fileName), body, 'utf8');

    // If the AI router broke it down into sub-tasks, generate multiple task files.
    const subTasks = routing.subTasks && routing.subTasks.length > 0
      ? routing.subTasks
      : [{ title: text.slice(0, 80), agent: routing.agent, instruction: `Human directive ${id} (inbox/${fileName}). Routed: ${routing.rationale}. Full text: ${text}` }];

    const taskFiles = fs.existsSync(TASKS_DIR) ? await fsp.readdir(TASKS_DIR) : [];
    let currentTaskIdNum = nextTaskIdNum(taskFiles);

    const taskIds: string[] = [];
    for (const st of subTasks) {
      const taskId = `F${String(currentTaskIdNum++).padStart(2, '0')}`;
      taskIds.push(taskId);

      const task = {
        id: taskId,
        title: st.title,
        owner: routing.engine,
        agent: st.agent || routing.agent,
        reviewer: st.reviewer || null,
        engine: routing.engine,
        model: routing.model,
        risk: routing.risk,
        status: 'pending',
        domain: routing.domain,
        files: [],
        createdAt,
        updatedAt: createdAt,
        tokens: { input: 0, output: 0, cost: 0 },
        analysis: routing.analysis || '',
        notes: st.instruction,
      };
      await fsp.writeFile(path.join(TASKS_DIR, `${taskId}.json`), JSON.stringify(task, null, 2) + '\n', 'utf8');
    }

    return { directive: { id, text, target, routing, createdAt, file: fileName }, taskId: taskIds.join(', ') };
  }

  async list(): Promise<Directive[]> {
    if (!fs.existsSync(INBOX_DIR)) return [];
    const files = (await fsp.readdir(INBOX_DIR)).filter((f) => f.endsWith('.md'));
    const out: Directive[] = [];
    for (const file of files) {
      const raw = await fsp.readFile(path.join(INBOX_DIR, file), 'utf8');
      const id = /# Directive (\w+)/.exec(raw)?.[1] ?? file;
      const target = (/\*\*Target\*\*: (\w+)/.exec(raw)?.[1] ?? 'auto') as DirectiveTarget;
      const createdAt = /\*\*Created\*\*: (.+)/.exec(raw)?.[1] ?? '';
      const text = raw.split('## Command\n')[1]?.trim() ?? '';
      const override: Engine | undefined =
        target === 'claude' || target === 'antigravity' ? target : undefined;
      out.push({ id, text, target, routing: await route(text, override), createdAt, file });
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
