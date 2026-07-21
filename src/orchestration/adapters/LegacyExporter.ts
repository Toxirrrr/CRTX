import { AgentTask, Cycle, CycleState, HandshakeStatus } from '../types';

/**
 * Maps the new CRTX Runtime Cycle model back to legacy AgentTask.
 * Direction: Runtime (CRTX Engine) -> Legacy (Prisma/API).
 * USE WITH CAUTION: Should only be used when persisting to old endpoints.
 */
export class LegacyExporter {

  static toLegacyTask(cycle: Cycle): AgentTask {
    return {
      taskId: cycle.id,
      sourceAgent: cycle.execution.sourceAgent,
      targetAgent: cycle.execution.targetAgent,
      status: this.mapCycleStateToStatus(cycle.execution.status),
      payload: {
        ...cycle.execution.payload,
        instruction: cycle.objective,
        risk: cycle.risk
      },
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt
    };
  }

  private static mapCycleStateToStatus(state: CycleState): HandshakeStatus {
    switch (state) {
      case 'PENDING': return 'REQUESTED';
      case 'INITIALIZING': return 'ACCEPTED';
      case 'RUNNING': return 'IN_PROGRESS';
      case 'QA_REVIEW': return 'REVIEW';
      case 'COMPLETED': return 'COMPLETED';
      case 'FAILED': return 'FAILED';
      case 'ROLLING_BACK': return 'REVIEW_FAILED';
      case 'RECOVERING': return 'IN_PROGRESS';
      case 'VALIDATING': return 'IN_PROGRESS';
      default: return 'REQUESTED';
    }
  }
}
