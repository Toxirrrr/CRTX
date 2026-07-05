# Передача контекста (LTCE Handover Context)

Этот документ содержит полную сводку текущего состояния проекта Long-Term Context Engine (LTCE) для бесшовного продолжения работы в новом чате.

## Текущий статус проекта
- **Фаза:** `Phase 0: Bootstrap` (Инфраструктура микроядра).
- **Репозиторий:** `C:\WEB\REAL\AGENT_OPS_PLATFORM\crtx\ltce`
- **Достижение:** Микроядро полностью функционально, изолировано от бизнес-логики и инфраструктуры баз данных. Цепочка управления и исполнения замкнута и на 100% покрыта тестами.

## Разработанная архитектура (Zero-Waste & Plugin-First)
Мы построили многослойную архитектуру исполнения, защищенную от превращения в God Object:

1. **Contracts & Plugins:**
   - Ядро взаимодействует с плагинами через `PluginAdapter` и интерфейс `Plugin` (методы `manifest()`, `onLoad()`, `execute()`).
2. **Registry & Catalog:**
   - `PluginCatalog` хранит состояние, `PluginRegistry` отвечает за загрузку.
   - `LifecycleManager` управляет State Machine (`REGISTERED` -> `RUNNING` -> `STOPPED`).
3. **EventBus:**
   - `InMemoryEventBus` осуществляет доставку событий `EventEnvelope` без падений при ошибках подписчиков (Sequential Error-Tolerant Dispatch).
4. **CapabilityRouter & PluginContext:**
   - `CapabilityRouter` работает **только** как индекс возможностей (Capability -> PluginId).
   - `ContextBuilder` формирует защищенный `PluginContext` (Object.freeze, Scoped Logger, адаптер для CapabilityLookup). Это исключает Service Locator антипаттерн.
5. **Execution Pipeline:**
   - `CommandDispatcher` (Исполнитель команд) отделен от шины событий и использует `SelectionPolicy` (сейчас `FirstMatchPolicy`) для выбора кандидата.
   - `PipelineExecutor` собирает цепочку `PipelineBehavior` (Onion-архитектура).
   - `TelemetryBehavior` измеряет время и отправляет метрики в `TelemetrySink`.
6. **Scheduling:**
   - `Scheduler` (сейчас `InMemoryScheduler`) принимает команды и расписания. Не знает о логике выполнения, делегирует всё `CommandExecutor`.
7. **Orchestrator & Planner:**
   - `Orchestrator` координирует работу: принимает `Event`, передает его в `Planner`.
   - `RegistryPlanner` маппит события на нужный `Planner`, который генерирует `Command[]`.
   - `Orchestrator` отправляет сгенерированные команды в `Scheduler`. Никакого прямого выполнения или switch-statement.

### Итоговый поток (Full Flow):
`Domain Event -> Orchestrator -> Planner -> Scheduler -> PipelineExecutor -> TelemetryBehavior -> CommandDispatcher -> Plugin.execute()`

## Следующий шаг (Next Step)
Следующий компонент, который мы должны разработать: **`Storage / Persistence`**.
Так как ядро уже умеет выполнять команды и реагировать на события, настало время подключить хранилище. `Storage` должен быть инфраструктурным слоем (Repository Pattern), который позволит сохранять:
- События (Event Store).
- Состояния плагинов.
- Отложенные задачи Scheduler'а.

## Строгие правила для нового чата:
- Соблюдать `LTCE_IMPLEMENTATION_GUIDE.md`.
- Следовать локальным правилам проекта (файлы создаются строго в соответствующих директориях монорепозитория, язык общения — русский, общение с пользователем по имени Тохир).
- `Storage` не должен диктовать условия ядру, он является подключаемым адаптером.
