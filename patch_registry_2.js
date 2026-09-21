import * as fs from 'fs';

const file = 'src/coordinator/registry.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace 1
code = code.replace(
  `const entry: CoordChatEntry = {
      chatId,
      agent,
      currentTaskId: null,`,
  `const entry: CoordChatEntry = {
      chatId,
      agent,
      chatState: 'ACTIVE',
      currentTaskId: null,`
);

// Replace 2
code = code.replace(
  `chat = {
      chatId, agent,
      currentTaskId: null, phase: null, intent: null, scope: null,
      locks: [], lastActivity: nowIso(), registeredAt: nowIso(),
    };`,
  `chat = {
      chatId, agent,
      chatState: 'WORKING',
      currentTaskId: null, phase: null, intent: null, scope: null,
      locks: [], lastActivity: nowIso(), registeredAt: nowIso(),
    };`
);

// Replace 3
code = code.replace(
  `newChat = {
      chatId: toChatId, agent,
      currentTaskId: null, phase: null, intent: null, scope: null,
      locks: [], lastActivity: nowIso(), registeredAt: nowIso(),
    };`,
  `newChat = {
      chatId: toChatId, agent,
      chatState: 'WORKING',
      currentTaskId: null, phase: null, intent: null, scope: null,
      locks: [], lastActivity: nowIso(), registeredAt: nowIso(),
    };`
);

// Also need to handle when `oldChat` and `newChat` are NOT null but TypeScript complains because it can't guarantee `readJson` return value isn't null after check.
// Wait, TS complained about `chat is possibly null`.
// Let's check exactly:
// src/coordinator/registry.ts(509,3): error TS18047: 'chat' is possibly 'null'.
// So I should ensure TS knows it's not null.
code = code.replace(
  `chat = {
      chatId, agent,
      chatState: 'WORKING',
      currentTaskId: null, phase: null, intent: null, scope: null,
      locks: [], lastActivity: nowIso(), registeredAt: nowIso(),
    };
  }
  chat.currentTaskId = taskId;`,
  `chat = {
      chatId, agent,
      chatState: 'WORKING',
      currentTaskId: null, phase: null, intent: null, scope: null,
      locks: [], lastActivity: nowIso(), registeredAt: nowIso(),
    };
  }
  chat!.chatState = 'WORKING';
  chat!.currentTaskId = taskId;`
);

code = code.replace(/chat\.phase/g, 'chat!.phase');
code = code.replace(/chat\.intent/g, 'chat!.intent');
code = code.replace(/chat\.scope/g, 'chat!.scope');
code = code.replace(/chat\.locks/g, 'chat!.locks');
code = code.replace(/chat\.lastActivity/g, 'chat!.lastActivity');

code = code.replace(
  `newChat = {
      chatId: toChatId, agent,
      chatState: 'WORKING',
      currentTaskId: null, phase: null, intent: null, scope: null,
      locks: [], lastActivity: nowIso(), registeredAt: nowIso(),
    };
  }
  newChat.currentTaskId = taskId;`,
  `newChat = {
      chatId: toChatId, agent,
      chatState: 'WORKING',
      currentTaskId: null, phase: null, intent: null, scope: null,
      locks: [], lastActivity: nowIso(), registeredAt: nowIso(),
    };
  }
  newChat!.chatState = 'WORKING';
  newChat!.currentTaskId = taskId;`
);

code = code.replace(/newChat\.phase/g, 'newChat!.phase');
code = code.replace(/newChat\.intent/g, 'newChat!.intent');
code = code.replace(/newChat\.scope/g, 'newChat!.scope');
code = code.replace(/newChat\.locks/g, 'newChat!.locks');
code = code.replace(/newChat\.lastActivity/g, 'newChat!.lastActivity');

fs.writeFileSync(file, code);
console.log('registry.ts patched part 2');
