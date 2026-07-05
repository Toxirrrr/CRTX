export interface EventEnvelope<T = any> {
  id: string;
  type: string;
  payload: T;
  occurredAt: Date;
  sourcePlugin: string;
  correlationId?: string;
  causationId?: string;
  version: number;
}

export interface SubscriptionToken {
  id: string;
  type: string;
}

export type EventHandler<T = any> = (event: EventEnvelope<T>) => void | Promise<void>;

export interface EventPublishResult {
  delivered: number;
  failed: number;
  errors: Error[];
}

export interface EventPublisher {
  publish<T>(event: EventEnvelope<T>): Promise<EventPublishResult>;
}

export interface EventSubscriber {
  subscribe<T>(type: string, handler: EventHandler<T>): SubscriptionToken;
  unsubscribe(token: SubscriptionToken): void;
}

export interface EventBus extends EventPublisher, EventSubscriber {}
