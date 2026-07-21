import { AgentTask, Cycle, CycleState, HandshakeStatus } from '../types';

/**
 * Maps legacy AgentTask objects to the new CRTX Runtime Cycle model.
 * Direction: Legacy (Prisma/API) -> Runtime (CRTX Engine).
 */
export class LegacyImporter {
  
  static toCycle(task: AgentTask): Cycle {
    return {
      id: task.taskId,
      missionId: 'legacy-mission',
      objective: task.payload?.instruction || 'Legacy Task Execution',
      scope: {
        include: task.payload?.dependsOn || [],
        exclude: []
      },
      budget: {
        maxHours: 24,
        maxFiles: task.payload?.contextSize || 50,
        maxModules: task.payload?.depth || 1
      },
      constraints: task.payload?.skills || [],
      risk: task.payload?.risk || 'UNKNOWN',
      definitionOfDone: task.payload?.validation ? Object.keys(task.payload.validation).map(k => `${k} validated`) : [],
      qualityGates: [],
      execution: {
        status: this.mapStatusToCycleState(task.status),
        sourceAgent: task.sourceAgent,
        targetAgent: task.targetAgent,
        payload: task.payload
      },
      evidence: [],
      artifacts: [],
      audit: {},
      releaseDecision: 'PENDING',
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: task.updatedAt || new Date().toISOString()
    };
  }

  private static mapStatusToCycleState(status: HandshakeStatus): CycleState {
    switch (status) {
      case 'REQUESTED': return 'PENDING';
      case 'ACCEPTED': return 'INITIALIZING';
      case 'IN_PROGRESS': return 'RUNNING';
      case 'REVIEW': return 'QA_REVIEW';
      case 'COMPLETED': return 'COMPLETED';
      case 'FAILED': return 'FAILED';
      case 'ESCALATED': return 'FAILED';
      case 'PARKED': return 'PENDING';
      case 'REVIEW_FAILED': return 'ROLLING_BACK';
      default: return 'PENDING';
    }
  }
}
