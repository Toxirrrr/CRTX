import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryEventBus } from '../src/InMemoryEventBus';
import { EventEnvelope } from '../../sdk/src/events';

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  const createEvent = (type: string, payload: any = {}): EventEnvelope => ({
    id: 'evt-1',
    type,
    payload,
    occurredAt: new Date(),
    sourcePlugin: 'test',
    version: 1
  });

  it('should deliver events to subscribers', async () => {
    const handler1 = vi.fn().mockResolvedValue(undefined);
    const handler2 = vi.fn().mockResolvedValue(undefined);

    bus.subscribe('NodeCreated', handler1);
    bus.subscribe('NodeCreated', handler2);

    const result = await bus.publish(createEvent('NodeCreated', { foo: 'bar' }));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(result.delivered).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should not stop dispatching if one handler throws', async () => {
    const failingHandler = vi.fn().mockRejectedValue(new Error('Crash'));
    const successHandler = vi.fn().mockResolvedValue(undefined);

    bus.subscribe('NodeUpdated', failingHandler);
    bus.subscribe('NodeUpdated', successHandler);

    const result = await bus.publish(createEvent('NodeUpdated'));

    expect(failingHandler).toHaveBeenCalledTimes(1);
    expect(successHandler).toHaveBeenCalledTimes(1); // Continues to execute
    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Crash');
  });

  it('should correctly unsubscribe via SubscriptionToken', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    
    const token = bus.subscribe('EdgeAdded', handler);
    bus.unsubscribe(token);

    const result = await bus.publish(createEvent('EdgeAdded'));

    expect(handler).not.toHaveBeenCalled();
    expect(result.delivered).toBe(0);
  });

  it('should return empty AggregateResult if no subscribers exist', async () => {
    const result = await bus.publish(createEvent('UnknownEvent'));
    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
