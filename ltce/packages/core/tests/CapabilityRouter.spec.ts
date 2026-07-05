import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityRouter } from '../src/CapabilityRouter';
import { PluginDescriptor } from '../../sdk/src/contracts';
import { Capability } from '../../types/src';

describe('CapabilityRouter', () => {
  let router: CapabilityRouter;

  beforeEach(() => {
    router = new CapabilityRouter();
  });

  const createDescriptor = (id: string, capabilities: Capability[], version = '1.0.0'): PluginDescriptor => ({
    instanceId: 'inst-' + id,
    state: 'REGISTERED',
    health: { status: 'Unavailable', latency: 0 },
    instance: null,
    manifest: {
      id,
      version,
      ltceVersion: '^1.0.0',
      author: 'Test',
      type: 'Test',
      capabilities,
      permissions: []
    }
  });

  describe('register()', () => {
    it('should register a single plugin', () => {
      router.register(createDescriptor('p1', ['ParseAST']));
      const matches = router.find('ParseAST');
      expect(matches).toHaveLength(1);
      expect(matches[0].pluginId).toBe('p1');
    });

    it('should register multiple plugins with the same capability', () => {
      router.register(createDescriptor('p1', ['ParseAST']));
      router.register(createDescriptor('p2', ['ParseAST']));
      const matches = router.find('ParseAST');
      expect(matches).toHaveLength(2);
      expect(matches.map(m => m.pluginId)).toEqual(expect.arrayContaining(['p1', 'p2']));
    });

    it('should register multiple capabilities for a single plugin', () => {
      router.register(createDescriptor('p1', ['ParseAST', 'ResolveSemantic']));
      expect(router.find('ParseAST')).toHaveLength(1);
      expect(router.find('ResolveSemantic')).toHaveLength(1);
    });

    it('should ignore duplicate registration of the same plugin ID', () => {
      router.register(createDescriptor('p1', ['ParseAST']));
      router.register(createDescriptor('p1', ['ParseAST']));
      expect(router.find('ParseAST')).toHaveLength(1);
    });
  });

  describe('unregister()', () => {
    it('should remove a plugin from the index', () => {
      router.register(createDescriptor('p1', ['ParseAST']));
      router.unregister('p1');
      expect(router.find('ParseAST')).toHaveLength(0);
    });

    it('should handle repeated unregister gracefully', () => {
      router.register(createDescriptor('p1', ['ParseAST']));
      router.unregister('p1');
      expect(() => router.unregister('p1')).not.toThrow();
    });

    it('should clear index for multiple capabilities', () => {
      router.register(createDescriptor('p1', ['ParseAST', 'RetrieveDense']));
      router.unregister('p1');
      expect(router.find('ParseAST')).toHaveLength(0);
      expect(router.find('RetrieveDense')).toHaveLength(0);
    });
  });

  describe('find()', () => {
    it('should return capability match for existing capability', () => {
      router.register(createDescriptor('p1', ['ParseAST'], '2.0.0'));
      const matches = router.find('ParseAST');
      expect(matches).toEqual([{
        pluginId: 'p1',
        capability: 'ParseAST',
        version: '2.0.0'
      }]);
    });

    it('should return empty array for missing capability', () => {
      expect(router.find('Planning')).toEqual([]);
    });
  });

  describe('supports()', () => {
    beforeEach(() => {
      router.register(createDescriptor('p1', ['Snapshot', 'RetrieveSparse']));
    });

    it('should return true if plugin supports capability', () => {
      expect(router.supports('p1', 'Snapshot')).toBe(true);
    });

    it('should return false if plugin does not support capability', () => {
      expect(router.supports('p1', 'ParseAST')).toBe(false);
    });

    it('should return false for unknown plugin', () => {
      expect(router.supports('unknown', 'Snapshot')).toBe(false);
    });
  });
});
