# Example 3: Provider Independence

This scenario demonstrates that **CRTX prevents vendor lock-in**.

## The Problem
Many AI wrappers or orchestration tools are deeply hardcoded to a specific API (like OpenAI's Assistants API). If a new, better model comes out from Anthropic or Google, or if you want to switch to a local model for privacy reasons, your entire architecture breaks.

## The CRTX Solution
Because CRTX uses the filesystem as the universal protocol, the specific LLM provider does not matter. The `Task`, `Evidence`, and `Capsule` are just structured files.

```text
Claude  →  Gemini  →  OpenAI  →  Local Model
```

## What this demonstrates:
- A task is initiated and partially completed by an Anthropic Claude model.
- The workflow is then handed over to a Google Gemini model.
- Finally, it is picked up by a local, offline model (e.g., LLaMA running via Ollama).
- Throughout all these transitions, the `Task` definition, `Evidence`, and `Capsule` remain intact and fully compatible. 
- You own the orchestration, not the vendor.
