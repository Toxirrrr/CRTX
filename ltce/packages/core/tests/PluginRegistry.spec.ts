import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginRegistry } from '../src/PluginRegistry';
import { PluginCatalog } from '../src/PluginCatalog';
import { PluginLoader } from '../src/PluginLoader';

describe('PluginRegistry', () => {
  let catalog: PluginCatalog;
  let loader: PluginLoader;
  let registry: PluginRegistry;

  beforeEach(() => {
    catalog = new PluginCatalog();
    loader = new PluginLoader();
    registry = new PluginRegistry(catalog, loader);
  });

  it('should load and register a plugin', async () => {
    // Mock the loader's load method since it relies on dynamic imports
    vi.spyOn(loader, 'load').mockResolvedValue({
      manifest: { id: 'test-plugin', capabilities: [] } as any,
      implementation: {}
    });

    const pluginId = await registry.loadAndRegister('some-path');
    
    expect(pluginId).toBe('test-plugin');
    const desc = catalog.findById('test-plugin');
    expect(desc).toBeDefined();
    expect(desc?.state).toBe('REGISTERED');
    expect(desc?.instanceId).toBeDefined();
  });

  it('should throw if manifest validation fails during load', async () => {
    vi.spyOn(loader, 'load').mockResolvedValue({
      manifest: { invalid: true } as any,
      implementation: {}
    });

    await expect(registry.loadAndRegister('some-path')).rejects.toThrow('Invalid Plugin Manifest format');
  });
});
