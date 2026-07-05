# UX-3 — Page Action Architecture (Action Taxonomy Standard)

- **Decision ID:** D021
- **Status:** ACCEPTED — binding standard (not an optional recommendation)
- **Date:** 2026-06-27
- **Scope:** frontend (`client/`), and pre-emptively `mobile/` before Mobile Foundation starts
- **Relates to:** UX-1 Navigation Foundation ✓, UX-2 Button Foundation ✓
- **Supersedes framing of:** "Button Standard" — this is broader and replaces it as the governing UI-action rule.

## Why this exists

The Button Architecture Audit and the Page Action Architecture Audit found that the
problem is **not** button styling. The platform was built module-by-module, and each
module re-invented its page actions. The result is four architectural UX defects:

1. **Create Verb Fragmentation** — the same "open create drawer" action is labeled
   `Создать` / `Добавить` / `Новый` across pages.
2. **Navigation vs Action Confusion** — Dashboard "Quick Actions" are sidebar
   duplicates (navigation), not actions.
3. **Entity Navigation Inconsistency** — row-click sometimes opens a drawer,
   sometimes routes to a detail page; handler names diverge.
4. **CRUD vs Workflow Conflation** — operational verbs (Approve/Reject/Dispatch) are
   styled as generic CRUD and have no distinct class.

> **Core principle: Buttons are not the problem. Action Architecture is the problem.**

This document ratifies the **Action Taxonomy** that closes all four. It is mandatory
**before** Mobile Foundation begins, so mobile inherits a sealed taxonomy
(Build Once, Scale Forward).

---

## 1. Action Classes (LOCKED)

Every interactive control on a page MUST resolve to exactly one of these five classes.
No sixth class may be introduced without a new decision record.

| Class | Role | Variant | Placement | Examples | Never |
|---|---|---|---|---|---|
| **PRIMARY_ACTION** | The one defining action of a surface | `primary` | Always rightmost in the action group | Создать задачу · Создать пользователя · Создать визит | More than one per surface; never on the left |
| **SECONDARY_ACTION** | Supporting, non-defining actions | `outline` | Immediately left of the primary | Обновить · Экспорт · Фильтр | Never styled `primary`; never destructive |
| **DANGER_ACTION** | Irreversible / destructive | `destructive` | Never in the page header; in-row, in-drawer, or in a confirm dialog | Удалить · Архивировать · Заблокировать | Never in a page header; never without confirmation |
| **WORKFLOW_ACTION** | Operational state transitions (NOT CRUD, NOT navigation) | dedicated workflow styling (see §6) | Contextual to the entity/row/drawer | Утвердить · Отклонить · Назначить · Отправить · Завершить · Принять | Never reuse generic `primary`/`outline` as if it were CRUD |
| **NAVIGATION_ACTION** | Moving between locations | link styling, never CTA weight | Breadcrumb bar, row, back-link | Breadcrumb · Row Click · Назад · Открыть детали | **Never look like a CTA** (no `primary`/`outline` button for pure navigation) |

**Surface = a page region with its own action context** (page header, table toolbar,
drawer footer, modal footer). The "one PRIMARY_ACTION per surface" rule is per-surface,
not per-page.

---

## 2. Create Verb Standard (LOCKED)

The create action has exactly one token, org-wide: **`Создать <noun>`**.

`Добавить` and `Новый/Новая/Новое` are eliminated for the create action. Rationale:
`Добавить` implies adding to an existing set; `Новый` is an adjective that forces
gender agreement per noun. `Создать` is the single semantically-neutral verb.

| Current (eliminate) | Standard |
|---|---|
| Добавить ТМЦ | Создать ТМЦ |
| Добавить магазин | Создать магазин |
| Добавить склад | Создать склад |
| Добавить водителя | Создать водителя |
| Новый пользователь | Создать пользователя |
| Новый ТС | Создать транспорт |
| Новая смена | Создать смену |
| Новая территория | Создать территорию |
| Новая задача | Создать задачу |
| Создать заявку / визит / продукт | (already conformant) |

---

## 3. Dashboard Quick Actions (LOCKED)

Dashboard Quick Actions MUST be **actions**, not navigation. The sidebar already owns
navigation; duplicating it as tiles is a UX anti-pattern.

- **Forbidden:** `Перейти в Заказы`, `Перейти в Склад`, `Перейти в Магазины`
  (i.e. `to="/inventory"`, `to="/sales"`, … tiles).
- **Required:** real create / assign actions, e.g.
  `Создать задачу` · `Создать заказ` · `Создать возврат` · `Назначить маршрут`.

