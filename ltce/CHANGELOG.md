# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v1.0.1

### Added
- Official documentation suite.
- Official plugin examples.

### Changed
- Documentation now follows the Examples First policy.
- Example packages now reference published SDK versions (`^1.0.1`).

### Fixed
- Replaced event-handler with event-publisher.
- Corrected SDK package dependencies.

## v1.0.0

### Added
- Core Execution Engine.
- SQLite WAL Persistence via `BetterSQLiteDriver`.
- CLI Interface (`init`, `start`, `stop`, `status`, `doctor`, `backup`, `restore`, `create-plugin`).
- Zod schema validation for `runtime.json`.
- Fail-fast configuration loading.
- Architecture Freeze enforcement.
