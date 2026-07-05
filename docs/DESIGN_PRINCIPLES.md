# Design Principles

CRTX is built on a specific set of architectural values. When contributing, ensure your proposals align with these core tenets.

## 1. Capability over Model
We route work based on the *action* required (e.g., `research`, `security_review`), never the specific model (e.g., `gpt-4o`). This prevents vendor lock-in.

## 2. Runtime Independence
The protocol must be executable by any agent. We do not build features that require a specific IDE or proprietary runtime.

## 3. Structured Memory
Chat context is fragile. We force serialization of important state into deterministic `Capsules`. Memory must live in the filesystem, not in hidden chat databases.

## 4. Composability
The output of one capability must be seamlessly consumable as the input of another. `Evidence` and `Capsules` act as these standardized interfaces.

## 5. Deterministic Orchestration
State machines must be predictable. A task is either `pending`, `in_progress`, `interrupted`, or `completed`. No silent failures.

## 6. Token Efficiency
By passing only the relevant `Capsule` rather than an entire conversation history, we drastically reduce token consumption and eliminate context overflow.
