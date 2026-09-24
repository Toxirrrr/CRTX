# AGENT OPS PLATFORM — AGENT ENGINEERING PROTOCOL (AEP)

**VERSION:** 1.0.0  
**STATUS:** CRTX ENGINEERING PROTOCOL  
**AUTHORITY:** Master Architect  
**CREATED:** 2026-09-10  
**SOURCE OF TRUTH:** `docs/active/` is canonical. Protocol cannot override `docs/active/`.

> **CRTX INTEGRATION:** This protocol is a mandatory extension layer inside the existing CRTX MAEP lifecycle. It does NOT replace the cycle. It adds mandatory gates within it. The canonical execution order is:
>
> `READ-ONLY DISCOVERY → ANALYSIS → CYCLE PLAN → VERIFICATION → EXECUTION → FINAL AUDIT`
>
> AEP gates slot into this cycle as defined in **Section 2** below.

---

## 0. FIRST PRINCIPLES

```
DO NOT OPTIMIZE FOR "TASK COMPLETED".

OPTIMIZE FOR:
  CORRECT + SAFE + PROVABLE + ARCHITECTURE-COMPLIANT + RECOVERABLE
```

- AEP is a **reproducible governance protocol**, not a cryptographic enforcement mechanism. Compliance is verified through evidence, not assumed by the existence of this file.
- A passing happy-path test is **not** proof of correctness.
- A clean report is **not** proof of correctness.
- Compilation is **not** proof of correctness.
- Source code truth is **not** proof of production runtime truth.

**PRODUCTION ADMISSION EQUATION (MANDATORY FOR DEPLOYMENT/RECOVERY TASKS):**
```
SOURCE TRUTH + BUILD TRUTH + IMAGE TRUTH + RUNTIME TRUTH + DATABASE/REDIS TRUTH = PRODUCTION ADMISSION
```
Only verified behavior + evidence across ALL layers + architecture compliance can justify completion.

---

## 1. SCOPE OF APPLICATION

This protocol applies to **every implementation task** in the Agent Ops Platform, regardless of:

- size (micro-fix, refactor, feature, recovery task)
- layer (backend, frontend, infrastructure, queue, database, realtime)
- urgency (including P0 incidents — protocol is not a bureaucratic delay; it is a risk control)

If a gate is skipped, the task **CANNOT be handed off** to Master Architect.

---

## 2. CRTX LIFECYCLE INTEGRATION MAP

```
CRTX PHASE                          AEP GATE(S) THAT EXECUTE HERE
─────────────────────────────────── ────────────────────────────────────────────────
READ-ONLY DISCOVERY                 GATE 0 — SCOPE LOCK
                                    GATE 1 — READ-ONLY RECON
                                    GATE 2 — ACTUAL EXECUTION PATH
─────────────────────────────────── ────────────────────────────────────────────────
ANALYSIS                            GATE 3 — ROOT CAUSE
                                    GATE 4 — FAILURE MODE MAP
─────────────────────────────────── ────────────────────────────────────────────────
CYCLE PLAN                          GATE 5 — ACCEPTANCE CONTRACT
─────────────────────────────────── ────────────────────────────────────────────────
VERIFICATION (pre-execution)        (Acceptance contract reviewed by Master Architect
                                    if task carries production risk)
─────────────────────────────────── ────────────────────────────────────────────────
EXECUTION                           GATE 6 — MINIMAL IMPLEMENTATION
─────────────────────────────────── ────────────────────────────────────────────────
FINAL AUDIT                         GATE 7 — NEGATIVE TESTING
                                    GATE 8 — ADVERSARIAL SELF-REVIEW
                                    GATE 9 — FINAL EVIDENCE AUDIT
                                    GATE 10 — HANDOFF TO MASTER ARCHITECT
─────────────────────────────────── ────────────────────────────────────────────────
```

---

## 3. DYNAMIC GATE ROUTING & PIPELINE OVERVIEW

To optimize AI performance and avoid bureaucratic overhead, the pipeline is dynamically routed based on task risk. Upon task assignment (in GATE 0), the AI must classify the task into one of three tracks and follow its optimized pipeline.

### 🟢 Track L1: Fast-Track (Low Risk)
**Applies to:** UI/UX changes, CSS, text modifications, isolated frontend components, pure aesthetic fixes.
**Required Gates:** (3 steps)
```
GATE 0 (Scope) -> GATE 6 (Implementation) -> GATE 10 (Handoff)
```
*(All other gates are implicitly marked N/A)*

