export interface EventEnvelope<T = any> {
  eventId: string;
  timestamp: string;
  eventType: string;
  source: string;
  version: string;
  tenantId: string;
  payload: T;
}

export type EventStatus = 'PENDING' | 'PROCESSED' | 'FAILED' | 'DLQ';

export interface FileChangedPayload {
  filePath: string;
  contentHash: string;
  diff?: string;
}

export interface GraphUpdatedPayload {
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
}

export interface ContextResponse {
  intent: string;
  role: string;
  nodesUsed: string[];
  xmlContext: string;
}

export interface PluginHealthReport {
  status: 'Healthy' | 'Degraded' | 'Unavailable';
  latency: number;
  message?: string;
}
