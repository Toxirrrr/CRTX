export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRTX Agent Chat & File Activity</title>
  <style>
    :root {
      --bg: #080c14;
      --card-bg: rgba(15, 23, 42, 0.75);
      --card-hover: rgba(30, 41, 59, 0.85);
      --border: #1e293b;
      --border-focus: #3b82f6;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --codex-color: #10b981;
      --antigravity-color: #8b5cf6;
      --gemini-color: #f59e0b;
      --reviewer-color: #06b6d4;
      --supervisor-color: #ec4899;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --code-bg: #020617;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --warning: #f59e0b;
      --success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding: 18px 24px; line-height: 1.5; min-height: 100vh; }
    
    /* Top Header */
    header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--border); margin-bottom: 18px; flex-wrap: wrap; gap: 14px; }
    .title-box { display: flex; align-items: center; gap: 14px; }
    .brand-logo { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800; color: #fff; box-shadow: 0 0 15px rgba(59, 130, 246, 0.4); }
    .title-box h1 { font-size: 1.35rem; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
    .title-box .subtitle { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }

    .header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .badge-live { display: inline-flex; align-items: center; gap: 7px; background: rgba(16, 185, 129, 0.12); color: #10b981; padding: 5px 12px; border-radius: 9999px; font-size: 0.78rem; font-weight: 600; border: 1px solid rgba(16, 185, 129, 0.25); }
    .badge-live .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; animation: pulse 2s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.35; } 100% { opacity: 1; } }

    /* Button System */
    .btn { background: var(--accent); color: #fff; border: 1px solid transparent; padding: 7px 13px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px; }
    .btn:hover { background: var(--accent-hover); transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .btn-danger { background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
    .btn-danger:hover { background: var(--danger); color: #fff; }
    .btn-emergency { background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: #fff; box-shadow: 0 0 16px rgba(239, 68, 68, 0.45); font-weight: 700; border: none; }
    .btn-emergency:hover { background: #dc2626; box-shadow: 0 0 20px rgba(239, 68, 68, 0.7); }
    .btn-warning { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3); }
    .btn-warning:hover { background: #f59e0b; color: #000; }
    .btn-secondary { background: rgba(255, 255, 255, 0.05); color: #e2e8f0; border-color: var(--border); }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); border-color: #475569; }
    .btn-sm { padding: 4px 8px; font-size: 0.74rem; border-radius: 6px; }

    /* Stats KPI Bar */
    .stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(8px); }
    .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.04em; }
    .stat-value { font-size: 1.25rem; font-weight: 800; color: #fff; margin-top: 2px; }
    .stat-icon { font-size: 1.5rem; opacity: 0.85; }

    /* Agents Dynamic Grid */
    .section-title { font-size: 0.92rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
    .agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; margin-bottom: 20px; }
    
    .agent-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; backdrop-filter: blur(8px); transition: all 0.2s ease; position: relative; overflow: hidden; }
    .agent-card::before { content: ""; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--accent); }
    .agent-card.codex::before { background: var(--codex-color); }
    .agent-card.gemini::before { background: var(--gemini-color); }
    .agent-card.antigravity::before { background: var(--antigravity-color); }
    .agent-card.reviewer::before { background: var(--reviewer-color); }
    .agent-card.supervisor::before { background: var(--supervisor-color); }

    .agent-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .agent-id-box { display: flex; align-items: center; gap: 8px; }
    .agent-name { font-weight: 700; font-size: 0.98rem; color: #fff; }
    .agent-online-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; }
    
    .role-select { background: #0f172a; color: #f8fafc; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 0.76rem; font-weight: 700; outline: none; cursor: pointer; transition: border-color 0.15s; }
    .role-select:focus { border-color: var(--accent); }

    .agent-action-box { background: rgba(0,0,0,0.35); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
    .agent-action-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; display: flex; justify-content: space-between; }
    .agent-action-text { font-size: 0.84rem; color: #e2e8f0; font-weight: 600; margin-top: 3px; word-break: break-word; }

    /* Locks in Agent Card */
    .agent-locks-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .file-lock-pill { background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #93c5fd; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-family: monospace; display: inline-flex; align-items: center; gap: 6px; max-width: 100%; }
    .file-lock-pill .btn-del-lock { background: none; border: none; color: #f87171; cursor: pointer; font-weight: bold; font-size: 0.8rem; line-height: 1; }
    .file-lock-pill .btn-del-lock:hover { color: #ef4444; }

    /* Quick task dispatch inside card */
    .card-task-input-box { display: flex; gap: 6px; }
    .card-task-input { flex: 1; background: #020617; border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; color: #fff; font-size: 0.78rem; outline: none; }
    .card-task-input:focus { border-color: var(--accent); }

    /* Main Split Stream: Live Feed & Chat */
    .main-stream { display: grid; grid-template-columns: 1.25fr 1.25fr 1fr; gap: 16px; }
    @media (max-width: 1200px) { .main-stream { grid-template-columns: 1.5fr 1.5fr; } .locks-panel { grid-column: span 2; } }
    @media (max-width: 850px) { .main-stream { grid-template-columns: 1fr; } .locks-panel { grid-column: span 1; } }

    .feed-container, .chat-panel, .locks-panel { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; display: flex; flex-direction: column; height: 580px; backdrop-filter: blur(8px); }
    
    .panel-header { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: 700; color: #fff; }
    
    /* Filter Tabs for Feed */
    .feed-filter-bar { display: flex; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.2); overflow-x: auto; }
    .filter-tab { background: none; border: 1px solid transparent; color: var(--text-muted); padding: 3px 10px; border-radius: 6px; font-size: 0.74rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
    .filter-tab.active, .filter-tab:hover { background: rgba(255,255,255,0.08); color: #fff; border-color: var(--border); }
    
    .feed-body { flex: 1; overflow-y: auto; padding: 12px; font-family: "JetBrains Mono", monospace; font-size: 0.8rem; display: flex; flex-direction: column; gap: 8px; }
    
    .log-entry { padding: 9px 12px; border-radius: 8px; background: rgba(0,0,0,0.4); border: 1px solid var(--border); animation: fadeIn 0.15s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
    .log-top { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.72rem; color: var(--text-muted); }
    .log-badge { font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-size: 0.68rem; }
    .badge-cmd { background: #3b82f6; color: #fff; }
    .badge-code { background: #10b981; color: #fff; }
    .badge-lock { background: #f59e0b; color: #000; }
    .badge-chat { background: #8b5cf6; color: #fff; }
    .badge-preempt { background: #ef4444; color: #fff; }
    .badge-role { background: #ec4899; color: #fff; }
    .log-content { word-break: break-all; color: #e2e8f0; font-size: 0.82rem; }
    .log-code-snippet { background: var(--code-bg); padding: 8px 10px; border-radius: 6px; margin-top: 6px; font-size: 0.76rem; border-left: 3px solid var(--accent); color: #93c5fd; white-space: pre-wrap; }

    /* Chat Messages */
    .chat-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .chat-bubble { padding: 10px 14px; border-radius: 8px; font-size: 0.82rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-left-width: 3px; }
    .chat-bubble.codex { border-left-color: var(--codex-color); }
    .chat-bubble.codex .sender-name { color: var(--codex-color); }
    .chat-bubble.gemini { border-left-color: var(--gemini-color); }
    .chat-bubble.gemini .sender-name { color: var(--gemini-color); }
    .chat-bubble.antigravity { border-left-color: var(--antigravity-color); }
    .chat-bubble.antigravity .sender-name { color: var(--antigravity-color); }
    .chat-bubble.user { border-left-color: var(--accent); }
    .chat-bubble.user .sender-name { color: var(--accent); }
    .chat-bubble.system { border-left-color: #ec4899; }
    .chat-bubble.system .sender-name { color: #ec4899; }
    .chat-bubble.watchdog { border-left-color: #f59e0b; }
    .chat-bubble.watchdog .sender-name { color: #f59e0b; }

    .chat-sender-line { font-weight: 700; font-size: 0.72rem; margin-bottom: 3px; display: flex; justify-content: space-between; }
    .chat-text { white-space: pre-wrap; line-height: 1.4; word-break: break-word; color: #f1f5f9; }

    /* Quick Command Chips above Chat Input */
    .chat-quick-chips { display: flex; gap: 6px; padding: 6px 12px; border-top: 1px solid var(--border); background: rgba(0,0,0,0.25); overflow-x: auto; }
    .chip { background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: #cbd5e1; padding: 3px 8px; border-radius: 12px; font-size: 0.72rem; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
    .chip:hover { background: rgba(59, 130, 246, 0.2); border-color: var(--accent); color: #fff; }

    .chat-input-area { padding: 10px 12px; border-top: 1px solid var(--border); display: flex; gap: 8px; background: rgba(0,0,0,0.3); }
    .recipient-select { background: #020617; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; color: #94a3b8; font-size: 0.78rem; outline: none; max-width: 110px; }
    .chat-input { flex: 1; background: #020617; border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px; color: #fff; font-size: 0.85rem; outline: none; }
    .chat-input:focus, .recipient-select:focus { border-color: var(--accent); }

    /* Dedicated Locks List */
    .locks-body { flex: 1; overflow-y: auto; padding: 12px; }
    .lock-item { display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 0.78rem; padding: 8px 10px; background: rgba(0,0,0,0.3); border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border); }
    .lock-file-name { color: #60a5fa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 65%; font-weight: 600; }
    .lock-agent-tag { color: var(--text-muted); font-size: 0.72rem; }

    /* Modal for Git Diff */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 2000; align-items: center; justify-content: center; backdrop-filter: blur(6px); }
    .modal-overlay.active { display: flex; }
    .modal-content { background: var(--bg); border: 1px solid var(--border); border-radius: 14px; width: 92%; max-width: 1050px; height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 0 40px rgba(0,0,0,0.7); }
    .modal-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.9); }
    .modal-body { flex: 1; overflow-y: auto; padding: 16px 20px; font-family: "JetBrains Mono", monospace; font-size: 0.82rem; background: var(--code-bg); white-space: pre-wrap; color: #e2e8f0; line-height: 1.45; }
    .diff-add { color: #34d399; background: rgba(16, 185, 129, 0.08); display: block; border-left: 2px solid #10b981; padding: 1px 4px; }
    .diff-del { color: #f87171; background: rgba(239, 68, 68, 0.08); display: block; border-left: 2px solid #ef4444; padding: 1px 4px; }

    /* Toast Notifications */
    .toast-container { position: fixed; bottom: 20px; right: 24px; z-index: 3000; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
    .toast { background: rgba(15, 23, 42, 0.95); border: 1px solid var(--border); border-left: 4px solid var(--accent); color: #fff; padding: 10px 16px; border-radius: 8px; font-size: 0.8rem; box-shadow: 0 4px 16px rgba(0,0,0,0.4); animation: slideIn 0.2s ease-out; pointer-events: auto; }
    @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  </style>
</head>
<body>

  <!-- Top Bar -->
  <header>
    <div class="title-box">
      <div class="brand-logo">TQ</div>
      <div>
        <h1>TINIQ Mission Control</h1>
        <div class="subtitle">Связь агентов · активность · блокировки файлов</div>
      </div>
    </div>
    
    <div class="header-right">
      <span class="badge-live" id="statusBadge"><span class="dot"></span> ПОДКЛЮЧЕНО</span>
    </div>
  </header>

  <!-- Stats KPI Bar -->
  <div class="stats-bar">
    <div class="stat-card">
      <div>
        <div class="stat-label">Подключено Агентов</div>
        <div class="stat-value" id="kpiAgents">3</div>
      </div>
      <div class="stat-icon">🤖</div>
    </div>
    <div class="stat-card">
      <div>
        <div class="stat-label">Активных Блокировок</div>
        <div class="stat-value" id="kpiLocks" style="color:#60a5fa;">0</div>
      </div>
      <div class="stat-icon">🔒</div>
    </div>
    <div class="stat-card">
      <div>
        <div class="stat-label">Событий в Эфире</div>
        <div class="stat-value" id="kpiEvents">0</div>
      </div>
      <div class="stat-icon">⚡</div>
    </div>
    <div class="stat-card">
      <div>
        <div class="stat-label">Dual-Mesh Связь</div>
        <div class="stat-value" style="font-size: 0.95rem; color:#10b981; font-weight:700;">Primary 4499 / Reserve 4498</div>
      </div>
      <div class="stat-icon">📡</div>
    </div>
  </div>

  <!-- Dynamic Agent Grid -->
  <div class="section-title">
    <span>🤖 Подключённые агенты</span>
    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">Активность и файлы, над которыми они работают</span>
  </div>
  <div class="agent-grid" id="agentGrid">
    <!-- Dynamically rendered via renderAgentCards() -->
  </div>

  <!-- Live Stream, Chat & Locks Triplet -->
  <div class="main-stream">
    <!-- Column 1: Live Telemetry Feed -->
    <div class="feed-container">
      <div class="panel-header">
        <span>⚡ Прямой эфир действий</span>
        <button class="btn btn-secondary btn-sm" onclick="clearFeed()">Очистить</button>
      </div>
      <div class="feed-filter-bar">
        <button class="filter-tab active" onclick="setFeedFilter('ALL', this)">Все</button>
        <button class="filter-tab" onclick="setFeedFilter('CODE', this)">✏️ Код</button>
        <button class="filter-tab" onclick="setFeedFilter('LOCK', this)">🔒 Блокировки</button>
        <button class="filter-tab" onclick="setFeedFilter('CMD', this)">⚡ Команды</button>
      </div>
      <div class="feed-body" id="feedBody">
        <div class="log-entry" data-category="ALL">
          <div class="log-top">
            <span class="log-badge badge-chat">SYSTEM</span>
            <span>Только что</span>
          </div>
          <div class="log-content">CRTX отображает подключённые агенты и передаёт сообщения в общий чат.</div>
        </div>
      </div>
    </div>

    <!-- Column 2: Shared Agent Chat -->
    <div class="chat-panel">
      <div class="panel-header">
        <span>💬 Общий чат агентов</span>
        <span style="font-size:0.75rem; color:var(--text-muted);">Все сообщения видны участникам</span>
      </div>
      <div class="chat-messages" id="chatList">
        <!-- Messages loaded from history -->
      </div>
      
      <div class="chat-input-area">
        <input type="text" id="chatInput" class="chat-input" placeholder="Общее сообщение агентам... (Enter)" onkeydown="if(event.key==='Enter') sendUserMessage()">
        <button class="btn" onclick="sendUserMessage()">Отправить</button>
      </div>
    </div>

    <!-- Column 3: Active Locks Inspector -->
    <div class="locks-panel">
      <div class="panel-header">
        <span>🔒 Заблокированные файлы</span>
        <span id="panelLockCount" style="color:#60a5fa; font-size:0.8rem;">0 файлов</span>
      </div>
      <div class="locks-body" id="locksList">
        <div style="color: var(--text-muted); font-size: 0.8rem; padding: 12px; text-align: center;">
          Нет активных блокировок.<br>Все файлы свободны для редактирования.
        </div>
      </div>
      <div style="padding: 10px 14px; border-top: 1px solid var(--border); font-size: 0.72rem; color: var(--text-muted); background: rgba(0,0,0,0.2);">
        ⏱️ Авто-сторож (Watchdog): файлы автоматически освобождаются при неактивности > 120 сек.
      </div>
    </div>
  </div>

  <!-- Git Diff Modal -->
  <div class="modal-overlay" id="diffModal">
    <div class="modal-content">
      <div class="modal-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <h3 style="font-size: 1.05rem; color: #fff;">📄 Текущие изменения в кодовой базе (Git Diff)</h3>
          <button class="btn btn-secondary btn-sm" onclick="openGitDiff()">🔄 Обновить</button>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="closeGitDiff()">✕ Закрыть</button>
      </div>
      <div class="modal-body" id="diffContent">
        Загрузка изменений...
      </div>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div class="toast-container" id="toastContainer"></div>

  <script>
    const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    let ws;
    let audioCtx = null;
    let currentFeedFilter = 'ALL';
    let totalEventsCount = 0;
    let cachedRoles = [];
    let cachedLocks = {};

    function playBeep(freq = 520, type = 'sine', duration = 0.15) {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch (e) {}
    }

    function showToast(text, type = 'info') {
      const c = document.getElementById('toastContainer');
      const t = document.createElement('div');
      t.className = 'toast';
      if (type === 'danger') t.style.borderLeftColor = 'var(--danger)';
      if (type === 'success') t.style.borderLeftColor = 'var(--success)';
      if (type === 'warning') t.style.borderLeftColor = 'var(--warning)';
      t.innerText = text;
      c.appendChild(t);
      setTimeout(() => { t.remove(); }, 3500);
    }

    function connect() {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        document.getElementById('statusBadge').innerHTML = '<span class="dot"></span> ПОДКЛЮЧЕНО (' + location.port + ')';
        document.getElementById('statusBadge').style.borderColor = 'rgba(16, 185, 129, 0.25)';
        ws.send(JSON.stringify({ action: 'get_status' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleIncoming(msg);
        } catch (e) {
          console.error('Invalid WS JSON:', e);
        }
      };

      ws.onclose = () => {
        document.getElementById('statusBadge').innerHTML = '<span class="dot" style="background: #ef4444; box-shadow: 0 0 8px #ef4444;"></span> ПЕРЕПОДКЛЮЧЕНИЕ...';
        setTimeout(connect, 2000);
      };
    }

    function handleIncoming(msg) {
      const feed = document.getElementById('feedBody');
      const time = new Date().toLocaleTimeString();

      if (msg.event === 'status') {
        if (msg.locks) { cachedLocks = msg.locks; renderAllLocks(msg.locks); }
        if (msg.connectedAgents) { cachedRoles = msg.connectedAgents; renderAgentCards(msg.connectedAgents); }
        if (Array.isArray(msg.recentMessages)) {
          const chat = document.getElementById('chatList');
          chat.innerHTML = '';
          for (const m of msg.recentMessages) addChatMessage(m.from, m.text, m.timestamp);
        }
      }

      if (msg.event === 'history' && Array.isArray(msg.messages)) {
        const chat = document.getElementById('chatList');
        chat.innerHTML = '';
        for (const m of msg.messages) {
          addChatMessage(m.from, m.text, m.timestamp);
        }
      }

      if (msg.event === 'action_updated') {
        const agent = cachedRoles.find(item => item.agent === msg.agent);
        if (agent) {
          agent.currentAction = msg.action;
          agent.status = msg.status;
          agent.currentFile = msg.file;
          agent.lineStart = msg.lineStart;
          agent.lineEnd = msg.lineEnd;
        }
        renderAgentCards(cachedRoles);
      }

      if (msg.event === 'telemetry') {
        totalEventsCount++;
        document.getElementById('kpiEvents').innerText = totalEventsCount;
        const t = msg.data;
        let badgeClass = 'badge-cmd';
        let badgeText = t.type || 'EXEC';
        let category = 'CMD';
        if (t.type === 'CODE_EDIT' || t.type === 'FILE_WRITE') { badgeClass = 'badge-code'; badgeText = 'CODE'; category = 'CODE'; }

        addLogEntry(badgeText + ' • ' + (t.agent || 'AI'), badgeClass, category, \`<strong>\${escapeHtml(t.summary || '')}</strong>\${t.details ? \`<div class="log-code-snippet">\${escapeHtml(t.details)}</div>\` : ''}\`);
      }

      if (msg.event === 'file_locked') {
        playBeep(480, 'sine', 0.1);
        if (msg.file && msg.agent) {
          cachedLocks[msg.file] = { file: msg.file, agent: msg.agent, priority: 10, lineStart: msg.lineStart, lineEnd: msg.lineEnd };
          renderAllLocks(cachedLocks);
          renderAgentCards(cachedRoles);
        }
        showToast(\`🔒 \${msg.agent} занял \${msg.file.split('/').pop()}\`, 'info');
        addLogEntry('🔒 LOCK • ' + msg.agent, 'badge-lock', 'LOCK', \`Занят: <strong style="color:#60a5fa">\${escapeHtml(msg.file)}</strong>\${msg.lineStart ? ':' + msg.lineStart + (msg.lineEnd && msg.lineEnd !== msg.lineStart ? '–' + msg.lineEnd : '') : ''}\`);
      }

      if (msg.event === 'file_unlocked' || msg.event === 'lock_expired') {
        if (msg.file) {
          delete cachedLocks[msg.file];
          renderAllLocks(cachedLocks);
          renderAgentCards(cachedRoles);
        }
        addLogEntry('🔓 UNLOCK • ' + (msg.agent || 'WATCHDOG'), 'badge-code', 'LOCK', \`Файл освобождён: <strong>\${escapeHtml(msg.file)}</strong>\`);
      }

      if (msg.event === 'chat_message') {
        addChatMessage(msg.message.from, msg.message.text, msg.message.timestamp);
      }
    }

    function addLogEntry(badgeText, badgeClass, category, contentHtml) {
      const feed = document.getElementById('feedBody');
      const time = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.dataset.category = category;
      if (currentFeedFilter !== 'ALL' && currentFeedFilter !== category) {
        entry.style.display = 'none';
      }
      entry.innerHTML = \`
        <div class="log-top">
          <span class="log-badge \${badgeClass}">\${badgeText}</span>
          <span>\${time}</span>
        </div>
        <div class="log-content">\${contentHtml}</div>
      \`;
      feed.appendChild(entry);
      feed.scrollTop = feed.scrollHeight;
    }

    function renderAgentCards(roles) {
      const grid = document.getElementById('agentGrid');
      const agents = Array.isArray(roles) ? roles : Object.values(roles || {});
      document.getElementById('kpiAgents').innerText = agents.length;
      grid.innerHTML = '';

      // Update chat recipient dropdown

      for (const a of agents) {

        const card = document.createElement('div');
        const lower = a.agent.toLowerCase();
        let cls = 'agent-card';
        if (lower.includes('codex')) cls += ' codex';
        else if (lower.includes('gemini')) cls += ' gemini';
        else if (lower.includes('antigravity')) cls += ' antigravity';
        card.className = cls;

        // Count locks held by this agent
        const agentLocks = Object.values(cachedLocks).filter(l => l.agent.toLowerCase() === a.agent.toLowerCase());

        let locksHtml = '';
        if (agentLocks.length > 0) {
          locksHtml = '<div class="agent-locks-row">' + agentLocks.map(l => {
            const shortName = l.file.split('/').pop();
            const range = l.lineStart ? ':' + l.lineStart + (l.lineEnd && l.lineEnd !== l.lineStart ? '–' + l.lineEnd : '') : '';
            return \`<div class="file-lock-pill" title="\${escapeHtml(l.file + range)}">
              <span>\${escapeHtml(shortName + range)}</span>
            </div>\`;
          }).join('') + '</div>';
        }

        card.innerHTML = \`
          <div class="agent-card-header">
            <div class="agent-id-box">
              <span class="agent-online-dot"></span>
              <div>
                <span class="agent-name">\${escapeHtml(a.agent)}</span>
                <span class="agent-model-badge" style="display:inline-block; font-size:0.68rem; padding:1px 6px; border-radius:4px; background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); margin-left:6px; font-weight:700;">🧠 \${escapeHtml(a.model || 'AI Model')}</span>
              </div>
            </div>
          </div>

          <div class="agent-action-box">
            <div class="agent-action-label">
              <span>Текущая активность</span>
              <span>\${agentLocks.length > 0 ? '🔒 ' + agentLocks.length + ' файлов' : 'свободен'}</span>
            </div>
            <div class="agent-action-text">\${escapeHtml(a.currentAction || 'Подключён')}</div>
            \${a.currentFile ? \`<div class="agent-action-text">\${escapeHtml(a.currentFile)}\${a.lineStart ? ':' + a.lineStart + (a.lineEnd && a.lineEnd !== a.lineStart ? '–' + a.lineEnd : '') : ''}</div>\` : ''}
          </div>

          \${locksHtml}

          <div class="card-task-input-box">
            <input type="text" class="card-task-input" id="task-input-\${escapeHtml(a.agent)}" placeholder="Сообщение \${escapeHtml(a.agent)}..." onkeydown="if(event.key==='Enter') sendAgentDirectTask('\${escapeHtml(a.agent)}')">
            <button class="btn btn-secondary btn-sm" onclick="sendAgentDirectTask('\${escapeHtml(a.agent)}')">➔</button>
          </div>
        \`;
        grid.appendChild(card);
      }
    }

    function sendAgentDirectTask(agent) {
      const input = document.getElementById('task-input-' + agent);
      if (!input) return;
      const text = input.value.trim();
      if (!text || !ws) return;
      ws.send(JSON.stringify({
        action: 'chat',
        from: 'Operator (User)',
        to: agent,
        text
      }));
      input.value = '';
      showToast(\`Сообщение отправлено для \${agent}\`, 'success');
    }

    function setFeedFilter(cat, btn) {
      currentFeedFilter = cat;
      const tabs = document.querySelectorAll('.filter-tab');
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      const entries = document.querySelectorAll('#feedBody .log-entry');
      entries.forEach(e => {
        if (cat === 'ALL' || e.dataset.category === cat) {
          e.style.display = 'block';
        } else {
          e.style.display = 'none';
        }
      });
    }

    async function fetchRoles() {
      try {
        const res = await fetch('/agents');
        cachedRoles = await res.json();
        renderAgentCards(cachedRoles);
      } catch (e) {}
    }

    function addChatMessage(sender, text, timestamp) {
      const chat = document.getElementById('chatList');
      const bubble = document.createElement('div');
      const lower = (sender || '').toLowerCase();
      let cls = 'antigravity';
      if (lower.includes('codex')) cls = 'codex';
      else if (lower.includes('gemini')) cls = 'gemini';
      else if (lower.includes('operator') || lower.includes('user') || lower.includes('supervisor')) cls = 'user';
      else if (lower.includes('system')) cls = 'system';
      else if (lower.includes('watchdog')) cls = 'watchdog';
      
      const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

      bubble.className = 'chat-bubble ' + cls;
      bubble.innerHTML = \`
        <div class="chat-sender-line">
          <span class="sender-name">\${escapeHtml(sender)}</span>
          <span style="color:var(--text-muted); font-size:0.7rem;">\${timeStr}</span>
        </div>
        <div class="chat-text">\${escapeHtml(text)}</div>
      \`;
      chat.appendChild(bubble);
      chat.scrollTop = chat.scrollHeight;
    }

    function sendUserMessage() {
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text || !ws) return;
      ws.send(JSON.stringify({ action: 'chat', text, from: 'Operator (User)', to: 'all' }));
      input.value = '';
    }

    function renderAllLocks(locks) {
      const container = document.getElementById('locksList');
      const entries = Object.entries(locks);
      document.getElementById('kpiLocks').innerText = entries.length;
      document.getElementById('panelLockCount').innerText = entries.length + ' файлов';

      if (entries.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; padding: 12px; text-align: center;">Нет активных блокировок.<br>Все файлы свободны.</div>';
        return;
      }
      container.innerHTML = '';
      for (const [file, info] of entries) {
        const item = document.createElement('div');
        item.className = 'lock-item';
        item.innerHTML = \`
          <span class="lock-file-name" title="\${escapeHtml(file)}">\${escapeHtml(file)}</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="lock-agent-tag">\${escapeHtml(info.agent)}</span>
          </div>
        \`;
        container.appendChild(item);
      }
    }

    function unlockFile(file, agent) {
      if (!ws) return;
      ws.send(JSON.stringify({ action: 'unlock', file, agent }));
      showToast(\`Запрос на разблокировку \${file.split('/').pop()}\`, 'info');
    }

    async function openGitDiff() {
      const modal = document.getElementById('diffModal');
      const content = document.getElementById('diffContent');
      modal.classList.add('active');
      content.innerHTML = 'Загрузка изменений через git diff...';
      try {
        const res = await fetch('/diff');
        const data = await res.json();
        if (data.error) {
          content.innerText = 'Ошибка загрузки diff: ' + data.error;
          return;
        }
        let html = '<div style="margin-bottom:12px; font-weight:bold; color:#60a5fa;">📁 ИЗМЕНЕННЫЕ ФАЙЛЫ:\\n' + escapeHtml(data.status || 'Нет изменений в рабочем каталоге') + '</div>';
        html += '<hr style="border:0; border-top:1px solid #1e293b; margin:12px 0;">';
        
        const lines = (data.diff || 'Нет незакоммиченных различий в коде. Рабочее дерево чисто.').split('\\n');
        for (const line of lines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            html += '<div class="diff-add">' + escapeHtml(line) + '</div>';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            html += '<div class="diff-del">' + escapeHtml(line) + '</div>';
          } else {
            html += '<div>' + escapeHtml(line) + '</div>';
          }
        }
        content.innerHTML = html;
      } catch (e) {
        content.innerText = 'Сбой сети при запросе diff: ' + e.message;
      }
    }

    function closeGitDiff() {
      document.getElementById('diffModal').classList.remove('active');
    }

    function clearFeed() {
      document.getElementById('feedBody').innerHTML = '';
    }

    function escapeHtml(str) {
      return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    connect();
  </script>
</body>
</html>`;
}
