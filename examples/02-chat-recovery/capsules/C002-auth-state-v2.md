# Capsule: Authentication Refactor State

Task: T002
Timestamp: 2026-07-06T14:22:10Z

## Context
We are migrating from Express session-based auth to stateless JWT. The session is interrupted, but work is partially completed.

## Decisions Made
- Use `RS256` for JWT signing (not `HS256`).
- Tokens expire in 15 minutes. Refresh tokens are stored in the database.
- We must maintain the `/api/v1/login` endpoint exactly as it is for legacy mobile clients (they expect a `Set-Cookie` header).

## Work Completed Before Interruption
- [x] Researched legacy auth payload structure.
- [x] Generated RSA key pair for development environment.
- [x] Implemented `JwtService` class with sign and verify methods.
- [x] Created `auth.middleware.ts` to validate Bearer tokens.

## Work Remaining (TODO)
- [ ] Connect `JwtService` to the `/api/v2/login` endpoint.
- [ ] Implement the database schema for the `RefreshToken` entity (PostgreSQL/Prisma).
- [ ] Write a backward-compatibility wrapper for `/api/v1/login` to issue both a JWT and a legacy Cookie.
- [ ] Ensure all 14 unit tests pass.

## Known Constraints
- Do not modify `user.repository.ts`.
- The v1 mobile app will break if the `session_id` cookie is missing from the login response.

**Instruction for Next Agent:**
Read this capsule, look at the TODO list, and immediately begin implementing the `RefreshToken` Prisma schema and the `/api/v2/login` controller. You do not need to repeat the architectural research.
