import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  acquireCoordFileLock,
  releaseCoordFileLock,
  expireCoordFileLock,
  sendCoordPeerMessage,
  getCoordPeerHistory,
  getCoordFileLocks,
  getCoordPeerSnapshot,
  getStatus
} from './registry';
import { renderDashboardHtml } from './dashboard';

const execAsync = promisify(exec);

type PeerAgentStatus = 'ONLINE' | 'BUSY' | 'IDLE';

function peerStatus(value: string): PeerAgentStatus {
  return value === 'ONLINE' || value === 'IDLE' ? value : 'BUSY';
}

interface AgentSocket extends WebSocket {
  agentName?: string;
  currentAction?: string;
  currentStatus?: string;
  model?: string;
  currentFile?: string;
  lineStart?: number;
  lineEnd?: number;
  isAlive?: boolean;
  capabilities?: string[];
  hasSlotLease?: boolean;
  slotGrantedAt?: number;
  currentTaskId?: string | null;
}


export function startWsServer(primaryPort = 4499, reservePort = 4498): {
  primaryServer: http.Server;
  reserveServer: http.Server;
  wss: WebSocketServer;
} {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });

  function broadcastWs(payload: Record<string, unknown>, filter?: (client: AgentSocket) => boolean) {
    const raw = JSON.stringify(payload);
    for (const client of wss.clients as Set<AgentSocket>) {
      if (client.readyState === WebSocket.OPEN) {
        if (!filter || filter(client)) {
          client.send(raw);
        }
      }
    }
  }

  function createHttpServer(listenPort: number): http.Server {
    const server = http.createServer(async (req, res) => {
      // CORS headers for local web/IDE clients
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://127.0.0.1:${listenPort}`);

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderDashboardHtml());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          role: listenPort === primaryPort ? 'primary' : 'reserve',
          port: listenPort,
          primaryPort,
          reservePort,
          time: new Date().toISOString()
        }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/status') {
        try {
          const { locks } = await getCoordPeerSnapshot();
          const connectedAgents = Array.from(wss.clients as Set<AgentSocket>)
          .filter(c => c.readyState === WebSocket.OPEN && c.agentName)
            .map(c => ({ agent: c.agentName, model: c.model, status: c.currentStatus || 'ONLINE', currentAction: c.currentAction || 'Connected', currentFile: c.currentFile, lineStart: c.lineStart, lineEnd: c.lineEnd }));
          const status = url.searchParams.get('full') === '1'
            ? await getStatus()
            : { activeAgents: connectedAgents.length, activeFileLocks: Object.keys(locks).length };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status, locks, connectedAgents, activePort: listenPort }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/history') {
        const limit = Math.max(0, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
        const history = await getCoordPeerHistory(limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(history));
        return;
      }

      if (req.method === 'GET' && (url.pathname === '/agents' || url.pathname === '/roles')) {
        const agents = Array.from(wss.clients as Set<AgentSocket>)
          .filter(c => c.readyState === WebSocket.OPEN && c.agentName)
          .map(c => ({ agent: c.agentName, model: c.model, status: c.currentStatus || 'ONLINE', currentAction: c.currentAction || 'Connected', currentFile: c.currentFile, lineStart: c.lineStart, lineEnd: c.lineEnd }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(agents));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/diff') {
        try {
          const { stdout: statOut } = await execAsync('git status --short', { cwd: path.resolve(__dirname, '../../..') });
          const { stdout: diffOut } = await execAsync('git diff -U3', { cwd: path.resolve(__dirname, '../../..'), maxBuffer: 1024 * 1024 * 5 });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: statOut, diff: diffOut }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // Read JSON body for POST endpoints
      if (req.method === 'POST') {
        let body = '';
        let bodyBytes = 0;
        let oversized = false;
        req.on('data', chunk => {
          if (oversized) return;
          bodyBytes += Buffer.byteLength(chunk);
          if (bodyBytes > 32 * 1024) {
            oversized = true;
            body = '';
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request exceeds 32 KiB.' }));
            return;
          }
          body += chunk;
        });
        req.on('end', async () => {
          if (oversized) return;
          try {
            const data = body ? JSON.parse(body) : {};

            if (['/role', '/swap-roles', '/clear-locks', '/emergency-stop'].includes(url.pathname)) {
              res.writeHead(410, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'CRTX is limited to peer communication, presence, and file locks.' }));
              return;
            }

            if (url.pathname === '/action') {
              const { agent, action: actText } = data;
              const actStatus = peerStatus(data.status);
              if (!agent || !actText) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'agent and action required' }));
                return;
              }
              const peers = Array.from(wss.clients as Set<AgentSocket>)
                .filter(client => client.readyState === WebSocket.OPEN && client.agentName === agent);
              if (peers.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Agent is not connected.' }));
                return;
              }
              for (const peer of peers) {
                peer.currentAction = actText;
                peer.currentStatus = actStatus;
              }
              broadcastWs({
                event: 'action_updated',
                agent,
                action: actText,
                status: actStatus
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, config: { agent, currentAction: actText, status: actStatus } }));
              return;
            }

            if (url.pathname === '/lock') {
              const { file, agent, reason, ttl, lineStart, lineEnd } = data;
              if (!file || !agent) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'file and agent required' }));
                return;
              }
              const result = await acquireCoordFileLock(file, agent, reason, ttl, lineStart, lineEnd);
              broadcastWs({
                event: result.success ? 'file_locked' : 'lock_failed',
                ...result,
                agent
              });
              res.writeHead(result.success ? 200 : 409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
              return;
            }

            if (url.pathname === '/unlock') {
              const { file, agent } = data;
              if (!file || !agent) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'file and agent required' }));
                return;
              }
              const result = await releaseCoordFileLock(file, agent);
              broadcastWs({ event: result.success ? 'file_unlocked' : 'unlock_rejected', file, agent, ...(!result.success ? { reason: 'Only the lock owner may release this file.' } : {}) });
              res.writeHead(result.success ? 200 : 403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
              return;
            }

            if (url.pathname === '/chat') {
              const { from, to, text } = data;
              if (!from || !text) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'from and text required' }));
                return;
              }
              const result = await sendCoordPeerMessage(from, to || 'all', text);
              broadcastWs({
                event: 'chat_message',
                message: result.message
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
              return;
            }

            if (url.pathname === '/telemetry') {
              const { type, agent, summary, details, file } = data;
              const item = {
                type: type || 'COMMAND',
                agent: agent || 'AI',
                summary: summary || '',
                details: details || '',
                file,
                timestamp: new Date().toISOString()
              };
              broadcastWs({
                event: 'telemetry',
                data: item
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, item }));
              return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('CRTX Coordinator WebSocket & HTTP Server');
    });

    server.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });

    return server;
  }

  // Handle WebSocket connections uniformly across primary and reserve ports
  wss.on('connection', (ws: AgentSocket, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Send connection greeting asynchronously
    ws.send(JSON.stringify({
      event: 'connected',
      message: 'CRTX peer hub online',
      ports: { primary: primaryPort, reserve: reservePort }
    }));

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const action = msg.action || msg.type || msg.event;
        switch (action) {
          
          case 'agent.register':
          case 'agent.heartbeat': {
            const agent = msg.agentId || msg.agent || 'Anonymous';
            ws.agentName = agent;
            ws.capabilities = msg.capabilities || [];
            ws.currentStatus = 'ONLINE';
            ws.send(JSON.stringify({ event: 'agent.registered', agent }));
            break;
          }
          case 'slot.claim': {
            const agent = msg.agentId || ws.agentName;
            const capabilities = msg.capabilities || ws.capabilities || [];
            if (!agent) {
               ws.send(JSON.stringify({ event: 'error', error: 'agentId required' }));
               break;
            }
            
            // Limit to 2 active agents
            const wssClients = Array.from(wss.clients as Set<AgentSocket>);
            const activeLeases = wssClients.filter(c => c.hasSlotLease).length;
            
            if (activeLeases >= 2 && !ws.hasSlotLease) {
               ws.send(JSON.stringify({ event: 'slot.denied', reason: 'DENIED_CAPACITY', activeLeases }));
            } else {
               ws.hasSlotLease = true;
               ws.slotGrantedAt = Date.now();
               ws.send(JSON.stringify({ event: 'slot.granted', agent }));
            }
            break;
          }
          case 'slot.release':
          case 'agent.quota_exhausted':
          case 'agent.error': {
            ws.hasSlotLease = false;
            ws.currentTaskId = null;
            ws.send(JSON.stringify({ event: 'slot.released' }));
            break;
          }
          case 'task.propose': {
             // Handle task proposal
             const proposal = {
                id: `RC-${Date.now()}`,
                domain: msg.domain || 'general',
                severity: msg.severity || 'P1',
                status: 'QUEUED',
                goal: msg.finding,
                evidence: msg.evidence || [],
                requiredCapabilities: [msg.domain || 'general']
             };
             // Ideally save to a task registry
             // For now, broadcast it
             broadcastWs({ event: 'task.queued', task: proposal });
             ws.send(JSON.stringify({ event: 'task.queued', task: proposal }));
             break;
          }
          case 'task.claim': {
             if (!ws.hasSlotLease) {
                ws.send(JSON.stringify({ event: 'error', error: 'Must have SLOT_GRANTED before claiming task' }));
                break;
             }
             // Dummy assignment for now, in a real system fetch from tasks.json
             const assignedTask = {
                id: `RC-AUTO-${Date.now()}`,
                status: 'LEASED',
                assignedAgent: ws.agentName,
                goal: 'Auto-assigned task'
             };
             ws.currentTaskId = assignedTask.id;
             ws.send(JSON.stringify({ event: 'task.assigned', task: assignedTask }));
             break;
          }
          case 'task.checkpoint': {
             if (!ws.currentTaskId) {
                ws.send(JSON.stringify({ event: 'error', error: 'No active task' }));
                break;
             }
             ws.send(JSON.stringify({ event: 'task.checkpointed', taskId: ws.currentTaskId }));
             break;
          }
          case 'task.complete':
          case 'task.blocked': {
             ws.currentTaskId = null;
             ws.send(JSON.stringify({ event: 'task.closed', status: action === 'task.complete' ? 'CLOSED' : 'BLOCKED' }));
             break;
          }

          case 'automatic': {
            ws.send(JSON.stringify({ event: 'error', error: 'Task control and automatic model execution are disabled; use CRTX for peer chat, presence, and file locks only.' }));
            break;
          }
          case 'identify': {
            if (typeof msg.agent !== 'string' || !msg.agent.trim() || msg.agent.length > 96) {
              ws.send(JSON.stringify({ event: 'error', error: 'A bounded agent name is required.' }));
              break;
            }
            const agent = msg.agent;
            ws.agentName = agent;
            const suppliedModel = msg.model || msg.modelName;
            const incomingModel = typeof suppliedModel === 'string' && suppliedModel.length <= 128
              ? suppliedModel : 'Не указана';

            ws.currentAction = 'Подключён';
            ws.currentStatus = 'ONLINE';
            ws.model = incomingModel;

            ws.send(JSON.stringify({
              event: 'identified',
              agent: ws.agentName,
              model: incomingModel,
              currentAction: ws.currentAction,
              instruction: 'CRTX обеспечивает только связь агентов, отображение активности и файловые блокировки. Назначение ролей и управление задачами выполняются вне координатора.'
            }));

            broadcastWs({
              event: 'agent_joined',
              agent: ws.agentName,
              model: incomingModel,
              status: ws.currentStatus,
              currentAction: ws.currentAction
            }, c => c !== ws);
            break;
          }

          case 'set_role': {
            ws.send(JSON.stringify({ event: 'error', error: 'CRTX supports agent communication, presence, and file locks only.' }));
            break;
          }

          case 'swap_roles': {
            ws.send(JSON.stringify({ event: 'error', error: 'Role assignment is not a coordinator function.' }));
            break;
          }

          case 'update_action': {
            const agent = ws.agentName || msg.agent || 'Anonymous';
            const actText = msg.text || msg.actionText || msg.summary || 'Работает';
            const actStatus = peerStatus(msg.status);
            const currentFile = typeof msg.file === 'string' && msg.file.length <= 256 ? msg.file.replace(/\\/g, '/') : undefined;
            const lineStart = Number.isSafeInteger(msg.lineStart) && msg.lineStart > 0 ? msg.lineStart : undefined;
            const lineEnd = Number.isSafeInteger(msg.lineEnd) && msg.lineEnd >= (lineStart || 1) ? msg.lineEnd : undefined;
            ws.currentAction = actText;
            ws.currentStatus = actStatus;
            ws.currentFile = currentFile;
            ws.lineStart = lineStart;
            ws.lineEnd = lineEnd;
            broadcastWs({
              event: 'action_updated',
              agent,
              action: actText,
              status: actStatus,
              file: currentFile,
              lineStart,
              lineEnd
            });
            break;
          }

          case 'emergency_stop': {
            ws.send(JSON.stringify({ event: 'error', error: 'Agent control is outside the coordinator.' }));
            break;
          }

          case 'clear_locks': {
            ws.send(JSON.stringify({ event: 'error', error: 'Locks can only be released by their owner or TTL expiry.' }));
            break;
          }

          case 'get_diff': {
            try {
              const { stdout: statOut } = await execAsync('git status --short', { cwd: path.resolve(__dirname, '../../..') });
              const { stdout: diffOut } = await execAsync('git diff -U3', { cwd: path.resolve(__dirname, '../../..'), maxBuffer: 1024 * 1024 * 5 });
              ws.send(JSON.stringify({ event: 'git_diff', status: statOut, diff: diffOut }));
            } catch (err: any) {
              ws.send(JSON.stringify({ event: 'error', error: err.message }));
            }
            break;
          }

          case 'lock': {
            const agent = ws.agentName || msg.agent || 'Anonymous';
            const file = msg.file;
            const reason = msg.reason || 'Editing file';
            const ttl = msg.ttl || 120;
            if (!file) {
              ws.send(JSON.stringify({ event: 'error', error: 'file is required for lock' }));
              return;
            }
            const lineStart = Number.isSafeInteger(msg.lineStart) && msg.lineStart > 0 ? msg.lineStart : undefined;
            const lineEnd = Number.isSafeInteger(msg.lineEnd) && msg.lineEnd >= (lineStart || 1) ? msg.lineEnd : undefined;
            const res = await acquireCoordFileLock(file, agent, reason, ttl, lineStart, lineEnd);
            ws.send(JSON.stringify({ event: 'lock_result', ...res }));
            if (res.success) {
              ws.currentAction = 'Редактирует: ' + file;
              ws.currentStatus = 'BUSY';
              ws.currentFile = file.replace(/\\/g, '/');
              ws.lineStart = lineStart;
              ws.lineEnd = lineEnd;
              broadcastWs({ event: 'action_updated', agent, action: ws.currentAction, status: 'BUSY', file: ws.currentFile, lineStart, lineEnd });
              broadcastWs({
                event: 'file_locked',
                file: res.file,
                agent,
                lineStart,
                lineEnd,
                expiresAt: res.expiresAt,
                reason
              }, c => c !== ws);
            }
            break;
          }

          case 'unlock': {
            const agent = ws.agentName || msg.agent || 'Anonymous';
            const file = msg.file;
            if (!file) {
              ws.send(JSON.stringify({ event: 'error', error: 'file is required for unlock' }));
              return;
            }
            const res = await releaseCoordFileLock(file, agent);
            ws.send(JSON.stringify({ event: 'unlock_result', ...res }));
            if (res.success) {
              ws.currentFile = undefined;
              ws.lineStart = undefined;
              ws.lineEnd = undefined;
              ws.currentAction = 'Подключён';
              ws.currentStatus = 'IDLE';
              broadcastWs({ event: 'action_updated', agent, action: ws.currentAction, status: 'IDLE' });
              broadcastWs({ event: 'file_unlocked', file, agent }, c => c !== ws);
            }
            break;
          }

          case 'chat': {
            const from = ws.agentName || msg.from || 'Anonymous';
            const to = msg.to || 'all';
            const text = msg.text || msg.message;
            if (!text) {
              ws.send(JSON.stringify({ event: 'error', error: 'text is required for chat' }));
              return;
            }
            const res = await sendCoordPeerMessage(from, to, text);
            // Broadcast to all matching clients
            broadcastWs({
              event: 'chat_message',
              message: res.message
            });
            break;
          }

          case 'get_status': {
            const { locks, messages } = await getCoordPeerSnapshot(50);
            const connectedAgents = Array.from(wss.clients as Set<AgentSocket>)
              .filter(c => c.readyState === WebSocket.OPEN && c.agentName)
              .map(c => ({ agent: c.agentName, model: c.model, status: c.currentStatus || 'ONLINE', currentAction: c.currentAction || 'Connected', currentFile: c.currentFile, lineStart: c.lineStart, lineEnd: c.lineEnd }));
            const status = msg.full === true
              ? await getStatus()
              : { activeAgents: connectedAgents.length, activeFileLocks: Object.keys(locks).length };
            ws.send(JSON.stringify({
              event: 'status',
              status,
              locks,
              connectedAgents,
              recentMessages: messages,
              ports: { primary: primaryPort, reserve: reservePort }
            }));
            break;
          }

          case 'history': {
            const limit = Number.isSafeInteger(msg.limit) ? Math.max(0, Math.min(100, msg.limit)) : 20;
            const history = await getCoordPeerHistory(limit);
            ws.send(JSON.stringify({ event: 'history', messages: history }));
            break;
          }

          case 'ping': {
            ws.send(JSON.stringify({ event: 'pong', timestamp: new Date().toISOString() }));
            break;
          }

          case 'telemetry': {
            const item = {
              type: msg.data?.type || msg.type || 'COMMAND',
              agent: ws.agentName || msg.agent || 'AI',
              summary: msg.data?.summary || msg.summary || '',
              details: msg.data?.details || msg.details || '',
              file: msg.data?.file || msg.file,
              timestamp: new Date().toISOString()
            };
            broadcastWs({
              event: 'telemetry',
              data: item
            });
            break;
          }

          default:
            ws.send(JSON.stringify({ event: 'error', error: `Unknown action: ${action}` }));
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ event: 'error', error: `Invalid JSON or execution error: ${err.message}` }));
      }
    });

    ws.on('close', () => {
      if (ws.agentName) {
        broadcastWs({
          event: 'agent_left',
          agent: ws.agentName
        });
      }
    });
  });

  // Heartbeat to clean broken connections
  const interval = setInterval(() => {
    for (const client of wss.clients as Set<AgentSocket>) {
      if (!client.isAlive) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 60000);

  // Watchdog: expire stale locks with one state read per minute.
  const watchdogInterval = setInterval(async () => {
    try {
      const locks = await getCoordFileLocks();
      const now = Date.now();
      for (const [file, lock] of Object.entries(locks)) {
        if (lock.expiresAt && now > lock.expiresAt) {
          if (await expireCoordFileLock(file, now)) {
            broadcastWs({ event: 'lock_expired', file, agent: lock.agent });
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }, 60000);

  wss.on('close', () => {
    clearInterval(interval);
    clearInterval(watchdogInterval);
  });

  const primaryServer = createHttpServer(primaryPort);
  const reserveServer = createHttpServer(reservePort);

  primaryServer.listen(primaryPort, '127.0.0.1', () => {
    console.log(`[CRTX-WS] Primary Hub running at ws://127.0.0.1:${primaryPort} and http://127.0.0.1:${primaryPort}`);
  });
  primaryServer.on('error', (err: any) => {
    console.error(`[CRTX-WS] Primary server error on port ${primaryPort}: ${err.message}`);
  });

  reserveServer.listen(reservePort, '127.0.0.1', () => {
    console.log(`[CRTX-WS] Reserve Hub running at ws://127.0.0.1:${reservePort} and http://127.0.0.1:${reservePort}`);
    console.log(`[CRTX-WS] High-Availability Dual Mesh Online! (Primary: ${primaryPort}, Reserve: ${reservePort})`);
  });
  reserveServer.on('error', (err: any) => {
    console.error(`[CRTX-WS] Reserve server error on port ${reservePort}: ${err.message}`);
  });

  return { primaryServer, reserveServer, wss };
}
