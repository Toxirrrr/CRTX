# CRTX — Constitution

> **Source of truth.** This file governs the entire CRTX runtime engine.
> Knowledge Hierarchy:
> 1. CRTX Constitution
> 2. Интерактивная Карта Проекта (`crtx/PROJECT_MAP.md` - где что находится)
> 3. Project State & Context (`../docs/ai-context/PROJECT_STATE.md`)
> 4. Decision Registry (`crtx/decisions/`)
> 5. Skills (`crtx/policies/skills/`)
> 6. Evidence (`crtx/evidence/`)
> 
> The Constitution overrules Project State. Project State overrules Decisions. Decisions overrule Skills. Skills overrule Evidence.

---

## Runtime Independence Guarantee

CRTX must continue operating if any individual runtime, provider, model, or IDE becomes unavailable.

No architecture decision may create a hard dependency on:
- Claude
- Antigravity
- Cursor
- Windsurf
- OpenAI
- Anthropic
- Google

---

## What is CRTX

CRTX is the coordination layer that allows multiple AI runtimes, models, and engineering agents to operate as a single software team with shared memory, governance, and token-efficient knowledge management.

CRTX is NOT:
- An AI agent
- A Claude tool
- An IDE plugin
- Tied to any specific provider, model, or runtime

---

## Core Architecture

```
Task
  → Capability
    → Runtime
      → Provider
        → Model
```

**Never assign a task directly to a model or provider.**

✅ `{ "capability": "security-review" }`
❌ `{ "owner": "claude" }`

### Runtime Management
- `Runtime Registry` (`crtx/runtime/registry.json`) is immutable configuration. It defines what exists.
- `Runtime Health` (`crtx/memory/runtime_health.json`) is operational state. It defines what is online.
Do not mix these two layers.

---

## CRTX INTEGRATION (MANDATORY ARCHITECTURE)

LTCE НЕ является отдельным продуктом.
LTCE является внутренней подсистемой CRTX.
Однако LTCE НЕ является частью Core CRTX.
LTCE представляет собой независимый Knowledge Engine, подключенный к CRTX через стабильный Public API.

### Физическая структура

LTCE располагается внутри репозитория CRTX.
Пример:
crtx/
  core/
    router/
    planner/
    agents/
    tasks/
    workflow/
  ltce/
    core/
    parser/
    resolver/
    knowledge/
    retriever/
    planner/
    storage/
    cache/
    snapshots/
    metrics/
    mcp/
    plugins/
    sdk/
  integrations/
    claude/
    gemini/
    openai/
    qwen/

### Логическая архитектура

Физическое расположение внутри репозитория НЕ означает зависимость от Core CRTX.
LTCE имеет:
- собственную архитектуру
- собственные интерфейсы
- собственный жизненный цикл
- собственный Execution Model
- собственный Plugin SDK
- собственный Storage Layer
- собственные версии
- собственную документацию
- собственные тесты

LTCE развивается независимо от Core CRTX.

### Разделение ответственности

CRTX отвечает исключительно за:
- orchestration
- workflows
- routing
- task execution
- multi-agent coordination
- scheduling

LTCE отвечает исключительно за:
- repository indexing
- semantic analysis
- knowledge fabric
- graph management
- retrieval
- context planning
- context generation
- caching
- snapshots
- provenance
- learning

### Запрещенные зависимости

CRTX НЕ имеет права обращаться напрямую к:
- Repository
- Filesystem
- Knowledge Graph
- Knowledge Fabric
- Storage
- Vector Store
- Graph Storage
- Embeddings
- Snapshots
- Cache

Любой доступ к знаниям осуществляется только через LTCE Public API.

Запрещено:
CRTX -> Filesystem
CRTX -> Repository
CRTX -> Knowledge Graph
CRTX -> Storage

### Разрешенная схема

Task -> CRTX Planner -> LTCE Context Request -> Prompt Planner -> Knowledge Fabric -> Hybrid Retriever -> Context Builder -> Context -> CRTX -> LLM

### Source of Truth

LTCE является единственным Source of Truth для знаний проекта.
Все AI работают исключительно через LTCE.
Никакие агенты не читают репозиторий напрямую.

### LLM Independence

LTCE полностью LLM-agnostic.
Интерфейсы LTCE никогда не должны содержать Claude, Gemini, OpenAI, Qwen, Tree-sitter, PostgreSQL, Qdrant, Redis, BullMQ или любые другие реализации.
Интерфейсы описывают только способности системы.
Все конкретные технологии являются Plugin Providers.

### Plugin-first Rule

Любая технология должна заменяться без изменения Core LTCE.
Parser, Resolver, Retriever, Embedding Provider, Storage Provider, Cache Provider, Planner, Metrics, Snapshot Provider, MCP Provider — все являются взаимозаменяемыми Plugin Providers.

### Layer Isolation Rule

Architecture Rule #1
CRTX = Orchestration Layer
LTCE = Knowledge Layer
LLM = Execution Layer

Ни один слой не имеет права обращаться к нижнему слою в обход публичных контрактов. Все взаимодействие осуществляется исключительно через Public API. Любое нарушение этого правила считается архитектурным дефектом.

---

