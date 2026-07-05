import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { IQueueAdapter, MessagePayload } from './types';

/**
 * P3: Local Queue Adapter
 * An in-memory EventEmitter based queue adapter.
 * Used for Zero-Dependency automation within a single Node.js process.
 */
export class LocalQueueAdapter implements IQueueAdapter {
  private bus = new EventEmitter();

  async publish(topic: string, payload: MessagePayload): Promise<string> {
    const messageId = randomUUID();
    
    // Asynchronously emit to avoid blocking the publisher
    setImmediate(() => {
      this.bus.emit(topic, { messageId, ...payload });
    });
    
    return messageId;
  }

  subscribe(topic: string, handler: (msg: MessagePayload) => Promise<void>): void {
    this.bus.on(topic, async (rawMsg: any) => {
      try {
        await handler(rawMsg as MessagePayload);
      } catch (err) {
        console.error(`[LocalQueueAdapter] Unhandled error in subscriber for topic ${topic}:`, err);
      }
    });
  }

  async acknowledge(messageId: string): Promise<void> {
    // In-memory doesn't strictly need acks, but we implement the interface for consistency.
  }

  async nack(messageId: string): Promise<void> {
    // In a real system, this would push the message back onto a retry queue.
    console.warn(`[LocalQueueAdapter] Message ${messageId} was nack'd. Retry logic not implemented in basic local queue.`);
  }
}
