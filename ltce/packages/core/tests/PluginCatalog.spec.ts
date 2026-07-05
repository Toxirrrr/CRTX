import { describe, it, expect, beforeEach } from 'vitest';
import { PluginCatalog } from '../src/PluginCatalog';
import { PluginDescriptor } from '../../sdk/src/contracts';

describe('PluginCatalog', () => {
  let catalog: PluginCatalog;

  beforeEach(() => {
    catalog = new PluginCatalog();
  });

  const createDescriptor = (id: string, capabilities: any[]): PluginDescriptor => ({
    instanceId: 'inst-' + id,
    state: 'REGISTERED',
    health: { status: 'Unavailable', latency: 0 },
    instance: null,
    manifest: {
      id,
      version: '1.0.0',
      ltceVersion: '^1.0.0',
      author: 'Test',
      type: 'Test',
      capabilities,
      permissions: []
    }
  });

  it('should register and find by ID', () => {
    const desc = createDescriptor('plugin-a', []);
    catalog.register(desc);
    expect(catalog.findById('plugin-a')).toEqual(desc);
  });

  it('should throw on duplicate ID', () => {
    const desc = createDescriptor('plugin-a', []);
    catalog.register(desc);
    expect(() => catalog.register(desc)).toThrow('already registered');
  });

  it('should unregister a plugin', () => {
    catalog.register(createDescriptor('plugin-a', []));
    catalog.unregister('plugin-a');
    expect(catalog.findById('plugin-a')).toBeUndefined();
  });

  it('should find plugins by capability', () => {
    catalog.register(createDescriptor('p1', ['ParseAST']));
    catalog.register(createDescriptor('p2', ['ParseAST', 'RetrieveDense']));
    catalog.register(createDescriptor('p3', ['Snapshot']));

    const parsers = catalog.findByCapability('ParseAST');
    expect(parsers).toHaveLength(2);
    expect(parsers.map(p => p.manifest.id)).toEqual(['p1', 'p2']);
  });

  it('should return empty array for empty catalog capability search', () => {
    expect(catalog.findByCapability('ParseAST')).toEqual([]);
  });
});
