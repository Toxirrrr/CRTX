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

  async executeTask(taskId: string, agentId: string, payload?: any): Promise<ExecutionResult> {
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

      // 1. Snapshot / Setup Context (Stub files list for P1)
      ctx.snapshotId = await this.allocator.createSnapshot(taskId, []);
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