A Quick Action opens the relevant create drawer / assignment flow in place — it does
not merely route to a page the sidebar already links.

---

## 4. Forms — Submit/Cancel Triad (LOCKED)

Form submit labels MUST distinguish create from edit. `DrawerFooter` (and the modal
equivalent) gains a `mode: 'create' | 'edit'`:

| Context | Submit label | Cancel label |
|---|---|---|
| Create | **Создать** | Отмена |
| Edit | **Сохранить изменения** | Отмена |

A single hardcoded `Сохранить` for both create and edit is non-conformant.

---

## 5. Page Header Contract (LOCKED)

All list/index pages share one header contract:

```
[ Title (text-xl font-semibold) / Subtitle ]            [ SECONDARY… ] [ PRIMARY_ACTION ]
                                          (flex justify-between)
```

- Title typography: `text-xl font-semibold` (the `text-2xl font-bold` variant is
  non-conformant).
- PRIMARY_ACTION always rightmost; SECONDARY immediately to its left.
- **DANGER_ACTION never in the header.**
- **Filters never raw in the header** — filters belong in the table toolbar /
  `AppSearchFilter`, not as bare `<select>`/`<input>` in the header row.
- Workflow back-navigation is a NAVIGATION_ACTION (breadcrumb/back-link), not a
  `secondary` button.
- List pages use `AppTable` + `AppSearchFilter` — raw `<table>`/`<input>` is
  non-conformant (`sales/index.vue` is the reference offender).

---

## 6. Entity Navigation (LOCKED)

- **Row click = Open Entity**, everywhere, with one consistent handler name
  (`onRowClick`).
- Sub-rule for what "open" means:
  - **Editable entity** → open the detail **drawer** in place.
  - **Entity with a dedicated operational detail page** → route to `/[id]`.
- Diverging handler names (`goToDetails`, `openEditStore`, `openEdit`, `openDrawer`)
  are consolidated to `onRowClick`.

---

## 7. Link Taxonomy (LOCKED)

Navigation must be visually and semantically distinct from CTAs:

- **BreadcrumbLink** — location trail / `Назад`. Link weight, never a `secondary` button.
- **EntityLink** — a reference to another entity (row click, entity name). Opens the entity.
- **ActionLink** — text-link that triggers an action (rare; prefer a button class).

No navigation may carry `primary`/`outline` button weight.

---

## Conformance Baseline (at ratification)

**Aggregate ≈ 58 / 100.**

| Area | Score | Note |
|---|---|---|
| Header pattern | 70% | offenders: `sales` (raw table), `returns` (workflow header), title-scale split |
| Entity navigation | 65% | gesture consistent; intent/handler-name divergent; `inventory` has no row-nav |
| Quick Actions | 20% | dashboard is 100% navigation duplicates |
| Forms | 50% | no create/edit label distinction |
| Links | 40% | no link taxonomy; back-nav rendered as buttons |
| Workflow actions | 45% | not a distinct class yet |

Conformant references today: `users`, `inventory`, `visits` (list-page skeleton).

---

## Execution Sequence (post-freeze)

Implementation is **blocked by the rc-2026-06-26 freeze** (a multi-module UX
restructure is not bug/security/deploy). It executes after the freeze lifts and
**before** Mobile Foundation, in this order:

| Step | Work | Why first/last |
|---|---|---|
| **UX-3A** | Decision ratification (this document) | unblocks the rest; freeze-safe, done now |
| **UX-3B** | Dashboard Quick Actions → real actions | highest-impact, smallest surface |
| **UX-3C** | `sales` → `AppTable` migration | removes the worst off-architecture page |
| **UX-3D** | Create Verb unification (`Создать`) | global label sweep |
| **UX-3E** | Navigation/Link taxonomy (`onRowClick`, breadcrumbs) | consolidates entity-nav |
| **UX-3F** | Workflow Action system (distinct WORKFLOW_ACTION styling) | operational screens |

After UX-3F: Navigation ✓ + Button ✓ + Page Action ✓ → UI is genuinely
Mobile-ready under Build Once, Scale Forward.

---

## Enforcement

- This standard is binding for all new frontend work and for `mobile/` before Mobile
  Foundation. New pages MUST conform on creation.
- Implementing agents (`frontend-engineer`) must read this standard; it should be bound
  into `crtx/policies/skills/` so it is loaded at implementation time (follow-up hook,
  see D021).
- A page-action change is "done" only under the project Done Criteria: works in browser,
  realtime propagates where relevant, survives reload — not merely Build+Lint+TS pass.
