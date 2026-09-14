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
