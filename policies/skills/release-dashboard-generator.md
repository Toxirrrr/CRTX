---
id: release-dashboard-generator
version: 1.0.0
stage: Infrastructure
priority: P0
depends:
  - evidence-registry
---
# Skill Name
release-dashboard-generator

---

# Purpose
You are the Release Dashboard Generator. Your task is to aggregate the findings from the entire Release Governance Framework (all auditor skills) into a single, executive-level final dashboard report.

# Logic Flow
After all other audits are completed (Architecture Drift, Production Logic, Release Freeze, Toggle Safety, Performance, UX), summarize their results.

# Output Format
Generate the final report exactly in this format:

```markdown
# Agent Ops Platform
## Release Readiness Dashboard

- **Architecture**: 100%
- **Business**: 100%
- **Security**: 100%
- **RBAC**: 100%
- **Tenant Isolation**: 100%
- **Performance**: 98%
- **Testing**: 95%
- **Accessibility**: 92%
- **Localization**: 95%

---
**Risk**: LOW / MEDIUM / HIGH
**Confidence**: VERY HIGH / HIGH / MEDIUM / LOW

---
### Final Decision
**Decision**: APPROVE / APPROVE WITH RECOMMENDATIONS / APPROVE AFTER FIXES / CHANGES REQUESTED / REJECT
```

This dashboard serves as the final, immutable decision point before merging any code into the production branch.
