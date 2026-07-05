# Capsule: Security Audit Request

Task: T003
Capability: Security Review

## Context
The `implementation` agent (Claude 3.5 Sonnet) has finished writing the RBAC middleware. The codebase now requires a strict `security_review` capability before it can move to `architecture_review`.

## Artifacts to Review
- Code implemented: See `evidence/E003-implementation.md`.

## Instructions for Security Agent
You are the designated Security Reviewer. Your goal is to find vulnerabilities in the provided evidence.

Please review the code carefully:
1. Does the fallback to 'Viewer' pose a privilege escalation risk?
2. What happens if the `requiredRole` is an array? Does this code support multiple roles?
3. What happens if `req.user` is entirely undefined?

**Action Required:**
Analyze the code, write your findings into a new evidence file (`E003-security-audit.md`), and update the task status in `tasks/T003-secure-auth.json` to move to the next capability (`architecture_review`).
