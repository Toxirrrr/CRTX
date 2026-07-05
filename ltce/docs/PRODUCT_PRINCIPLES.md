# CRTX Product Principles

This document defines the core engineering and product management rules for the CRTX Runtime following the `v1.0.1` Architecture Freeze. CRTX has transitioned from an *architecture experiment* into a *mature, production-ready open-source product*. 

Stability, backward compatibility, and user feedback are prioritized above all else.

---

### Rule #1: No Development Without a User
Every new feature must begin with a confirmed need, not an idea.
**Workflow:** `Issue` ➔ `Problem` ➔ `Evidence` ➔ `Design` ➔ `Implementation`.
Do not implement hypothetical features in search of a use case.

### Rule #2: Every Feature Must Pay for Itself
Before accepting any new feature, answer three questions:
1. What exact problem does it solve?
2. Who will use it in the next 3-6 months?
3. Why can't this be solved using the existing API?
If any question lacks a compelling answer, the feature is postponed.

### Rule #3: Compatibility First
For all `1.x` releases:
- Do not break the public SDK without severe justification.
- Prefer additive changes over modifications.
- Announce future breaking changes far in advance to protect the plugin ecosystem.

### Rule #4: Examples Are Tests
The `examples/` directory serves as our integration testing suite.
- If an SDK change breaks an example, it is a regression.
- If an example must be updated to accommodate a change, the documentation must be updated simultaneously.

### Rule #5: Documentation Is Part of the Release
A release is NEVER complete until:
- `CHANGELOG.md` is updated.
- Documentation perfectly matches the code.
- Examples run successfully.
- `Quick Start` is verified on a clean machine.
Documentation must pass the same strict review process as the codebase.

### Rule #6: Simplicity Wins
When choosing between two solutions, select the one that:
- Requires fewer dependencies.
- Is easier to explain to a new developer.
- Will be simpler to maintain in a year.
- Has fewer potential points of failure.

---

## Roadmap Guidelines

### `v1.0.x` (Patch Releases)
- Bug fixes.
- CLI polish.
- Documentation improvements.
- Performance optimizations.
- Community feedback integrations.

### `v1.1.x` (Minor Releases)
- New SDK capabilities (only if there is confirmed demand).
- New official examples.
- New CLI commands (if necessary).

### `v2.0.0` (Major Releases)
- Do not plan `v2.0` in advance. 
- A major release is only triggered when enough critical, confirmed product needs accumulate that absolutely cannot be solved without breaking backward compatibility.

### Rule #7: Delete Before You Add
Before adding new code, ask: 'Can this problem be solved by deleting or simplifying existing code?' Sometimes the best pull request is one that reduces the codebase size.

### Rule #8: Every Dependency Has a Cost
Any new library must answer:
1. Why can't we use the standard library?
2. Who will maintain this dependency in two years?
3. What happens if the project is abandoned?
If there are no convincing answers, the dependency is rejected.

### Rule #9: The Product Is More Important Than the Framework
CRTX exists to serve products. Products do not exist to justify CRTX. If the product no longer benefits from a specific CRTX component, that component must change or disappear.

### Rule #10: Measure Before Optimizing
Before any performance or architectural change: Measure ? Find the bottleneck ? Fix ? Measure again. Never optimize based on 'this will probably be faster.'