### 🟡 Track L2: Standard (Medium Risk)
**Applies to:** Standard feature development, new CRUD endpoints, standard controllers, isolated business logic.
**Required Gates:** (7 steps)
```
GATE 0 (Scope) -> GATE 1 (Recon) -> GATE 3 (Root Cause) -> GATE 5 (Contract) -> GATE 6 (Implementation) -> GATE 9 (Final Evidence) -> GATE 10 (Handoff)
```
*(Gates 2, 4, 7, 8 are skipped unless the agent discovers unexpected complexity during Recon)*

### 🔴 Track L3: Deep Core (Critical Risk)
**Applies to:** DB Schema (Prisma), Auth, Tenant Isolation, Core Architecture, WebSockets, BullMQ Queues, Infrastructure.
**Required Gates:** (All 11 steps)
```
GATE 0 (Scope) -> GATE 1 (Recon) -> GATE 2 (Execution Path) -> GATE 3 (Root Cause) -> GATE 4 (Failure Mode Map) -> GATE 5 (Contract) -> GATE 6 (Implementation) -> GATE 7 (Negative Testing) -> GATE 8 (Adversarial Review) -> GATE 9 (Evidence) -> GATE 10 (Handoff)
```

No required gate may be silently skipped within its assigned track. If a required gate is not applicable, it must be explicitly marked `N/A — REASON: [...]`.

---

## 4. GATE 0 — SCOPE LOCK

**Executes in:** READ-ONLY DISCOVERY phase, before any file read or command.

### 4.0 Workspace & Branch Health Check (Branch Guardian)
Before locking scope, you **MUST** ensure the branch is clean and not abandoned by a previous agent crash.
Run:
```bash
cd crtx && npm run guardian
```
- If the tool reports stale tasks, you must ask the user whether to RESUME or ABORT.
- Do not proceed until the workspace is free of orphaned CRTX locks or dirty uncommitted changes.

### 4.1 Define and freeze the scope in writing:

```
Task:
Goal:
Dynamic Track: L1 (Fast) / L2 (Standard) / L3 (Core) - Reason:
In Scope:
Out of Scope:
Allowed files to modify:
Forbidden changes:
Dependencies (internal):
Dependencies (external / env):
Production impact: YES / NO
```

**Forbidden during any task execution:**

| Forbidden action | Reason |
|---|---|
| Scope expansion (scope creep) | Violates ONE TASK = ONE CLOSED CYCLE |
| Unrelated refactor | Violates Architectural Freeze |
| New features (beyond task goal) | Requires separate cycle |
| Speculative optimization | Untestable side effect risk |
| Architecture redesign | Requires Master Architect decision |
| Changing frozen architecture | Explicit prohibition |
| Creating temporary solutions | Leaves orphaned code in production |

**Principle:** `ONE TASK = ONE CLOSED ENGINEERING CYCLE`

---

## 5. GATE 1 — READ-ONLY RECON

**Executes in:** READ-ONLY DISCOVERY phase. **Code must NOT be modified until this gate is complete.**

Before touching any code, the agent MUST locate and verify:

| Item | Where to look |
|---|---|
| Source of truth for this task | `docs/active/`, `crtx/CONSTITUTION.md`, `CLAUDE.md` |
| Actual implementation | Source code (`server/src/`, `client/`) |
| Full dependency tree | Import graph, module registry |
| DB model (if relevant) | `server/prisma/schema.prisma` |
| Actual DB state vs schema | Run `\d tablename` on production replica if authorized |
| Tenant boundary | `@CurrentOrganizationId()`, guards, repository `scope()` |
| Authorization boundary | Guard stack: `JwtAuthGuard -> OrganizationGuard -> PermissionsGuard` |
| Redis / BullMQ / cache behavior | Queue definitions, worker handlers, Redis key patterns |
| Existing test coverage | `*.spec.ts`, `*.test.ts`, `e2e/` |
| Known UNKNOWNs | `docs/active/12_UNKNOWN_DECISION_REGISTER.md` |
| Production/runtime evidence | Logs, forensic output, if task is production-related |

**Gate 1 exit condition:** Agent can describe the actual system behavior from code, not from documentation assumption.

---

## 6. GATE 2 — ACTUAL EXECUTION PATH

**Executes in:** READ-ONLY DISCOVERY phase, after Gate 1.

