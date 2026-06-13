/**
 * test_rag.ts — verifies the semantic memory (RAG): save text to the vector
 * DB, then retrieve it via a semantically-related (not keyword-identical)
 * query.
 *
 * First run downloads the embedding model (~90MB) and may take a minute.
 * Run: npm run test:rag
 */
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from '../src/rag/memoryStore';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function main(): Promise<void> {
  // Use a throwaway temp index so the test is repeatable and side-effect-free.
  const tmpIndex = path.join(os.tmpdir(), `ao-rag-test-${Date.now()}`);
  const memory = new MemoryStore(tmpIndex);

  const facts = [
    'The GPS tracking pipeline writes points to Redis with a 300 second TTL.',
    'Replenishment requests move PENDING to APPROVED to IN_TRANSIT to DELIVERED.',
    'SalesAgent must never contain vehicle or logistics fields like licensePlate.',
  ];

  for (const fact of facts) {
    await memory.remember(fact, { source: 'test' });
  }

  // Query with different words than the stored fact — tests *semantic*
  // retrieval, not substring matching.
  const results = await memory.recall('How long does an agent location stay cached?', 3);

  assert(results.length > 0, 'recall returned at least one result');
  const top = results[0];
  assert(
    top.text.includes('300 second TTL'),
    `top semantic match should be the Redis-TTL fact, got: "${top.text}"`,
  );

  // eslint-disable-next-line no-console
  console.log(
    `test_rag: PASS — saved ${facts.length} items, semantic query returned correct top match ` +
      `(score ${top.score.toFixed(3)})`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('test_rag: FAIL —', err);
  process.exit(1);
});
