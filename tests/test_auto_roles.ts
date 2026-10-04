import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { WebSocket, type RawData } from 'ws';
import type { CoordFileLock, CoordPeerMessage } from '../src/coordinator/types';

interface PeerReply {
  event: string;
  success?: boolean;
  error?: string;
  locks?: Record<string, CoordFileLock>;
  connectedAgents?: { agent: string; currentFile?: string; lineStart?: number; lineEnd?: number }[];
  recentMessages?: CoordPeerMessage[];
  message?: CoordPeerMessage;
  messages?: CoordPeerMessage[];
}

interface PeerRequest {
  action: string;
  agent?: string;
  model?: string;
  file?: string;
  text?: string;
  to?: string;
  ttl?: number;
  lineStart?: number;
  lineEnd?: number;
}

function receive(socket: WebSocket, event: string): Promise<PeerReply> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('message', onMessage);
      socket.off('error', onError);
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onMessage = (raw: RawData) => {
      const reply: PeerReply = JSON.parse(raw.toString());
      if (reply.event === event) { cleanup(); resolve(reply); }
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timed out waiting for ' + event)); }, 3000);
    socket.on('message', onMessage);
    socket.once('error', onError);
  });
}

function request(socket: WebSocket, message: PeerRequest, event: string): Promise<PeerReply> {
  const reply = receive(socket, event);
  socket.send(JSON.stringify(message));
  return reply;
}

function waitOutput(child: ChildProcessWithoutNullStreams, fragment: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = '';
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.off('error', onError);
      child.off('close', onClose);
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error('Peer CLI exited before ' + fragment)); };
    const onData = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-65536);
      if (output.includes(fragment)) { cleanup(); resolve(); }
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Peer CLI output timeout: ' + fragment)); }, 5000);
    child.stdout.on('data', onData);
    child.once('error', onError);
    child.once('close', onClose);
  });
}

