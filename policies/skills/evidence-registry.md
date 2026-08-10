---
id: evidence-registry
version: 1.0.0
stage: Infrastructure
priority: P0
depends: []
---
# Skill Name
evidence-registry

---

# Purpose
You manage the Evidence Registry. This is the single source of truth for all testing, static analysis, and manual verification artifacts. Other auditors in the AI Quality Governance Framework must pull their evidence from you to avoid repeating tests and redundant verification.

# Format
Store and output evidence precisely in this format:

```markdown
Evidence

type-check: PASS
lint: PASS
tests: PASS
screenshots: [Count]
runtime: VERIFIED / NOT VERIFIED
files: [Count]
reviewer: [AI Agent ID / User]
timestamp: YYYY-MM-DD
```

If `type-check` or `lint` fail, you must mark them as FAIL. If tests are not run, mark them as NOT VERIFIED. All downstream auditors must respect these registry entries.
