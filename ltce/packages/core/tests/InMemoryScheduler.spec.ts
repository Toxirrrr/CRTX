import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryScheduler } from '../src/InMemoryScheduler';
import { CommandExecutor } from '../../sdk/src/command';
import { Clock } from '../../sdk/src/context';

describe('InMemoryScheduler', () => {
  let mockExecutor: CommandExecutor;
  let mockClock: Clock;
  let scheduler: InMemoryScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    mockExecutor = { execute: vi.fn().mockResolvedValue({ success: true, pluginId: '1' }) };
    mockClock = { now: vi.fn().mockReturnValue(new Date('2026-01-01T00:00:00Z')) };
    scheduler = new InMemoryScheduler(mockExecutor, mockClock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createCommand = (id: string) => ({ id, capability: 'Test', payload: {}, createdAt: new Date() });

  describe('schedule()', () => {
    it('should schedule execution after a delay', async () => {
      const executeAt = new Date('2026-01-01T00:00:05Z'); // 5 seconds later
      const task = scheduler.schedule(createCommand('cmd1'), { id: 's1', executeAt });
      
      expect(task.state).toBe('SCHEDULED');
      expect(mockExecutor.execute).not.toHaveBeenCalled();

      // Fast-forward 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
      expect(task.state).toBe('COMPLETED');
    });

    it('should execute multiple independent tasks', async () => {
      scheduler.schedule(createCommand('cmd1'), { id: 's1', executeAt: new Date('2026-01-01T00:00:01Z') });
      scheduler.schedule(createCommand('cmd2'), { id: 's2', executeAt: new Date('2026-01-01T00:00:02Z') });

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockExecutor.execute).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockExecutor.execute).toHaveBeenCalledTimes(2);
    });

    it('should catch executor errors and mark as FAILED', async () => {
      mockExecutor.execute = vi.fn().mockRejectedValue(new Error('Crash'));
      const task = scheduler.schedule(createCommand('cmd1'), { id: 's1' });

      await vi.runAllTimersAsync();

      expect(task.state).toBe('FAILED');
    });
  });

  describe('cancel()', () => {
    it('should cancel before execution', () => {
      const task = scheduler.schedule(createCommand('cmd1'), { id: 's1', executeAt: new Date('2026-01-01T00:00:05Z') });
      
      scheduler.cancel(task.id);
      expect(task.state).toBe('CANCELLED');

      vi.advanceTimersByTime(5000);
      expect(mockExecutor.execute).not.toHaveBeenCalled();
    });

    it('should allow cancellation via task reference', () => {
      const task = scheduler.schedule(createCommand('cmd1'), { id: 's1', executeAt: new Date('2026-01-01T00:00:05Z') });
      task.cancel();
      expect(task.state).toBe('CANCELLED');
    });

    it('should ignore cancellation of unknown tasks', () => {
      expect(() => scheduler.cancel('unknown')).not.toThrow();
    });
  });

  describe('shutdown()', () => {
    it('should cancel all pending tasks', () => {
      const t1 = scheduler.schedule(createCommand('cmd1'), { id: 's1', executeAt: new Date('2026-01-01T00:00:05Z') });
      const t2 = scheduler.schedule(createCommand('cmd2'), { id: 's2', executeAt: new Date('2026-01-01T00:00:10Z') });

      scheduler.shutdown();

      expect(t1.state).toBe('CANCELLED');
      expect(t2.state).toBe('CANCELLED');

      vi.runAllTimers();
      expect(mockExecutor.execute).not.toHaveBeenCalled();
    });

    it('should prevent new scheduling after shutdown', () => {
      scheduler.shutdown();
      expect(() => scheduler.schedule(createCommand('cmd1'), { id: 's1' })).toThrow('Scheduler is shutdown');
    });
  });
});
