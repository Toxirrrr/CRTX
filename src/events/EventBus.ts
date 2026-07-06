import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { CRTXEvent, EventType } from './types';

export class EventBus {
  private emitter = new EventEmitter();

  /**
   * Publishes an event to the bus.
   * Automatically injects schemaVersion, timestamp, and a unique id.
   */
  publish(event: Omit<CRTXEvent, 'schemaVersion' | 'timestamp' | 'id'>): void {
    const fullEvent: CRTXEvent = {
      ...event,
      id: randomUUID(),
      schemaVersion: 1,
      timestamp: new Date().toISOString(),
    };
    
    // Emit specifically for the event type
    this.emitter.emit(event.type, fullEvent);
    // Emit to wildcard listeners (like the TimelineSubscriber)
    this.emitter.emit('*', fullEvent);
  }

  /**
   * Subscribe to specific event types or all events ('*')
   */
  subscribe(type: EventType | '*', handler: (event: CRTXEvent) => void): void {
    this.emitter.on(type, handler);
  }

  unsubscribe(type: EventType | '*', handler: (event: CRTXEvent) => void): void {
    this.emitter.off(type, handler);
  }
}
