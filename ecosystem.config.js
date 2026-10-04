// PM2 autostart for the agent-orchestrator ONLY (independent of the root
// ecosystem.config.js). Run from inside agent-orchestrator/:
//   npm install && npm run build
//   pm2 start ecosystem.config.js
//   pm2 save                 # persist across reboots
//   pm2 startup              # (run the printed command once, as admin)
module.exports = {
  apps: [
    // 🎛️ Main server 🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️🎛️
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

    // 💓 Heartbeat daemons 💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓💓
    // Each agent session that is actively running should have its heartbeat
    // daemon running alongside. When an agent session ends, stop its daemon
    // (pm2 stop heartbeat:codex) so the watchdog knows it went offline.
    {
      name: 'heartbeat:agy',
      script: 'dist/agents/heartbeat-client.js',
      args: '--agent agy --capacity 3',
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
      name: 'heartbeat:codex',
      script: 'dist/agents/heartbeat-client.js',
      args: '--agent codex --capacity 3',
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

    // 🎧 Event-Driven Listeners (Zero-Waste) 🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧🎧
    {
      name: 'listen:agy',
      script: 'dist/agents/listen-for-work.js',
      args: 'agy',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'listen:codex',
      script: 'dist/agents/listen-for-work.js',
      args: 'codex',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