Build the **full execution chain** for the feature under change. Do not limit to the named function.

### Backend chain template:
```
HTTP Request
-> Global JWT Guard
-> OrganizationGuard / AgentContractGuard
-> PermissionsGuard / RolesGuard
-> Controller (validate DTO)
-> Service (business logic)
-> Repository (this.scope(organizationId))
-> Prisma (DB query)
-> [Optional] BullMQ enqueue
-> [Optional] Worker: claim -> process -> persist -> ACK
-> [Optional] WebSocket emit (AFTER DB commit)
-> Response
```

### Frontend chain template:
```
User action / Page mount
-> Composable / Pinia store action
-> Service (apiClient call)
-> HTTP API (request)
-> API response (unwrapped by ResponseInterceptor)
-> State update (store mutation)
-> [Optional] WebSocket delta sync on reconnect
-> UI render / computed update
```

### Infrastructure chain template:
```
docker-compose config
-> container startup
-> volume mount
-> network connectivity
-> service dependency (healthcheck)
-> runtime environment
```

**For every step, document:**
- What it does
- What it assumes
- What it can fail on
- What side effect it produces

---

## 7. GATE 3 — ROOT CAUSE

**Executes in:** ANALYSIS phase.

**Do not fix the symptom. Identify and fix the root cause.**

```
Observed failure:
Actual root cause:
Evidence:
  - file:
  - line:
  - command:
  - output:
Affected execution path:
Why existing tests did NOT catch this:
```

If root cause is not determinable from available evidence:

```
ROOT CAUSE: UNKNOWN
Evidence gap:
Required evidence to determine:
Escalation: MASTER ARCHITECT DECISION REQUIRED
```

**UNKNOWN must never be converted to an assumption.**

---

## 8. GATE 4 — FAILURE MODE MAP

**Executes in:** ANALYSIS phase. This is a **mandatory gate** — no silent skip.

For each task, enumerate all applicable failure scenarios. For each:

```
Failure:
Impact:
Current behavior:
Expected behavior:
Data-loss risk: YES / NO
Tenant isolation risk: YES / NO
Recovery behavior:
Test required: YES / NO / N/A — REASON
```

### Universal failure matrix (check all applicable rows):

| # | Scenario |
|---|---|
| F-01 | NORMAL (happy path) |
| F-02 | NULL / nil input |
| F-03 | MISSING required field |
| F-04 | INVALID format / type |
| F-05 | DUPLICATE (idempotency) |
| F-06 | WRONG TENANT (cross-org input) |
| F-07 | UNAUTHORIZED (wrong role, no contract) |
| F-08 | DELETED ENTITY (soft-deleted target) |
| F-09 | STALE ENTITY (outdated reference) |
| F-10 | PARTIAL FAILURE (transaction incomplete) |
| F-11 | DEPENDENCY FAILURE (external service down) |
| F-12 | TIMEOUT (upstream slow) |
| F-13 | RETRY (message processed more than once) |
| F-14 | CRASH (process dies mid-operation) |
| F-15 | CONCURRENCY (parallel requests to same resource) |
| F-16 | RACE CONDITION (time-of-check to time-of-use) |
| F-17 | PARTIAL BATCH (some items succeed, some fail) |
| F-18 | EMPTY RESULT (valid query, no rows) |
| F-19 | MALFORMED INPUT (valid JSON, invalid semantics) |
| F-20 | ACK BEFORE DURABLE WRITE (phantom success) |

---

## 9. DATA LOSS RULE (P0 ABSOLUTE)

Any path matching this pattern is classified as **P0 DATA LOSS**:

```
INPUT -> silent skip -> success response -> ACK -> data disappears
```

This is a P0 blocker **even if** current production population does not contain such a payload.
Absence of bad input today does NOT make a destructive code path safe.

### Silent `continue` — forbidden pattern:

```typescript
// FORBIDDEN: silently discards item, then ACKs job as success
for (const item of batch) {
  if (!item.someField) continue;  // <- data gone, no trace
}
job.progress(100);  // <- success reported
await job.moveToCompleted('done', true);  // <- ACK
```

### Required disposition for every skipped item:

| Disposition | Allowed |
|---|---|
| PERSISTED | YES |
| RETRYABLE — moved to retry queue | YES |
| QUARANTINED — moved to DLQ with reason | YES |
| REJECTED_AND_PRESERVED — error logged with full payload | YES |
| SILENTLY_DISCARDED | NEVER |

