# Capsule C001: Knowledge Engine Structure

## State Snapshot
- **Task:** T001-knowledge-engine
- **Current Phase:** Schema Definition (Completed)
- **Next Phase:** Extraction (Pending)

## Architectural Context
We have shifted from a "web scraping" paradigm to a "structured pattern extraction" paradigm.
The goal is NOT 500 screenshots. The goal is 100-150 rigorous JSON files representing universal UX/UI solutions.

## Handoff Instructions for the Next Agent (Capability: Extraction)
1. **Target:** `c:/WEB/REAL/PORTFOLIO/knowledge/`
2. **Schema:** You MUST validate any JSON you generate against `knowledge/_schema.json`. 
3. **Fields:** Every pattern needs an ID (e.g. `HERO-001`), `name`, `category`, `problem`, `solution`, `examples` (array), and `confidence` (0.0 - 1.0).
4. **Sources:** Refer to `knowledge/SOURCES.md`. Start your extraction strictly with Tier 1 products (Linear, Stripe, Vercel, GitHub).
5. **Execution:** Pick a category (e.g., `dashboard`), research how Linear and Stripe solve large navigation complexity, and create `PATTERN-001.json`.

Do not create markdown blobs. Create strict JSON patterns.
