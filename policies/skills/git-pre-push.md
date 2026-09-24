---
trigger: always_on
description: Hard pre-push validation gate requiring lint, typecheck, and tests before git push.
---

# GIT PRE-PUSH — HARD VALIDATION GATE

PROJECT MODE: ENGINEERING_GUARDRAIL

## PURPOSE

Prevent unvalidated commits from being pushed to the remote repository.

This is a repository safety rule.

It does not replace the CRTX engineering cycle.

---

# HARD RULE

Before executing:

`git push`

the agent MUST validate the exact commits that are about to be pushed.

A push MUST NOT happen when validation is incomplete.

---

# REQUIRED CHECKS

Before push:

## 1. Repository State

Run:

`git status --short`

`git diff --check`

Confirm:

* no unintended files;
* no merge conflicts;
* no temporary files;
* no debug artifacts;
* no generated junk.

---

# 2. Commit Scope

Determine exactly which commits will be pushed.

Review:

* commit range;
* changed files;
* diff/stat;
* relevant commit messages.

Do not validate only the working tree when the push contains already-created commits.

---

# 3. Changed-Code Review

Inspect all files changed by the commits being pushed.

Check:

* syntax;
* imports;
* types;
* logic;
* error handling;
* configuration;
* environment assumptions;
* security implications.

---

# 4. Architecture Validation

For touched code verify:

* existing architecture is preserved;
* no unauthorized architectural pattern;
* no unrelated refactoring;
* no new temporary implementation;
* no planned rewrite introduced.

Follow the project Constitution.

---

# 5. DATABASE SAFETY

If the commit touches:

* Prisma;
* database code;
* migrations;
* Docker database configuration;
* database volumes;

perform an additional database-safety review.

Never push an unverified production database configuration.

Schema changes and migrations require explicit Master Architect authorization.

---

# 6. TENANT / RBAC SAFETY

If backend authorization or tenant-owned functionality is touched, verify:

* organizationId scoping;
* JWT context;
* guards;
* repository scoping;
* RBAC behavior;
* cross-tenant isolation.

Never push a change that bypasses tenant isolation or RBAC.

---

# 7. BUILD / TYPECHECK / TEST

Run the project's applicable validation commands.

At minimum, when applicable:

* lint;
* typecheck;
* build;
* unit tests;
* relevant integration/E2E tests.

Do not invent commands.

Use the repository's existing package scripts and documented validation workflow.

If a required validation cannot be executed:

STATUS = BLOCKED

Do not push.

---

# 8. PRODUCTION CONFIGURATION

If infrastructure/deployment files are modified, additionally validate:

* Docker Compose configuration;
* service names;
* environment variables;
* volume mappings;
* network configuration;
* exposed ports;
* healthchecks;
* dependency ordering;
* deployment scripts.

For database volumes, verify the intended persistent volume identity explicitly.

A successful Docker build is NOT sufficient evidence of deployment correctness.

---

# 9. RUNTIME VALIDATION

If the task is a production/runtime fix, perform the appropriate runtime smoke test before push.

Examples:

* API health;
* Worker processing;
* Realtime connection;
* queue processing;
* routing/OSRM;
* production ingress;
* database connectivity.

Do not claim runtime validation from static inspection alone.

---

# 10. FINAL DIFF CHECK

Before push:

`git diff --check`

Then inspect the exact commit diff that will be pushed.

Confirm:

* only intended files;
* only intended behavior;
* no accidental secrets;
* no credentials;
* no local paths;
* no debug code;
* no temporary test artifacts.

---

# PUSH DECISION

## PASS

Push is allowed only when:

* commit scope is understood;
* required validation passed;
* no release blocker exists;
* no unauthorized schema/migration change exists;
* no tenant/RBAC regression exists;
* production configuration is validated when applicable;
* workspace is clean.

## BLOCKED

Do NOT push if:

* build fails;
* required tests fail;
* validation was skipped;
* production configuration is unverified;
* database volume identity is uncertain;
* schema/migration authorization is missing;
* tenant isolation is uncertain;
* merge conflict exists;
* secrets or temporary artifacts are present;
* a release-blocking defect is discovered.

---

# SELF-CORRECTION

If validation discovers a defect:

STOP.

Do not push.

Fix the defect within the current authorized task scope.

Then repeat the complete validation sequence.

Do not bypass a failed gate merely to complete the push.

---

# IMPORTANT

This rule does NOT authorize:

* new features;
* architecture changes;
* schema migrations;
* destructive database operations;
* unrelated refactoring.

Authorization still comes from the active project task and Master Architect.

The rule only defines the minimum safety gate before git push.

---

# REQUIRED FINAL RECORD

Before push, record internally:

STATUS:
PASS / BLOCKED

VALIDATION:
...

COMMIT RANGE:
...

CHANGED FILES:
...

TESTS:
...

BUILD:
...

RUNTIME:
...

RISKS:
...

PUSH:
ALLOWED / BLOCKED
