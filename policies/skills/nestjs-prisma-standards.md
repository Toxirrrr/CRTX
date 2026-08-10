---
description: Official NestJS and Prisma backend coding standards from the web.
globs: server/**/*.ts
alwaysApply: true
id: nestjs-prisma-standards
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
# NestJS & Prisma Best Practices (Community Standard)

- **Architecture Rules**: Strictly enforce the use of Modules, Controllers, Services, and DTOs. Keep business logic out of controllers.
- **Type Safety**: Strictly FORBID the use of `any`. Require strict TypeScript configurations and explicit return types for all controller and service functions.
- **Prisma Patterns**:
  - Mandate the use of a singleton pattern / injectable `PrismaService` to prevent connection exhaustion during hot reloads.
  - Prohibit raw SQL queries (prefer Prisma methods like `findMany`, `update`).
- **DTO Validation**: Require `class-validator` and `class-transformer` for all incoming DTOs in controllers.
- **Security**: Require explicit Authorization guards on all protected routes. Do not expose sensitive fields (like passwords or hashes) in API responses.
