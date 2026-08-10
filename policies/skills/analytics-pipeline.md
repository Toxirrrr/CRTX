---
id: analytics-pipeline
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
Backend: every aggregation scoped by `organizationId`. SUPER_ADMIN cross-org views check role first. Heavy aggregations use `$queryRaw` with composite descending time-series indexes. Responses: `{success,data}` via `ResponseInterceptor`.

Endpoints: `/api/v1/analytics/{tasks,sales}/metrics`, `/trends`, `/sales/top-agents`, `/locations/heatmap`, `/export`.

Frontend (#1 regression source):
- `api.client.ts` already unwraps `{success,data}` — stores receive `data` directly. **Never write `response.data.data`** — causes "shows 0/NaN" bugs.
- Chart guards: `if (!width||!height||isNaN(width)) return` and `if (!data?.length) return`.
- Data flow: `Socket→Composable→Store→UI`. Never call API from component — use `services/analytics.service.ts`.

Done check: verify the number is real, org-scoped, and survives reload. Disconnected/fake metrics = No-Fake-UI violation (P4 finding).