---

## 10. SILENT SUCCESS RULE

A job/operation reporting success when an item was actually dropped is a **SILENT SUCCESS** — a form of data loss.

Requirements:
- Every skipped item must have an **explicit, persisted disposition**.
- ACK must only be sent **after** all dispositions are written durably.
- Any crash between processing and ACK must leave the item **recoverably in-flight**, not lost.

---

## 11. TENANT ISOLATION GATE

For **every backend task**, verify all isolation points:

| Point | What to verify |
|---|---|
| organizationId source | Must come from @CurrentOrganizationId() — never from client body/params alone |
| JWT / Contract verification | AgentContractGuard for Platform Agents; OrganizationGuard for tenant users |
| Repository scope | All queries use this.scope(organizationId) — never raw prisma.entity.findMany() |
| Redis keys | Must include org:{orgId}: prefix |
| BullMQ job data | Must carry organizationId; worker must verify before processing |
| WebSocket rooms | Must use RoomRegistry.liveMap(organizationId) — never global broadcast |
| Cache keys | Must be org-scoped |
| Cross-tenant input | Client-provided organizationId must be verified against JWT — never blindly trusted |
| Wrong-tenant behavior | Attempting another org resource must return 403 Forbidden, not 404 |

**Do NOT create a new tenant model.** Follow the existing contract:
`CurrentOrganization -> JWT/Contract verification -> Domain Guard -> Repository scope`

---

## 12. DATABASE GATE

Before modifying any DB-related code, verify:

- `server/prisma/schema.prisma` — declared schema
- Actual production schema (via authorized query) — runtime reality
- Repository logic — what the code actually queries
- Constraints: unique, FK, NOT NULL
- Indexes: covering, composite
- NULL semantics: nullable vs required
- Transaction behavior: atomicity, isolation level

Watch for **schema/code/DB divergence**:
```
schema says X
code does Y
DB does Z      <- must be found BEFORE implementation
```

### Forbidden DB actions (require explicit Master Architect authorization):

| Action | Status |
|---|---|
| prisma migrate | FORBIDDEN without explicit MA authorization |
| prisma db push | FORBIDDEN |
| DROP TABLE / TRUNCATE | ABSOLUTELY FORBIDDEN |
| ALTER TABLE (destructive) | ABSOLUTELY FORBIDDEN |
| prisma migrate reset | ABSOLUTELY FORBIDDEN on prod/staging |
| Adding new ShiftStatus enum | Requires MA decision (see U-06) |

---

## 13. QUEUE / REDIS GATE

For **every task touching BullMQ or Redis**, analyze the full job lifecycle:

```
CLAIM (worker picks up job)
-> PROCESS (business logic executes)
-> ENQUEUE (downstream jobs, if any)
-> PERSIST (write to DB)
-> ACK (job marked complete)
-> [Failure paths:]
-> RETRY (transient failure -> back in queue)
-> CRASH (process dies -> job reclaimed by next worker)
-> ORPHAN (job in limbo — what happens?)
-> RECLAIM (stale lock released, job re-processed)
-> DUPLICATE (same job processed twice — idempotency check)
-> CONCURRENCY (two workers process same data simultaneously)
```

**Prove** that ACK **never** means loss of the only copy of data.

Redis keys **must** follow org-scoped naming:
```
org:{orgId}:tracking:{entityId}
org:{orgId}:driver:{driverId}:status
```

---

## 14. GATE 5 — ACCEPTANCE CONTRACT

**Executes in:** CYCLE PLAN phase. Created before any code is written.

```
## Acceptance Contract — [Task Name]

### MUST PASS:
- [ ] [specific behavior]

### MUST NOT HAPPEN:
- [ ] [forbidden outcome]

### P0 BLOCKERS:
- [ ] [condition — if true, implementation is BLOCKED]

### P1 RISKS:
- [ ] [risk — must be documented, may not block if mitigated]

### REQUIRED TESTS:
- [ ] [test case]

### REQUIRED EVIDENCE:
- [ ] [evidence item — file / log / query output]
```

**Implementation is COMPLETE only when every contract item is fulfilled.**

### 14.1 Task Division & Swarm Delegation (1+2+3 Protocol)
If the task spans multiple domains (e.g. Frontend Component and Backend API), you MUST decompose it into CRTX subtasks and delegate to subagents using the 1+2+3 Protocol:
1. Register subtasks in CRTX (`POST /api/coordinator/tasks`).
2. Invoke Antigravity subagents in parallel (`Workspace: "share"`).
3. Route based on complexity (`pro` vs `flash`).
**Do not execute independent subtasks sequentially.**

