import path from 'node:path';
import { LocalIndex } from 'vectra';
import { embed } from './embeddings';

export interface MemoryItem {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
  score: number;
}

const DEFAULT_INDEX_PATH = path.join(__dirname, '..', '..', 'data', 'memory-index');

/**
 * Local, file-backed semantic memory (RAG). Lets Claude and Antigravity
 * persist notes/decisions and recall them by meaning, not just keyword.
 */
export class MemoryStore {
  private index: LocalIndex;
  private ready: Promise<void>;

  constructor(indexPath: string = DEFAULT_INDEX_PATH) {
    this.index = new LocalIndex(indexPath);
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    if (!(await this.index.isIndexCreated())) {
      await this.index.createIndex();
    }
  }

  async remember(text: string, metadata: Record<string, unknown> = {}): Promise<string> {
    await this.ready;
    const vector = await embed(text);
    const item = await this.index.insertItem({ vector, metadata: { ...metadata, text } });
    return item.id;
  }

  async recall(query: string, topK = 5): Promise<MemoryItem[]> {
    await this.ready;
    const vector = await embed(query);
    const results = await this.index.queryItems(vector, topK);
    return results.map((result) => ({
      id: result.item.id,
      text: String(result.item.metadata?.text ?? ''),
      metadata: result.item.metadata ?? {},
      score: result.score,
    }));
  }

  /**
   * Lazy RAG — skips recall when the remaining context budget is too tight.
   *
   * Uses remainingBudget = modelContextWindow - contextSize.
   * If fewer than minRemainingTokens are left, adding RAG entries risks
   * overflowing the context or crowding out the real task payload.
   *
   * Works correctly regardless of model window size (32k, 128k, 200k, 1M).
   *
   * @param query           Search query
   * @param contextSize     Tokens already consumed
   * @param modelWindow     Max tokens the model supports (default: 128k)
   * @param minRemaining    Skip RAG if fewer than this many tokens remain (default: 10k)
   */
  async recallLazy(
    query: string,
    contextSize: number,
    modelWindow  = 128_000,
    minRemaining = 10_000,
    topK         = 5,
  ): Promise<MemoryItem[]> {
    const remainingBudget = modelWindow - contextSize;
    if (remainingBudget < minRemaining) {
      return []; // not enough room left — skip RAG
    }
    return this.recall(query, topK);
  }
}