async function main(): Promise<void> {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'crtx-peer-test-'));
  const previousRoot = process.env.CRTX_COORDINATOR_TEST_ROOT;
  process.env.CRTX_COORDINATOR_TEST_ROOT = fixtureRoot;
  const registry: typeof import('../src/coordinator/registry') = require('../src/coordinator/registry');
  const { startWsServer }: typeof import('../src/coordinator/ws-server') = require('../src/coordinator/ws-server');
  const hub = startWsServer(0, 0);
  const clients: WebSocket[] = [];
  let cliPeer: ChildProcessWithoutNullStreams | undefined;
  try {
    await Promise.all([hub.primaryServer, hub.reserveServer].map(server =>
      server.listening ? Promise.resolve() : new Promise<void>(resolve => server.once('listening', resolve))));
    const primary = hub.primaryServer.address();
    const reserve = hub.reserveServer.address();
    assert.ok(primary && typeof primary !== 'string');
    assert.ok(reserve && typeof reserve !== 'string');
    const connect = async (port: number, agent: string) => {
      const socket = new WebSocket('ws://127.0.0.1:' + port);
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { socket.terminate(); reject(new Error('Connection timeout')); }, 3000);
        socket.once('open', () => { clearTimeout(timer); resolve(); });
        socket.once('error', error => { clearTimeout(timer); reject(error); });
      });
      await request(socket, { action: 'identify', agent, model: 'integration-test' }, 'identified');
      return socket;
    };
    const writer = await connect(primary.port, 'writer');
    const peer = await connect(reserve.port, 'peer');
    const file = 'server/fixture.ts';
    assert.equal((await request(writer, { action: 'lock', file, ttl: 120, lineStart: 10, lineEnd: 20 }, 'lock_result')).success, true);
    assert.equal((await request(peer, { action: 'lock', file, ttl: 120 }, 'lock_result')).success, false, 'peer cannot preempt');
    assert.equal((await request(peer, { action: 'unlock', file }, 'unlock_result')).success, false, 'foreign unlock rejected');
    const statePath = path.join(fixtureRoot, 'state.json');
    const beforeActivity = await fs.readFile(statePath, 'utf8');
    await request(writer, { action: 'update_action', file, lineStart: 12, lineEnd: 18, text: 'Reviewing exact lines' }, 'action_updated');
    assert.equal(await fs.readFile(statePath, 'utf8'), beforeActivity, 'presence must not rewrite persisted state');
    const status = await request(peer, { action: 'get_status' }, 'status');
    assert.equal(status.locks?.[file].agent, 'writer');
    assert.equal(status.locks?.[file].lineStart, 10);
    assert.equal(status.connectedAgents?.find(agent => agent.agent === 'writer')?.lineStart, 12);
    assert.equal(status.connectedAgents?.length, 2);
    assert.ok(Array.isArray(status.recentMessages));
    const crossHub = receive(peer, 'chat_message');
    const chat = await request(writer, { action: 'chat', to: 'peer', text: 'Shared across both ports' }, 'chat_message');
    assert.equal((await crossHub).message?.id, chat.message?.id);
    assert.equal((await request(peer, { action: 'history' }, 'history')).messages?.length, 1);
    assert.match((await request(writer, { action: 'automatic' }, 'error')).error || '', /disabled/);
    assert.match((await request(writer, { action: 'set_role' }, 'error')).error || '', /communication/);
    const base = 'http://127.0.0.1:' + primary.port;
    assert.equal((await fetch(base + '/chat', { method: 'POST', body: 'x'.repeat(32769) })).status, 413);
    for (const endpoint of ['/role', '/swap-roles', '/clear-locks', '/emergency-stop']) {
      assert.equal((await fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 410);
    }
    const httpStatus = await fetch(base + '/status');
    const compactStatus = await httpStatus.text();
    assert.equal(httpStatus.status, 200);
    assert.ok(compactStatus.length < 8192);
    assert.ok(!compactStatus.includes('"tasks"'), 'default response omits historical task engine');
    assert.equal((await fetch(base + '/status?full=1')).status, 200);
    const old = await registry.acquireCoordFileLock('server/renew.ts', 'writer', 'short lease', 1);
    assert.ok(old.expiresAt);
    await registry.acquireCoordFileLock('server/renew.ts', 'writer', 'renewed lease', 120);
    assert.equal(await registry.expireCoordFileLock('server/renew.ts', Date.parse(old.expiresAt) + 1), false, 'stale watchdog cannot expire a renewed lease');
    await registry.releaseCoordFileLock('server/renew.ts', 'writer');
    assert.equal((await request(writer, { action: 'unlock', file }, 'unlock_result')).success, true);
    const cli = path.resolve(__dirname, '../dist/cli/coordinator.js');
    cliPeer = spawn(process.execPath, [cli, 'ws-client', 'cli-peer', String(primary.port), String(reserve.port)], { windowsHide: true });
    const cliLocked = waitOutput(cliPeer, '"event":"lock_result","success":true');
    cliPeer.stdin.write('{"action":"lock","file":"server/cli-');
    cliPeer.stdin.write('fixture.ts","ttl":120,"lineStart":2,"lineEnd":4}\n');
    await cliLocked;
    assert.equal((await registry.getCoordFileLocks())['server/cli-fixture.ts'].lineStart, 2);
    const sockets = Array.from(hub.wss.clients) as (WebSocket & { agentName?: string })[];
    const cliSocket = sockets.find(socket => socket.agentName === 'cli-peer');
    assert.ok(cliSocket);
    const rejoined = waitOutput(cliPeer, '"event":"identified","agent":"cli-peer"');
    cliSocket.close(1001, 'Reconnect regression test');
    await rejoined;
    await registry.releaseCoordFileLock('server/cli-fixture.ts', 'cli-peer');
    assert.equal(spawnSync(process.execPath, [cli, 'claim'], { encoding: 'utf8' }).status, 2);
    const cliStatus = spawnSync(process.execPath, [cli, 'status'], { encoding: 'utf8' });
    assert.equal(cliStatus.status, 0);
    assert.ok(cliStatus.stdout.includes('"fileLocks"'));
    assert.ok(!cliStatus.stdout.includes('"tasks"'));
    console.log('PASS: peer chat across ports, activity lines, owner-only locks, lease renewal race, compact status, structured CLI input and reconnect; manager/model control disabled, production state untouched.');
  } finally {
    cliPeer?.kill();
    for (const client of clients) client.terminate();
    await new Promise<void>(resolve => hub.wss.close(() => resolve()));
    await Promise.all([hub.primaryServer, hub.reserveServer].map(server =>
      new Promise<void>(resolve => server.close(() => resolve()))));
    process.env.CRTX_COORDINATOR_TEST_ROOT = previousRoot;
    if (previousRoot === undefined) delete process.env.CRTX_COORDINATOR_TEST_ROOT;
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
