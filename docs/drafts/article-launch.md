# AI Agents Don't Need Better Prompts. They Need Better Coordination.

## Part 1: The Symptoms We All Ignore
After hundreds of hours working with AI coding tools, a pattern emerges. The models are incredibly smart. They can write complex boilerplate, refactor thousands of lines of code, and spot obscure security vulnerabilities. But the *process* of working with them is fundamentally broken.

The symptoms are everywhere:
- **Context Loss:** You spend an hour building up the perfect context in your IDE chat. Then the IDE crashes, or you hit a token limit, and that context is gone forever.
- **The Copy/Paste Pipeline:** You ask a local model for a quick bash script, paste it into your IDE, ask Claude to refactor the project, and then copy the resulting errors back into ChatGPT to figure out what went wrong.
- **Vendor Lock-in:** You build an entire workflow around OpenAI's Assistants API, only to realize that Anthropic's new model is vastly superior for your specific task.
- **The "Single Brain" Bottleneck:** You can't easily tell an AI: "Do this research, then hand the results over to the Security Agent, and have the QA Agent write tests based on that." 

We don't have a model intelligence problem. We have a coordination problem.

## Part 2: Why Current Solutions Fall Short
There are brilliant frameworks out there trying to solve this.

LangGraph and AutoGen offer powerful state machines and multi-agent conversations. But they are heavy frameworks designed for building *LLM applications*, not necessarily for orchestrating the engineering tools developers already use (like Cursor or Windsurf). They often lock state in memory or proprietary databases.

GitHub Issues and project management tools are great for human coordination, but they lack the deterministic, machine-readable structures that autonomous agents need to seamlessly pick up where another left off without losing semantic context.

Shared Chats attempt to solve the context problem by putting everything in one massive context window. This leads to "Context Explosion"—the model starts hallucinating, forgetting earlier instructions, and racking up massive API costs.

We realized that to orchestrate AI engineers effectively, we had to stop treating them like chatbots and start treating them like asynchronous microservices.

## Part 3: The Architectural Shift
This realization led to a new architectural idea: **Filesystem-Native Coordination**.

If every AI tool (from CLI agents like Aider to IDEs like Cursor) inherently understands how to read and write files, why not use the local filesystem as the ultimate source of truth?

Instead of routing data through a central cloud server, we can serialize the state of the project, the current task, and the agent's memory directly into the repository. 

This is where **CRTX** comes in. It's not a new AI agent, and it's not a framework that executes code. It is a provider-neutral, filesystem-native coordination protocol.

We decoupled the *Capability* from the *Model*. A task defines what needs to be done (e.g., `capability: "research"`). The CRTX runtime simply points an available agent at the filesystem. 

## Part 4: Three Workflows That Change Everything

By serializing orchestration into files (`tasks/`, `capsules/`, `evidence/`), three previously impossible workflows become trivial:

### 1. Multi-Agent Handoff
An exploratory AI agent conducts API research. Instead of losing that context in a chat window, it serializes its findings into a highly compressed `Capsule` and outputs cryptographic `Evidence`. The implementation agent (e.g., inside Cursor) is then spun up, reads the `Capsule`, and begins coding with perfect context, starting exactly where the researcher left off.

### 2. Chat Recovery (Zero Context Loss)
Your IDE crashes mid-refactor. With traditional tools, you start over. With CRTX, the last agent already wrote its state to the `tasks/` directory. You simply reopen the project, and the agent reads the filesystem state to resume the refactor seamlessly.

### 3. Provider Switch on the Fly
You hit a rate limit on Claude 3.5 Sonnet. Because tasks are routed by capability rather than model name, you simply switch your local CRTX runtime to use Gemini or a local LLaMA model for the next step of the task. The new model reads the exact same filesystem state and continues the work without missing a beat.

## Part 5: The Road Ahead
We believe the future of software engineering isn't a single omnipotent AI writing all the code. It's a coordinated team of specialized agents, orchestrating their work asynchronously, leaving verifiable evidence of their decisions.

We built CRTX to be the open, provider-neutral protocol for that future. 

If you think filesystem-native coordination is the wrong direction, we'd genuinely like to hear why. Check out the repository, run the examples, and let us know where this architecture breaks down.
