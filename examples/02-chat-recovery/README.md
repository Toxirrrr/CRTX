# Example 2: Recovery After Chat Reset

This scenario demonstrates one of the most powerful and practical benefits of CRTX: **Zero Context Loss**.

## The Problem
Every developer using AI has experienced this: you're 40 messages deep into a complex refactoring session. The model's context window overflows, the IDE crashes, or the AI starts hallucinating and repeating itself. You are forced to start a "New Chat" and spend 15 minutes manually pasting files, explaining the architecture, and getting the AI back up to speed.

## The CRTX Solution
CRTX makes the chat window disposable. Because the "mind" of the system is stored in the filesystem, an agent crash means nothing. 

```text
Chat Dies  →  New Session  →  CRTX Loads Capsule  →  Work Continues (0 context lost)
```

## What this demonstrates:
- An agent starts a task and saves a `Capsule` mid-way.
- You deliberately close the chat/IDE.
- You open a brand new chat session with no history.
- The agent reads the `Capsule`, understands exactly what was done and what needs to be done next, and seamlessly resumes work.
