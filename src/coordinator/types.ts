/**
 * CRTX Multi-Agent Coordinator — Type Definitions
 *
 * Responsibility boundary:
 *   CRTX Core  → HOW to execute an engineering task (lifecycle)
 *   Coordinator → WHO is executing WHAT, WHERE, in WHICH phase
 *
 * This module belongs to the CRTX engineering/tooling layer.
 * It must NOT be imported by server/, client/, or mobile/ runtime code.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type CoordTaskStatus =
  | 'TODO'
  | 'CLAIMED'
  | 'AUDITING'
  | 'PLANNED'
  | 'IMPLEMENTING'
  | 'VALIDATING'
  | 'BLOCKED'
  | 'CLOSED';

export type CoordChatState =
  | 'NEW'
  | 'ACTIVE'
  | 'WORKING'
  | 'WAITING'
  | 'VALIDATING'
  | 'BLOCKED'
  | 'DISCONNECTED'
  | 'STALE'
  | 'IDLE'
  | 'CLOSED';

export type CoordIntent =
  | 'READ'
  | 'AUDIT'
  | 'PLAN'
  | 'IMPLEMENT'
  | 'VALIDATE'
  | 'HANDOFF';

export type CoordEventType =
  | 'TASK_CREATED'
  | 'TASK_CLAIMED'
  | 'TASK_RELEASED'
  | 'TASK_BLOCKED'
  | 'TASK_UNBLOCKED'
  | 'TASK_CLOSED'
  | 'RESOURCE_LOCKED'
  | 'RESOURCE_RELEASED'
  | 'CONFLICT_DETECTED'
  | 'DEPENDENCY_BLOCKED'
  | 'SCOPE_VIOLATION'
  | 'HANDOFF_STARTED'
  | 'HANDOFF_ACCEPTED'
  | 'VALIDATION_STARTED'
  | 'VALIDATION_PASSED'
  | 'VALIDATION_FAILED'
  | 'AGENT_HEARTBEAT'
  | 'AGENT_STALE'
  | 'AGENT_DISCONNECTED'
  | 'DUPLICATE_TASK_DETECTED'
  | 'TASK_SWITCH_DETECTED'
  | 'ARCHITECTURE_CONFLICT'
  | 'MASTER_ARCHITECT_REQUIRED';

// ─── Core Task Model ──────────────────────────────────────────────────────────

export interface CoordScope {
  /** Declared directories (glob patterns allowed, e.g. "server/src/modules/tasks/**") */
  directories: string[];
  /** Specific files declared */
  files: string[];
  /** Human-readable description of expected changes */
  expectedChanges: string;
}

export interface CoordValidationEvidence {
  lintPassed?: boolean;
  typecheckPassed?: boolean;
  buildPassed?: boolean;
  unitTestsPassed?: boolean;
  integrationTestsPassed?: boolean;
  runtimeVerified?: boolean;
  scopeVerified?: boolean;
  architectureVerified?: boolean;
  remainingBlockers: string[];
  notes: string;
  recordedAt: string;
}

export interface CoordHandoff {
  fromChatId: string;
  toChatId: string;
  phase: CoordTaskStatus;
  completedWork: string;
  remainingWork: string;
  blockers: string[];
  filesChanged: string[];
  validationState: string;
  initiatedAt: string;
  acceptedAt?: string;
}

