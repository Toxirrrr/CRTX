# FAQ & Guidelines

## When NOT to use CRTX

To maintain trust, we are upfront about CRTX's boundaries. **CRTX is probably not the right choice if:**
- You are building a single-agent chatbot or simple consumer LLM wrapper.
- You don't need persistent, deterministic task state between agent sessions.
- Your entire workflow relies on (and is happy with) one proprietary runtime (e.g., exclusively OpenAI's Assistants API).
- You are only automating short-lived, trivial prompts that don't require architectural context.

---

## Why not a shared chat?

You can add multiple bots to a Slack or Discord channel and have them talk to each other. 
**The problem:** Chat interfaces are linear and transient. A codebase is hierarchical and persistent. If Claude and Windsurf chat for 200 messages, the context window explodes, and crucial architectural decisions are lost in the noise. CRTX forces agents to serialize their states into `Capsules` so context is never lost and context windows stay clean.

## Why not GitHub Issues?

GitHub Issues are great for human coordination.
**The problem:** They are too high-level for granular AI workflow orchestration. An AI agent needs to know the exact state of the AST, the specific variables that were mocked, and the precise file paths of the evidence it generated. CRTX `Tasks` represent capability-level execution steps, while GitHub Issues represent human-level features or bugs. You can use both (a GitHub Issue triggers a CRTX Task pipeline).

## Why not LangGraph or AutoGen?

LangGraph and AutoGen are brilliant frameworks for building LLM applications.
**The problem:** They are application frameworks, not engineering protocols. To use LangGraph to build software, you have to write Python code to orchestrate your agents. CRTX is an infrastructure protocol—it uses the filesystem. You don't write Python to route tasks; you just create a `task.json`, and any agent (even closed-source ones like Cursor) can read it and do the work.

## Why not MCP (Model Context Protocol) only?

MCP (Anthropic's Model Context Protocol) is fantastic for giving models access to tools and databases.
**The problem:** MCP is a client-server protocol for *context retrieval*, not lifecycle orchestration. MCP lets an agent query a database; CRTX tells the agent *why* it needs to query the database, what capability it is performing, and where to save the architectural snapshot when it's done. CRTX actually works perfectly *alongside* MCP.

## Why not a Database (PostgreSQL / Redis)?

We could store all tasks, evidence, and capsules in a central PostgreSQL database.
**The problem:** Most AI coding tools (Cursor, Windsurf, Aider) do not natively talk to arbitrary databases. However, **every single AI coding tool knows how to read the filesystem.** By using the filesystem as the source of truth, CRTX achieves 100% interoperability with all existing and future AI IDEs without requiring them to build custom integrations.
