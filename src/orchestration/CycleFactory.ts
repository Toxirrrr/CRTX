import { Cycle, CycleState } from './types';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// CycleFactory — единственная точка создания и валидации объектов Cycle.
// Никакой другой модуль не должен создавать Cycle вручную или через as-cast.
//
// Правило: LegacyImporter/LegacyExporter — единственные внешние потребители
// этого класса. Внутри router/planner/executor только CycleFactory.create()
// или CycleFactory.parse().
// ---------------------------------------------------------------------------

const VALID_CYCLE_STATES: CycleState[] = [
  'PENDING', 'INITIALIZING', 'RUNNING', 'VALIDATING',
  'QA_REVIEW', 'ROLLING_BACK', 'RECOVERING', 'COMPLETED', 'FAILED'
];

export interface CycleParseResult {
  ok: true;
  cycle: Cycle;
}

export interface CycleParseError {
  ok: false;
  errors: string[];
}

export type CycleParseOutcome = CycleParseResult | CycleParseError;

// ---------------------------------------------------------------------------
// parse — validates an unknown value and returns Cycle or errors.
// Use this instead of `JSON.parse(...) as Cycle`.
// ---------------------------------------------------------------------------
export function parse(raw: unknown): CycleParseOutcome {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['Input is not an object'] };
  }

  const r = raw as Record<string, unknown>;

  // --- Required scalar fields ---
  if (typeof r['objective'] !== 'string' || r['objective'].trim() === '') {
    errors.push('objective: required string');
  }

  // --- scope ---
  if (typeof r['scope'] !== 'object' || r['scope'] === null) {
    errors.push('scope: required object');
  } else {
    const scope = r['scope'] as Record<string, unknown>;
    if (!Array.isArray(scope['include'])) errors.push('scope.include: must be string[]');
    if (!Array.isArray(scope['exclude'])) errors.push('scope.exclude: must be string[]');
  }

  // --- budget ---
  if (typeof r['budget'] !== 'object' || r['budget'] === null) {
    errors.push('budget: required object');
  } else {
    const budget = r['budget'] as Record<string, unknown>;
    if (typeof budget['maxHours'] !== 'number') errors.push('budget.maxHours: must be number');
    if (typeof budget['maxFiles'] !== 'number') errors.push('budget.maxFiles: must be number');
    if (typeof budget['maxModules'] !== 'number') errors.push('budget.maxModules: must be number');
  }

  // --- execution ---
  if (typeof r['execution'] !== 'object' || r['execution'] === null) {
    errors.push('execution: required object');
  } else {
    const execution = r['execution'] as Record<string, unknown>;
    if (typeof execution['sourceAgent'] !== 'string') errors.push('execution.sourceAgent: must be string');
    if (typeof execution['targetAgent'] !== 'string') errors.push('execution.targetAgent: must be string');
    if (
      typeof execution['status'] !== 'string' ||
      !VALID_CYCLE_STATES.includes(execution['status'] as CycleState)
    ) {
      errors.push(`execution.status: must be one of ${VALID_CYCLE_STATES.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // --- Build validated Cycle with defaults ---
  const scope = r['scope'] as { include: string[]; exclude: string[] };
  const budget = r['budget'] as { maxHours: number; maxFiles: number; maxModules: number };
  const execution = r['execution'] as { status: CycleState; sourceAgent: string; targetAgent: string; payload?: Record<string, unknown> };
  const now = new Date().toISOString();

  const cycle: Cycle = {
    id: (typeof r['id'] === 'string' && r['id'].trim() !== '') ? r['id'] : uuidv4(),
    missionId: (typeof r['missionId'] === 'string') ? r['missionId'] : 'unknown-mission',
    objective: (r['objective'] as string).trim(),
    scope: {
      include: scope.include.filter((x): x is string => typeof x === 'string'),
      exclude: scope.exclude.filter((x): x is string => typeof x === 'string'),
    },
    budget: {
      maxHours: budget.maxHours,
      maxFiles: budget.maxFiles,
      maxModules: budget.maxModules,
    },
    constraints: Array.isArray(r['constraints'])
      ? (r['constraints'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    risk: (typeof r['risk'] === 'string') ? r['risk'] : 'UNKNOWN',
    definitionOfDone: Array.isArray(r['definitionOfDone'])
      ? (r['definitionOfDone'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    qualityGates: Array.isArray(r['qualityGates'])
      ? (r['qualityGates'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    execution: {
      status: execution.status,
      sourceAgent: execution.sourceAgent,
      targetAgent: execution.targetAgent,
      payload: (typeof execution.payload === 'object' && execution.payload !== null)
        ? execution.payload as Record<string, unknown>
        : {},
    },
    evidence: Array.isArray(r['evidence'])
      ? (r['evidence'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    artifacts: Array.isArray(r['artifacts'])
      ? (r['artifacts'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    audit: (typeof r['audit'] === 'object' && r['audit'] !== null) ? r['audit'] as Record<string, unknown> : {},
    releaseDecision: (typeof r['releaseDecision'] === 'string') ? r['releaseDecision'] : 'PENDING',
    createdAt: (typeof r['createdAt'] === 'string') ? r['createdAt'] : now,
    updatedAt: (typeof r['updatedAt'] === 'string') ? r['updatedAt'] : now,
  };

  return { ok: true, cycle };
}

// ---------------------------------------------------------------------------
// create — factory for creating new Cycles from known values.
// Use when constructing a Cycle in code (not from external input).
// ---------------------------------------------------------------------------
export function create(
  params: {
    missionId: string;
    objective: string;
    sourceAgent: string;
    targetAgent: string;
    risk?: string;
    scope?: { include: string[]; exclude: string[] };
    budget?: { maxHours: number; maxFiles: number; maxModules: number };
    payload?: Record<string, unknown>;
  }
): Cycle {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    missionId: params.missionId,
    objective: params.objective,
    scope: params.scope ?? { include: [], exclude: [] },
    budget: params.budget ?? { maxHours: 1, maxFiles: 10, maxModules: 1 },
    constraints: [],
    risk: params.risk ?? 'UNKNOWN',
    definitionOfDone: [],
    qualityGates: [],
    execution: {
      status: 'PENDING',
      sourceAgent: params.sourceAgent,
      targetAgent: params.targetAgent,
      payload: params.payload ?? {},
    },
    evidence: [],
    artifacts: [],
    audit: {},
    releaseDecision: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
}
