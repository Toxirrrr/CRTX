# ADR 003: Why Capsules?

## Status
Accepted

## Context
When collaborating in chat interfaces, developers frequently run into "Context Explosion." After 50 messages, the LLM begins to hallucinate, forget initial instructions, and cost significantly more per request.

## Decision
CRTX forces agents to serialize their mid-workflow state and knowledge into lightweight Markdown documents called **Capsules** (`capsules/`). When a task is handed off, the next agent reads the Capsule, not the chat history.

## Rationale
- **Zero Context Loss:** If an IDE crashes, the Capsule retains the exact state (Decisions made, TODOs remaining, constraints).
- **Token Efficiency:** A Capsule summarizes 50,000 tokens of conversational back-and-forth into 500 tokens of strict architectural context.
- **Handoff Clarity:** It forces the completing agent to explicitly document "What the next engineer should do", mimicking high-quality enterprise handoffs.

## Consequences
- Agents must be explicitly instructed on how to format and read Capsules.
- Requires strict enforcement of the `CONSTITUTION.md` so agents don't skip the Capsule generation step.
