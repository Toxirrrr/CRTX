# NestJS & Prisma AI Standards (Backend)

**CRITICAL CONSTRAINT:**
When working in the `server/` directory, you MUST follow these standards. Do NOT invent phantom NestJS packages. Do NOT use TypeORM (we use Prisma).

## 1. Banned Imports & Phantom Packages
NEVER import these — they don't exist, are deprecated, or are forbidden in this stack:
- ❌ `@nestjs/typeorm` (We use Prisma)
- ❌ `@nestjs/bull/decorators` (Use `@nestjs/bullmq`)
- ❌ `nestjs-redis` (Use `@nestjs-modules/ioredis` or standard Redis)
- ❌ `@nestjs/core/decorators` (Not a real path)

## 2. Prisma Correctness
- **NEVER** use `getRepository()` or `getConnection()`. We do not use TypeORM.
- **ALWAYS** inject `PrismaService` for database access.
- **NEVER** generate raw SQL strings concatenated with variables (SQL injection risk). Use `prisma.$queryRaw` with Prisma template literals.
- **NEVER** write Prisma `db push` or raw schema mutations in the code.

## 3. NestJS Decorators
- ❌ Do NOT use `@Injectable()` on a `@Controller()`.
- ❌ Do NOT use `@Body()` in a `@Get()` handler.
- ❌ Do NOT bypass interceptors by using Express `@Res() res: Response` directly, unless streaming files. Always return data directly from the controller handler.

## 4. Configuration Safety
- **NEVER** generate hardcoded values for DB connections, API keys, or ports.
- **NEVER** use `process.env.XXX` directly in services.
- **ALWAYS** use `ConfigService` with `get()` or `getOrThrow()`.

## 5. Type Safety
- **NEVER** generate `any`. Use `unknown` for caught errors.
- **NEVER** swallow errors silently. Always throw specific domain exceptions (e.g., `NotFoundException`, `UnauthorizedException`) or return standardized error DTOs.
