# CRTX Examples

This directory contains practical, reproducible examples demonstrating the core value of CRTX as a filesystem-native coordination runtime.

Each example runs independently and proves a specific architectural advantage of moving AI orchestration out of the chat window and into the filesystem.

## Available Examples

1. **[01-multi-agent-handoff](./01-multi-agent-handoff)**: Demonstrates how multiple agents (e.g., Windsurf for research, Cursor for implementation) can collaborate sequentially without losing context, by sharing Tasks, Evidence, and Capsules.
2. **[02-chat-recovery](./02-chat-recovery)**: Proves that context is never lost. If an agent session crashes or a context window overflows, a new agent can instantly resume exactly where the previous one left off by loading the state Capsule.
3. **[03-provider-switch](./03-provider-switch)**: Showcases Provider Independence. Switch seamlessly from Claude to Gemini to an offline Local LLaMA mid-workflow without breaking the architecture.

## How to use these examples

Each folder contains a self-contained `tasks/` directory. To run an example:
1. Navigate to the example folder.
2. Open your preferred AI agent (Cursor, Windsurf, Aider) in that folder.
3. Instruct the agent to "execute the tasks in the `tasks/` directory".
4. Watch as it reads the tasks, generates evidence, creates capsules, and updates the task status.