export interface CoordTask {
  /** Stable task ID — e.g. "API-274", "BACKEND-DRIVERS-001" */
  taskId: string;
  title: string;
  description: string;
  /** chatId of the implementation owner — null if unowned */
  ownerChatId: string | null;
  phase: CoordTaskStatus;
  /** Current declared intent of the owner */
  intent: CoordIntent;
  /** Declared implementation scope */
  scope: CoordScope;
  /** Task IDs this task depends on */
  dependencies: string[];
  /** Task IDs that are blocking this task */
  blockers: string[];
  /** Validation evidence required before CLOSED */
  evidence: CoordValidationEvidence | null;
  /** Pending handoff (if any) */
  pendingHandoff: CoordHandoff | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Resource Lock Model ──────────────────────────────────────────────────────

export interface CoordResourceLock {
  /** Normalized resource path (relative to repo root) */
  resource: string;
  /** The taskId that holds this lock */
  taskId: string;
  /** The chatId that holds this lock */
  chatId: string;
  /** WRITE or READ_ONLY */
  mode: 'WRITE' | 'READ_ONLY';
  acquiredAt: string;
}

// ─── Chat/Agent Registry ──────────────────────────────────────────────────────

export interface CoordChatEntry {
  chatId: string;
  /** Agent type: "antigravity" | "claude" | "opus" | "human" */
  agent: string;
  /** Chat Lifecycle State */
  chatState: CoordChatState;
  /** Currently active task (null if idle) */
  currentTaskId: string | null;
  phase: CoordTaskStatus | null;
  intent: CoordIntent | null;
  /** Declared scope for current task */
  scope: CoordScope | null;
  /** Locked resources for current task */
  locks: string[];
  lastActivity: string;
  registeredAt: string;
}

// ─── Conflict Models ──────────────────────────────────────────────────────────

export type ConflictType =
  | 'FILE_COLLISION'
  | 'DUPLICATE_TASK'
  | 'SEMANTIC_OVERLAP'
  | 'TASK_SWITCH'
  | 'SCOPE_VIOLATION'
  | 'ARCHITECTURE_VIOLATION'
  | 'DEPENDENCY_BLOCK'
  | 'PORT_COLLISION';

export interface CoordConflict {
  conflictId: string;
  type: ConflictType;
  description: string;
  /** Resources / task IDs involved */
  subjects: string[];
  involvedChatIds: string[];
  /** Conflict is actionable until resolved */
  resolved: boolean;
  resolution?: string;
  detectedAt: string;
  resolvedAt?: string;
}

// ─── Audit Event ─────────────────────────────────────────────────────────────

export interface CoordAuditEvent {
  eventId: string;
  type: CoordEventType;
  taskId?: string;
  chatId?: string;
  resource?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ─── Workspace Diff ───────────────────────────────────────────────────────────

export interface WorkspaceDiff {
  declaredScope: string[];
  actualModified: string[];
  undeclared: string[];
  /** true if actual changes exceed declared scope */
  hasViolation: boolean;
  checkedAt: string;
}

// ─── API Request/Response shapes ──────────────────────────────────────────────

export interface HeartbeatRequest {
  chatId: string;
  agent: string;
  taskId: string | null;
  phase: string | null;
  intent: string | null;
  timestamp: string;
}

export interface ClaimTaskRequest {
  chatId: string;
  agent: string;
  intent: CoordIntent;
  scope: CoordScope;
}

export interface ClaimTaskResponse {
  success: true;
  task: CoordTask;
  locks: CoordResourceLock[];
}

export interface ClaimTaskConflict {
  success: false;
  conflictType: 'DUPLICATE_TASK' | 'RESOURCE_CONFLICT' | 'TASK_SWITCH' | 'DEPENDENCY_BLOCK' | 'TASK_NOT_FOUND';
  message: string;
  ownerChatId?: string | null;
  currentPhase?: CoordTaskStatus | null;
  conflictId?: string;
}

export interface StatusOutput {
  generatedAt: string;
  activeTasks: number;
  activeChats: number;
  chats: CoordChatEntry[];
  tasks: CoordTask[];
  openConflicts: CoordConflict[];
  stats: {
    conflicts: number;
    duplicates: number;
    fileCollisions: number;
    dependencyBlocks: number;
    undeclaredChanges: number;
    staleLocks: number;
  };
}

export interface CoordPeerMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: string;
}

export interface CoordFileLock {
  file: string;
  agent: string;
  priority: number;
  reason: string;
  acquiredAt: string;
  expiresAt: number;
  ttlSeconds: number;
  lineStart?: number;
  lineEnd?: number;
}

export interface AgentRoleConfig {
  agent: string;
  role: 'MANAGER' | 'WORKER' | 'PLATFORM' | 'CODE_REVIEWER' | 'SUPERVISOR' | 'ANALYZER';
  priority: number;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'IDLE';
  currentAction: string;
  activeFiles: string[];
  lastSeen: string;
  model?: string;
}

export interface CoordinatorState {
  version: number;
  updatedAt: string;
  chats: Record<string, CoordChatEntry>;
  tasks: Record<string, CoordTask>;
  locks: Record<string, CoordResourceLock>;
  conflicts: Record<string, CoordConflict>;
  fileLocks?: Record<string, CoordFileLock>;
  messages?: CoordPeerMessage[];
  agentRoles?: Record<string, AgentRoleConfig>;
  automatic?: AutomaticCoordination;
}

export type AutomaticRole = 'WRITER' | 'REVIEWER' | 'QA' | 'RESERVE';
export interface AutomaticAgent { id: string; tokenHash: string; capabilities: string[]; roles: AutomaticRole[]; canManage: boolean; leaseUntil: number; credits: 'AVAILABLE' | 'EXHAUSTED'; model: string; }
export interface AutomaticWork { acknowledgedAt?: number; startedAt?: number; progressAt?: number; taskId: string; capabilities: string[]; role: AutomaticRole; reviewOf?: string; authorId?: string; ownerId: string | null; phase: 'QUEUED' | 'OFFERED' | 'ACKNOWLEDGED' | 'RUNNING' | 'BLOCKED' | 'COMPLETED' | 'ACCEPTED'; leaseUntil: number; assignmentId: string; notes: string; evidence: string[]; artifactIds?: string[]; }

export interface Artifact {
  id: string;
  taskId: string;
  agentId: string;
  type: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  content: string;
  timestamp: number;
  executionId?: string;
  sessionId?: string;
}

export interface Cycle {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  tasks: string[];
}

export interface Gate {
  id: string;
  targetId: string;
  type: 'EVIDENCE' | 'STAGE' | 'FINAL';
  status: 'PENDING' | 'PASS' | 'FAIL' | 'BLOCKED';
  requiredArtifactTypes: string[];
  policyId?: string;
  evaluatedBy?: string;
  evaluatedAt?: number;
  evaluationArtifactIds?: string[];
  reason?: string;
}

export interface CrtxEventEnvelope<T = unknown> {
  eventId: string;
  type: string;
  version: number;
  source: { agentId?: string; sessionId?: string };
  target: { type: string; id: string };
  timestamp: string;
  correlationId?: string;
  causationId?: string;
  payload: T;
}

export interface AutomaticCoordination { direct?: { [messageId: string]: AutomaticDirectMessage }; agents: { [id: string]: AutomaticAgent }; work: { [taskId: string]: AutomaticWork }; cycles?: { [cycleId: string]: Cycle }; gates?: { [gateId: string]: Gate }; artifacts?: { [artifactId: string]: Artifact }; managerId: string | null; managerUntil: number; epoch: number; }
export interface AutomaticDirectMessage { preflight?: { skillPath: string; sha256: string; status: 'PASSED' }; messageId: string; recipientId: string; prompt: string; status: 'QUEUED' | 'CLAIMED' | 'STARTED' | 'COMPLETED' | 'BLOCKED'; runId: string; leaseUntil: number; createdAt: number; startedAt?: number; progressAt?: number; output: string; blocker?: 'AUTH' | 'CREDITS' | 'NETWORK' | 'MODEL_CRASH' | 'TIMEOUT' | 'NO_ADAPTER' | 'SHUTDOWN'; }
export interface AutomaticRequest { scope?: CoordScope; action: 'REGISTER' | 'HEARTBEAT' | 'ENQUEUE' | 'ACK' | 'START' | 'PROGRESS' | 'BLOCK' | 'COMPLETE' | 'ACCEPT' | 'HANDOFF' | 'SUBMIT_ARTIFACT' | 'EVALUATE_GATE' | 'CREATE_CYCLE' | 'CREATE_GATE'; agentId: string; token: string; epoch?: number; taskId?: string; assignmentId?: string; capabilities?: string[]; role?: AutomaticRole; reviewOf?: string; targetAgentId?: string; notes?: string; evidence?: string[]; credits?: 'AVAILABLE' | 'EXHAUSTED'; model?: string; artifact?: Partial<Artifact>; gate?: Partial<Gate>; cycle?: Partial<Cycle>; }
export interface AutomaticSnapshot { managerId: string | null; epoch: number; role: AutomaticRole | 'MANAGER'; assignments: AutomaticWork[]; execution: 'TRANSPORT_ONLY_NO_MODEL_ADAPTER'; }
