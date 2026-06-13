import http from 'node:http';

const agent = process.argv[2] || 'antigravity';

http.get('http://localhost:4100/api/board', (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    try {
      const board = JSON.parse(data);
      const pendingTasks = board.tasks.filter(
        (t: any) => t.owner === agent && (t.status === 'pending' || t.status === 'assigned')
      );

      if (pendingTasks.length === 0) {
        console.log(`[Zero-Waste] NO_WORK_FOR_${agent.toUpperCase()}`);
      } else {
        const ids = pendingTasks.map((t: any) => t.id).join(', ');
        console.log(`[Zero-Waste] WORK_FOUND: ${ids}`);
        console.log(`Run 'cat tasks/${pendingTasks[0].id}.json' to start working.`);
      }
    } catch (err) {
      console.error('Error parsing board data:', err);
    }
  });
}).on('error', (err) => {
  console.error('Orchestrator is offline:', err.message);
});
