# Contributing to CRTX

First off, thank you for considering contributing to CRTX! We aim to build the industry standard for AI team coordination.

## Architectural Principles
Before writing code, please read our [Design Principles](docs/DESIGN_PRINCIPLES.md). All contributions must strictly align with:
- **Capability-first routing** (No vendor lock-in).
- **Filesystem-native state** (No hidden chat context).

## Submitting a Pull Request
We prefer small, focused Pull Requests over massive structural changes.

1. **Fork the repo** and create your branch from `main`.
2. **Minimal PR**: Ensure your PR solves exactly one problem.
3. **Tests Required**: If you add a feature, add a test. If you fix a bug, add a test that prevents regressions.
4. **Documentation**: Update the relevant markdown files if you change behavior.
5. **Checklist**: Fill out the PR template completely.

## Documentation Style
- **No Marketing Fluff**: Be concise. State the problem and the solution.
- **Verifiable**: If you claim a feature does something, provide a command to verify it.
