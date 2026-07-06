export enum EventType {
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_DELETED = 'task_deleted',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_ASSIGNED = 'task_assigned',
  BOARD_LOADED = 'board_loaded'
}

export type EventActor = 'cursor' | 'claude-code' | 'system' | 'manual' | 'unknown';

export interface CRTXEvent<T = any> {
  schemaVersion: number;
  id: string; // Unique event ID
  type: EventType;
  actor: EventActor;
  correlationId?: string;
  timestamp: string;
  metadata: Record<string, any>;
  payload: T;
}
