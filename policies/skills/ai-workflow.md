# Agent Ops Platform — AI Workflow

> **ВНИМАНИЕ ВСЕМ АГЕНТАМ!**
> Этот проект использует внешний модуль контекста, расположенный в `docs/ai-context/`.

## 1. Главный источник истины
Все агенты **обязаны** перед началом работы прочитать файл:
`C:\WEB\REAL\AGENT_OPS_PLATFORM\docs\ai-context\PROJECT_STATE.md`

Этот файл содержит:
- Текущий прогресс разработки
- Приоритеты задач (P1, P2 и т.д.)
- Ссылки на другие документы (Архитектура БД, События WebSocket, Design System).

## 2. Рабочий цикл
1. Посмотри свою задачу в `crtx/tasks/`.
2. Прочитай `docs/ai-context/PROJECT_STATE.md`.
3. Сверься с `docs/ai-context/TODO.md`.
4. Изучи `docs/ai-context/DEFINITION_OF_DONE.md`.
5. Пиши код, следуя правилам (Composition API, NestJS, Prisma).
6. После выполнения обнови матрицы статусов в `docs/ai-context/`.

**Важно**: CRTX управляет тасками, но `docs/ai-context` управляет бизнес-логикой и статусом всего проекта.
