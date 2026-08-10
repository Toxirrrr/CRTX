---
id: ai-workflow
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
# Agent Ops Platform — AI Workflow

> **ВНИМАНИЕ ВСЕМ АГЕНТАМ!**
> Этот проект использует внешний модуль контекста, расположенный в `docs/ai-context/`.

## 1. Главный источник истины
Все агенты **обязаны** перед началом работы прочитать файл:
`C:\WEB\REAL\AGENT_OPS_PLATFORM\docs\ai-context\PROJECT_STATE.md`

## 2. Обязательный стандарт разработки (Pre-Implementation Checks)
Любой AI-агент перед написанием кода обязан использовать доступные инструменты поиска (skills) для проверки лучших практик:

### 🎨 UI / UX Pipeline
1. Использовать `modern-web-guidance` для проверки современных паттернов.
2. Провести Design System Audit.
3. Провести Existing Pattern Audit (поиск аналогичных компонентов в проекте).
4. Только после этого -> Implementation.

### ⚙️ Backend Pipeline
1. Использовать `find-docs` для проверки актуального API (NestJS, Prisma, BullMQ).
2. Использовать `context7` для поиска примеров реализации.
3. Только после этого -> Implementation.

### 🚀 Release Freeze Pipeline
1. Architecture Audit (не нарушает ли текущую архитектуру).
2. Minimal Diff (минимальные изменения существующего кода).
3. Verification (проверка работоспособности).
4. `npm run type-check`.
5. Linting.
6. Tests.

## 3. Рабочий цикл
1. Посмотри свою задачу в `crtx/tasks/`.
2. Прочитай `docs/ai-context/PROJECT_STATE.md`.
3. Выполни соответствующий **Pipeline (UI/UX или Backend)**.
4. Пиши код (Implementation).
5. Заверши через **Release Freeze Pipeline** (type-check, tests).
6. После выполнения обнови матрицы статусов в `docs/ai-context/`.
