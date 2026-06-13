import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import * as path from 'path';
import { AgentTask, AgentTaskInput, HandshakeStatus } from './types';

/**
 * In-memory task handshake bus. Every submit/status change emits a 'task'
 * event so the dashboard (Socket.io) and other listeners stay in sync.
 */
export class TaskBus extends EventEmitter {
  private tasks = new Map<string, AgentTask>();
  // Stores IDs of terminal tasks to prevent OOM while keeping dependency checks functional
  private completedTaskIds = new Set<string>();

  private hasCycle(startTaskId: string, newDeps: string[]): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const visit = (nodeId: string): boolean => {
      if (stack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      stack.add(nodeId);

      let deps: string[] = [];
      if (nodeId === startTaskId) {
        deps = newDeps;
      } else {
        const task = this.tasks.get(nodeId);
        if (task) deps = (task.payload?.dependsOn as string[]) || [];
        // If it's only in completedTaskIds, it has no unresolved dependencies we care about for cycles
      }

      for (const dep of deps) {
        if (visit(dep)) return true;
      }

      stack.delete(nodeId);
      return false;
    };

    return visit(startTaskId);
  }

  async submit(input: AgentTaskInput): Promise<AgentTask> {
    let runtimeHealth: any = { agents: {}, fallbackChain: ['claude'] };
    let costPolicy: any = { allowGenericAgent: true, limits: {} };
    try {
      runtimeHealth = JSON.parse(await fsp.readFile(path.resolve(process.cwd(), 'memory/runtime_health.json'), 'utf-8'));
      costPolicy = JSON.parse(await fsp.readFile(path.resolve(process.cwd(), 'memory/cost_policy.json'), 'utf-8'));
    } catch (e) {}

    // Cost Policy Validation
    const role = input.payload.role;
    if (role === 'general-purpose' && costPolicy.allowGenericAgent === false) {
      throw new Error('CostPolicyViolation: general-purpose role is disabled');
    }

    const depth = input.payload.depth || 0;
    if (costPolicy.maxDepth !== undefined && depth > costPolicy.maxDepth) {
      throw new Error(`CostPolicyViolation: max depth exceeded (limit: ${costPolicy.maxDepth})`);
    }

    const risk = input.payload.risk || 'LOW';
    const limit = costPolicy.limits?.[risk]?.maxAgents;
    const count = input.payload.subagentsCount || 0; // Assuming the payload indicates how many it plans to spawn or is currently tracking
    if (limit !== undefined && count > limit) {
      throw new Error(`CostPolicyViolation: max agents exceeded for risk ${risk} (limit: ${limit})`);
    }

    const skills = input.payload.skills || [];
    if (skills.includes('subagent-driven-development')) {
      const allowedRisks = costPolicy.skills?.['subagent-driven-development']?.allowedRisks || [];
      const allowedDomains = costPolicy.skills?.['subagent-driven-development']?.allowedDomains || [];
      const domain = input.payload.domain;
      
      const riskAllowed = allowedRisks.includes(risk);
      const domainAllowed = domain && allowedDomains.includes(domain);
      
      if (!riskAllowed && !domainAllowed) {
        throw new Error(`CostPolicyViolation: subagent-driven-development not allowed for risk ${risk} / domain ${domain}`);
      }
    }

    let targetAgent = input.targetAgent;
    let status = input.status ?? 'REQUESTED';

    if (runtimeHealth.agents[targetAgent] && runtimeHealth.agents[targetAgent].status !== 'online') {
      let found = false;
      const fallbackAttempts = (input.payload.fallbackAttempts as number) || 0;
      
      if (fallbackAttempts > 3) {
        status = 'PARKED';
      } else {
        for (const fallback of runtimeHealth.fallbackChain || []) {
          if (runtimeHealth.agents[fallback] && runtimeHealth.agents[fallback].status === 'online') {
            targetAgent = fallback;
            input.payload.fallbackAttempts = fallbackAttempts + 1;
            found = true;
            break;
          }
        }
        if (!found) status = 'PARKED';
      }
    }

    if (input.payload.risk === 'CRITICAL' || input.payload.domain === 'RBAC') {
      status = 'ESCALATED';
    }

    const cSize = input.payload.contextSize || 0;
    if (cSize >= 100000) {
      if (input.payload.compressionDone) {
        status = 'ESCALATED'; // Prevent infinite compression cascade
      } else {
        input.payload.requiresCompression = true;
      }
    } else if (cSize >= 50000) {
      input.payload.capsulePolicy = 'capsule-only';
    } else if (cSize >= 20000) {
      input.payload.capsulePolicy = 'capsule-preferred';
    }

    const taskId = input.taskId ?? randomUUID();
    const deps = (input.payload.dependsOn as string[]) || [];
    if (deps.includes(taskId)) {
      throw new Error('SelfDependencyError: Task cannot depend on itself');
    }
    if (this.hasCycle(taskId, deps)) {
      throw new Error('CyclicDependencyError: Cyclic dependency detected');
    }

    const now = new Date().toISOString();
    const task: AgentTask = {
      taskId,
      sourceAgent: input.sourceAgent,
      targetAgent,
      status,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.taskId, task);
    this.emit('task', task);
    return task;
  }

  updateStatus(taskId: string, targetStatus: HandshakeStatus, payload?: Record<string, unknown>): AgentTask {
    const existing = this.tasks.get(taskId);
    if (!existing) {
      throw new Error(`Unknown taskId: ${taskId}`);
    }
    
    let status = targetStatus;
    const combinedPayload = payload ?? existing.payload;

    if (status === 'COMPLETED') {
      if (existing.status === 'ESCALATED') {
        throw new Error('EscalationReviewError: ESCALATED tasks must transition to REVIEW before COMPLETED');
      }
      const v = combinedPayload.validation as any;
      if (v && (v.lint === false || v.tests === false)) {
        status = 'REVIEW_FAILED';
      }
    }

    if (status === 'ACCEPTED' || status === 'IN_PROGRESS') {
      const deps = combinedPayload.dependsOn as string[];
      if (deps && deps.includes(taskId)) {
        throw new Error('SelfDependencyError: Task cannot depend on itself');
      }
      if (deps && deps.length > 0) {
        if (this.hasCycle(taskId, deps)) {
          throw new Error('CyclicDependencyError: Cyclic dependency detected');
        }
        for (const depId of deps) {
          if (this.completedTaskIds.has(depId)) continue; // Already safely completed/swept
          
          const dep = this.tasks.get(depId);
          if (!dep || dep.status !== 'COMPLETED') {
            throw new Error(`DependencyBlockedError: Cannot start task until dependency ${depId} is COMPLETED.`);
          }
        }
      }
    }

    const updated: AgentTask = {
      ...existing,
      status,
      payload: combinedPayload,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(taskId, updated);
    this.emit('task', updated);
    return updated;
  }

  list(): AgentTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Memory Leak Prevention:
   * Removes payloads of terminal tasks to free RAM over long periods.
   * terminal states: COMPLETED, CANCELLED, PARKED, REVIEW_FAILED.
   * Returns the number of tasks swept.
   */
  sweep(): number {
    let count = 0;
    const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'PARKED', 'REVIEW_FAILED']);
    for (const [id, task] of this.tasks.entries()) {
      if (TERMINAL_STATUSES.has(task.status)) {
        if (task.status === 'COMPLETED') {
          this.completedTaskIds.add(id);
        }
        this.tasks.delete(id);
        count++;
      }
    }
    return count;
  }
}
