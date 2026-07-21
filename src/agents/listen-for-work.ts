import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const CYCLES_DIR = path.join(ROOT, 'cycles');
const AGENTS_DIR = path.join(ROOT, 'agents');

export function startListener(agent: string) {
  console.log(`[Event-Driven] ${agent} is listening for cycles (with Work Stealing)...`);

  let isProcessing = false;

  function checkCycles() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // 1. Read capacities for ALL agents
    const stats: Record<string, { capacity: number, active: number, lastSeen: number }> = {};
    if (fs.existsSync(AGENTS_DIR)) {
      const agentFiles = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.status.json'));
      for (const af of agentFiles) {
        const name = af.replace('.status.json', '');
        try {
          const st = JSON.parse(fs.readFileSync(path.join(AGENTS_DIR, af), 'utf8'));
          stats[name] = { 
            capacity: typeof st.capacity === 'number' ? st.capacity : 2, 
            active: 0,
            lastSeen: st.lastSeen ? new Date(st.lastSeen).getTime() : 0
          };
        } catch { /* ignore */ }
      }
    }
    if (!stats[agent]) stats[agent] = { capacity: 2, active: 0, lastSeen: Date.now() };

    // 2. Scan cycles to calculate active counts and find pending cycles
    if (!fs.existsSync(CYCLES_DIR)) {
        fs.mkdirSync(CYCLES_DIR, { recursive: true });
    }
    const files = fs.readdirSync(CYCLES_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    const pendingCycles: { file: string, owner: string }[] = [];

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(CYCLES_DIR, file), 'utf8');
        const cycle = JSON.parse(raw);

        if (cycle.status === 'in_progress' || cycle.status === 'review' || cycle.status === 'assigned') {
          if (cycle.owner && stats[cycle.owner]) {
            stats[cycle.owner].active++;
          }
        } else if (cycle.status === 'pending') {
          pendingCycles.push({ file, owner: cycle.owner || '' });
        }
      } catch { /* ignore partial read */ }
    }

    const myStats = stats[agent];
    
    // 3. Apply limit & Work Stealing logic
    if (myStats.active < myStats.capacity) {
      // Primary: Look for my own pending cycles
      let target = pendingCycles.find(t => t.owner === agent);
      
      // Fallback (Work Stealing): Look for cycles of OTHER agents who are FULL, or unowned cycles
      let isSteal = false;
      if (!target) {
        const now = Date.now();
        target = pendingCycles.find(t => {
          if (!t.owner) return true; // Unowned cycle, grab it
          const ownerStats = stats[t.owner];
          if (!ownerStats) return true;
          
          // Steal if the owner is completely full
          if (ownerStats.active >= ownerStats.capacity) return true;
          
          // Steal if the owner is offline (no heartbeat for 2 minutes)
          if (now - ownerStats.lastSeen > 2 * 60 * 1000) return true;

          return false;
        });
        if (target) isSteal = true;
      }

      if (target) {
        console.log(`\n🔔 WAKE UP! ENGINEERING CYCLE READY: ${target.file}`);
        console.log(`My Capacity: ${myStats.active}/${myStats.capacity}`);
        if (isSteal) {
          console.log(`[Work Stealing] Original owner '${target.owner}' is full (or empty). You are taking over!`);
        }
        
        // Auto-claim the cycle to stop the PM2 infinite loop
        try {
          const targetPath = path.join(CYCLES_DIR, target.file);
          const rawCycle = fs.readFileSync(targetPath, 'utf8');
          const cycleObj = JSON.parse(rawCycle);
          cycleObj.owner = agent;
          cycleObj.status = 'assigned';
          cycleObj.updatedAt = new Date().toISOString();
          fs.writeFileSync(targetPath, JSON.stringify(cycleObj, null, 2), 'utf8');
          console.log(`[Auto-Claim] Set cycles/${target.file} owner="${agent}" and status="assigned"`);
        } catch (e) {
          console.error(`[Error] Failed to auto-claim ${target.file}`, e);
        }
      }
    }
  } catch (err) {
    // Ignore FS errors
  } finally {
    isProcessing = false;
  }
}

  // Check initially
  checkCycles();

  // Check on any file change in cycles/
  fs.watch(CYCLES_DIR, (eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
      checkCycles();
    }
  });
}

if (require.main === module) {
  const agent = process.argv[2] || 'antigravity';
  startListener(agent);
}