---

## 15. GATE 6 — MINIMAL IMPLEMENTATION

**Executes in:** EXECUTION phase.

After analysis, choose the **smallest safe change** that fulfills the acceptance contract.

**Forbidden expansions during implementation:**

| Expansion | Action required |
|---|---|
| Agent discovers additional improvement | Log as OUT-OF-SCOPE FINDING — do NOT change code |
| Agent finds another bug | Log as UNRELATED FINDING — do NOT fix unless it blocks THIS task |
| Agent wants to refactor surrounding code | Forbidden — Architectural Freeze |

**Exception:** If an out-of-scope finding blocks safety or correctness of the current task, it becomes a blocker of the current cycle and must be resolved as part of it (documented, not silently fixed).

---

## 16. GATE 7 — NEGATIVE TESTING

**Executes in:** FINAL AUDIT phase.

Happy-path tests are necessary but insufficient. For every critical branch, negative tests must exist.

### Minimum test matrix:

| Case | Required |
|---|---|
| Valid input | YES |
| Invalid type | YES |
| Missing required field | YES |
| Null value | YES |
| Duplicate submission | YES (idempotency) |
| Wrong tenant (cross-org request) | YES |
| Soft-deleted entity | YES |
| Dependency failure (mocked) | YES |
| Retry scenario | YES |
| Concurrency / race condition | YES or N/A with documented reason |
| Partial batch failure | YES if applicable |

If a case is not applicable: `NOT APPLICABLE — REASON: [...]`

---

## 17. GATE 8 — ADVERSARIAL SELF-REVIEW

**Executes in:** FINAL AUDIT phase.

After implementation, the agent MUST switch mode:

```
ASSUME THE IMPLEMENTATION IS WRONG
```

Ask and answer each question with reference to **actual code** (not report):

| Question | Answer with file:line |
|---|---|
| Where can data be lost? | |
| Where can ACK happen before durable write? | |
| Where can there be a silent success (skip + OK)? | |
| Where can an error be swallowed? | |
| Where is cross-tenant access possible? | |
| Where can a duplicate be created? | |
| Where is a race condition possible? | |
| What happens on process crash? | |
| What happens on timeout? | |
| What happens with a soft-deleted entity? | |
| What happens with malformed input? | |
| What happens with a partial batch? | |
| What happens if a dependency is down? | |
| What happens on re-run / replay? | |
| What if a current UNKNOWN is a real production case? | |

Every answer must reference the actual implementation. If any answer reveals a risk — the item becomes a blocker **before** handoff.

---

## 18. CODE > REPORT RULE

```
If report says PASS
but source code contains an unsafe path
-> result is BLOCKED

If test says PASS
but source code contains an untested destructive branch
-> result is BLOCKED
```

**Report is never the source of truth. Code is.**

**Self-check question before handoff:**

> "If Master Architect opens source code instead of my report, will they find the same result?"

If the answer is **NO** -> **BLOCKED**.

---

## 19. UNKNOWN POLICY

An UNKNOWN is any behavior, data state, or system property that cannot be verified from available evidence.

| Action | Status |
|---|---|
| Ignore UNKNOWN | FORBIDDEN |
| Guess / assume UNKNOWN | FORBIDDEN |
| Treat as test data | FORBIDDEN |
| Treat as harmless | FORBIDDEN |
| Auto-migrate | FORBIDDEN |
| Auto-delete | FORBIDDEN |

Required handling:
```
UNKNOWN
  -> PRESERVE (do not touch)
  -> QUARANTINE / HOLD (separate, label)
  -> MASTER ARCHITECT DECISION
```

---

## 20. EVIDENCE STANDARD

Every claim that justifies a PASS verdict must have concrete evidence:

```
FACT:
  source:    [description]
  file:      [path]
  line:      [number]
  command:   [if applicable]
  result:    [exact output]
  timestamp: [ISO 8601]
```

**Forbidden as evidence basis:**

| Phrase | Status |
|---|---|
| "probably" | FORBIDDEN |
| "likely" | FORBIDDEN |
| "should be safe" | FORBIDDEN |
| "assumed" | FORBIDDEN |
| "I believe" | FORBIDDEN |

