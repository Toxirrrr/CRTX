/**
 * Interactive Telegram bot(s) — run by the operator on their own machine:
 *
 *   npm run bot
 *
 * No chat id needed: each bot long-polls Telegram and REPLIES to whoever
 * messages it. Multiple bots (one per recipient, from notifications.config.json)
 * run in the same process; each answers with its own owner-filtered board.
 *
 * Commands the bot understands:
 *   /start /help   → short help
 *   /digest /tasks → the board digest (this bot's owner slice)
 *
 * Not runnable from the Claude sandbox (egress is blocked there by design) —
 * this is an operator-run process. Token(s) come from notifications.config.json
 * or .env (TELEGRAM_BOT_TOKEN).
 */
import fs from 'node:fs';
import path from 'node:path';
import { BotRegistry, Bot } from './botRegistry';
import { buildOwnerDigest, readTasks, readDecisions } from './digest';
import type { TelegramUpdate } from './telegram';

loadDotEnv();

const HELP =
  '🤖 <b>Agent Ops bot</b>\n' +
  'Commands:\n' +
  '/digest — current board (your tasks)\n' +
  '/tasks — alias for /digest\n' +
  '/help — this message';

function digestFor(bot: Bot): string {
  const tasks = readTasks();
  const decisions = readDecisions();
  return buildOwnerDigest(
    bot.config.name,
    bot.config.owner,
    bot.notifier.detail,
    tasks,
    decisions,
  );
}

async function handleUpdate(bot: Bot, u: TelegramUpdate): Promise<void> {
  const chatId = u.message?.chat?.id;
  const text = (u.message?.text ?? '').trim().toLowerCase();
  if (chatId === undefined) return;

  if (text.startsWith('/digest') || text.startsWith('/tasks') || text.startsWith('/board')) {
    await bot.notifier.sendTo(chatId, digestFor(bot));
  } else if (text.startsWith('/start') || text.startsWith('/help')) {
    await bot.notifier.sendTo(chatId, HELP);
  } else {
    await bot.notifier.sendTo(chatId, 'Send /digest for the board, /help for commands.');
  }
}

async function pollLoop(bot: Bot): Promise<void> {
  let offset: number | undefined;
  // Identify the bot + clear any webhook (a webhook blocks getUpdates).
  const username = await bot.notifier.getMe();
  await bot.notifier.deleteWebhook();
  if (!username) {
    // eslint-disable-next-line no-console
    console.error(
      `[bot] ${bot.config.name}: getMe failed — token invalid/revoked or no network. Skipping.`,
    );
    return;
  }
  // eslint-disable-next-line no-console
  console.log(
    `[bot] ${bot.config.name} → @${username} (owner=${bot.config.owner}) listening… ` +
      `if it never replies, another program is polling this same token (409).`,
  );
  for (;;) {
    try {
      const updates = await bot.notifier.getUpdates(offset, 30);
      for (const u of updates) {
        offset = u.update_id + 1;
        await handleUpdate(bot, u);
      }
    } catch {
      // transient network/API error — back off briefly and retry
      await sleep(2000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function main(): void {
  const registry = new BotRegistry();
  if (registry.size === 0) {
    // eslint-disable-next-line no-console
    console.error(
      '[bot] no bots configured — set TELEGRAM_BOT_TOKEN in .env or create notifications.config.json.',
    );
    process.exit(1);
  }
  for (const bot of registry.list()) {
    void pollLoop(bot);
  }
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

main();
