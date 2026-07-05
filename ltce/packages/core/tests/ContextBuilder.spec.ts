import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextBuilder } from '../src/ContextBuilder';
import { CapabilityRouter } from '../src/CapabilityRouter';
import { Clock, Logger, Telemetry, CancellationToken } from '../../sdk/src/context';
import { EventPublisher } from '../../sdk/src/events';

describe('ContextBuilder', () => {
  let mockClock: Clock;
  let mockLogger: Logger;
  let mockEventPublisher: EventPublisher;
  let mockTelemetry: Telemetry;
  let router: CapabilityRouter;
  let mockCancellationToken: CancellationToken;
  
  beforeEach(() => {
    mockClock = { now: vi.fn().mockReturnValue(new Date('2026-01-01T00:00:00Z')) };
    mockLogger = {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()
    };
    mockEventPublisher = { publish: vi.fn() };
    mockTelemetry = { increment: vi.fn(), record: vi.fn(), measure: vi.fn() };
    router = new CapabilityRouter();
    mockCancellationToken = { isCancelled: false, throwIfCancelled: vi.fn() };
  });

  it('should create an immutable plugin context', () => {
    const builder = new ContextBuilder(mockClock, mockLogger, mockEventPublisher, mockTelemetry, router);
    const ctx = builder.build('plugin-1', mockCancellationToken);

    expect(ctx).toBeDefined();
    expect(ctx.pluginId).toBe('plugin-1');
    expect(Object.isFrozen(ctx)).toBe(true);

    // Attempting to modify should throw or fail silently in strict mode
    expect(() => {
      (ctx as any).pluginId = 'hacked';
    }).toThrow();
  });

  it('should scope logger to the plugin ID', () => {
    const builder = new ContextBuilder(mockClock, mockLogger, mockEventPublisher, mockTelemetry, router);
    const ctx = builder.build('test-plugin', mockCancellationToken);

    ctx.logger.info('System online');
    expect(mockLogger.info).toHaveBeenCalledWith('[test-plugin] System online');
  });

  it('should use mocked Clock values correctly', () => {
    const builder = new ContextBuilder(mockClock, mockLogger, mockEventPublisher, mockTelemetry, router);
    const ctx = builder.build('p1', mockCancellationToken);

    expect(ctx.clock.now()).toEqual(new Date('2026-01-01T00:00:00Z'));
  });

  it('should adapt CapabilityLookup strictly without exposing Registry/Router', () => {
    const builder = new ContextBuilder(mockClock, mockLogger, mockEventPublisher, mockTelemetry, router);
    const ctx = builder.build('p1', mockCancellationToken);

    expect((ctx.capabilityLookup as any).register).toBeUndefined(); // Exposed methods should not exist
    expect(typeof ctx.capabilityLookup.find).toBe('function');
    expect(typeof ctx.capabilityLookup.supports).toBe('function');
  });
});
