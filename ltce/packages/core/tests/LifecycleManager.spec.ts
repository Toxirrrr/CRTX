import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LifecycleManager } from '../src/LifecycleManager';
import { PluginCatalog } from '../src/PluginCatalog';
import { PluginContext, PluginDescriptor, PluginManifest } from '../../sdk/src/contracts';
import { PluginAdapter } from '../../sdk/src/PluginAdapter';

describe('LifecycleManager', () => {
  let catalog: PluginCatalog;
  let lifecycle: LifecycleManager;
  let mockCtx: PluginContext;

  beforeEach(() => {
    catalog = new PluginCatalog();
    lifecycle = new LifecycleManager(catalog);
    mockCtx = {} as PluginContext;
  });

  const registerMockPlugin = (id: string, impl: any) => {
    const manifest: PluginManifest = { id, version: '1', ltceVersion: '1', author: '', type: '', capabilities: [], permissions: [] };
    const descriptor: PluginDescriptor = {
      instanceId: '123',
      manifest,
      state: 'REGISTERED',
      health: { status: 'Unavailable', latency: 0 },
      instance: new PluginAdapter(manifest, impl)
    };
    catalog.register(descriptor);
    return descriptor;
  };

  it('should transition from REGISTERED -> LOADING -> RUNNING', async () => {
    const onLoadSpy = vi.fn().mockResolvedValue(undefined);
    const desc = registerMockPlugin('p1', { onLoad: onLoadSpy, health: async () => ({ status: 'Healthy', latency: 5 }) });
    
    await lifecycle.startPlugin('p1', mockCtx);
    
    expect(onLoadSpy).toHaveBeenCalled();
    expect(desc.state).toBe('RUNNING');
    expect(desc.health.status).toBe('Healthy');
  });

  it('should transition to FAILED if onLoad throws', async () => {
    const desc = registerMockPlugin('p2', { onLoad: async () => { throw new Error('Crash'); } });
    
    await expect(lifecycle.startPlugin('p2', mockCtx)).rejects.toThrow('Crash');
    expect(desc.state).toBe('FAILED');
  });

  it('should transition to STOPPED on stopPlugin', async () => {
    const onUnloadSpy = vi.fn().mockResolvedValue(undefined);
    const desc = registerMockPlugin('p3', { onUnload: onUnloadSpy });
    desc.state = 'RUNNING';
    
    await lifecycle.stopPlugin('p3');
    expect(desc.state).toBe('STOPPED');
    expect(onUnloadSpy).toHaveBeenCalled();
  });

  it('should transition to DEGRADED if health check fails or returns degraded', async () => {
    const desc = registerMockPlugin('p4', { health: async () => ({ status: 'Degraded', latency: 10 }) });
    desc.state = 'RUNNING';
    
    await lifecycle.checkHealth('p4');
    expect(desc.state).toBe('DEGRADED');
    expect(desc.health.status).toBe('Degraded');
  });

  it('should transition to DEGRADED if health throws exception', async () => {
    const desc = registerMockPlugin('p5', { health: async () => { throw new Error('Network timeout'); } });
    desc.state = 'RUNNING';
    
    await lifecycle.checkHealth('p5');
    expect(desc.state).toBe('DEGRADED');
    expect(desc.health.status).toBe('Unavailable');
    expect(desc.health.message).toContain('Network timeout');
  });
});
