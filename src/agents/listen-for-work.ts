import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const TASKS_DIR = path.join(ROOT, 'tasks');
const AGENTS_DIR = path.join(ROOT, 'agents');

export function startListener(agent: string) {
  console.log(`[Event-Driven] ${agent} is listening for tasks (with Work Stealing)...`);

  let isProcessing = false;

  function checkTasks() {
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

    // 2. Scan tasks to calculate active counts and find pending tasks
    const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    const pendingTasks: { file: string, owner: string }[] = [];

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(TASKS_DIR, file), 'utf8');
        const task = JSON.parse(raw);

        if (task.status === 'in_progress' || task.status === 'review' || task.status === 'assigned') {
          if (task.owner && stats[task.owner]) {
            stats[task.owner].active++;
          }
        } else if (task.status === 'pending') {
          pendingTasks.push({ file, owner: task.owner || '' });
        }
      } catch { /* ignore partial read */ }
    }

    const myStats = stats[agent];
    
    // 3. Apply limit & Work Stealing logic
    if (myStats.active < myStats.capacity) {
      // Primary: Look for my own pending tasks
      let target = pendingTasks.find(t => t.owner === agent);
      
      // Fallback (Work Stealing): Look for tasks of OTHER agents who are FULL, or unowned tasks
      let isSteal = false;
      if (!target) {
        const now = Date.now();
        target = pendingTasks.find(t => {
          if (!t.owner) return true; // Unowned task, grab it
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
        console.log(`\n🔔 WAKE UP! TASK READY: ${target.file}`);
        console.log(`My Capacity: ${myStats.active}/${myStats.capacity}`);
        if (isSteal) {
          console.log(`[Work Stealing] Original owner '${target.owner}' is full (or empty). You are taking over!`);
        }
        
        // Auto-claim the task to stop the PM2 infinite loop
        try {
          const targetPath = path.join(TASKS_DIR, target.file);
          const rawTask = fs.readFileSync(targetPath, 'utf8');
          const taskObj = JSON.parse(rawTask);
          taskObj.owner = agent;
          taskObj.status = 'assigned';
          taskObj.updatedAt = new Date().toISOString();
          fs.writeFileSync(targetPath, JSON.stringify(taskObj, null, 2), 'utf8');
          console.log(`[Auto-Claim] Set tasks/${target.file} owner="${agent}" and status="assigned"`);
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
  checkTasks();

  // Check on any file change in tasks/
  fs.watch(TASKS_DIR, (eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
      checkTasks();
    }
  });
}

if (require.main === module) {
  const agent = process.argv[2] || 'antigravity';
  startListener(agent);
}
