#!/usr/bin/env node

/**
 * CRTX Session Memory CLI (`node crtx/dist/cli/memory.js`)
 * 
 * Direct, offline, daemon-less interface to the CRTX persistent session memory.
 * Stores and manages session goal, active subsystem scope, in-flight task,
 * recent milestones, and strict directives in crtx/memory/session.json.
 */

import {
  loadSessionMemory,
  saveSessionMemory,
  updateFocus,
  addMilestone,
  setCurrentTask,
  getSessionFilePath
} from '../memory/sessionMemory';

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'status':
    case 'get': {
      const state = loadSessionMemory();
      console.log(JSON.stringify(state, null, 2));
      break;
    }

    case 'summary': {
      const s = loadSessionMemory();
      console.log('=== CRTX SESSION MEMORY STATUS ===');
      console.log(`Conversation ID : ${s.activeConversationId}`);
      console.log(`Updated At      : ${s.updatedAt}`);
      console.log(`Session Goal    : ${s.sessionGoal}`);
      console.log(`Active Scope    : [${s.activeSubsystemScope.join(', ')}]`);
      console.log(`Locked Scopes   : [${s.lockedSubsystems.join(', ')}]`);
      console.log(`Active Task     : ${s.currentTask ? `${s.currentTask.taskId} - ${s.currentTask.title}` : 'None'}`);
      console.log(`Recent Milestones (${s.recentMilestones.length}):`);
      for (const m of s.recentMilestones.slice(-5)) {
        console.log(`  * [${m.taskId}]: ${m.summary} (${m.completedAt})`);
      }
      console.log('===================================');
      break;
    }

    case 'focus': {
      const goal = args[1];
      const scopeArg = args[2];
      if (!goal) {
        console.error('Usage: memory focus "<goal>" [scopesCsv e.g. backend,server]');
        process.exit(1);
      }
      const scope = scopeArg ? scopeArg.split(',').map((s) => s.trim()) : undefined;
      const updated = updateFocus(goal, scope);
      console.log(JSON.stringify({ ok: true, state: updated }, null, 2));
      break;
    }

    case 'milestone': {
      const taskId = args[1];
      const summary = args[2];
      if (!taskId || !summary) {
        console.error('Usage: memory milestone <taskId> "<summary>"');
        process.exit(1);
      }
      const updated = addMilestone(taskId, summary);
      console.log(JSON.stringify({ ok: true, state: updated }, null, 2));
      break;
    }

    case 'task': {
      const taskId = args[1];
      const title = args[2] || '';
      const details = args[3] || '';
      if (!taskId) {
        console.error('Usage: memory task <taskId> "<title>" "<details>"');
        process.exit(1);
      }
      const updated = setCurrentTask({
        taskId,
        title,
        status: 'IN_PROGRESS',
        details
      });
      console.log(JSON.stringify({ ok: true, state: updated }, null, 2));
      break;
    }

    case 'clear-task': {
      const updated = setCurrentTask(null);
      console.log(JSON.stringify({ ok: true, state: updated }, null, 2));
      break;
    }

    case 'path': {
      console.log(getSessionFilePath());
      break;
    }

    default: {
      console.error(`Unknown memory command: ${command}`);
      console.error('Available commands: status, summary, focus, milestone, task, clear-task, path');
      process.exit(1);
    }
  }
}

main();
