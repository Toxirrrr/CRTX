---
id: api-dto-validation
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
# 🛡️ API & DTO Validation (Payload Guards)

**CRITICAL:** Prevent garbage data from reaching the backend when UI states change.

## 1. Dynamic Form Protection (Context Guards)
- When switching between context types (e.g., changing a Task from `VISIT` to `REPLENISHMENT`), **always clear** fields that are no longer valid for the new type.
- Example: A `VISIT` task cannot have a `warehouseId`. If switching from `REPLENISHMENT` to `VISIT`, `warehouseId` must be set to `null` or `''`.

## 2. DTO Whitelisting (Payload Guards)
- Do not spread raw form objects (`...values`) directly into API service calls.
- Explicitly construct the payload object to ensure only valid fields are sent to the API.

## 3. User Input Protection
- If a user manually types data (e.g., `title`), do not automatically overwrite it with a generated string later (Context Guard).
