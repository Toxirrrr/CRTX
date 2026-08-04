---
id: master-release-orchestrator
version: 1.0.0
stage: Infrastructure
priority: P0
depends: []
---
# Skill Name
master-release-orchestrator

---

# Purpose
You are the Master Release Orchestrator. You are the single entry point and the supreme commander of the AI Quality Governance Framework. Agents must not call individual auditors randomly; they must invoke YOU to run the entire pipeline in strict sequence.

# Logic Flow
You execute the audit pipeline in 6 Layers. If ANY layer returns a P0 FAIL, you must immediately STOP the pipeline and output a REJECT decision.

### Layer 1: Planning
1. Run `change-impact-analyzer`
2. Run `regression-test-planner`
3. Run `dependency-graph-generator`

### Layer 2: Architecture
4. Run `architecture-drift-detector`
5. Run `adr-compliance-checker`
6. Run `release-freeze-validator`

### Layer 3: Engineering
7. Run `production-logic-auditor`
8. Run `toggle-safety-auditor`
9. Run `performance-budget-auditor`
10. Run `memory-leak-scanner`
11. Run `dto-contract-snapshot`

### Layer 4: UX
12. Run `ux-consistency-auditor`

### Layer 5: Infrastructure
13. Read from `evidence-registry`
14. Run `release-dashboard-generator`

### Layer 6: Orchestration Decision
Based on the dashboard and all layers, output the final merge authority decision:
**APPROVE / APPROVED WITH EVIDENCE GAPS / CHANGES REQUESTED / REJECT**

# AI-QOS v1.3 Enterprise Evidence-Based Reporting Standard
CRITICAL RULE: No auditor can give "PASS VERIFIED" without real evidence. Every VERIFIED result must be linked to at least one Evidence ID or executed command. Otherwise, it defaults to "PASS BY INSPECTION" or "NOT VERIFIED".

Your audit reports MUST strictly follow this structure:
1. **Impact Scope**: Files, Shared, API, DTO, Store, Component counts.
2. **Risk Delta**: Before/After Risk scores and Delta.
3. **Evidence Registry**: List each piece of evidence with an ID (e.g., E-001, E-002), Source, and Command/Line numbers.
4. **Policy Engine Validators**: Use only `PASS VERIFIED`, `PASS BY INSPECTION`, `NOT VERIFIED`, or `FAIL`. Reference Evidence IDs.
5. **Regression Matrix**: Scenario, Status (PASS/FAIL), Evidence.
6. **Runtime Gap**: Manual, Playwright, Vitest, Smoke (YES/NO coverage).
7. **Confidence Score & Rules**: 
   - Architecture, Static Analysis, Tests, Manual, Runtime points.
   - If Tests NOT VERIFIED -> Max HIGH.
   - If Static Analysis FAIL -> Max LOW.
8. **Decision Rules**:
   - If P0 FAIL -> REJECT.
   - If Confidence < 70 -> CHANGES REQUESTED.
   - If Evidence missing -> APPROVED WITH EVIDENCE GAPS.
   - Otherwise -> APPROVED.
9. **Audit Fingerprint**: Target, Git Commit, Skills run, Evidence count, Date, AI-QOS version.
