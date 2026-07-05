import { describe, it, expect } from 'vitest';
import { PluginLoader } from '../src/PluginLoader';

describe('PluginLoader', () => {
  const loader = new PluginLoader();

  it('should validate a valid manifest', () => {
    const validManifest = {
      id: 'test',
      capabilities: ['ParseAST']
    };
    expect(() => loader.validate(validManifest)).not.toThrow();
  });

  it('should throw on invalid manifest', () => {
    const invalidManifest = {
      id: 123, // Should be string
      capabilities: 'ParseAST' // Should be array
    };
    expect(() => loader.validate(invalidManifest)).toThrow('Invalid Plugin Manifest');
  });

  it('should instantiate an adapter', () => {
    const manifest = { id: 'test', capabilities: [] } as any;
    const instance = loader.instantiate(manifest, {});
    expect(instance.manifest()).toEqual(manifest);
  });
});
