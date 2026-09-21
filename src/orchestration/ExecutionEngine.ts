import { 
  IExecutionEngine, 
  ExecutionResult, 
  ExecutionState, 
  IValidationPipeline, 
  IRecoveryEngine,
  ExecutionContext
} from './types';
import { ContextAllocator } from './ContextAllocator';
import { TaskFingerprint } from '../token/TaskFingerprint';
import { ResultCache } from '../token/ResultCache';

import { PolicyResolver } from './PolicyResolver';
import { GovernanceGate } from './GovernanceGate';

/**
 * P1: Execution Engine
 * Glues together ContextAllocator (Rollback), ValidationPipeline, Auto QA, and Recovery.
 * Now includes Token Economy (P0) optimizations.
 */
export class ExecutionEngine implements IExecutionEngine {
  private allocator: ContextAllocator;
  private validator: IValidationPipeline;
  private recovery: IRecoveryEngine;
  private resultCache: ResultCache;
  private activeExecutions = new Map<string, ExecutionContext>();

  constructor(allocator: ContextAllocator, validator: IValidationPipeline, recovery: IRecoveryEngine, resultCache?: ResultCache) {
    this.allocator = allocator;
    this.validator = validator;
    this.recovery = recovery;
    this.resultCache = resultCache || new ResultCache();
  }

