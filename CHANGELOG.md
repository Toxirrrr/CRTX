# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `QUICKSTART.md` for a 5-minute onboarding experience.
- `FAQ.md` to address architectural "Why not..." questions.
- Example 3: `03-provider-switch` demonstrating capability routing across different vendors.
- Example 2: `02-chat-recovery` demonstrating zero context loss with capsules.
- Example 1: `01-multi-agent-handoff` demonstrating the core task/evidence/capsule loop.
- Smoke test script (`npm run demo`) to verify runtime initialization.

### Changed
- Refined `README.md` positioning to focus on "Git-like workflows for AI engineering".
- Replaced monolithic local documentation with structured Capability Routing diagrams.

### Removed
- Legacy, unstructured validation sprint documentation that polluted context windows.

## [1.0.0] - 2026-07-01
### Added
- Initial Open Source release of the CRTX framework.
- File-system native protocol definition (`tasks/`, `evidence/`, `capsules/`, `decisions/`).
- Local Task Coordination Engine (LTCE) for local runtime execution.
- Capability-based routing logic.