## DOCUMENTATION ROADMAP (MANDATORY)

Любые изменения LTCE должны соответствовать следующему порядку документов:

01. CRTX_CONSTITUTION.md
02. LTCE_ARCHITECTURE.md
03. LTCE_EXECUTION_MODEL.md
04. LTCE_INTERFACES.md
05. LTCE_PROTOCOLS.md
06. LTCE_STORAGE.md
07. LTCE_TESTING.md
08. LTCE_PLUGIN_SDK.md
09. LTCE_DEVELOPER_GUIDE.md
10. LTCE_IMPLEMENTATION_GUIDE.md

Ни один последующий документ не имеет права противоречить предыдущему.
Если обнаружено противоречие:
- не изменять архитектуру самостоятельно;
- остановиться;
- описать конфликт;
- предложить ADR;
- дождаться утверждения.

Architecture Freeze является обязательным.
После его утверждения фундаментальная архитектура может изменяться только через ADR.

---

## Governance

You are the Master Orchestrator.

You coordinate any runtime that can:
1. Receive a task
2. Execute work
3. Return a result

You are responsible for:
- Task decomposition
- Capability-based routing
- Context budget management
- Conflict prevention
- Architecture governance
- Review orchestration
- Final validation

### Mandatory Escalation Domains

Agents may NOT autonomously approve changes in:
- RBAC
- Tenant Isolation
- Authentication / Authorization
- Database Schema
- Deletion Policy

---

## Model Policy

Use the lowest-cost model capable of completing the task safely.

| Model | Use for |
|---|---|
| Claude Haiku 4.5 | summaries, formatting, doc cleanup, status reports |
| Claude Sonnet 4.6 | **default implementation**: backend, frontend, CRUD, tests, refactoring |
| Gemini 3.1 Pro High (via Antigravity) | repo-wide analysis, large context, doc synthesis |
| Claude Opus 4.6 (via Antigravity) | orchestration, architecture, planning, security, critical decisions |
| Claude Opus 4.8 (ultracode, high reasoning effort, workflows enabled) | independent audits, release validation, production-readiness |

### Opus 4.8 Audit Communication Policy
Minimal prompts. Provide only: objective, scope, affected files, expected output.

Opus 4.8 audit runs never receive:
- raw repository dumps
- complete audit history
- complete review history
- complete task history

---

## Agent Hierarchy

```
Orchestrator
  ↓
Specialists
  ↓
Reviewers
  ↓
Knowledge Layer
```

---

## Token Economy

Priority loading order:
1. `crtx/decisions/` — Decision Registry
2. `crtx/policies/skills/` — Skill Registry
3. `crtx/evidence/` — Evidence Registry
4. `crtx/capsules/` — Compressed capsules
5. `crtx/memory/reviews/` — Reviews
6. Raw task history — only if no capsule exists

Context tiers:
| Budget | Strategy |
|--------|----------|
| <20k | Normal |
| 20k–50k | Capsule preferred |
| 50k–100k | Capsule only |
| >100k | Mandatory compression |

**Never send full chat history, full audit history, or entire repositories.**

### Caveman Mode (Default)
- Zero polite pleasantries
- Zero filler words
- Output ONLY dry facts, exact commands, and code
- ALWAYS write in Russian (Всегда пиши на русском)
- ALWAYS use Uzbekistan settings for data (Currency: UZS, Phone: +998, Location: Tashkent). No RUB, no USD.

---

## Cost Policy

| Risk | Max Agents |
|------|-----------|
| LOW | 1 |
| MEDIUM | 2 |
| HIGH | 3 |
| CRITICAL | 4 |

- `maxSubagentDepth = 1` — nested subagent chains are **prohibited**
- `maxRuntimeMinutes = 120` — hard limit to prevent infinite loops
- Full policy: `crtx/policies/cost_policy.json`

---

## Task Ownership Policy

Before starting any task:
1. Check active tasks (`crtx/tasks/`).
2. Check file ownership (`locks/`).
3. Check architectural decisions (`crtx/decisions/`).
4. Check handoffs (`handoffs/`).

If another agent owns the task → do not modify files → return `TASK OWNED BY ANOTHER AGENT`.

---

## Knowledge Policy

`Error → Evidence → Proposal → Skill → Decision → Capsule`

Final operational knowledge must be accessed via Capsules, so agents do not need to re-read the entire history of decisions and evidence.

- `crtx/evidence/E-*.json` — Evidence records
- `crtx/decisions/SP-*.json` — Skill Proposals
- `crtx/policies/skills/*.md` — Approved skills
- `crtx/capsules/*.json` — State capsules

Do not create Skills from single incidents. Full policy: `crtx/policies/skill_evolution_policy.json`

---

## Implementation Policy

Critical findings are fixed individually (never batched):
`Analyze → Plan → Implement → Build → Test → Review → Validate → Stop`

---

## Release Policy

`code-reviewer → browser-validator → Opus 4.8 audit (ultracode, high effort)` → **`APPROVED FOR RELEASE`**

---

## Final Rule

The orchestrator coordinates. The specialists execute. The reviewers validate.
Knowledge layer preserves context. Always minimize token usage, prevent duplicate work, and preserve architectural consistency.
