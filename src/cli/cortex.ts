#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

const API_BASE = process.env.ORCHESTRATOR_URL || 'http://localhost:4100/api';

async function main() {
  const [,, command, ...args] = process.argv;

  if (!command) {
    console.error('Usage: cortex <submit|status|doctor|cleanup> [args]');
    process.exit(1);
  }

  switch (command) {
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

async function handleSubmit(filePath: string) {
  if (!filePath) {
    console.error('Usage: cortex submit <path-to-task.json>');
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

  // Pre-validate role client-side for immediate feedback
  const role = taskInput.payload?.role;
  if (role === 'general-purpose') {
    console.warn('[CORTEX] WARNING: general-purpose role is heavily restricted. Submission may fail.');
  }

  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskInput),
    });

    if (!res.ok) {
      const error = await res.json() as any;
      console.error('❌ Task Submission Failed:', error.error);
      process.exit(1);
    }

    const result = await res.json() as any;
    console.log(`✅ Task submitted successfully. Task ID: ${result.taskId}`);
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
      console.log(`--- CORTEX Board Status ---`);
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
  console.log('🩺 Running CORTEX Doctor...');
  // Force clean orphaned locks
  try {
    const res = await fetch(`${API_BASE}/locks/clean`, { method: 'POST' });
    const data = await res.json() as any;
    console.log(`✅ Lock Janitor ran. Orphaned locks evicted.`);
    console.log(`Remaining locks: ${data.count}`);
  } catch (e: any) {
    console.error('Failed to clean locks:', e.message);
  }
}

async function handleCleanup() {
  console.log('🧹 Running CORTEX Cleanup...');
  // This would archive completed tasks. Currently just logs.
  console.log('Note: Task archival is not yet implemented in the API. Board state is stable.');
}

main().catch(console.error);
