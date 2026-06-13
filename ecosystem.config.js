// PM2 autostart for the agent-orchestrator ONLY (independent of the root
// ecosystem.config.js). Run from inside agent-orchestrator/:
//   npm install && npm run build
//   pm2 start ecosystem.config.js
//   pm2 save                 # persist across reboots
//   pm2 startup              # (run the printed command once, as admin)
module.exports = {
  apps: [
    // ── Main server ──────────────────────────────────────────────────────────
    {
      name: 'agent-orchestrator',
      script: 'dist/server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 4100,
        TZ: 'Asia/Tashkent',
      },
    },

    // ── Heartbeat daemons ────────────────────────────────────────────────────
    // Each agent session that is actively running should have its heartbeat
    // daemon running alongside. When an agent session ends, stop its daemon
    // (pm2 stop heartbeat:claude) so the watchdog knows it went offline.
    //
    // Starting all three by default: if an agent is not active its tasks
    // won't be dispatched to it (capacity>activeTasks check in watchdog).
    // To disable an agent: pm2 stop heartbeat:<name>
    {
      name: 'heartbeat:claude',
      script: 'dist/agents/heartbeat-client.js',
      args: '--agent claude --capacity 2',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Tashkent',
        // ORCHESTRATOR_URL: 'http://localhost:4100',  // default
        // ORCHESTRATOR_API_KEY: '',                   // set if auth enabled
      },
    },
    {
      name: 'heartbeat:antigravity',
      script: 'dist/agents/heartbeat-client.js',
      args: '--agent antigravity --capacity 3',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Tashkent',
      },
    },
    {
      name: 'heartbeat:fable',
      script: 'dist/agents/heartbeat-client.js',
      args: '--agent fable --capacity 1',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Tashkent',
      },
    },
    // ── Event-Driven Listeners (Zero-Waste) ──────────────────────────────────
    {
      name: 'listen:claude',
      script: 'dist/agents/listen-for-work.js',
      args: 'claude',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'listen:antigravity',
      script: 'dist/agents/listen-for-work.js',
      args: 'antigravity',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
