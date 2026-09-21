#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { ExecutionEngine } from '../orchestration/ExecutionEngine';
import { ContextAllocator } from '../orchestration/ContextAllocator';
import { ValidationPipeline } from '../orchestration/Validator';
import { RecoveryEngine } from '../orchestration/RecoveryEngine';
import { BoardStore } from '../coordination/boardStore';
import { TaskBus } from '../orchestration/taskBus';

const API_BASE = process.env.ORCHESTRATOR_URL || 'http://localhost:4100/api';

async function main() {
  const [,, command, ...args] = process.argv;

  if (!command) {
    console.error('Usage: crtx <execute|submit|status|doctor|cleanup> [args]');
    process.exit(1);
  }

  switch (command) {
    case 'execute':
      await handleExecute(args[0]);
      break;
    case 'submit':
      await handleSubmit(args[0]);
      break;
    case 'status':
      await handleStatus(args[0]);
      break;
    case 'doctor':
      await handleDoctor();
      break;
    case 'cleanup':
      await handleCleanup();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

async function handleExecute(filePath: string) {
  // redirect console.log to console.error to preserve stdout for JSON
  const originalConsoleLog = console.log;
  console.log = console.error;

  if (!filePath) {
    console.error('Usage: crtx execute <path-to-task.json>');
    process.exit(1); // Invalid CLI input
  }

  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1); // Invalid input
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  let taskInput: any;
  try {
    taskInput = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON file');
    process.exit(1); // Invalid input
  }

  if (!taskInput.id) {
    taskInput.id = `task-${Date.now()}`;
  }

  // CLI instantiation (Ephemeral coordination mocks/defaults so it doesn't rely on running daemon)
  const root = path.resolve(__dirname, '..', '..'); // project crtx
  const contextAllocator = new ContextAllocator(path.resolve(root, 'data', 'snapshots'));
  const validationPipeline = new ValidationPipeline(root);
  const board = new BoardStore();
  const taskBus = new TaskBus();
  const recoveryEngine = new RecoveryEngine(board, taskBus);
  const executionEngine = new ExecutionEngine(contextAllocator, validationPipeline, recoveryEngine);

  try {
    // Attempt execution
    const agentId = 'cli-agent';
    const result = await executionEngine.executeTask(taskInput.id, agentId, taskInput);
    
    // Deterministic serialization
    const out = {
      taskId: taskInput.id,
      status: result.success ? 'SUCCESS' : 'FAILED',
      governance: 'ALLOW', // if it failed due to governance, error starts with GOVERNANCE_BLOCKED
      validation: result.success ? 'PASS' : 'FAIL',
      evidenceId: result.evidenceId,
      metrics: result.metrics,
      error: undefined as any,
      snapshot: true,
      aiExecution: true
    };

    if (result.error) {
      const msg = result.error.message || String(result.error);
      out.error = {
        code: msg.includes('GOVERNANCE_BLOCKED') ? 'GOVERNANCE_BLOCKED' : 'EXECUTION_ERROR',
        message: msg,
        details: [] // Intentionally omitting raw stack trace to prevent internal path leaks
      };

      if (msg.includes('GOVERNANCE_BLOCKED')) {
        out.status = 'BLOCKED';
        out.governance = 'BLOCKED';
        out.snapshot = false;
        out.aiExecution = false;
        process.stdout.write(JSON.stringify(out, null, 2) + '\n');
        process.exit(2); // GOVERNANCE_BLOCKED
      }
      
      process.stdout.write(JSON.stringify(out, null, 2) + '\n');
      process.exit(3); // ORDINARY FAILURE
    }

    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    process.exit(0); // SUCCESS
  } catch (err: any) {
    // Unhandled crash
    const out = {
      taskId: taskInput.id,
      status: 'FAILED',
      error: {
        code: 'UNHANDLED_CRASH',
        message: err.message,
        details: err.stack ? [err.stack] : []
      }
    };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    process.exit(3);
  }
}

async function handleSubmit(filePath: string) {
  if (!filePath) {
    console.error('Usage: crtx submit <path-to-task.json>');
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  let taskInput: any;
  try {
    taskInput = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON file');
    process.exit(1);
  }

  const role = taskInput.payload?.role;
  if (role === 'general-purpose') {
    console.warn('[CRTX] WARNING: general-purpose role is heavily restricted. Submission may fail.');
  }

  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskInput),
    });

    if (!res.ok) {
      const error = await res.json() as any;
      console.error('вќЊ Task Submission Failed:', error.error);
      process.exit(1);
    }

    const result = await res.json() as any;
    console.log(`вњ… Task submitted successfully. Task ID: ${result.taskId}`);
  } catch (err: any) {
    console.error('Failed to communicate with Orchestrator:', err.message);
  }
}

async function handleStatus(taskId?: string) {
  try {
    const res = await fetch(`${API_BASE}/tasks`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    const tasks = await res.json() as any;

    if (taskId) {
      const task = tasks.find((t: any) => t.taskId === taskId || t.id === taskId);
      if (!task) {
        console.error(`Task ${taskId} not found`);
        return;
      }
      console.log(JSON.stringify(task, null, 2));
    } else {
      console.log(`--- CRTX Board Status ---`);
      console.log(`Total Tasks: ${tasks.length}`);
      const active = tasks.filter((t: any) => t.status === 'in_progress' || t.status === 'assigned');
      console.log(`Active: ${active.length}`);
      console.log(`Pending: ${tasks.filter((t: any) => t.status === 'pending' || t.status === 'REQUESTED').length}`);
      console.log(`Parked/Escalated: ${tasks.filter((t: any) => t.status === 'PARKED' || t.status === 'ESCALATED').length}`);
    }
  } catch (e: any) {
    console.error('Failed to get status:', e.message);
  }
}

async function handleDoctor() {
  console.log('рџ©є Running CRTX Doctor...');
  try {
    const res = await fetch(`${API_BASE}/locks/clean`, { method: 'POST' });
    const data = await res.json() as any;
    console.log(`вњ… Lock Janitor ran. Orphaned locks evicted.`);
    console.log(`Remaining locks: ${data.count}`);
  } catch (e: any) {
    console.error('Failed to clean locks:', e.message);
  }
}

async function handleCleanup() {
  console.log('рџ§№ Running CRTX Cleanup...');
  console.log('Note: Task archival is not yet implemented in the API. Board state is stable.');
}

main().catch(console.error);
