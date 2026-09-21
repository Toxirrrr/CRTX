import * as fs from 'fs';

const file = 'src/coordinator/router.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `import {
  registerChat,
  chatHeartbeat,
  listChats,`,
  `import {
  registerChat,
  processHeartbeat,
  disconnectChat,
  listChats,`
);

code = code.replace(
  `// POST /api/coordinator/heartbeat
coordinatorRouter.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const chatId = requireString(req.body?.chatId, 'chatId');
    await chatHeartbeat(chatId);
    res.json({ ok: true, chatId, lastActivity: new Date().toISOString() });
  } catch (e) { handleError(res, e); }
});`,
  `// POST /api/coordinator/heartbeat
coordinatorRouter.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const chatId = requireString(req.body?.chatId, 'chatId');
    const agent = requireString(req.body?.agent, 'agent');
    const taskId = req.body?.taskId || null;
    const phase = req.body?.phase || null;
    const intent = req.body?.intent || null;
    const timestamp = req.body?.timestamp || new Date().toISOString();

    await processHeartbeat({ chatId, agent, taskId, phase, intent, timestamp });
    res.json({ ok: true, chatId, lastActivity: timestamp });
  } catch (e) { handleError(res, e); }
});

// POST /api/coordinator/disconnect
coordinatorRouter.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const chatId = requireString(req.body?.chatId, 'chatId');
    await disconnectChat(chatId);
    res.json({ ok: true, chatId, status: 'DISCONNECTED' });
  } catch (e) { handleError(res, e); }
});`
);

fs.writeFileSync(file, code);
console.log('router.ts patched');