These phrases may appear in risk assessments. They must **never** be the reason for a PASS.

---

## 21. GATE 9 — FINAL EVIDENCE AUDIT

**Executes in:** FINAL AUDIT phase.

Before handing off, the AI MUST mathematically prove the code is not broken.
1. **Syntax & Build Check:** Run `npm run build` (or equivalent compiler check). Do NOT hand off code that does not compile.
2. **Orphan Code Check:** Ensure no fragmented code was left behind during deletions (e.g., hanging braces, missing imports, broken scope).
3. **Linting Check:** Run `npm run lint` to catch syntax or scope errors.

```
[ ] Syntax & Build successfully completed (NO compiler errors)
[ ] Orphan Code Check passed (No fragmented/broken deletions)
[ ] Scope respected (no scope expansion)
[ ] Architecture respected (no new patterns invented)
[ ] Code Truth verified (code matches report)
[ ] Runtime Truth verified (running artifact + config + dependencies + volumes + queue contract)
[ ] Tenant isolation verified at all points
[ ] RBAC verified for all affected endpoints
[ ] DB contract verified (schema vs code vs runtime)
[ ] Redis/BullMQ contract verified (ACK safety)
[ ] All failure modes addressed
[ ] Negative tests executed and passed
[ ] Adversarial self-review completed
[ ] No silent data loss paths exist
[ ] No silent success paths exist
[ ] No unauthorized mutation possible
[ ] No schema change (or explicitly authorized)
[ ] No unrelated refactor included
[ ] Build passes: npm run build
[ ] TypeScript passes: npm run type-check
[ ] Relevant tests pass (unit + integration)
[ ] Evidence captured for all PASS claims
[ ] All UNKNOWNs explicitly listed
```

---

## 22. GATE 10 — HANDOFF TO MASTER ARCHITECT

**Agent cannot self-authorize final acceptance.**

Allowed agent verdicts:

| Verdict | Meaning |
|---|---|
| IMPLEMENTATION_COMPLETE | Code written, all gates passed |
| VERIFICATION_COMPLETE | Implementation complete, tests executed |
| BLOCKED | Gate failed — cannot proceed without MA decision |

**Forbidden agent self-declarations:**

| Declaration | Status |
|---|---|
| MASTER_ARCHITECT_APPROVED | Agent cannot grant this |
| PRODUCTION_AUTHORIZED | Agent cannot grant this |
| MERGE_READY (without MA review) | Agent cannot grant this |

The agent MAY include:
```
RECOMMENDED_VERDICT: PASS / CONDITIONAL_PASS / FAIL
REASON: [...]
```

Final acceptance remains with Master Architect.

---

## 23. MANDATORY TASK REPORT FORMAT

Every completed task must produce this report. No exceptions.

```
# Task Report — [Task Name / ID]

TASK:
GOAL:
TRACK: L1 / L2 / L3

SCOPE:
  IN SCOPE:
  OUT OF SCOPE:

ROOT CAUSE:

ACTUAL EXECUTION PATH:

FAILURE MODE MAP:
  F-01 NORMAL:
  F-02 NULL:
  F-03 MISSING:
  F-04 INVALID:
  F-05 DUPLICATE:
  F-06 WRONG TENANT:
  F-07 UNAUTHORIZED:
  F-08 DELETED ENTITY:
  F-09 STALE ENTITY:
  F-10 PARTIAL FAILURE:
  F-11 DEPENDENCY FAILURE:
  F-12 TIMEOUT:
  F-13 RETRY:
  F-14 CRASH:
  F-15 CONCURRENCY:
  F-16 RACE CONDITION:
  F-17 PARTIAL BATCH:
  F-18 EMPTY RESULT:
  F-19 MALFORMED INPUT:
  F-20 ACK BEFORE DURABLE WRITE:

ACCEPTANCE CONTRACT:
  MUST PASS:
  MUST NOT HAPPEN:
  P0 BLOCKERS:
  P1 RISKS:

IMPLEMENTATION: [summary of what was changed and why]

FILES CHANGED:
  [file] — [change type] — [reason]

TESTS: [commands run, results]

NEGATIVE TESTS: [cases and outcomes]

ADVERSARIAL REVIEW:
  [per-question answers with file:line]

EVIDENCE:
  [per-claim: source / file / line / command / output / timestamp]

UNKNOWN:
  [list of UNKNOWNs, current disposition]

RISKS:
  [known risks, severity, mitigation]

UNRELATED FINDINGS:
  [out-of-scope issues found — NOT fixed]

REMAINING BLOCKERS:

RECOMMENDED VERDICT: PASS / CONDITIONAL_PASS / FAIL
REASON:

PRODUCTION MUTATION: YES / NO
RUNTIME TRUTH VERIFIED: YES / NO / N/A (mandatory if Production Mutation is YES)

MASTER ARCHITECT AUTHORIZATION REQUIRED: YES / NO
REASON:
```

