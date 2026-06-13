import https from 'node:https';

/**
 * Minimal, dependency-free Telegram Bot transport.
 *
 * Config via env (never hardcode the token — it lives in `.env`, gitignored):
 *   TELEGRAM_BOT_TOKEN   bot token from @BotFather               (required to enable)
 *   TELEGRAM_CHAT_ID     target chat id                          (optional — auto-discovered)
 *   TELEGRAM_DETAIL      'summary' | 'full'                      (default 'summary')
 *
 * If TELEGRAM_CHAT_ID is unset, the notifier auto-discovers it from getUpdates
 * (you must have sent at least one message — e.g. /start — to the bot first).
 *
 * Security note: 'summary' deliberately omits task `notes` (which can contain
 * audit/exploit detail). Set TELEGRAM_DETAIL=full only on a private chat you trust.
 */
export type DetailLevel = 'summary' | 'full';

interface TelegramApiResult {
  ok: boolean;
  result?: unknown;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat?: { id: number; type?: string };
    from?: { username?: string; first_name?: string };
  };
}

export interface TelegramConfig {
  token?: string;
  chatId?: string;
  detail?: DetailLevel;
}

export class TelegramNotifier {
  private readonly token: string;
  private chatId: string;
  readonly detail: DetailLevel;

  /**
   * Config precedence: explicit constructor arg → env (single-bot fallback).
   * Pass a per-bot config from the bot registry for the multi-bot setup.
   */
  constructor(config: TelegramConfig = {}) {
    this.token = config.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
    this.chatId = config.chatId ?? process.env.TELEGRAM_CHAT_ID ?? '';
    this.detail =
      (config.detail ??
        (process.env.TELEGRAM_DETAIL === 'full' ? 'full' : 'summary')) as DetailLevel;
  }

  /** True when a bot token is configured. */
  get enabled(): boolean {
    return Boolean(this.token);
  }

  /** Resolve the chat id, auto-discovering from getUpdates when not set. */
  async ensureChatId(): Promise<string | null> {
    if (this.chatId) return this.chatId;
    const updates = await this.api('getUpdates', {});
    const list = Array.isArray(updates?.result) ? (updates.result as unknown[]) : [];
    for (const u of list) {
      const id = (u as { message?: { chat?: { id?: number } } })?.message?.chat?.id;
      if (id !== undefined) {
        this.chatId = String(id);
        return this.chatId;
      }
    }
    return null;
  }

  /** Send an HTML message. Returns true only on a confirmed Telegram `ok`. */
  async send(html: string): Promise<boolean> {
    if (!this.enabled) return false;
    const chatId = await this.ensureChatId();
    if (!chatId) return false;
    const res = await this.api('sendMessage', {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    return Boolean(res?.ok);
  }

  /** Send to an explicit chat id (used by the interactive bot to reply). */
  async sendTo(chatId: string | number, html: string): Promise<boolean> {
    if (!this.enabled) return false;
    const res = await this.api('sendMessage', {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    return Boolean(res?.ok);
  }

  /** Long-poll for updates. Returns the raw update array (empty on error). */
  async getUpdates(offset?: number, timeoutSec = 30): Promise<TelegramUpdate[]> {
    if (!this.enabled) return [];
    const res = await this.api('getUpdates', {
      offset,
      timeout: timeoutSec,
      allowed_updates: ['message'],
    });
    if (res && res.ok === false) {
      const err = res as { error_code?: number; description?: string };
      // 409 = another process is already polling this same bot token, or a
      // webhook is set — the #1 reason "the bot doesn't reply".
      // eslint-disable-next-line no-console
      console.error(
        `[telegram] getUpdates failed (${err.error_code ?? '?'}): ${
          err.description ?? 'unknown'
        }`,
      );
    }
    return Array.isArray(res?.result) ? (res.result as TelegramUpdate[]) : [];
  }

  /** Identify the bot behind the token. Returns the @username or null. */
  async getMe(): Promise<string | null> {
    if (!this.enabled) return null;
    const res = await this.api('getMe', {});
    const u = (res?.result as { username?: string } | undefined)?.username;
    return u ?? null;
  }

  /** Remove any webhook so long-polling getUpdates can work. */
  async deleteWebhook(): Promise<void> {
    if (!this.enabled) return;
    await this.api('deleteWebhook', { drop_pending_updates: false });
  }

  private api(
    method: string,
    body: Record<string, unknown>,
  ): Promise<TelegramApiResult | null> {
    return new Promise((resolve) => {
      const payload = JSON.stringify(body);
      const req = https.request(
        {
          hostname: 'api.telegram.org',
          path: `/bot${this.token}/${method}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          // Long-poll calls pass their own `timeout` (seconds); give the socket
          // that plus headroom. Other calls fall back to 10s.
          timeout:
            typeof body.timeout === 'number'
              ? body.timeout * 1000 + 15_000
              : 10_000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data) as TelegramApiResult);
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.write(payload);
      req.end();
    });
  }
}

/** Escape the five characters Telegram HTML parse_mode treats specially. */
export function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
