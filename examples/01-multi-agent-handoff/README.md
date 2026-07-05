# Example 1: Multi-Agent Handoff

This is the primary scenario that explains the value of CRTX in 3 minutes.

## The Problem
When you ask an AI assistant to "research an API and then write the code", it usually does it in one giant, unstructured context window. If the task is large, it forgets constraints, hallucinates architectures, and creates a mess.

## The CRTX Solution
CRTX decouples the workflow. One agent (e.g., Windsurf or Gemini) performs the research and creates a structured **Capsule** and **Evidence**. Another agent (e.g., Cursor or Claude) reads that capsule and writes the code.

```mermaid
flowchart TD
    A[Create Task] --> B[Research Agent]
    B --> C[Evidence Generated]
    C --> D[Capsule Saved]
    D --> E[Implementation Agent]
    E --> F[Review Agent]
    F --> G[Task Done]
```

## How to experience this:

1. Open this folder in your AI IDE (Cursor, Windsurf, etc.).
2. Ask your AI assistant:
   > "Review the task in `tasks/T001-research-api.json` and continue the implementation."
3. Notice that the assistant uses the `Capsule` and `Evidence` to write the code perfectly, without requiring you to paste any original conversation history.
