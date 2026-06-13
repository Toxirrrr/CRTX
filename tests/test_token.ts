/**
 * test_token.ts — Token Economy module tests
 *
 * Covers:
 *   1. TaskFingerprint — normalize, compute, cross-task reuse, invalidate
 *   2. DiffContext     — slice extraction, 30% fallback to full file
 *   3. ResultCache     — get/set by fingerprint+runtime+model, TTL expiry, CACHEABLE_CAPABILITIES
 *   4. RuntimeRouteCache — set/get, TTL expiry, invalidateRuntime, sweepExpired
 *   5. MemoryStore.recallLazy — remainingBudget threshold
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';

import { TaskFingerprint }   from '../src/token/TaskFingerprint';
import { DiffContext }       from '../src/token/DiffContext';
import { ResultCache, CACHEABLE_CAPABILITIES } from '../src/token/ResultCache';
import { RuntimeRouteCache } from '../src/token/RuntimeRouteCache';
import { MemoryStore }       from '../src/rag/memoryStore';

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

async function main() {

  // ── Test 1: TaskFingerprint ────────────────────────────────────────────────
  console.log('\nTest 1: TaskFingerprint — normalization & cross-task reuse');
  {
    // Normalization: similar instructions produce same fingerprint
    const fp1 = TaskFingerprint.compute({ capability: 'security-review', instruction: 'review auth module' });
    const fp2 = TaskFingerprint.compute({ capability: 'security-review', instruction: 'review auth module please' });
    const fp3 = TaskFingerprint.compute({ capability: 'security-review', instruction: 'REVIEW AUTH MODULE NOW' });
    assert('similar instructions produce same fingerprint', fp1 === fp2 && fp2 === fp3);

    // Different capability → different fingerprint
    const fp4 = TaskFingerprint.compute({ capability: 'coding', instruction: 'review auth module' });
    assert('different capability → different fingerprint', fp1 !== fp4);

    // Files are sorted
    const fpA = TaskFingerprint.compute({ capability: 'review', instruction: 'check', files: ['b.ts', 'a.ts'] });
    const fpB = TaskFingerprint.compute({ capability: 'review', instruction: 'check', files: ['a.ts', 'b.ts'] });
    assert('files are sorted before hashing', fpA === fpB);

    // Fingerprint does NOT include taskId (cross-task reuse)
    // Two different "tasks" with same content should match
    const fpX = TaskFingerprint.compute({ capability: 'analysis', instruction: 'audit dependencies', model: 'sonnet', runtime: 'claude-code' });
    const fpY = TaskFingerprint.compute({ capability: 'analysis', instruction: 'audit dependencies', model: 'sonnet', runtime: 'claude-code' });
    assert('same content without taskId → same fingerprint (cross-task reuse)', fpX === fpY);

    // Timestamps stripped from instruction
    const fpTime1 = TaskFingerprint.compute({ capability: 'review', instruction: 'review 2026-06-13T12:00:00Z auth' });
    const fpTime2 = TaskFingerprint.compute({ capability: 'review', instruction: 'review 2026-06-14T08:00:00Z auth' });
    assert('timestamps stripped from instruction', fpTime1 === fpTime2);

    // Record and lookup
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-test-'));
    // Use a temporary fingerprints.json for this test
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync('memory', { recursive: true });

    const testFp = TaskFingerprint.compute({ capability: 'review', instruction: 'test lookup' });
    await TaskFingerprint.record({ fingerprint: testFp, resultId: 'result-001', createdAt: new Date().toISOString() });
    const found = await TaskFingerprint.lookup(testFp);
    assert('record and lookup returns entry', found?.resultId === 'result-001');

    await TaskFingerprint.invalidate(testFp);
    assert('invalidate removes fingerprint', (await TaskFingerprint.lookup(testFp)) === null);

    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // ── Test 2: DiffContext ────────────────────────────────────────────────────
  console.log('\nTest 2: DiffContext — slice extraction & 30% fallback');
  {
    // Create a temp file with 100 lines
    const tmpFile = path.join(os.tmpdir(), `cortex-difftest-${Date.now()}.ts`);
    const lines   = Array.from({ length: 100 }, (_, i) => `const line${i + 1} = ${i + 1};`);
    fs.writeFileSync(tmpFile, lines.join('\n'), 'utf8');

    // Slice small range: lines 10-15 (6 lines + padding = ~12 lines, 12% of 100) → diff
    const small = await DiffContext.extractSlice(tmpFile, 10, 15, 3);
    assert('small slice extracted', small !== null);
    assert('small slice is NOT full file', small!.usedFullFile === false);
    assert('small slice has correct token estimate', small!.tokenEstimate > 0);

    // Slice large range: lines 1-80 (80% of 100) → falls back to full file
    const large = await DiffContext.extractSlice(tmpFile, 1, 80, 3);
    assert('large slice falls back to full file', large!.usedFullFile === true);
    assert('full file fallback has totalLines=100', large!.totalLines === 100);

    // fromEvidence
    const evidence = [`${tmpFile}:10-15`];
    const slices = await DiffContext.fromEvidence(evidence, path.dirname(tmpFile));
    assert('fromEvidence returns slices', slices.length === 1);
    assert('fromEvidence slice is not full file', slices[0].usedFullFile === false);

    // summarize
    const summary = DiffContext.summarize(slices);
    assert('summarize returns non-empty string', summary.length > 0);
    assert('totalTokens is positive', DiffContext.totalTokens(slices) > 0);

    // Missing file returns null
    assert('missing file returns null', (await DiffContext.extractSlice('/nonexistent/file.ts', 1, 5)) === null);

    fs.unlinkSync(tmpFile);
  }

  // ── Test 3: ResultCache ────────────────────────────────────────────────────
  console.log('\nTest 3: ResultCache — fingerprint+runtime+model key, TTL, CACHEABLE_CAPABILITIES');
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-cache-'));
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync(path.join('memory', 'cache'), { recursive: true });

    const cache = new ResultCache();

    // Cacheable capabilities whitelist
    assert('security-review is cacheable', ResultCache.isCacheable('security-review'));
    assert('analysis is cacheable', ResultCache.isCacheable('analysis'));
    assert('implementation is NOT cacheable', !ResultCache.isCacheable('implementation'));
    assert('code-generation is NOT cacheable', !ResultCache.isCacheable('code-generation'));

    // set and get
    await cache.set({ fingerprint: 'fp1', runtime: 'claude-code', model: 'sonnet', result: { score: 42 } });
    const hit = await cache.get<{ score: number }>('fp1', 'claude-code', 'sonnet');
    assert('cache hit returns correct result', hit?.result.score === 42);

    // Different runtime → different cache entry (miss)
    const miss = await cache.get('fp1', 'antigravity', 'gemini-pro');
    assert('different runtime → cache miss', miss === null);

    // TTL expiry
    await cache.set({
      fingerprint: 'fp-expire',
      runtime: 'claude-code',
      model: 'sonnet',
      result: 'stale',
      ttlMs: -1, // already expired
    });
    const expired = await cache.get('fp-expire', 'claude-code', 'sonnet');
    assert('expired entry returns null', expired === null);

    // sweepExpired
    await cache.set({ fingerprint: 'fp-sweep', runtime: 'r', model: 'm', result: 'data', ttlMs: -1 });
    const swept = await cache.sweepExpired();
    assert('sweepExpired removes expired entries', swept > 0);

    // list() returns only valid entries
    await cache.set({ fingerprint: 'fp-valid', runtime: 'r', model: 'm', result: 'ok', ttlMs: 60_000 });
    const list = await cache.list();
    assert('list() returns only non-expired entries', list.every(e => new Date(e.expiresAt) > new Date()));

    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // ── Test 4: RuntimeRouteCache ─────────────────────────────────────────────
  console.log('\nTest 4: RuntimeRouteCache — TTL, invalidateRuntime, sweepExpired');
  {
    const rc = new RuntimeRouteCache();

    rc.set('coding', { runtime: 'claude-code', provider: 'anthropic', model: 'sonnet' });
    const hit = rc.get('coding');
    assert('route cache hit returns decision', hit?.runtime === 'claude-code');

    // Miss for unknown capability
    assert('unknown capability → null', rc.get('does-not-exist') === null);

    // Expired entry
    const rc2 = new RuntimeRouteCache();
    rc2.set('security-review', { runtime: 'claude-code', provider: 'anthropic', model: 'opus' }, -1);
    assert('expired route → null', rc2.get('security-review') === null);

    // invalidateRuntime removes all routes for that runtime
    rc.set('analysis',     { runtime: 'antigravity', provider: 'google', model: 'gemini-pro' });
    rc.set('architecture', { runtime: 'antigravity', provider: 'google', model: 'gemini-pro' });
    rc.set('review',       { runtime: 'claude-code', provider: 'anthropic', model: 'sonnet' });
    rc.invalidateRuntime('antigravity');
    assert('invalidateRuntime removes analysis', rc.get('analysis') === null);
    assert('invalidateRuntime removes architecture', rc.get('architecture') === null);
    assert('invalidateRuntime leaves other runtimes', rc.get('review')?.runtime === 'claude-code');

    // sweepExpired
    const rc3 = new RuntimeRouteCache();
    rc3.set('x', { runtime: 'r', provider: 'p', model: 'm' }, -1);
    rc3.set('y', { runtime: 'r', provider: 'p', model: 'm' }, 60_000);
    const swept = rc3.sweepExpired();
    assert('sweepExpired removes only expired entries', swept === 1);
    assert('non-expired entry survives sweep', rc3.get('y') !== null);

    // snapshot
    const snap = rc.snapshot();
    assert('snapshot returns array', Array.isArray(snap));
  }

  // ── Test 5: MemoryStore.recallLazy ────────────────────────────────────────
  console.log('\nTest 5: MemoryStore.recallLazy — remainingBudget threshold');
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-rag-'));
    const store  = new MemoryStore(path.join(tmpDir, 'idx'));

    await store.remember('auth module security vulnerability', { tag: 'test' });

    // Plenty of budget (128k window, 5k used → 123k remaining > 10k) → should recall
    const results = await store.recallLazy('auth security', 5_000, 128_000, 10_000, 1);
    assert('recallLazy returns results when budget is ample', results.length > 0);

    // Tight budget (128k window, 125k used → 3k remaining < 10k) → should skip
    const skipped = await store.recallLazy('auth security', 125_000, 128_000, 10_000, 1);
    assert('recallLazy skips RAG when budget is tight', skipped.length === 0);

    // Works with large model window (1M window, 500k used → 500k remaining) → should recall
    const large = await store.recallLazy('auth security', 500_000, 1_000_000, 10_000, 1);
    assert('recallLazy works correctly with 1M context window', large.length > 0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n--- Token Economy Tests: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

void main();
