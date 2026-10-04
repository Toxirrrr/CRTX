# ChatGPT Browser Integration

CRTX can control the user's already-authenticated ChatGPT web session through a persistent Chromium browser profile. This lets the orchestrator route tasks to ChatGPT Projects and maintain continuous conversation context across Antigravity task cycles.

## Architecture

## Architecture

```
CRTX Project
    ↕
ChatGPT Project (matched by visible name)
    ↕
CRTX Chat / Task
    ↕
ChatGPT Conversation (persisted by URL)
    ↕
Playwright connectOverCDP() 
    ↕
Normal Google Chrome (dedicated profile)
    ↕
real chatgpt.com UI
```

## Requirements

- Node.js 18+
- Playwright Chromium browser
- A ChatGPT account (login is done manually — no credentials are stored)
- ChatGPT Projects created manually in the ChatGPT web UI

## Installation

```bash
# 1. Install dependencies (Playwright is now a dependency)
npm install

# 2. Install the Playwright Chromium browser
npx playwright install chromium
```

## First-Time Setup

### Step 1 — Log in manually

```bash
npx ts-node crtx/cli/index.ts chatgpt login
```

A browser window will open. Complete the ChatGPT login manually.  
After login, close or let the command finish. Your session is saved to:

```
~/.crtx/browser/chatgpt/   (default — configurable via CHATGPT_BROWSER_PROFILE_DIR)
```

> **Security:** Only browser profile data (cookies, localStorage) is saved — never your password.

### Step 2 — Create a ChatGPT Project

In the ChatGPT web UI, create a project manually. Example: **TINIQ**

### Step 3 — Connect CRTX → ChatGPT

```bash
npx ts-node crtx/cli/index.ts chatgpt connect tiniq --project TINIQ
```

Output:
```
CRTX project "tiniq"
→ ChatGPT project "TINIQ"

Connection saved.
```

The mapping is saved to `memory/chatgpt_mapping.json` (gitignored).

## CLI Commands

| Command | Description |
|---------|-------------|
| `crtx chatgpt login` | Open browser for manual ChatGPT login |
| `crtx chatgpt status` | Show browser / auth / profile state and existing mappings |
| `crtx chatgpt projects` | List all visible ChatGPT projects from the sidebar |
| `crtx chatgpt connect <crtx> --project <gpt>` | Map a CRTX project to a ChatGPT project |
| `crtx chatgpt test` | Run safe connectivity test without sending a real message |

### Full examples

```bash
# Check status
npx ts-node crtx/cli/index.ts chatgpt status

# List visible ChatGPT projects
npx ts-node crtx/cli/index.ts chatgpt projects

# Connect multiple projects
npx ts-node crtx/cli/index.ts chatgpt connect tiniq   --project TINIQ
npx ts-node crtx/cli/index.ts chatgpt connect travel  --project Travel
npx ts-node crtx/cli/index.ts chatgpt connect univer  --project UNIVER

# Run connectivity test
npx ts-node crtx/cli/index.ts chatgpt test
```

## Configuration

Add to your `.env` file (see `.env.example` for all options):

```dotenv
# Enable/disable the integration
CHATGPT_ENABLED=true

# Show browser window (keep false for debugging, true for headless production)
CHATGPT_HEADLESS=false

# Custom browser profile location (optional — defaults to ~/.crtx/browser/chatgpt)
# CHATGPT_BROWSER_PROFILE_DIR=/custom/path

# Response timeout in milliseconds (default: 2 minutes)
CHATGPT_RESPONSE_TIMEOUT_MS=120000

# Navigation timeout in milliseconds (default: 30 seconds)
CHATGPT_NAVIGATION_TIMEOUT_MS=30000
```

## How Conversations Work

### First message to a CRTX chat/task

```
crtxProjectId = "tiniq"
crtxChatId    = "task-001"
               ↓
ChatGPT Project "TINIQ" opened
               ↓
New conversation created inside TINIQ
               ↓
Conversation URL saved to memory/chatgpt_mapping.json
               ↓
Message sent → Response returned to CRTX
```

### Subsequent messages (same CRTX chat/task)

```
crtxProjectId = "tiniq"
crtxChatId    = "task-001"
               ↓
Stored URL: https://chatgpt.com/c/...
               ↓
Existing conversation reopened (NOT a new one)
               ↓
Message sent → Response returned to CRTX
               ↓
Conversation remains continuous across CRTX restarts
```

## Safety Guards

The integration enforces these safety checks **before every message send**:

1. **Project mapping exists** — CRTX project must be connected to a ChatGPT project  
2. **URL identity check** — browser must be at the exact expected conversation URL before sending  
3. **Navigation anomaly detection** — if the browser navigated to auth or homepage, the send is blocked  

This prevents messages being sent to the wrong project or the wrong conversation.

## GPT ↔ Antigravity Loop

