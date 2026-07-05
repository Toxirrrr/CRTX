# Example 2: Chat Recovery (Zero Context Loss)

Every developer using AI has experienced this: you are 100+ messages deep into a complex refactoring session. The context window overflows, the IDE crashes, or the AI starts hallucinating and looping. You are forced to start a "New Chat" and spend 15 minutes manually pasting files, explaining the architecture, and getting the AI back up to speed.

CRTX solves this by storing the "mind" of the system in the filesystem.

## How to experience this:

1. Imagine your AI chat just crashed in the middle of a massive Authentication Refactor.
2. Open a **brand new chat session** in your AI IDE (Cursor, Windsurf, Claude) with zero history.
3. Ask the agent:
   > "Read the task `tasks/T002-auth-refactor.json`. My previous chat crashed. Resume the work."
4. Notice that the agent instantly reads the `Capsule`, understands the accepted architecture, constraints, and exactly which TODOs are left, and continues coding flawlessly. 

No copy-pasting required. Zero context lost.
