---
name: page-action-architecture
description: Page action/UI rules for client/** (and mobile/** pre-Foundation). Read BEFORE building any page header, button, row action, form, or dashboard tile. Source of truth = D021.
---
Source of truth: `crtx/decisions/D021.json` + `crtx/decisions/UX-3-page-action-architecture.md`. These are the enforceable rules.

Every control = exactly ONE of 5 classes:
- PRIMARY_ACTION: the one defining action. `variant=primary`. Rightmost in the group. Max ONE per surface (header/toolbar/drawer-footer/modal-footer each = a surface).
- SECONDARY_ACTION: supporting. `variant=outline`. Immediately left of primary. Never primary, never destructive.
- DANGER_ACTION: destructive. `variant=destructive`. NEVER in a page header. Always confirmed.
- WORKFLOW_ACTION: operational state transitions (Утвердить/Отклонить/Назначить/Отправить/Завершить/Принять). Distinct class — never styled as generic CRUD or navigation.
- NAVIGATION_ACTION: links/breadcrumbs/row-click/Назад. NEVER carries CTA weight (no primary/outline button for pure navigation).

Create verb: ONE token org-wide = `Создать <noun>`. `Добавить`/`Новый`/`Новая` are forbidden for the create action.

Header contract (list pages): `flex justify-between`; title `text-xl font-semibold` (NOT `text-2xl font-bold`); SECONDARY then PRIMARY rightmost. No DANGER in header. No raw `<select>`/`<input>` filters in header — filters go in the table toolbar / `AppSearchFilter`. Back-nav = breadcrumb/back-link (NAVIGATION_ACTION), never a `secondary` button.

List pages: use `AppTable` + `AppSearchFilter`. Raw `<table>`/`<input>` = non-conformant.

Quick Actions (dashboard): real actions only (`Создать задачу`/`Создать заказ`/`Создать возврат`/`Назначить маршрут`). Sidebar-navigation duplicates (`to="/inventory"` tiles) are forbidden.

Entity navigation: row click = Open Entity, handler `onRowClick`. Editable entity → open detail drawer in place. Entity with a dedicated detail page → route to `/[id]`. Do not invent `goToDetails`/`openEdit`/`openDrawer` variants.

Forms (DrawerFooter / modal): submit label by mode — create=`Создать`, edit=`Сохранить изменения`. Cancel always=`Отмена`. A single hardcoded `Сохранить` for both = non-conformant.

Done: not Build+Lint+TS alone — works in browser, realtime propagates where relevant, survives reload.
