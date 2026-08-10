---
id: i18n-localization
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
# 🌍 i18n & Localization (Uzbekistan Focus)

**CRITICAL:** No hardcoded strings in Vue components or backend exceptions.

## 1. Vue i18n
- Always use `$t('key.subkey')` in templates.
- If adding new text, add it to the respective JSON files (e.g., `ru.json`, `uz.json`).
- Utilize lazy-loading for i18n chunks (already implemented in Waves 1-5).

## 2. Uzbekistan Regional Settings (Mandatory)
- **Currency:** ONLY use `UZS` (Uzbekistani Som). Never use USD, RUB, or EUR. 
- **Phone Numbers:** Must strictly start with `+998` and follow local validation (e.g., +998 90 123 45 67).
- **Locations:** All default map coordinates, demo data, and addresses must point to **Tashkent, Uzbekistan**.

## 3. Dates and Timezones
- Format dates using local timezone context. Prefer relative dates ("2 часа назад") where applicable.
