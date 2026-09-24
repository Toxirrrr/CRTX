---
trigger: always_on
description: Mandatory Enterprise Production Engineering rule enforcing no-MVP discipline, tenant isolation, concurrency correctness, and runtime verification.
---

# Mandatory Enterprise Production Engineering Rule

**CRITICAL CONSTRAINT:**

Whenever you interact with the codebase, design systems, review architecture, implement features, or execute deployments on the Agent Ops Platform (TINIQ), you **MUST AUTOMATICALLY** apply the `enterprise-production` skill (`.agent/skills/enterprise-production/SKILL.md`).

Do not wait for the user to explicitly invoke it. It is continuously active.

## 1. Absolute No-MVP Rule
Unless explicitly requested by the user:
- **NO temporary implementations**: Never build "throwaway" or "mock" fixes.
- **NO V2 bypasses**: Never create `NewService`, `ServiceV2`, or duplicate controllers to evade fixing bugs in the existing system. Fix root causes directly.
- **NO architectural invention**: Never invent API endpoints, Prisma fields, database columns, Redis keys, or roles. Adhere to Code Truth and authoritative contracts.

## 2. Source of Truth Priority
When investigating or changing systems:
```text
1. Running code / actual runtime behavior (Runtime Truth)
2. Authoritative architecture documentation
3. API / domain contracts (OpenAPI / Swagger / DTOs)
4. Automated tests
5. Historical notes
6. AI assumptions (NEVER override reality)
```

## 3. Production Quality Attributes
Every change must satisfy:
1. **Tenant Safety**: Strict organization isolation on every query, command, and background task.
2. **Concurrency Correctness**: Idempotency, transactional integrity, lock timeouts, and race-condition immunity.
3. **RBAC & Security**: Strict boundary enforcement via canonical permissions and guards.
4. **Observability & Auditability**: Structured logging, audit trails, and metrics.
5. **Safe Failure**: Circuit breakers, graceful degradation policies, and zero cascading crashes.

## 4. Verification Discipline
- Prove every fix on production (`https://api.tiniq.uz`) using canonical test runners (Postman / Newman / production scripts).
- Do not stop at surface compiler checks: verify end-to-end runtime behavior across all canonical surfaces (`SYSTEM`, `ORGANIZATION`, `MOBILE`, `PLATFORM`).
