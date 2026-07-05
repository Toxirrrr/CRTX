# Quick Start

Get CRTX up and running in under 5 minutes.

## 1. Clone the repository

```bash
git clone https://github.com/Toxirrrr/CRTX.git
cd CRTX/crtx
```

*Expected output:* You should be in the `crtx` root directory.

## 2. Install Dependencies

CRTX uses a lightweight local coordination engine.

```bash
npm install
```

*Expected output:*
```text
added X packages, and audited Y packages in Zs
found 0 vulnerabilities
```

## 3. Verify Installation (Smoke Test)

Verify that your system is ready for capability routing:

```bash
npm run demo
```

*Expected output:*
```text
✓ Runtime initialized
✓ Tasks loaded
✓ Evidence created
✓ Capsule generated

Demo completed. Your environment is ready for Capability Routing.
```

*(If you do not see these checkmarks, please consult the Troubleshooting section below).*

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

| Problem | Possible Reason | Solution |
|---|---|---|
| `npm run demo` fails with "Command not found" | Node.js/npm not installed | Install Node.js v20+ and try again. |
| `npm run demo` fails with "Missing modules" | Dependencies missing | Run `npm install` in the `crtx` folder. |
| Agent says it cannot find `T001-research-api.json` | Wrong working directory | Ensure you opened the *specific* example folder (`examples/01-multi-agent-handoff`) in your IDE, not the repository root. |
| Agent tries to perform the research again | Agent hallucinated instructions | Tell the agent: "Strictly follow the `capsules/C001-api-summary.md` and only execute pending capabilities." |
