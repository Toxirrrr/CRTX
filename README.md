<div align="center">
  <h1>CRTX</h1>
  <p><strong>A Provider-Neutral, Filesystem-Native Coordination Runtime for AI Teams</strong></p>
</div>

Every AI tool right now wants to own your entire workflow. They lock you into their IDE, tether you to their models, and constrain you within their context windows. 

**Think of CRTX as Git for AI teams**—a shared, transparent protocol where human developers and AI systems synchronize their work.

But building production-grade software isn't just about generating code faster in a chat box. **It's about coordination.**

**CRTX** is an open-source orchestration runtime that turns isolated AI agents—Claude Code, Cursor, Windsurf, Aider, and local LLMs—into a synchronized, autonomous engineering team. Instead of trapping agents in a closed, memory-heavy API loop, CRTX uses the **filesystem** as the ultimate source of truth. 

## Why CRTX?

Relying on a single vendor's agent creates a hard ceiling. Context windows overflow, architecture is forgotten, and developers spend more time correcting "AI slop" than reviewing logic.

Traditional orchestration frameworks try to fix this by building massive, opaque state machines. **CRTX is different.** It is Zero-Waste and completely Provider-Neutral. It decouples the work from the vendor.

### Capability-Based Routing

```text
Task  →  Capability  →  Runtime  →  Provider  →  Model
```

Instead of sending a massive prompt to a single model and hoping for the best, CRTX evaluates the required *Capability* (e.g., "Architecture Review", "E2E Testing", "Frontend Implementation") and dynamically routes the work to the best available runtime on your machine. This enables parallel execution across multiple runtimes while preserving task isolation and coordination.

## The Software Factory

CRTX replaces chaotic prompting with structured, verifiable directories. Any compatible AI runtime can instantly plug into this ecosystem just by reading the filesystem.

- `tasks/` — **The Workload:** Agent assignments, dependency chains, and statuses. 
- `capsules/` — **The Memory:** Snapshot states for transferring context between agents without exploding token limits.
- `decisions/` — **The Architecture:** Immutable Architecture Decision Records (ADRs). Agents must read these before writing code.
- `evidence/` — **The QA Lead:** Cryptographic proofs of successful testing and validation. No code merges without evidence.
- `skills/` — **The Playbook:** Executable SOPs, prompts, and domain knowledge.
- `runtime/` — **The Dispatcher:** Decentralized registry mapping capabilities to execution adapters.
- `events/` — **The Audit Log:** A transparent log of every system state transition.

## The Constitution

While other tools rely on a simple `config.json`, CRTX operates under a master `CONSTITUTION.md`. This is the absolute law for your AI team, establishing the boundaries of the system:
- **Role-Based Access & Ceilings**
- **Release Gates & Validation Rules**
- **Token Economy & Budgets**
- **Escalation Protocols** (When the AI must stop and ask a human)

## Who this is for

- **Technical Founders & Teams** who want to orchestrate parallel AI agents to ship faster.
- **Staff Engineers** looking for rigorous review, QA, and release automation on every PR.
- **Open-Source Builders** who refuse to be locked into a single vendor's ecosystem.

## Quick Start

CRTX is not an application you start or a server you host. It is a **protocol and project structure**. Any agent can plug in just by reading and writing files.

**1. Initialize the Workspace**
```bash
git clone https://github.com/Toxirrrr/CRTX.git
cd CRTX
npm install
```
*Note: `npm install` automatically scaffolds the required directories (`tasks/`, `capsules/`, etc.) and detects available runtimes.*

**2. Dispatch a Task**
Simply create a JSON file in the `tasks/` directory describing what needs to be built. Your AI team (Claude, Cursor, etc.) will pick it up automatically.

## For Agents

If you are an AI agent (Cursor, Windsurf, Claude) operating in a repository powered by CRTX, you do not need to boot an orchestrator to check your workload. 

Simply read your assigned tasks from the `tasks/` directory:
```bash
cat tasks/*.json | grep "your-agent-id"
```
When you finish a task, update its `status` to `done` directly in the JSON file. Always consult `CONSTITUTION.md` before executing work.

## License
MIT License. Free forever. Fork it, improve it, make it yours.
