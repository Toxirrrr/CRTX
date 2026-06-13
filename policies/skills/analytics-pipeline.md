---
name: analytics-pipeline
description: Analytics rules spanning this backend and the admin panel — org-scoped aggregation, the api.client unwrap gotcha, chart pre-data guards, and the metrics/trends/heatmap/export endpoints. Use when editing analytics.service.ts, analytics endpoints, or analytics stores/charts.
---

# Analytics Pipeline (Agent Ops Platform)

## Backend
- Every aggregation query is scoped by `organizationId` — analytics is a common tenant-isolation leak path. SUPER_ADMIN cross-org views check role first.
- Endpoints: `/api/v1/analytics/{tasks,sales}/metrics`, `/trends`, `/sales/top-agents`, `/locations/heatmap`, `/export`.
- Heavy aggregations use `$queryRaw` with proper indexes (time-series composite descending indexes).
- Responses wrapped by `ResponseInterceptor` as `{ success, data }`.

## Frontend (the #1 regression source)
- **`api.client.ts` already unwraps `{ success, data }`** — stores receive `data` directly. **Do NOT write `response.data.data`.** This is the single most common cause of "analytics shows 0/NaN" bugs.
- Guard chart rendering against pre-data renders:
  - `if (!width || !height || isNaN(width)) return`
  - `if (!data || data.length === 0) return`
- Data flow stays `Socket → Composable → Store → UI`. Never call the API from a component — go through `services/analytics.service.ts`.

## Reality check
"Analytics shows a number" is not done — verify the number is real, org-scoped, and survives reload. Disconnected/fake metrics are a No-Fake-UI (P4) finding.
