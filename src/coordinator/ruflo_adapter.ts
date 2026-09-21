/**
 * CRTX Coordinator <-> Ruflo Orchestration Adapter
 * 
 * ARCHITECTURE BOUNDARY DEFINITION:
 * 
 * CRTX OWNS (Governance):
 * - Architecture policy & Validation Gates
 * - Task Registry & Intent Tracking
 * - File/Resource Ownership (Locks)
 * - Semantic Conflict Policy
 * - Close Gates & Master Architect Recovery
 * 
 * Ruflo OWNS (Orchestration):
 * - Agent Lifecycle & Swarm Execution
 * - Session Lifecycle
 * - EventBus & Telemetry
 * - Memory & Embeddings
 * - LLM Routing
 * 
 * This adapter defines the protocol by which CRTX subscribes to Ruflo's EventBus 
 * without surrendering authoritative state to Ruflo.
 */

import { CoordAuditEvent } from './types';

// Mock types for Ruflo integration (representing Ruflo's EventBus)
export interface RufloEvent {
  type: string;
  payload: any;
  timestamp: string;
}

export interface RufloEventBus {
  on(eventType: string, handler: (evt: RufloEvent) => void): void;
  emit(eventType: string, payload: any): void;
}

export class CRTXRufloAdapter {
  private bus: RufloEventBus;

  constructor(bus: RufloEventBus) {
    this.bus = bus;
    this.registerListeners();
  }

  private registerListeners() {
    // 1. Map Ruflo session pings to CRTX Heartbeats
    this.bus.on('swarm:agent:ping', async (evt) => {
      // Calls processHeartbeat in CRTX registry
      // processHeartbeat({ chatId: evt.payload.agentId, ... })
    });

    // 2. Map Ruflo disconnects to CRTX Disconnects
    this.bus.on('swarm:agent:disconnected', async (evt) => {
      // Calls disconnectChat in CRTX registry
    });

    // 3. Prevent Ruflo from overriding CRTX Task States
    // If Ruflo tries to claim a task, it MUST pass through CRTX `claimTask`.
    this.bus.on('swarm:task:claim_request', async (evt) => {
      // Calls claimTask. If CRTX rejects, emit 'crtx:task:claim_rejected' back to Ruflo.
    });

    // 4. Stale/Deadlock Detection
    this.bus.on('swarm:deadlock:detected', async (evt) => {
      // Calls markStaleOwners() to transition to STALE, but relies on Master Architect for ABORT.
    });
  }

  public emitCRTXEvent(event: CoordAuditEvent) {
    // Forward CRTX audit events to Ruflo for telemetry/logging
    this.bus.emit(`crtx:${event.type.toLowerCase()}`, event.payload);
  }
}
