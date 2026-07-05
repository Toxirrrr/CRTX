# ADR 002: Why Capabilities over Models?

## Status
Accepted

## Context
Most AI orchestration frameworks hardcode routing logic to specific LLM providers (e.g., "send step 1 to GPT-4o, send step 2 to Claude 3.5 Sonnet").

## Decision
CRTX completely decouples the work from the vendor. Tasks are defined by the *Capability* they require (e.g., `research`, `security_review`, `e2e_test`), not the model. 

## Rationale
- **Vendor Independence:** Models evolve rapidly. A workflow hardcoded to Anthropic today might be obsolete tomorrow if Google releases a better model. Capability routing allows users to swap underlying runtimes without changing their task definitions.
- **Cost Optimization:** A `documentation` capability can be routed to a cheap, fast local model, while an `architecture_design` capability is routed to the most expensive frontier model.
- **Future-Proofing:** It allows for human-in-the-loop fallback. If an AI cannot perform a `security_review`, the capability can be picked up by a human engineer.

## Consequences
- Requires an active "Runtime / Router" layer to map capabilities to available providers.
- Agents must advertise their supported capabilities upon initialization.
