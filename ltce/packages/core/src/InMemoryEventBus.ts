import { EventBus, EventEnvelope, EventHandler, EventPublishResult, SubscriptionToken } from "../../sdk/src/events";
import { randomUUID } from "crypto";

export class InMemoryEventBus implements EventBus {
  // Map Type -> Set of token IDs
  private typeSubscriptions = new Map<string, Set<string>>();
  // Map Token ID -> Handler reference
  private handlers = new Map<string, EventHandler>();

  subscribe<T>(type: string, handler: EventHandler<T>): SubscriptionToken {
    const tokenId = randomUUID();
    
    if (!this.typeSubscriptions.has(type)) {
      this.typeSubscriptions.set(type, new Set());
    }
    
    this.typeSubscriptions.get(type)!.add(tokenId);
    this.handlers.set(tokenId, handler as EventHandler);

    return { id: tokenId, type };
  }

  unsubscribe(token: SubscriptionToken): void {
    const typeSet = this.typeSubscriptions.get(token.type);
    if (typeSet) {
      typeSet.delete(token.id);
    }
    this.handlers.delete(token.id);
  }

  async publish<T>(event: EventEnvelope<T>): Promise<EventPublishResult> {
    const result: EventPublishResult = {
      delivered: 0,
      failed: 0,
      errors: []
    };

    const typeSet = this.typeSubscriptions.get(event.type);
    if (!typeSet || typeSet.size === 0) {
      return result;
    }

    // Call sequentially, collect aggregate result
    for (const tokenId of typeSet) {
      const handler = this.handlers.get(tokenId);
      if (!handler) continue;

      try {
        await handler(event);
        result.delivered++;
      } catch (err) {
        result.failed++;
        result.errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    return result;
  }
}
