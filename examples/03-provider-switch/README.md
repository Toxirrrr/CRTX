# Example 3: Capability Routing (Provider Independence)

This scenario demonstrates that **CRTX prevents vendor lock-in** by decoupling the required *capability* from the *runtime* that executes it.

## The Problem
Many AI wrappers or orchestration tools are deeply hardcoded to a specific API. If a new, better model comes out from Anthropic or Google, or if you want to switch to a local model for privacy reasons, your entire architecture breaks.

## The CRTX Solution
Because CRTX uses the filesystem as the universal protocol, the specific LLM provider does not matter. The system routes based on **capabilities**, not models.

```text
Research  →  Implementation  →  Security Review  →  Architecture Review
```

Any runtime (Claude, Gemini, Local LLaMA) can pick up any capability as long as it knows how to read the `Task`, `Evidence`, and `Capsule`.

## How to experience this:

1. Look at `tasks/T003-secure-auth.json`. You will see that `research` and `implementation` are completed.
2. The current capability is `security_review`. 
3. Open this folder in a completely different AI provider than you normally use (e.g., if you used Claude for implementation, open this in Gemini or an offline LLaMA).
4. Ask the new agent:
   > "Perform the `security_review` capability requested in `tasks/T003-secure-auth.json`."
5. Watch the new agent read the capsule, find the vulnerability in the code, and hand the task off to the next capability. 

You own the orchestration, not the vendor.
