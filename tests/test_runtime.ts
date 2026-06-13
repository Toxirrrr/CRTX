/**
 * test_runtime.ts — Runtime Abstraction Layer tests
 *
 * Covers:
 *   1. CapabilityResolver — returns sorted list by weight
 *   2. RuntimeRegistry    — merges static + health
 *   3. RuntimeSelector    — picks highest-weight online runtime
 *   4. GenericAdapter     — auto-created for unregistered runtimes
 *   5. NullAdapter        — PARKED when nothing is online
 *   6. Dedicated Adapter  — ClaudeCodeAdapter / AntigravityAdapter preferred over Generic
 */

import { CapabilityResolver }  from '../src/runtime/CapabilityResolver';
import { RuntimeRegistry }     from '../src/runtime/RuntimeRegistry';
import { RuntimeSelector }     from '../src/runtime/RuntimeSelector';
import { NullAdapter }         from '../src/runtime/adapters/NullAdapter';
import { ClaudeCodeAdapter }   from '../src/runtime/adapters/ClaudeCodeAdapter';
import { AntigravityAdapter }  from '../src/runtime/adapters/AntigravityAdapter';
import { GenericAdapter }      from '../src/runtime/adapters/GenericAdapter';

let passed = 0;
let failed = 0;

function assert(desc: string, condition: boolean) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failed++;
  }
}

console.log('\n--- Runtime Abstraction Layer Tests ---\n');

async function main() {
  // ── Test 1: CapabilityResolver ────────────────────────────────────────────────
  console.log('Test 1: CapabilityResolver — weight-based ranking');
  {
    const resolver = new CapabilityResolver();
    const ranked = await resolver.resolve('coding');
    assert('coding returns a non-empty list', ranked.length > 0);
    assert('first runtime has highest weight (claude-code)', ranked[0] === 'claude-code');
    const knownCaps = await resolver.capabilities();
    assert('capabilities() returns known list', knownCaps.includes('coding') && knownCaps.includes('security-review'));
  }

  // ── Test 2: RuntimeRegistry ───────────────────────────────────────────────────
  console.log('\nTest 2: RuntimeRegistry — merges static + health');
  {
    const registry = new RuntimeRegistry();
    const all = await registry.all();
    assert('registry returns at least one runtime', all.length > 0);
    const claudeCode = await registry.get('claude-code');
    assert('claude-code entry exists', claudeCode !== null);
    assert('claude-code has provider field', claudeCode?.provider === 'anthropic');
    assert('isOnline() returns boolean', typeof (await registry.isOnline('claude-code')) === 'boolean');
  }

  // ── Test 3: NullAdapter ───────────────────────────────────────────────────────
  console.log('\nTest 3: NullAdapter — always returns PARKED');
  {
    const adapter = new NullAdapter();
    assert('NullAdapter health is offline', !(await adapter.health()).online);
    const result = await adapter.execute({ id: 'test-null' });
    assert('NullAdapter execute returns success=false', !result.success);
    assert('NullAdapter output contains PARKED message', !!result.error?.includes('PARKED'));
  }

  // ── Test 4: GenericAdapter ────────────────────────────────────────────────────
  console.log('\nTest 4: GenericAdapter — reads from runtime_registry.json');
  {
    const adapter = new GenericAdapter('antigravity');
    assert('GenericAdapter reads provider from registry', adapter.provider === 'google+anthropic');
    assert('GenericAdapter reads capabilities from registry', adapter.capabilities.includes('coding'));
  }

  // ── Test 5: RuntimeSelector — picks highest-weight online runtime ─────────────
  console.log('\nTest 5: RuntimeSelector — capability routing');
  {
    const selector = new RuntimeSelector();
    selector.register(new ClaudeCodeAdapter());
    selector.register(new AntigravityAdapter());
    selector.register(new NullAdapter());

    const reg = new RuntimeRegistry();
    const allRegs = await reg.all();
    const anyOnline = allRegs.some(r => r.health.online);

    if (anyOnline) {
      const selection = await selector.resolve('coding', { id: 'test-selector-probe' });
      assert('selector resolves to a named runtime (not null)', selection.runtimeName !== 'null');
      assert('selector result has provider', !!selection.provider);
    } else {
      const selection = await selector.resolve('coding', { id: 'test-selector-offline' });
      assert('all offline → NullAdapter (PARKED)', selection.runtimeName === 'null');
    }
  }

  // ── Test 6: RuntimeSelector — GenericAdapter auto-created ────────────────────
  console.log('\nTest 6: RuntimeSelector — auto GenericAdapter for unregistered runtime');
  {
    const selector = new RuntimeSelector();
    selector.register(new NullAdapter());
    const registered = selector.registeredAdapters();
    assert('only null is registered explicitly', registered.includes('null') && !registered.includes('antigravity'));

    let threw = false;
    try {
      await selector.resolve('analysis', { id: 'test-generic-auto' });
    } catch {
      threw = true;
    }
    assert('selector does not throw for unregistered runtime', !threw);
  }

  // ── Test 7: Unknown capability → PARKED ──────────────────────────────────────
  console.log('\nTest 7: Unknown capability → PARKED via NullAdapter');
  {
    const selector = new RuntimeSelector();
    selector.register(new NullAdapter());
    const selection = await selector.resolve('does-not-exist', { id: 'test-unknown-cap' });
    assert('unknown capability falls back to null runtime', selection.runtimeName === 'null');
    assert('result is not successful', !selection.result.success);
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n--- Runtime Tests: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

void main();

