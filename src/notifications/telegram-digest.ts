/**
 * One-shot Telegram digest (PUSH) — run MANUALLY by the operator:  npm run notify
 *
 * Sends each configured bot its owner-filtered board digest, once, and exits.
 * For an always-listening bot that REPLIES on demand (no chat id needed), use
 * `npm run bot` instead (src/notifications/bot.ts).
 *
 * Bots come from notifications.config.json (one per recipient, keyed by `owner`)
 * or a single .env bot (TELEGRAM_BOT_TOKEN, owner '*'). Push needs a chat id —
 * set it per bot, or send /start to the bot first so it auto-discovers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { BotRegistry } from './botRegistry';
import { buildOwnerDigest, readTasks, readDecisions } from './digest';

loadDotEnv();

async function main(): Promise<void> {
  const registry = new BotRegistry();
  if (registry.size === 0) {
    console.error(
      '[telegram] no bots configured — create notifications.config.json ' +
        '(see notifications.config.example.json) or set TELEGRAM_BOT_TOKEN in .env.',
    );
    process.exit(1);
  }

  const tasks = readTasks();
  const decisions = readDecisions();
  let ok = 0;
  let failed = 0;

  for (const bot of registry.list()) {
    const html = buildOwnerDigest(
      bot.config.name,
      bot.config.owner,
      bot.notifier.detail,
      tasks,
      decisions,
    );
    const sent = await bot.notifier.send(html);
    if (sent) {
      ok += 1;
      console.log(`[telegram] ✓ ${bot.config.name} (owner=${bot.config.owner})`);
    } else {
      failed += 1;
      console.error(
        `[telegram] ✗ ${bot.config.name} — set chatId or send /start to the bot first.`,
      );
    }
  }

  console.log(`[telegram] done: ${ok} sent, ${failed} failed.`);
  if (ok === 0) process.exit(1);
}

function loadDotEnv(): void {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

void main();
