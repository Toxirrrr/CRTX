# Workspace Cleanliness & Root Directory Rule

**CRITICAL CONSTRAINT:**
You MUST NOT create, generate, or dump any new files into the root directory of the workspace (`/`).

## 1. The Root is Sacred
The root directory is strictly reserved for:
- Standard framework configuration files (`package.json`, `tsconfig.json`, `docker-compose.yml`, `.env`).
- Primary project documentation (`README.md`).
- Existing configuration files.

## 2. Where to put files
If you need to create a new file, it MUST go into its appropriate subdirectory:
- **Agent Reports / Plans / Audits:** -> `docs/reports/` or `docs/plans/`
- **One-off Scripts / Helpers:** -> `scripts/`
- **Infrastructure / Deploy / DevOps:** -> `infrastructure/`
- **API Specs / Postman Collections:** -> `docs/api_specs/`
- **Temporary / Scratch / Backups:** -> `archive/` or `scratch/`

## 3. Enforcement
Before creating a file, analyze the directory structure. If you write a markdown report, JSON dump, or temporary script to the root directory, you are violating this constraint. Always navigate into the correct folder or use absolute/relative paths pointing inside a subdirectory.
