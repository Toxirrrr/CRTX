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

// --- CRTX v2 Execution Engine Types (Phase P0 & P1) ---

export enum ExecutionState {
  PENDING = 'pending',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  VALIDATING = 'validating',
  QA_REVIEW = 'qa_review', // Added in P1
  ROLLING_BACK = 'rolling_back',
  RECOVERING = 'recovering',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface ExecutionContext {
  executionId: string;
  taskId: string;
  agentId: string;
  state: ExecutionState;
  snapshotId: string;
  attempts: number;
}

export interface ExecutionResult {
  success: boolean;
  evidenceId?: string;
  error?: Error;
  metrics: {
    durationMs: number;
    tokensUsed: number;
    cost: number;
  };
}

export interface IExecutionEngine {
  executeTask(taskId: string, agentId: string): Promise<ExecutionResult>;
  suspendTask(executionId: string, reason: string): Promise<void>;
  resumeTask(executionId: string): Promise<ExecutionResult>;
  rollback(executionId: string): Promise<void>;
}

export interface ValidationResult {
  passed: boolean;
  step: string;
  logs: string;
}

export interface IValidationPipeline {
  validate(taskId: string): Promise<ValidationResult>;
}

export interface IRecoveryEngine {
  triggerRecovery(taskId: string, errorLogs: string): Promise<void>;
}

// --- Phase P1 Types ---

export interface DAGNode {
  taskId: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'review' | 'done' | 'failed' | 'cascading_blocked';
  dependsOn: string[];
  dependents: string[];
  depthLevel: number;
}

export interface ITaskDAGEngine {
  buildGraph(tasks: any[]): Record<string, DAGNode>;
  detectCycles(graph: Record<string, DAGNode>): boolean;
  getExecutableTasks(graph: Record<string, DAGNode>): string[];
  propagateBlockingState(taskId: string, failed: boolean, graph: Record<string, DAGNode>): void;
}

export interface ExecutionTelemetry {
  taskId: string;
  capability: string;
  runtime: string;
  agent: string;
  model: string;
  tokens: { input: number; output: number };
  success: boolean;
  failureReason?: string;
  retry_count: number;
  durationMs: number;
  costUsd: number;
}

export interface RoutingRecommendation {
  recommendedRuntime: string;
  recommendedModel: string;
  expectedCost: number;
  historicalSuccessRate: number;
  confidenceScore: number;
}

export interface ILearningEngine {
  recordOutcome(telemetry: ExecutionTelemetry): Promise<void>;
  recommendRouting(capability: string, maxCostLimit?: number): Promise<RoutingRecommendation>;
}

export interface IMiniKnowledgeGraph {
  getModuleDependencies(taskId: string): string[];
  recordTaskFileModification(taskId: string, filePath: string): void;
}

// --- Phase P2 Types ---

export interface GraphNode {
  id: string;
  type: 'file' | 'module' | 'task' | 'symbol' | 'api' | 'agent';
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  relation: 'CONTAINS' | 'MODIFIES' | 'AFFECTS' | 'DEFINES' | 'CALLS' | 'IMPLEMENTS' | 'EXECUTED';
}

export interface IFullKnowledgeGraph {
  addNode(node: GraphNode): void;
  addEdge(edge: GraphEdge): void;
  getImpactAnalysis(endpoint: string): GraphNode[];
  ingestModifications(taskId: string, filesChanged: string[]): Promise<void>;
  queryGraph(startNodeId: string, maxDepth: number, relations: string[]): GraphNode[];
}

export interface IASTParser {
  parseFile(filePath: string, fileContent: string): { nodes: GraphNode[], edges: GraphEdge[] };
}

export interface IHybridSearch {
  search(query: string, topK?: number): Promise<{ semanticResults: any[], graphResults: GraphNode[] }>;
}

// --- Phase P3 Types ---

export interface MessagePayload {
  taskId: string;
  command: 'START' | 'STOP' | 'ROLLBACK';
  contextUrl?: string;
  metadata?: Record<string, any>;
}

export interface IQueueAdapter {
  publish(topic: string, payload: MessagePayload): Promise<string>;
  subscribe(topic: string, handler: (msg: MessagePayload) => Promise<void>): void;
  acknowledge(messageId: string): Promise<void>;
  nack(messageId: string): Promise<void>;
}