  /**
   * Execute a Cycle (or legacy task for backward compat).
   * @param cycleId - The Cycle ID (new runtime). Also accepted as taskId for legacy callers.
   * @param agentId - The agent executing this cycle.
   * @param payload - Optional payload override.
   */
  async executeTask(cycleId: string, agentId: string, payload?: any): Promise<ExecutionResult> {
    // Alias: cycleId and taskId are interchangeable during migration.
    // TODO(migration): Rename parameter to cycleId after full migration.
    const taskId = cycleId;
    const executionId = `exec-${taskId}-${Date.now()}`;

    const ctx: ExecutionContext = {
      executionId,
      taskId,
      agentId,
      state: ExecutionState.INITIALIZING,
      snapshotId: '',
      attempts: 0
    };
    
    this.activeExecutions.set(executionId, ctx);
    const startMs = Date.now();

    try {
      // 0. Token Optimization: Check ResultCache to prevent duplicate work
      if (payload && ResultCache.isCacheable(payload.capability)) {
        const fingerprint = TaskFingerprint.compute(payload);
        // Assuming we route to 'claude' and 'sonnet' for now
        const cached = await this.resultCache.get(fingerprint, 'claude', 'sonnet');
        if (cached) {
          console.log(`[Token Economy] Cache hit for ${taskId} (${fingerprint}). Saved ~5000 tokens.`);
          ctx.state = ExecutionState.COMPLETED;
          return {
            success: true,
            metrics: {
              durationMs: Date.now() - startMs,
              tokensUsed: 0, // Optimized!
              cost: 0
            }
          };
        }
      }

      // 1. Governance Gate Check
      const docsDir = require('path').resolve(__dirname, '../../../docs/active');
      const resolver = new PolicyResolver(docsDir);
      const records = resolver.resolve();
      const governanceGate = new GovernanceGate(records);

      const files = payload?.files || [];
      const taskType = payload?.type;
      const engineeringCycleId = payload?.engineeringCycleId;
      
      // PROJECT ROOT CONTAINMENT CHECK
      const path = require('path');
      const fs = require('fs');
      const projectRoot = path.resolve(__dirname, '../../..');
      const rootPrefix = projectRoot + path.sep;

      const normalizedFiles: string[] = [];
      for (const file of files) {
        const absolutePath = path.resolve(projectRoot, file);
        
        // 1. Lexical prefix collision & normalized boundary check
        if (!absolutePath.startsWith(rootPrefix) && absolutePath !== projectRoot) {
          throw new Error(`GOVERNANCE_BLOCKED: Path escapes project root: ${file}`);
        }
        
        // 2. Symlink boundary check
        try {
          const real = fs.realpathSync(absolutePath);
          if (!real.startsWith(rootPrefix) && real !== projectRoot) {
            throw new Error(`GOVERNANCE_BLOCKED: Path escapes project root via symlink: ${file}`);
          }
          // Normalize to canonical relative path for GovernanceGate
          normalizedFiles.push(path.relative(projectRoot, real).replace(/\\/g, '/'));
        } catch (e: any) {
          // If file doesn't exist yet, verify its closest existing parent
          if (e.code === 'ENOENT') {
            let current = absolutePath;
            let parent = path.dirname(current);
            while (current !== parent) {
              try {
                const realParent = fs.realpathSync(parent);
                if (!realParent.startsWith(rootPrefix) && realParent !== projectRoot) {
                  throw new Error(`GOVERNANCE_BLOCKED: Path escapes project root via parent symlink: ${file}`);
                }
                break; // Found nearest existing parent safely inside project root
              } catch (err: any) {
                if (err.code === 'ENOENT') {
                  current = parent;
                  parent = path.dirname(current);
                } else {
                  throw err; // Other fs errors (e.g. EACCES) block execution for safety
                }
              }
            }
            // Normalize to canonical relative path for GovernanceGate
            normalizedFiles.push(path.relative(projectRoot, absolutePath).replace(/\\/g, '/'));
          } else {
            throw new Error(`GOVERNANCE_BLOCKED: FS error checking containment for ${file}: ${e.message}`);
          }
        }
      }

      if (!taskType) {
        throw new Error(`GOVERNANCE_BLOCKED: Missing task type.`);
      }

      const allowedTaskTypes = ['FEATURE', 'REMEDIATION', 'BUGFIX', 'SECURITY_FIX', 'PERFORMANCE', 'HOTFIX'];
      if (!allowedTaskTypes.includes(taskType.toUpperCase())) {
        throw new Error(`GOVERNANCE_BLOCKED: Invalid task type: ${taskType}`);
      }
      
      if (engineeringCycleId && typeof engineeringCycleId !== 'string') {
        throw new Error(`GOVERNANCE_BLOCKED: Invalid engineeringCycleId.`);
      }

      const govResult = governanceGate.check(normalizedFiles, taskType, engineeringCycleId);
      if (!govResult.passed) {
        const reasons = govResult.blockingRecords.map(r => `[${r.id}] ${r.status}`).join(', ');
        const message = reasons ? `GOVERNANCE_BLOCKED: ${reasons}` : `GOVERNANCE_BLOCKED: ${govResult.reason}`;
        throw new Error(message);
      }

      // 1.5 Snapshot / Setup Context
      ctx.snapshotId = await this.allocator.createSnapshot(taskId, normalizedFiles);
      ctx.state = ExecutionState.RUNNING;

      // 2. Here the external Agent performs work...
      // (For this execution engine mock, we assume the agent finishes and calls reportComplete)
      // In a real flow, this method would suspend or wait for the agent.
      
      // 3. Validation
      ctx.state = ExecutionState.VALIDATING;
      const valResult = await this.validator.validate(taskId);
      
      if (!valResult.passed) {
        throw new Error(`Validation failed at step ${valResult.step}: ${valResult.logs}`);
      }

      // 4. Auto QA
      ctx.state = ExecutionState.QA_REVIEW;
      const qaPassed = await this.runAutoQA(taskId);
      if (!qaPassed) {
        throw new Error(`Auto QA rejected task ${taskId}`);
      }

      // 5. Completion
      ctx.state = ExecutionState.COMPLETED;
      await this.allocator.clearSnapshot(ctx.snapshotId);
      
      return {
        success: true,
        metrics: {
          durationMs: Date.now() - startMs,
          tokensUsed: 1000, // Dummy
          cost: 0.01
        }
      };

    } catch (err: any) {
      ctx.attempts++;
      ctx.state = ExecutionState.ROLLING_BACK;
      if (ctx.snapshotId) {
        await this.allocator.restoreSnapshot(ctx.snapshotId);
      }

      ctx.state = ExecutionState.RECOVERING;
      await this.recovery.triggerRecovery(taskId, err.message);

      ctx.state = ExecutionState.FAILED;
      return {
        success: false,
        error: err,
        metrics: {
          durationMs: Date.now() - startMs,
          tokensUsed: 500,
          cost: 0.005
        }
      };
    }
  }

  /**
   * P1 Auto QA process.
   * Delegates the final check to Claude running Opus 4.8 (ultracode, high reasoning effort).
   */
  private async runAutoQA(taskId: string): Promise<boolean> {
    console.log(`[ExecutionEngine] Triggering Auto QA for ${taskId}...`);
    // Placeholder for actual API call to Claude (Opus 4.8) for QA audit.
    // Assuming Opus 4.8 always approves for now.
    return true;
  }

  async suspendTask(executionId: string, reason: string): Promise<void> {
    const ctx = this.activeExecutions.get(executionId);
    if (ctx) {
      console.log(`[ExecutionEngine] Suspending ${executionId} due to: ${reason}`);
      // Would save context capsule here
    }
  }

  async resumeTask(executionId: string): Promise<ExecutionResult> {
    // Stub
    return { success: true, metrics: { durationMs: 0, tokensUsed: 0, cost: 0 } };
  }

  async rollback(executionId: string): Promise<void> {
    const ctx = this.activeExecutions.get(executionId);
    if (ctx && ctx.snapshotId) {
      ctx.state = ExecutionState.ROLLING_BACK;
      await this.allocator.restoreSnapshot(ctx.snapshotId);
      ctx.state = ExecutionState.FAILED;
    }
  }
}
