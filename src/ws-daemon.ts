import { startWsServer } from './coordinator/ws-server';
import { spawn, ChildProcess } from 'node:child_process';

const primaryPort = process.env.CRTX_WS_PORT ? parseInt(process.env.CRTX_WS_PORT, 10) : 4499;
const reservePort = process.env.CRTX_WS_RESERVE_PORT ? parseInt(process.env.CRTX_WS_RESERVE_PORT, 10) : 4498;

if (process.argv.includes('--supervise')) {
  let child: ChildProcess | undefined;
  let timer: NodeJS.Timeout | undefined;
  let stopping = false;
  let failures: number[] = [];
  const launch = () => {
    if (stopping) return;
    const startedAt = Date.now();
    child = spawn(process.execPath, [__filename], { cwd: process.cwd(), env: process.env, shell: false, windowsHide: true, stdio: 'inherit' });
    child.once('error', error => console.error(`[CRTX-SUPERVISOR] Launch failed: ${error.name}`));
    child.once('close', code => {
      if (stopping) return;
      failures = failures.filter(at => Date.now() - at < 300_000);
      if (Date.now() - startedAt > 60_000) failures = [];
      failures.push(Date.now());
      if (failures.length >= 5) { console.error('[CRTX-SUPERVISOR] CIRCUIT_OPEN after five failures/5min; no automatic retry until supervisor restarted'); process.exitCode = 2; return; }
      const delay = Math.min(30_000, 1000 * 2 ** (failures.length - 1)) + Math.floor(Math.random() * 500);
      console.error(`[CRTX-SUPERVISOR] Child exit=${code}; restart in ${delay}ms`);
      timer = setTimeout(launch, delay);
    });
  };
  const stop = () => { stopping = true; if (timer) clearTimeout(timer); child?.kill(); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  launch();
} else {
  console.log(`[CRTX-DAEMON] Starting Dual-Mesh CRTX WebSocket Daemon (Primary: ${primaryPort}, Reserve: ${reservePort})...`);
  const hub = startWsServer(primaryPort, reservePort);
  let stopping = false;
  const stop = () => {
    if (stopping) return; stopping = true;
    for (const client of hub.wss.clients) client.close(1001, 'Hub shutdown; reconnect and resume existing assignment');
    hub.wss.close(); hub.primaryServer.close(); hub.reserveServer.close();
    const deadline = setTimeout(() => process.exit(0), 5000); deadline.unref();
  };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
}
