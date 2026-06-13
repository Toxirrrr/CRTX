import fs from 'node:fs';
import path from 'node:path';
import { TelegramNotifier, DetailLevel } from './telegram';

const ROOT = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(ROOT, 'notifications.config.json');

/**
 * One Telegram bot per recipient. `owner` is the routing key:
 *   - an agent/owner name ('claude' | 'antigravity' | 'fable' | 'unassigned' …)
 *     → this bot only receives notifications whose task owner matches.
 *   - '*' → this bot receives everything (an all-seeing channel).
 */
export interface BotConfig {
  name: string;
  owner: string;
  token: string;
  chatId?: string;
  detail?: DetailLevel;
}

export interface Bot {
  config: BotConfig;
  notifier: TelegramNotifier;
}

/** A notification's routable fields (subset of Notification). */
export interface Routable {
  owner?: string;
}

/**
 * Loads per-recipient bots from `notifications.config.json` (gitignored).
 * Falls back to a single env-configured bot (owner '*') when the file is absent
 * but TELEGRAM_BOT_TOKEN is set — so the simple one-bot setup keeps working.
 */
export class BotRegistry {
  private readonly bots: Bot[] = [];

  constructor() {
    for (const cfg of this.loadConfigs()) {
      if (!cfg.token) continue;
      this.bots.push({ config: cfg, notifier: new TelegramNotifier(cfg) });
    }
  }

  get size(): number {
    return this.bots.length;
  }

  list(): Bot[] {
    return this.bots;
  }

  /** Bots that should receive a notification with the given owner. */
  match(item: Routable): Bot[] {
    const owner = item.owner ?? 'unassigned';
    return this.bots.filter(
      (b) => b.config.owner === '*' || b.config.owner === owner,
    );
  }

  private loadConfigs(): BotConfig[] {
    // Preferred: explicit per-recipient config file.
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = JSON.parse(
          fs.readFileSync(CONFIG_FILE, 'utf8'),
        ) as { bots?: BotConfig[] };
        if (Array.isArray(raw.bots)) {
          return raw.bots.filter((b) => b && b.name && b.owner);
        }
      } catch {
        // malformed config → fall through to env fallback
      }
    }
    // Fallback: single env bot, owner '*'.
    if (process.env.TELEGRAM_BOT_TOKEN) {
      return [
        {
          name: 'default',
          owner: '*',
          token: process.env.TELEGRAM_BOT_TOKEN,
          chatId: process.env.TELEGRAM_CHAT_ID,
          detail: process.env.TELEGRAM_DETAIL === 'full' ? 'full' : 'summary',
        },
      ];
    }
    return [];
  }
}
