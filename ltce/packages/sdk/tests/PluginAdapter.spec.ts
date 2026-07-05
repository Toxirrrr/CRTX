import { describe, it, expect, vi } from 'vitest';
import { PluginAdapter } from '../src/PluginAdapter';
import { PluginManifest, PluginContext } from '../src/contracts';

describe('PluginAdapter', () => {
  const mockManifest: PluginManifest = {
    id: 'test-plugin',
    version: '1.0.0',
    ltceVersion: '^1.0.0',
    author: 'Test',
    type: 'Parser',
    capabilities: ['ParseAST'],
    permissions: []
  };

  it('should return the provided manifest', () => {
    const adapter = new PluginAdapter(mockManifest, {});
    expect(adapter.manifest()).toEqual(mockManifest);
  });

  it('should call onLoad if provided', async () => {
    const onLoadSpy = vi.fn().mockResolvedValue(undefined);
    const adapter = new PluginAdapter(mockManifest, { onLoad: onLoadSpy });
    await adapter.onLoad({} as PluginContext);
    expect(onLoadSpy).toHaveBeenCalledTimes(1);
  });

  it('should not throw on onLoad if omitted', async () => {
    const adapter = new PluginAdapter(mockManifest, {});
    await expect(adapter.onLoad({} as PluginContext)).resolves.not.toThrow();
  });

  it('should call onUnload if provided', async () => {
    const onUnloadSpy = vi.fn().mockResolvedValue(undefined);
    const adapter = new PluginAdapter(mockManifest, { onUnload: onUnloadSpy });
    await adapter.onUnload();
    expect(onUnloadSpy).toHaveBeenCalledTimes(1);
  });

  it('should return Healthy by default if health is omitted', async () => {
    const adapter = new PluginAdapter(mockManifest, {});
    const report = await adapter.health();
    expect(report.status).toBe('Healthy');
  });

  it('should throw exceptions transparently from implementation', async () => {
    const adapter = new PluginAdapter(mockManifest, {
      onLoad: async () => { throw new Error('Init Crash'); }
    });
    await expect(adapter.onLoad({} as PluginContext)).rejects.toThrow('Init Crash');
  });
});
