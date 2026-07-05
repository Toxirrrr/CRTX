import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryBehavior } from '../src/telemetry/TelemetryBehavior';
import { ExecutionContext, TelemetrySink } from '../../sdk/src/pipeline';
import { Clock } from '../../sdk/src/context';

describe('TelemetryBehavior', () => {
  let mockSink: TelemetrySink;
  let mockClock: Clock;
  let context: ExecutionContext;

  beforeEach(() => {
    mockSink = { record: vi.fn() };
    
    let time = 1000;
    mockClock = { now: vi.fn().mockImplementation(() => {
      time += 500; // Each call advances time by 500ms
      return new Date(time); 
    })};

    context = {
      command: { id: '1', capability: 'Test', payload: {}, createdAt: new Date() },
      startedAt: new Date(),
      metadata: new Map()
    };
  });

  it('should record execution duration for successful commands', async () => {
    const behavior = new TelemetryBehavior(mockSink, mockClock);
    const next = vi.fn().mockResolvedValue({ success: true, pluginId: 'p1' });

    await behavior.execute(context, next);

    expect(mockSink.record).toHaveBeenCalledTimes(1);
    expect(mockSink.record).toHaveBeenCalledWith(expect.objectContaining({
      name: 'command.duration',
      value: 500, // Two clock calls inside behavior (start and end) -> difference is 500ms
      tags: {
        capability: 'Test',
        success: 'true',
        pluginId: 'p1'
      }
    }));
  });

  it('should record execution duration and propagate error for failed commands', async () => {
    const behavior = new TelemetryBehavior(mockSink, mockClock);
    const next = vi.fn().mockRejectedValue(new Error('Crash'));

    await expect(behavior.execute(context, next)).rejects.toThrow('Crash');

    expect(mockSink.record).toHaveBeenCalledTimes(1);
    expect(mockSink.record).toHaveBeenCalledWith(expect.objectContaining({
      name: 'command.duration',
      tags: {
        capability: 'Test',
        success: 'false',
        pluginId: 'unknown',
        error: 'true'
      }
    }));
  });
});
