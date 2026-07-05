import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandDispatcher } from '../src/CommandDispatcher';
import { CapabilityLookup } from '../../sdk/src/context';
import { SelectionPolicy, Command, CommandResult } from '../../sdk/src/command';
import { PluginCatalog } from '../src/PluginCatalog';
import { PluginDescriptor } from '../../sdk/src/contracts';
import { PluginAdapter } from '../../sdk/src/PluginAdapter';

describe('CommandDispatcher', () => {
  let dispatcher: CommandDispatcher;
  let mockLookup: CapabilityLookup;
  let mockPolicy: SelectionPolicy;
  let catalog: PluginCatalog;

  beforeEach(() => {
    mockLookup = {
      find: vi.fn(),
      supports: vi.fn()
    };
    mockPolicy = {
      select: vi.fn()
    };
    catalog = new PluginCatalog();
    dispatcher = new CommandDispatcher(mockLookup, mockPolicy, catalog);
  });

  const createCommand = (capability: any): Command => ({
    id: 'cmd-1',
    capability,
    payload: {},
    createdAt: new Date()
  });

  const registerMockPlugin = (id: string, executeImpl: any) => {
    const desc: PluginDescriptor = {
      instanceId: 'inst-1',
      state: 'RUNNING',
      health: { status: 'Healthy', latency: 0 },
      manifest: { id, version: '1', ltceVersion: '1', author: '', type: '', capabilities: [], permissions: [] },
      instance: new PluginAdapter({ id } as any, { execute: executeImpl })
    };
    catalog.register(desc);
  };

  it('should route and execute successfully', async () => {
    vi.mocked(mockLookup.find).mockReturnValue([{ pluginId: 'p1', capability: 'ParseAST', version: '1' }]);
    vi.mocked(mockPolicy.select).mockReturnValue({ pluginId: 'p1', capability: 'ParseAST', version: '1' });
    
    registerMockPlugin('p1', vi.fn().mockResolvedValue('success-result'));

    const result = await dispatcher.execute(createCommand('ParseAST'));

    expect(result.success).toBe(true);
    expect(result.pluginId).toBe('p1');
    expect(result.value).toBe('success-result');
  });

  it('should return error if no capability matches exist', async () => {
    vi.mocked(mockLookup.find).mockReturnValue([]);
    vi.mocked(mockPolicy.select).mockReturnValue(null);

    const result = await dispatcher.execute(createCommand('ParseAST'));

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('No available plugin found');
  });

  it('should trap exceptions and return as CommandResult', async () => {
    vi.mocked(mockLookup.find).mockReturnValue([{ pluginId: 'p2', capability: 'ParseAST', version: '1' }]);
    vi.mocked(mockPolicy.select).mockReturnValue({ pluginId: 'p2', capability: 'ParseAST', version: '1' });
    
    registerMockPlugin('p2', vi.fn().mockRejectedValue(new Error('Plugin Crash')));

    const result = await dispatcher.execute(createCommand('ParseAST'));

    expect(result.success).toBe(false);
    expect(result.pluginId).toBe('unknown'); // As it's caught in the generic catch block
    expect(result.error?.message).toBe('Plugin Crash');
  });

  it('should return error immediately if token is cancelled', async () => {
    const cmd = createCommand('ParseAST');
    cmd.cancellationToken = { isCancelled: true, throwIfCancelled: vi.fn() };

    const result = await dispatcher.execute(cmd);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('cancelled');
    expect(mockLookup.find).not.toHaveBeenCalled();
  });
});
