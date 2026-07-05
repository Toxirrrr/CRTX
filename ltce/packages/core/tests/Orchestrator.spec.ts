import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoreOrchestrator } from '../src/orchestration/CoreOrchestrator';
import { RegistryPlanner } from '../src/orchestration/RegistryPlanner';
import { InMemoryScheduler } from '../src/InMemoryScheduler';
import { PipelineExecutor } from '../src/pipeline/PipelineExecutor';
import { TelemetryBehavior } from '../src/telemetry/TelemetryBehavior';
import { CommandDispatcher } from '../src/CommandDispatcher';
import { PluginCatalog } from '../src/PluginCatalog';
import { PluginAdapter } from '../../sdk/src/PluginAdapter';
import { EventEnvelope } from '../../sdk/src/events';
import { Command } from '../../sdk/src/command';
import { Clock } from '../../sdk/src/context';
import { TelemetrySink } from '../../sdk/src/pipeline';
import { FirstMatchPolicy } from '../src/policies/FirstMatchPolicy';
import { PluginDescriptor } from '../../sdk/src/contracts';

describe('Orchestration Full Flow', () => {
  let mockClock: Clock;
  let mockSink: TelemetrySink;
  let catalog: PluginCatalog;
  let dispatcher: CommandDispatcher;
  let telemetry: TelemetryBehavior;
  let pipeline: PipelineExecutor;
  let scheduler: InMemoryScheduler;
  let plannerRegistry: RegistryPlanner;
  let orchestrator: CoreOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();

    mockClock = { now: vi.fn().mockReturnValue(new Date('2026-01-01T00:00:00Z')) };
    mockSink = { record: vi.fn() };
    
    // 1. Catalog & Dispatcher
    catalog = new PluginCatalog();
    const lookup = {
      find: (cap: string) => catalog.findByCapability(cap as any).map(d => ({ pluginId: d.manifest.id, capability: cap as any, version: '1' })),
      supports: () => true
    };
    dispatcher = new CommandDispatcher(lookup, new FirstMatchPolicy(), catalog);

    // 2. Pipeline
    telemetry = new TelemetryBehavior(mockSink, mockClock);
    pipeline = new PipelineExecutor([telemetry], dispatcher, mockClock);

    // 3. Scheduler
    scheduler = new InMemoryScheduler(pipeline, mockClock);

    // 4. Planner
    plannerRegistry = new RegistryPlanner();

    // 5. Orchestrator
    orchestrator = new CoreOrchestrator(plannerRegistry, scheduler);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should process a Domain Event through the full execution pipeline', async () => {
    // A. Register a Plugin that implements execution
    const mockExecute = vi.fn().mockResolvedValue('plugin-result');
    const desc: PluginDescriptor = {
      instanceId: 'inst-1', state: 'RUNNING', health: { status: 'Healthy', latency: 0 },
      manifest: { id: 'p1', version: '1', ltceVersion: '1', author: '', type: '', capabilities: ['FormatDisk' as any], permissions: [] },
      instance: new PluginAdapter({ id: 'p1' } as any, { execute: mockExecute })
    };
    catalog.register(desc);

    // B. Register a Planner for an event
    plannerRegistry.register('DiskAddedEvent', {
      plan: async (evt) => {
        return [{
          id: 'cmd-1',
          capability: 'FormatDisk' as any,
          payload: { diskId: evt.payload.diskId },
          createdAt: new Date()
        }];
      }
    });

    // C. Trigger the Event
    const event: EventEnvelope<any> = {
      id: 'evt-1',
      type: 'DiskAddedEvent',
      payload: { diskId: 'disk-x' },
      occurredAt: new Date(),
      sourcePlugin: 'sys',
      version: 1
    };

    await orchestrator.handle(event);

    // D. Advance time to trigger Scheduler execution
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // E. Verify the pipeline
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ id: 'cmd-1', capability: 'FormatDisk' }));
    
    // F. Verify telemetry recorded the duration and pluginId
    expect(mockSink.record).toHaveBeenCalledWith(expect.objectContaining({
      name: 'command.duration',
      tags: expect.objectContaining({
        capability: 'FormatDisk',
        success: 'true',
        pluginId: 'p1'
      })
    }));
  });

  it('should do nothing if no planner is registered for the event', async () => {
    const event: EventEnvelope<any> = {
      id: 'evt-2', type: 'UnknownEvent', payload: {}, occurredAt: new Date(), sourcePlugin: 'sys', version: 1
    };

    await orchestrator.handle(event);
    vi.runAllTimers();

    // No plugins executed
    expect(mockSink.record).not.toHaveBeenCalled();
  });
});