---

## 24. AGENT OPS PLATFORM SPECIFIC RULES

Derived from canonical architecture documents. Non-negotiable.

### 24.1 Guard Stack (immutable order)
```
JwtAuthGuard -> OrganizationGuard / AgentContractGuard -> PermissionsGuard
```
Do not invent new guards if the existing stack suffices.

### 24.2 Repository Contract
```
ALL tenant queries: this.scope(organizationId)
NEVER:            prisma.entity.findMany() without organizationId
```

### 24.3 GPS Pipeline (immutable)
```
POST /tracking/batch
-> Redis HASH (transient state)
-> HTTP responds
-> BullMQ (durable queue)
-> PostGIS (DB write)
-> WebSocket emit (ONLY after DB commit)
```

### 24.4 WebSocket Emit Rule
```
Emit ONLY after DB commit succeeds.
Never emit speculatively.
```

### 24.5 Domain Separation (Architectural Freeze)
```
Driver != Agent
SALES != LOGISTICS != INVENTORY
Map registries: driverRegistry | salesAgentRegistry | storeRegistry | warehouseRegistry
  -> NEVER merged
```

### 24.6 StockMovement Rule
```
StockMovement is IMMUTABLE.
No direct quantity mutation without creating a StockMovement record.
No deletes.
```

### 24.7 Response Shape
```
Backend:  ResponseInterceptor wraps to { success, data }
Frontend: apiClient unwraps — do NOT write response.data.data
```

### 24.8 Localization (non-negotiable)
```
Currency:   UZS only
Phone:      +998 prefix only
Geography:  Tashkent, Uzbekistan
Timezone:   Asia/Tashkent
```

---

## 25. SELF-TEST: PROTOCOL ON THREE SYNTHETIC SCENARIOS

### SCENARIO A — Normal CRUD Task (Update Driver Status)

| Gate | Action |
|---|---|
| GATE 0 | Scope lock: only driver.status, only tenant endpoint. Forbidden: Agent.status. |
| GATE 1 | Recon: DriversRepository, this.scope(organizationId), PermissionsGuard, existing tests. |
| GATE 2 | Chain: PATCH /drivers/:id/status -> JwtAuthGuard -> OrganizationGuard -> PermissionsGuard -> DriversService -> DriversRepository.scope(orgId) -> prisma.driver.update. |
| GATE 3 | Root cause: document specifically. |
| GATE 4 | Failure map: null status, invalid enum, wrong org driver, deleted driver, concurrent updates. |
| GATE 5 | Contract: driver in org + valid status -> update; wrong org -> 403. |
| GATE 6 | Minimal: one field in existing service + repository method. |
| GATE 7 | Negative tests: wrong tenant 403, invalid status 422, deleted driver 404. |
| GATE 8 | Adversarial: verified no cross-domain mutation to Agent.status. |
| GATE 9 | Evidence audit complete. |
| GATE 10 | Handoff. RECOMMENDED_VERDICT: PASS. |

**Result:** Task completes cleanly.

---

### SCENARIO B — Tenant Isolation Violation Attempt

**Proposed:** shared dashboard endpoint returning all organizations' data.

| Gate | What stops it |
|---|---|
| GATE 0 | BLOCKED. Scope Lock: cross-org data. Platform vs Organization context separation is explicit. |
| GATE 2 | Execution path would bypass OrganizationGuard — architectural violation. |
| GATE 4 | F-06 (WRONG TENANT) — every non-platform request exposes cross-org data. |
| GATE 5 | Contract MUST NOT HAPPEN: cross-org data in response. Cannot be fulfilled. |

**Outcome:** BLOCKED at GATE 0 / GATE 5.
`MASTER ARCHITECT AUTHORIZATION REQUIRED: YES`
Agent reports finding, does NOT implement.

---

### SCENARIO C — Queue Recovery with Silent Data Loss

