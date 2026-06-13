# tasks/

One JSON file per task: `<ID>.json` (copy `_TEMPLATE.json`).

## Fields
- `id` — stable task ID (e.g. `F10` = Finding/Feature #10 from a
  roadmap/audit; pick any scheme, just keep it unique).
- `owner` — `claude` | `antigravity` | `fable` | `human`.
- `status` — `pending` | `in_progress` | `blocked` | `review` | `done`.
- `domain` — `SALES` | `LOGISTICS` | `INVENTORY` | `OPERATIONS` |
  `ADMINISTRATION` | `META` (optional, for routing).
- `files` — files this task expects to touch (informational; actual
  exclusivity is enforced via `locks/`).
- `notes` — free text, current state / blockers.

## Rules
- Before setting `status: in_progress`, check no other task with
  overlapping `files` is already `in_progress` under a different `owner`.
- Update `updatedAt` on every change.
- Never delete a `done` task file — it's part of the project history (move
  to `memory/context/` if this directory gets too large).
