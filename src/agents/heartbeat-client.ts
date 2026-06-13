/**
 * Heartbeat client — keeps an agent's liveness signal alive in the orchestrator.
 *
 * Usage:
 *   ts-node src/agents/heartbeat-client.ts --agent claude --capacity 2
 *   ts-node src/agents/heartbeat-client.ts --agent antigravity --capacity 3
 *
 * Or via npm scripts:
 *   npm run heartbeat:claude
 *   npm run heartbeat:antigravity
 *
 * Run this in the background at the start of every agent session.
 * It sends one heartbeat immediately, then repeats every INTERVAL_MS.
 * On SIGINT/SIGTERM it sends { status: offline } before exiting.
 *
 * The server is expected at ORCHESTRATOR_URL (default: http://localhost:4100).
 * If ORCHESTRATOR_API_KEY is set in the environment, it is sent as x-api-key.
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export function startHeartbeat(AGENT: string, CAPACITY: number) {
  const BASE_URL   = process.env.ORCHESTRATOR_URL ?? 'http://localhost:4100';
  const INTERVAL   = 60000; // ms
  const API_KEY    = process.env.ORCHESTRATOR_API_KEY ?? '';

  const ALLOWED = new Set(['claude', 'antigravity', 'fable']);
  if (!ALLOWED.has(AGENT)) {
    console.error(`[heartbeat] unknown agent "${AGENT}". Must be one of: ${[...ALLOWED].join(', ')}`);
    process.exit(1);
  }

// ── HTTP helper ───────────────────────────────────────────────────────────────

function post(path: string, body: object): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url    = new URL(path, BASE_URL);
    const data   = JSON.stringify(body);
    const lib    = url.protocol === 'https:' ? https : http;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data).toString(),
    };
    if (API_KEY) headers['x-api-key'] = API_KEY;

    const req = lib.request(
      { hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname, method: 'POST', headers },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: buf }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────

async function beat(status: 'online' | 'offline' | 'busy'): Promise<void> {
  const ts = new Date().toISOString();
  try {
    const res = await post(`/api/agents/${AGENT}/heartbeat`, { status, capacity: CAPACITY });
    if (res.status === 200 || res.status === 429) {
      // 429 = rate limited — still alive, just don't log noise
      if (res.status !== 429) console.log(`[heartbeat] ${ts} ${AGENT} → ${status} ✓`);
    } else {
      console.warn(`[heartbeat] ${ts} ${AGENT} → ${status} ⚠ HTTP ${res.status}: ${res.body}`);
    }
  } catch (err) {
    console.error(`[heartbeat] ${ts} ${AGENT} → ${status} ✗ ${(err as Error).message}`);
    // Don't exit — server might be temporarily down, retry on next interval
  }
}

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async function main(): Promise<void> {
    console.log(`[heartbeat] starting — agent=${AGENT} capacity=${CAPACITY} interval=${INTERVAL}ms url=${BASE_URL}`);

    // Send online immediately
    await beat('online');

    // Repeat on interval
    const timer = setInterval(() => void beat('online'), INTERVAL);

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      clearInterval(timer);
      console.log(`\n[heartbeat] ${signal} received — sending offline signal`);
      await beat('offline');
      process.exit(0);
    };

    process.on('SIGINT',  () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    // Keep process alive
    process.stdin.resume();
  }

  void main();
}

if (require.main === module) {
  const args = process.argv.slice(2);
  function flag(name: string, fallback: string): string {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : (process.env[name.toUpperCase()] ?? fallback);
  }
  
  const AGENT      = flag('agent', 'claude');
  const CAPACITY   = Number(flag('capacity', '2'));
  startHeartbeat(AGENT, CAPACITY);
}
