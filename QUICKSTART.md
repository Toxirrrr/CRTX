# Quick Start

Get CRTX up and running in under 5 minutes.

## 1. Clone the repository

```bash
git clone https://github.com/Toxirrrr/CRTX.git
cd CRTX/crtx
```

## 2. Install Dependencies

CRTX uses a lightweight local coordination engine.

```bash
npm install
```

## 3. Run the Smoke Test

Verify that your system is ready for capability routing:

```bash
npm run demo
```

You should see:
```text
✓ Runtime initialized
✓ Tasks loaded
✓ Evidence created
✓ Capsule generated
Demo completed.
```

## 4. Experience the "Aha!" Moment

The easiest way to understand CRTX is to run **Example 1: Multi-Agent Handoff**.

1. Navigate to the example directory:
   ```bash
   cd examples/01-multi-agent-handoff
   ```
2. Open this specific folder in your preferred AI IDE (Cursor, Windsurf, or Copilot).
3. Open the IDE's AI Chat and type exactly this:
   > "Review the task in `tasks/T001-research-api.json` and continue the implementation."
4. **Observe the magic**: 
   - The agent reads the `history` in the task.
   - It reads the research `Evidence`.
   - It reads the context `Capsule`.
   - It begins writing code exactly where the previous agent left off—without you ever pasting a single prompt of context.

## Troubleshooting

- **Agent says it cannot find the task**: Ensure you opened the *specific* example folder (`01-multi-agent-handoff`) in your IDE, not the root repository. The agent relies on reading its current working directory.
- **Agent tries to do research again**: Tell the agent: "Strictly follow the `capsules/C001-api-summary.md` and only execute pending capabilities."
