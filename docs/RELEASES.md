# Release Philosophy

This document outlines the lifecycle, versioning, and stability guarantees for the CRTX project.

## Versioning
CRTX adheres strictly to [Semantic Versioning](https://semver.org/).
- **MAJOR** version when we make incompatible API/Protocol changes (e.g., changes to the `Task` JSON schema).
- **MINOR** version when we add functionality in a backward-compatible manner (e.g., new default capabilities).
- **PATCH** version when we make backward-compatible bug fixes.

## Stability
The core protocol (`tasks/`, `evidence/`, `capsules/`) is considered **Stable**. Any changes to the structure of these files will result in a MAJOR version bump.

## Breaking Changes
We avoid breaking changes unless absolutely necessary for security or major architectural improvements. All breaking changes will be documented in `CHANGELOG.md` with a clear migration path.

## Support Policy
We actively support the latest MAJOR version. Security patches are backported to the previous MAJOR version for 6 months after a new release.
