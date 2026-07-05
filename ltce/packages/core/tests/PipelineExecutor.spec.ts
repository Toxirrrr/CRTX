import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineExecutor } from '../src/pipeline/PipelineExecutor';
import { PipelineBehavior, ExecutionContext } from '../../sdk/src/pipeline';
import { CommandExecutor, Command } from '../../sdk/src/command';
import { Clock } from '../../sdk/src/context';

describe('PipelineExecutor', () => {
  let mockExecutor: CommandExecutor;
  let mockClock: Clock;
  let command: Command<any>;

  beforeEach(() => {
    mockExecutor = { execute: vi.fn().mockResolvedValue({ success: true, pluginId: '1' }) };
    mockClock = { now: vi.fn().mockReturnValue(new Date('2026-01-01T00:00:00Z')) };
    command = { id: '1', capability: 'Test', payload: {}, createdAt: new Date() };
  });

  it('should execute final executor when no behaviors are provided', async () => {
    const pipeline = new PipelineExecutor([], mockExecutor, mockClock);
    await pipeline.execute(command);
    expect(mockExecutor.execute).toHaveBeenCalledWith(command);
  });

  it('should execute behaviors in order and call next()', async () => {
    const log: number[] = [];

    const b1: PipelineBehavior = {
      execute: async (ctx, next) => { log.push(1); const r = await next(); log.push(2); return r; }
    };
    const b2: PipelineBehavior = {
      execute: async (ctx, next) => { log.push(3); const r = await next(); log.push(4); return r; }
    };

    const pipeline = new PipelineExecutor([b1, b2], mockExecutor, mockClock);
    await pipeline.execute(command);

    expect(log).toEqual([1, 3, 4, 2]); // Onion model execution order
    expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
  });

  it('should allow behavior to short-circuit execution', async () => {
    const shortCircuitBehavior: PipelineBehavior = {
      execute: async () => ({ success: false, pluginId: 'none', error: new Error('Blocked') })
    };

    const pipeline = new PipelineExecutor([shortCircuitBehavior], mockExecutor, mockClock);
    const result = await pipeline.execute(command);

    expect(result.success).toBe(false);
    expect(mockExecutor.execute).not.toHaveBeenCalled();
  });

  it('should pass ExecutionContext through the pipeline', async () => {
    let capturedContext: ExecutionContext | null = null;
    const captureBehavior: PipelineBehavior = {
      execute: async (ctx, next) => { capturedContext = ctx; return next(); }
    };

    const pipeline = new PipelineExecutor([captureBehavior], mockExecutor, mockClock);
    await pipeline.execute(command);

    expect(capturedContext).toBeDefined();
    expect(capturedContext?.command).toBe(command);
    expect(capturedContext?.startedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
  });
});
