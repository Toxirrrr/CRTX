// Mirrors the schema in ai/multiagent/handshake.json so Claude and
// Antigravity exchange tasks in a shared, pre-agreed shape.
export type HandshakeStatus = 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'PARKED' | 'ESCALATED' | 'REVIEW' | 'REVIEW_FAILED' | 'COMPLETED' | 'FAILED';

export interface AgentTask {
  taskId: string;
  sourceAgent: string;
  targetAgent: string;
  status: HandshakeStatus;
  payload: {
    instruction?: string;
    risk?: string;
    domain?: string;
    role?: string;
    depth?: number;
    skills?: string[];
    contextSize?: number;
    dependsOn?: string[];
    requiresCompression?: boolean;
    validation?: { lint?: boolean; tests?: boolean; security?: boolean };
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AgentTaskInput {
  sourceAgent: string;
  targetAgent: string;
  taskId?: string;
  status?: HandshakeStatus;
  payload: {
    instruction?: string;
    risk?: string;
    domain?: string;
    role?: string;
    depth?: number;
    skills?: string[];
    contextSize?: number;
    dependsOn?: string[];
    requiresCompression?: boolean;
    validation?: { lint?: boolean; tests?: boolean; security?: boolean };
    [key: string]: any;
  };
}
