# CRTX Roadmap

Our vision is to make CRTX the **industry standard open-source protocol for AI team coordination**.
We measure success by architectural resilience, provider independence, and zero-waste execution—not hype.

## Phase 1: Foundation (Current)
*Establish the core filesystem protocol and prove the architecture.*
- [x] Define filesystem-native protocol (`tasks/`, `capsules/`, `evidence/`)
- [x] Provider-neutral capability routing architecture
- [x] Local Task Coordination Engine (LTCE) base implementation
- [x] Multi-agent handoff examples
- [x] Zero-context-loss chat recovery examples

## Phase 2: Developer Experience (Up Next)
*Reduce the friction for the first 100 users.*
- [ ] 5-Minute Quick Start Guide
- [ ] CLI installation script (`npx crtx init`)
- [ ] Automated Smoke Tests (`npm run demo`)
- [ ] Visual Demo Video (Architecture & Terminal Execution)
- [ ] VS Code / Cursor snippets for fast Task creation

## Phase 3: Community & Integrations
*Prove the protocol across real-world workflows and tools.*
- [ ] Built-in GitHub Issues to CRTX Task sync
- [ ] First-class MCP (Model Context Protocol) compatibility templates
- [ ] Example 4: Code Review Pipeline
- [ ] Example 5: End-to-End Bug Investigation
- [ ] Example 6: Large Monorepo Orchestration
- [ ] Technical deep-dive articles (Medium, Dev.to)

## Phase 4: Open Source Scale
*Transition to a community-driven standard.*
- [ ] Accept first external Pull Requests (Parsers, new Capabilities)
- [ ] Standardized JSON Schemas for `tasks` and `capsules` (for strict validation)
- [ ] Pluggable event webhooks (Slack/Discord notifications for agent handoffs)
- [ ] "Claude for Open Source" integration & support