**Found in code:**
```typescript
for (const point of gpsPoints) {
  if (!point.driverId) continue;  // SILENT DISCARD
}
await job.moveToCompleted('done', true);  // ACK — data gone
```

| Gate | What stops it |
|---|---|
| GATE 2 | Execution path traced: claim -> loop -> silent skip -> ACK. Data loss identified. |
| GATE 3 | Root cause: continue before write — unprocessed items never persisted. |
| GATE 4 | F-17 (PARTIAL BATCH) + F-20 (ACK BEFORE DURABLE WRITE): P0. |
| GATE 5 | Contract MUST NOT HAPPEN: ACK before all items have explicit disposition. Contract fails. |
| GATE 8 | Adversarial: "Where can data be lost?" answered with file:line. |

**Outcome:** BLOCKED at GATE 4 / GATE 5.
Fix required: replace continue with quarantine + DLQ write before ACK.
Task is NOT declared complete until adversarial review passes on the fix.

---

## 26. DISCREPANCIES NOTED (CODE TRUTH vs DOCUMENTATION)

| # | Discrepancy | Finding |
|---|---|---|
| D-01 | 00_READ_FIRST.md references 02_MASTER_ARCHITECTURE.md, 03_BUSINESS_ARCHITECTURE.md, 04_OWNERSHIP_AND_SECURITY.md | These files do NOT exist. Actual docs use different numbering: 02_DATABASE_SCHEMA.md, 04_BACKEND_ARCHITECTURE.md, 05_FRONTEND_ARCHITECTURE.md. Documentation drift. |
| D-02 | AGENTS.md referenced in CLAUDE.md and 01_PROJECT_CONSTITUTION.md | File does NOT exist at project root. |
| D-03 | crtx/CONSTITUTION.md referenced as primary source | File exists but could not be read during protocol creation (encoding issue). Content is proxied through crtx/policies/skills/ documents. |

**Resolution:** Logged per UNKNOWN POLICY. No files modified. MA decision required on D-01 and D-02.

---

## 27. INTEGRATION STEPS (NOT EXECUTED — FOR MA REVIEW)

Recommended minimal changes to connect this protocol to agent discovery. NOT executed by this task.

### Option A — Add reference to CLAUDE.md (recommended)
In section `## Runtime Info`, add:
```
- Engineering Protocol: Read `crtx/AGENT_ENGINEERING_PROTOCOL.md` before implementing any task.
```

### Option B — Add reference to docs/active/01_PROJECT_CONSTITUTION.md
Under `## AI Operating Rules (CRTX MAEP)`, add:
```
6. **Mandatory Engineering Gates:** Follow `crtx/AGENT_ENGINEERING_PROTOCOL.md` for all implementation tasks.
```

### Option C — Register as CRTX policy skill
Create `crtx/policies/skills/agent-engineering-protocol.md` as an ID-only reference pointing to this file.

**Master Architect selects which options to activate.**

---

## APPENDIX: QUICK REFERENCE CARD

```
+-----------------------------------------------------+
|       AEP QUICK REFERENCE — AGENT OPS PLATFORM      |
+------+----------------------------------------------+
| G-0  | SCOPE LOCK — freeze scope before reading     |
| G-1  | READ-ONLY RECON — no code until done         |
| G-2  | EXECUTION PATH — full chain, every side fx   |
| G-3  | ROOT CAUSE — not symptom, actual cause       |
| G-4  | FAILURE MAP — 20 scenarios, mandatory        |
| G-5  | ACCEPTANCE CONTRACT — before any code        |
| G-6  | MINIMAL IMPL — smallest safe change          |
| G-7  | NEGATIVE TESTS — unhappy paths required      |
| G-8  | ADVERSARIAL REVIEW — assume you are wrong    |
| G-9  | EVIDENCE AUDIT — code > report               |
| G-10 | HANDOFF — agent cannot self-authorize        |
+------+----------------------------------------------+
| P0 RULES (any violation = BLOCKED)                   |
|   Silent data loss          -> BLOCKED               |
|   ACK before durable write  -> BLOCKED               |
|   Cross-tenant data access  -> BLOCKED               |
|   Schema change without MA  -> BLOCKED               |
|   Report != Code            -> BLOCKED               |
+-----------------------------------------------------+
| UNKNOWN -> PRESERVE -> QUARANTINE -> MA DECISION     |
| PASS requires: evidence + tests + adversarial review |
| Final acceptance: MASTER ARCHITECT ONLY              |
+-----------------------------------------------------+
```