The integration is designed to support the future supervisor loop:

```
USER
 ↓
CRTX
 ↓
Antigravity executes task
 ↓
Antigravity produces structured handoff
 ↓
CRTX sends handoff to ChatGPT (same conversation)
 ↓
ChatGPT analyzes result and produces next task
 ↓
CRTX receives next task
 ↓
Antigravity executes it
 ↓
repeat
```

The ChatGPT conversation acts as the persistent supervisor context. Each CRTX task maps to one ChatGPT conversation, allowing multi-turn analysis over many Antigravity cycles.

## Manual E2E Test Procedure

After setup, verify the complete flow:

1. Run `crtx chatgpt login` — browser opens
2. Log in manually — confirm "Authentication detected."
3. Create ChatGPT Project **TINIQ** manually in ChatGPT UI
4. Run `crtx chatgpt connect tiniq --project TINIQ`
5. Run `crtx chatgpt projects` — verify TINIQ appears in the list
6. Send a test message (via ChatGPTService or a CRTX task with `chatgpt` runtime)
7. Verify a **new** ChatGPT conversation was created **inside the TINIQ project** (not at root)
8. Verify the conversation URL appears in `memory/chatgpt_mapping.json`
9. Send a second message to the same `crtxChatId`
10. Verify the **same** conversation is used (check the URL in the browser matches step 8)
11. Restart CRTX (close and reopen)
12. Send a third message to the same `crtxChatId`
13. Verify the **same** conversation is reopened — no new conversation created
14. Verify `memory/chatgpt_mapping.json` is **not tracked** by git (`git status` should not show it)
15. Verify `.crtx/browser/` is **not tracked** by git

## Troubleshooting

### "ChatGPT authentication required"

Run `crtx chatgpt login` and complete the login in the browser window.

### "ChatGPT Project 'X' was not found"

The project name is case-sensitive and must exactly match what's visible in the ChatGPT sidebar.  
Create the project manually in ChatGPT, then run `crtx chatgpt projects` to see available names.

### "New chat was created but URL did not change"

The ChatGPT UI may have changed. Check `ChatGPTSelectors.ts` — specifically `newChatButton()`.  
Run with `CHATGPT_HEADLESS=false` to watch the browser and identify the correct element.

### "Response timeout"

ChatGPT took longer than `CHATGPT_RESPONSE_TIMEOUT_MS` to respond.  
Increase the timeout: `CHATGPT_RESPONSE_TIMEOUT_MS=300000` (5 minutes).

### Selector failures (UI_CHANGED errors)

All selectors live in one file: [`ChatGPTSelectors.ts`](../src/integrations/chatgpt/ChatGPTSelectors.ts).  
Run with `CHATGPT_HEADLESS=false`, inspect the element in Chrome DevTools, and update the selector.

### "Authentication provider rejected the automated browser environment" (Google block)

Some authentication providers (like Google) block logins from automated browsers (Playwright), showing an error like "This browser or app may not be secure."

**Solution:** Tell Playwright to use your actual installed Google Chrome browser for the login step instead of the bundled Chromium:

```dotenv
# Windows Example
CHATGPT_BROWSER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# macOS Example
CHATGPT_BROWSER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

Set this environment variable, then run `crtx chatgpt login` again. The system will safely relaunch visible mode when session expires to allow you to log in manually again.

## Security Limitations

- **No credentials are stored.** Only the browser profile (cookies/session) is persisted.
- **The browser profile contains your ChatGPT session.** Protect the `CHATGPT_BROWSER_PROFILE_DIR` directory.
- **The profile directory and mapping file are gitignored.** Never commit them.
- **This integration depends on the ChatGPT web UI.** It will break if ChatGPT significantly redesigns its UI.
- **This is not an official ChatGPT API.** There are no uptime or stability guarantees from OpenAI for browser automation.
- **Do not run this in multi-user environments** without isolating browser profiles per user.

## File Structure

```
src/integrations/chatgpt/
├── ChatGPTConfig.ts        — Configuration loader (env vars)
├── ChatGPTErrors.ts        — Typed error codes
├── ChatGPTSelectors.ts     — All UI selectors (single source of truth)
├── ChatGPTChromeManager.ts — Native Chrome process and CDP manager
├── ChatGPTBrowser.ts       — Playwright CDP client (only file using Playwright)
├── ChatGPTMappingStore.ts  — JSON persistence for project/chat mappings
└── ChatGPTService.ts       — Orchestration service (business logic)

src/runtime/adapters/
└── ChatGPTAdapter.ts       — RuntimeAdapter implementation

cli/commands/
└── chatgpt.ts              — CLI subcommands

tests/
├── test_chatgpt.ts         — Unit tests (no browser required)
└── test_chatgpt_browser.ts — Opt-in browser integration tests

memory/
└── chatgpt_mapping.json    — Persisted mappings (gitignored)
```
