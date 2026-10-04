#!/usr/bin/env node

/**
 * CRTX Multi-Agent Coordinator — Native File-System CLI
 * 
 * Direct, offline, daemon-less coordinator interface.
 * Operates directly on coordinator/state.json using atomic file locks.
 * Zero HTTP server. Zero port binding. Zero background daemons required.
 */

import {
  createTask,
  claimTask,
  releaseTask,
  updateTaskPhase,
  recordValidation,
  listTasks,
  getTask,
  getStatus,
  listLocks,
  listConflicts,
  resolveConflict,
  markStaleOwners,
  recoverStale,
  acquireCoordFileLock,
  releaseCoordFileLock,
  sendCoordPeerMessage,
  getCoordPeerHistory,
  getCoordPeerSnapshot
} from '../coordinator/registry';
import { CoordIntent, CoordScope, CoordValidationEvidence, CoordTaskStatus } from '../coordinator/types';
import { startWsServer } from '../coordinator/ws-server';
import { WebSocket } from 'ws';

function parseJsonArg<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      // Relaxed cleanup for shell escaping artifacts (e.g. \. or \' in PowerShell)
      const cleaned = raw.replace(/\\([^"\\/bfnrtu])/g, '$1');
      return JSON.parse(cleaned);
    } catch {
      return fallback;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  if (['create', 'claim', 'validate', 'release', 'resolve-conflict', 'recover', 'handoff', 'stale'].includes(command)) {
    console.error('CRTX task/manager control is disabled; use peer chat and file locks only.');
    process.exitCode = 2;
    return;
  }

  try {
    switch (command) {
      case 'status': {
        const snapshot = await getCoordPeerSnapshot(10);
        const status = args.includes('--full') ? await getStatus() : {
          fileLocks: snapshot.locks,
          recentMessages: snapshot.messages,
          livePresence: 'GET /agents or WebSocket get_status'
        };
        console.log(JSON.stringify(status, null, 2));
        break;
      }

      case 'tasks':
      case 'list-tasks': {
        const tasks = await listTasks();
        console.log(JSON.stringify({ tasks, count: tasks.length }, null, 2));
        break;
      }

      case 'get-task': {
        const taskId = args[1];
        if (!taskId) {
          console.error('Usage: coordinator get-task <taskId>');
          process.exit(1);
        }
        const task = await getTask(taskId);
        if (!task) {
          console.error(`Task ${taskId} not found`);
          process.exit(1);
        }
        console.log(JSON.stringify({ task }, null, 2));
        break;
      }

      case 'create': {
        const taskId = args[1];
        const title = args[2] || taskId;
        const description = args[3] || title;
        const deps = args[4] ? parseJsonArg<string[]>(args[4], []) : [];
        if (!taskId) {
          console.error('Usage: coordinator create <taskId> [title] [description] [dependenciesJson]');
          process.exit(1);
        }
        const task = await createTask(taskId, title, description, deps);
        console.log(JSON.stringify({ ok: true, task }, null, 2));
        break;
      }

      case 'claim': {
        const taskId = args[1];
        const chatId = args[2];
        const agent = args[3] || 'Antigravity';
        const intent = (args[4] || 'IMPLEMENT') as CoordIntent;
        const rawScope = parseJsonArg<any>(args[5], {});
        const scope: CoordScope = {
          directories: Array.isArray(rawScope.directories) ? rawScope.directories.map(String) : [],
          files: Array.isArray(rawScope.files) ? rawScope.files.map(String) : [],
          expectedChanges: String(rawScope.expectedChanges || '')
        };

        if (!taskId || !chatId) {
          console.error('Usage: coordinator claim <taskId> <chatId> [agent] [intent] [scopeJson]');
          process.exit(1);
        }

        const result = await claimTask(taskId, chatId, agent, intent, scope);
        if (result.success) {
          console.log(JSON.stringify({ ok: true, task: result.task, locks: result.locks }, null, 2));
        } else {
          console.error(JSON.stringify({ ok: false, conflictType: result.conflictType, message: result.message }, null, 2));
          process.exit(1);
        }
        break;
      }

      case 'validate': {
        const taskId = args[1];
        const chatId = args[2];
        const parsedEvidence = parseJsonArg<any>(args[3], {});
        const evidence: CoordValidationEvidence = {
          lintPassed: parsedEvidence.lintPassed ?? true,
          typecheckPassed: parsedEvidence.typecheckPassed ?? true,
          buildPassed: parsedEvidence.buildPassed ?? true,
          unitTestsPassed: parsedEvidence.unitTestsPassed ?? true,
          integrationTestsPassed: parsedEvidence.integrationTestsPassed ?? true,
          runtimeVerified: parsedEvidence.runtimeVerified ?? true,
          scopeVerified: parsedEvidence.scopeVerified ?? true,
          architectureVerified: parsedEvidence.architectureVerified ?? true,
          remainingBlockers: Array.isArray(parsedEvidence.remainingBlockers) ? parsedEvidence.remainingBlockers : [],
          notes: String(parsedEvidence.notes || ''),
          recordedAt: parsedEvidence.recordedAt || new Date().toISOString()
        };

        if (!taskId || !chatId) {
          console.error('Usage: coordinator validate <taskId> <chatId> [evidenceJson]');
          process.exit(1);
        }

        const task = await recordValidation(taskId, chatId, evidence);
        console.log(JSON.stringify({ ok: true, task }, null, 2));
        break;
      }

      case 'release': {
        const taskId = args[1];
        const chatId = args[2];
        const phase = (args[3] || 'CLOSED') as CoordTaskStatus;

        if (!taskId || !chatId) {
          console.error('Usage: coordinator release <taskId> <chatId> [phase]');
          process.exit(1);
        }

        if (phase && phase !== 'TODO') {
          await updateTaskPhase(taskId, chatId, phase);
        }
        await releaseTask(taskId, chatId, phase);
        console.log(JSON.stringify({ ok: true, taskId, chatId, phase }, null, 2));
        break;
      }

      case 'locks':
      case 'list-locks': {
        const locks = await listLocks();
        console.log(JSON.stringify({ locks, count: locks.length }, null, 2));
        break;
      }

      case 'conflicts':
      case 'list-conflicts': {
        const conflicts = await listConflicts(true);
        console.log(JSON.stringify({ conflicts, count: conflicts.length }, null, 2));
        break;
      }

      case 'resolve-conflict': {
        const conflictId = args[1];
        const resolution = args[2] || 'RESOLVED';
        if (!conflictId) {
          console.error('Usage: coordinator resolve-conflict <conflictId> [resolution]');
          process.exit(1);
        }
        await resolveConflict(conflictId, resolution);
        console.log(JSON.stringify({ ok: true, conflictId, resolution }, null, 2));
        break;
      }

      case 'stale': {
        const stale = await markStaleOwners();
        console.log(JSON.stringify({ stale, count: stale.length }, null, 2));
        break;
      }

      case 'recover': {
        const chatId = args[1];
        const action = (args[2] || 'RESUME').toUpperCase() as 'RESUME' | 'ABORT';
        if (!chatId) {
          console.error('Usage: coordinator recover <chatId> [RESUME|ABORT]');
          process.exit(1);
        }
        await recoverStale(chatId, action);
        console.log(JSON.stringify({ ok: true, chatId, action }, null, 2));
        break;
      }

      case 'handoff': {
        const taskId = args[1];
        const toAgent = args[2];
        const notes = args.slice(3).join(' ') || 'Передача задачи из-за исчерпания контекста токенов';
        if (!taskId || !toAgent) {
          console.error('Usage: coordinator handoff <taskId> <toAgent> [notes]');
          process.exit(1);
        }
        await sendCoordPeerMessage('SYSTEM', 'all', `🔄 [HANDOFF]: Задача ${taskId} передана новому агенту ${toAgent}. Примечание: ${notes}`);
        console.log(JSON.stringify({ ok: true, taskId, toAgent, notes }, null, 2));
        break;
      }

      case 'lock': {
        const file = args[1];
        const agent = args[2] || 'Antigravity';
        const reason = args[3] || 'Editing file';
        const ttl = args[4] ? parseInt(args[4], 10) : 120;
        if (!file) {
          console.error('Usage: coordinator lock <file> [agent] [reason] [ttlSeconds]');
          process.exit(1);
        }
        const res = await acquireCoordFileLock(file, agent, reason, ttl);
        console.log(JSON.stringify(res, null, 2));
        if (!res.success) process.exit(1);
        break;
      }

      case 'unlock': {
        const file = args[1];
        const agent = args[2] || 'Antigravity';
        if (!file) {
          console.error('Usage: coordinator unlock <file> [agent]');
          process.exit(1);
        }
        const res = await releaseCoordFileLock(file, agent);
        console.log(JSON.stringify(res, null, 2));
        break;
      }

      case 'chat':
      case 'send':
      case 'shout': {
        const fromAgent = args[1] || 'Antigravity';
        const toAgent = args[2] || 'all';
        const text = args.slice(3).join(' ');
        if (!text) {
          console.error('Usage: coordinator chat <fromAgent> <toAgent|all> <message>');
          process.exit(1);
        }
        const res = await sendCoordPeerMessage(fromAgent, toAgent, text);
        console.log(JSON.stringify(res, null, 2));
        break;
      }

      case 'history': {
        const limit = args[1] ? parseInt(args[1], 10) : 10;
        const res = await getCoordPeerHistory(limit);
        console.log(JSON.stringify(res, null, 2));
        break;
      }

      case 'ws':
      case 'serve-ws':
      case 'serve': {
        const primary = args[1] ? parseInt(args[1], 10) : (process.env.CRTX_WS_PORT ? parseInt(process.env.CRTX_WS_PORT, 10) : 4499);
        const reserve = args[2] ? parseInt(args[2], 10) : (process.env.CRTX_WS_RESERVE_PORT ? parseInt(process.env.CRTX_WS_RESERVE_PORT, 10) : 4498);
        startWsServer(primary, reserve);
        // Keep process open
        await new Promise(() => {});
        break;
      }

      case 'ws-client':
      case 'client': {
        const agentName = args[1] || 'Antigravity';
        const primaryPort = args[2] ? parseInt(args[2], 10) : 4499;
        const reservePort = args[3] ? parseInt(args[3], 10) : 4498;
        const ports = [primaryPort, reservePort];
        let currentPortIndex = 0;
        let currentSocket: WebSocket | undefined;
        let reconnectTimer: NodeJS.Timeout | undefined;
        let failures = 0;
        let stopping = false;
        let inputBuffer = '';
        let pendingBytes = 0;
        const pending: string[] = [];
        const allowedActions = new Set(['identify', 'chat', 'lock', 'unlock', 'update_action', 'get_status', 'history', 'ping']);
        const sendLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          let frame: string;
          try {
            if (trimmed.startsWith('{')) {
              const command: { action: string } = JSON.parse(trimmed);
              if (!allowedActions.has(command.action)) throw new Error('Only peer communication actions are supported.');
              frame = JSON.stringify(command);
            } else {
              frame = JSON.stringify({ action: 'chat', text: trimmed, to: 'all' });
            }
            if (Buffer.byteLength(frame) > 32 * 1024) throw new Error('Frame exceeds 32 KiB.');
          } catch (error) {
            console.error('[WS-CLIENT] Rejected input:', error instanceof Error ? error.message : 'Invalid peer frame');
            return;
          }
          if (currentSocket?.readyState === WebSocket.OPEN) currentSocket.send(frame);
          else if (pendingBytes + Buffer.byteLength(frame) <= 64 * 1024) {
            pending.push(frame);
            pendingBytes += Buffer.byteLength(frame);
          } else console.error('[WS-CLIENT] Offline queue full; input was not sent. Retry after reconnect.');
        };
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => {
          inputBuffer += chunk.toString();
          let newline = inputBuffer.indexOf('\n');
          while (newline >= 0) {
            sendLine(inputBuffer.slice(0, newline));
            inputBuffer = inputBuffer.slice(newline + 1);
            newline = inputBuffer.indexOf('\n');
          }
          if (Buffer.byteLength(inputBuffer) > 32 * 1024) {
            inputBuffer = '';
            console.error('[WS-CLIENT] Input line exceeds 32 KiB.');
          }
        });
        const stop = () => {
          stopping = true;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          currentSocket?.close();
          process.stdin.pause();
        };
        process.once('SIGTERM', stop);
        process.once('SIGINT', stop);

        function connectWs() {
          if (stopping) return;
          const port = ports[currentPortIndex];
          const url = `ws://127.0.0.1:${port}`;
          const isReserve = currentPortIndex > 0;
          console.log(`[WS-CLIENT] Connecting to ${url} as ${agentName}${isReserve ? ' (RESERVE)' : ''}...`);

          const ws = new WebSocket(url, { handshakeTimeout: 5000 });
          currentSocket = ws;

          ws.on('open', () => {
            failures = 0;
            console.log(`[WS-CLIENT] Connected to ${isReserve ? 'RESERVE' : 'PRIMARY'} Hub (${port})! Identifying as ${agentName}...`);
            ws.send(JSON.stringify({ action: 'identify', agent: agentName, model: args[4] }));
            ws.send(JSON.stringify({ action: 'get_status' }));
            for (const frame of pending.splice(0)) ws.send(frame);
            pendingBytes = 0;
          });

          ws.on('message', (data) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.event === 'chat_message') {
                console.log(`💬 [CHAT] ${msg.message.from} -> ${msg.message.to}: ${msg.message.text}`);
              } else if (msg.event === 'file_locked') {
                console.log(`🔒 [LOCK] ${msg.agent} (priority ${msg.priority}) locked: ${msg.file}${msg.preempted ? ` (PREEMPTED ${msg.previousOwner}!)` : ''}`);
              } else if (msg.event === 'file_unlocked') {
                console.log(`🔓 [UNLOCK] ${msg.agent} released: ${msg.file}`);
              } else if (msg.event === 'welcome' || msg.event === 'connected') {
                console.log(`✨ [HUB] ${msg.message || 'Connected to CRTX WebSocket Hub'}`);
              } else {
                console.log(`📡 [EVENT] ${JSON.stringify(msg)}`);
              }
            } catch {
              console.log(`[RAW] ${data.toString()}`);
            }
          });

          ws.on('error', (err) => {
            console.error(`[WS-CLIENT] Connection error on port ${port}: ${err.message}`);
          });

          ws.on('close', () => {
            if (currentSocket === ws) currentSocket = undefined;
            if (stopping) return;
            console.log(`[WS-CLIENT] Disconnected from port ${port}. Trying failover...`);
            currentPortIndex = (currentPortIndex + 1) % ports.length;
            const delay = Math.min(30000, 1000 * 2 ** Math.min(failures++, 5));
            reconnectTimer = setTimeout(connectWs, Math.round(delay * (0.8 + Math.random() * 0.2)));
          });

        }

        connectWs();
        break;
      }

      case 'stream':
      case 'watch': {
        const primaryPort = args[1] ? parseInt(args[1], 10) : 4499;
        const reservePort = args[2] ? parseInt(args[2], 10) : 4498;
        const ports = [primaryPort, reservePort];
        let currentPortIndex = 0;

        function connectStream() {
          const port = ports[currentPortIndex];
          const url = `ws://127.0.0.1:${port}`;
          const isReserve = currentPortIndex > 0;
          console.log(`\x1b[36m[CRTX STREAM] Connecting to ${isReserve ? 'RESERVE' : 'PRIMARY'} broadcast hub at ${url}...\x1b[0m`);

          const ws = new WebSocket(url);

          ws.on('open', () => {
            console.log(`\x1b[32m[CRTX STREAM] Connected to Live Event Stream (${isReserve ? 'RESERVE' : 'PRIMARY'}: ${port})!\x1b[0m`);
            console.log(`\x1b[90mListening to all AI actions, commands, code edits and locks...\x1b[0m\n`);
            ws.send(JSON.stringify({ action: 'identify', agent: 'Stream-Watcher' }));
          });

          ws.on('message', (data) => {
            try {
              const msg = JSON.parse(data.toString());
              const time = new Date().toLocaleTimeString();

              if (msg.event === 'telemetry') {
                const t = msg.data;
                let icon = '⚡ [COMMAND]';
                let color = '\x1b[34m'; // blue
                if (t.type === 'CODE_EDIT' || t.type === 'FILE_WRITE') {
                  icon = '✏️ [CODE]';
                  color = '\x1b[32m'; // green
                }
                console.log(`${color}${icon} [${time}] ${t.agent || 'AI'}: ${t.summary}\x1b[0m`);
                if (t.details) {
                  console.log(`   \x1b[90m${t.details.replace(/\n/g, '\n   ')}\x1b[0m`);
                }
              } else if (msg.event === 'file_locked') {
                const p = msg.preempted ? ` \x1b[31m(PREEMPTED ${msg.previousOwner}!)\x1b[0m` : '';
                console.log(`\x1b[33m🔒 [LOCK] [${time}] ${msg.agent} (priority ${msg.priority}) locked: ${msg.file}${p}\x1b[0m`);
              } else if (msg.event === 'file_unlocked') {
                console.log(`\x1b[32m🔓 [UNLOCK] [${time}] ${msg.agent} released: ${msg.file}\x1b[0m`);
              } else if (msg.event === 'chat_message') {
                console.log(`\x1b[35m💬 [CHAT] [${time}] ${msg.message.from} -> ${msg.message.to}: ${msg.message.text}\x1b[0m`);
              }
            } catch {
              // raw output
            }
          });

          ws.on('error', (err) => {
            console.error(`\x1b[31m[CRTX STREAM] Error on port ${port}: ${err.message}\x1b[0m`);
          });

          ws.on('close', () => {
            console.log(`\x1b[33m[CRTX STREAM] Connection lost on port ${port}. Failing over to reserve...\x1b[0m`);
            currentPortIndex = (currentPortIndex + 1) % ports.length;
            setTimeout(connectStream, 1000);
          });
        }

        connectStream();
        break;
      }

      default:
        console.error(`Unknown coordinator command: ${command}`);
        console.error('Available commands: status, tasks, get-task, create, claim, validate, release, locks, conflicts, resolve-conflict, stale, recover, handoff, lock, unlock, chat, history, ws, ws-client, stream');
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`Coordinator error: ${err.message}`);
    process.exit(1);
  }
}

main();
