---
trigger: always_on
description: Hard prohibition against creating auxiliary AI helper scripts (.js, .ts, .py, .sh, or inline node -e programs).
---

# ABSOLUTE RULE — NO AI HELPER SCRIPTS

AI/Agent MUST NOT create auxiliary scripts for inspecting, auditing, fixing,
migrating, generating, transforming, or validating the repository.

This is a HARD PROHIBITION.

## FORBIDDEN

The agent MUST NOT create files such as:

- audit-*.js
- audit-*.ts
- check-*.js
- check-*.ts
- fix-*.js
- fix-*.ts
- migrate-*.js
- migrate-*.ts
- scan-*.js
- scan-*.ts
- analyze-*.js
- analyze-*.ts
- generate-*.js
- generate-*.ts
- validate-*.js
- validate-*.ts
- temp-*.js
- tmp-*.js
- *.py
- *.sh
- one-off codemods
- one-off migration helpers
- temporary repository scanners
- AI-only debugging scripts
- AI-only data extraction scripts
- AI-only Swagger/OpenAPI audit scripts
- AI-only Prisma analysis scripts
- AI-only refactoring scripts

Example of explicitly forbidden behavior:

    scripts/audit-swagger.js
    scripts/fix-imports.js
    scripts/find-prisma-usage.js
    scripts/generate-swagger-tags.js
    scripts/check-routes.py

The agent MUST NOT create a script just because it is easier than inspecting
and editing the actual code.

## NO INLINE SCRIPT WORKAROUNDS

The prohibition also includes hiding temporary scripts inside commands such as:

    node -e '...large program...'
    python - <<'PY'
    ...
    PY

or large heredoc programs used as temporary audit/fix tooling.

Do not bypass this rule by executing generated code without saving it to disk.

Small standard shell commands for inspection are allowed, for example:

    rg
    grep
    find
    git grep
    git diff
    git status
    sed for read-only display
    cat
    head
    tail
    jq
    npm scripts already present in the repository
    npx tools already declared/used by the project
    tsc
    eslint
    jest
    prisma validate
    prisma generate

But the agent MUST NOT assemble these into a new custom program whose purpose
is to perform the agent's work automatically.

## REQUIRED WORKING METHOD

The agent must work directly with Code Truth.

Required workflow:

1. Inspect the real source files.
2. Inspect existing package.json scripts.
3. Inspect existing configuration.
4. Inspect controllers/services/repositories/modules directly.
5. Identify the root cause.
6. Edit the actual production source files.
7. Run existing project validation commands.
8. Review the resulting diff.
9. Fix remaining defects directly.
10. Repeat until verification passes.

The agent itself must perform the reasoning and edits.

Do NOT delegate reasoning to a newly-created script.

## EXISTING PROJECT SCRIPTS

Existing repository scripts are NOT automatically forbidden.

The agent MAY use an existing script if:

- it already belongs to the project;
- it has a legitimate production/development purpose;
- it was not created merely to help the current AI task.

Examples:

    deploy.js
    existing migration tooling
    existing build scripts
    existing CI scripts
    existing backup/restore scripts

Do not delete or rewrite legitimate existing scripts solely because of this rule.

## CREATION OF NEW PRODUCT SCRIPTS

A new script may be created ONLY when the script itself is an explicit
product/infrastructure deliverable requested by the user.

Examples:

- production deployment script explicitly requested by the user
- backup automation explicitly requested by the user
- CI/CD entrypoint explicitly requested by the user
- operational maintenance utility explicitly approved as architecture

Before creating such a script, the task must explicitly require that script
as a persistent project artifact.

If the script exists only to help the AI inspect/fix the current task:

FORBIDDEN.

## SWAGGER SPECIFIC RULE

For Swagger/OpenAPI work:

DO NOT create:

    audit-swagger.js
    generate-swagger.js
    rewrite-tags.js
    swagger-fix.js

Instead:

- inspect controllers directly;
- inspect @ApiTags / decorators directly;
- inspect Swagger bootstrap directly;
- edit actual decorators/infrastructure directly;
- run the project's existing build/typecheck/tests;
- inspect generated OpenAPI using existing project/runtime mechanisms.

Swagger architecture must live in real application code, not in AI audit scripts.

## BACKEND AUDIT SPECIFIC RULE

For backend audits:

DO NOT create scanner scripts to discover:

- PrismaService usage
- controllers
- routes
- permissions
- guards
- DTOs
- module providers
- imports
- WebSocket events

Use repository search and direct source inspection.

Then fix the real files.

## CLEANUP

If an AI-created helper script from previous work is discovered and it has no
legitimate project/runtime purpose:

1. inspect it first;
2. confirm nothing depends on it;
3. delete it;
4. verify build/tests afterward.

Do not retain AI-generated audit artifacts in production code.

## FINAL REPORT REQUIREMENT

At the end of every engineering task report:

AI_HELPER_SCRIPTS_CREATED = 0

If this value is not 0, the task is NOT complete unless the user explicitly
requested creation of that persistent script.

HARD RULE:

AI must solve the task itself.
AI must not write another program to solve the task for it.
