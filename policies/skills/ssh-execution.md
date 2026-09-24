---
trigger: always_on
description: Mandatory rules for efficient and safe execution of remote SSH commands.
---

# SSH Execution Efficiency Rule

**CRITICAL CONSTRAINT:**

When interacting with remote servers via SSH, **DO NOT open a new SSH connection for every individual command when the commands can safely be executed within the same remote execution context.**

## 1. Reuse an Existing Session

If the terminal/tooling supports a persistent SSH session, keep the session open and execute subsequent remote commands inside it.

Do not reconnect unnecessarily.

## 2. Group Remote Commands

If persistent sessions are not supported, group related server-side commands into a single SSH invocation.

Prefer:

```bash
ssh user@host "command1 && command2 && command3"
```

for commands where later steps depend on earlier steps succeeding.

Use:

```bash
ssh user@host "command1; command2; command3"
```

only when commands are intentionally independent and execution should continue even if one command fails.

## 3. Use Heredocs or Scripts for Complex Work

For multi-step diagnostics, deployment preparation, testing, or server inspection, prefer a single remote script/heredoc:

```bash
ssh user@host 'bash -s' <<'REMOTE'
set -e
command1
command2
command3
REMOTE
```

For longer repeatable procedures, use an existing project script or a dedicated remote script rather than generating many independent SSH calls.

## 4. Bad Pattern

Do NOT do this for related operations:

```bash
ssh user@host "docker ps"
ssh user@host "docker stats --no-stream"
ssh user@host "docker logs app"
ssh user@host "df -h"
ssh user@host "free -h"
```

This unnecessarily repeats TCP/SSH connection establishment.

## 5. Good Pattern

Prefer:

```bash
ssh user@host "docker ps; echo '---'; docker stats --no-stream; echo '---'; docker logs --tail 50 app; echo '---'; df -h; echo '---'; free -h"
```

because these are independent diagnostic commands.

For dependent operations:

```bash
ssh user@host "cd /srv/agent-ops && git status && npm run build && npm run smoke"
```

## 6. Failure Semantics Must Be Preserved

Do not replace `&&` with `;` merely to reduce SSH calls.

The grouping strategy must preserve the intended failure behavior.

Use:

```text
&&
```

when failure should stop subsequent steps.

Use:

```text
;
```

when subsequent commands are intentionally independent.

Use:

```bash
set -e
```

inside multi-step remote scripts when the procedure should stop on failure.

## 7. Avoid SSH Spam

Before executing a remote command, check whether:

* it can be combined with the current remote operation;
* it can be executed in the existing SSH session;
* several inspection commands can be collected into one diagnostic invocation;
* an existing project script already performs the required operation.

Do not trade correctness for fewer SSH calls.

## 8. Security and Production Safety

This rule does NOT authorize:

* destructive commands;
* database mutations;
* migrations;
* production deployment;
* firewall changes;
* service restarts;
* credential changes;
* bypassing project safety rules.

Command grouping is an **execution-efficiency rule**, not an authorization rule.

All existing project safety, production, database, and deployment rules remain higher priority.

## PRINCIPLE

Prefer:

```text
ONE SSH SESSION
        OR
ONE GROUPED SSH INVOCATION
        OR
ONE REMOTE SCRIPT
```

instead of:

```text
ONE SSH CONNECTION PER COMMAND
```

while always preserving command failure semantics and project safety constraints.
