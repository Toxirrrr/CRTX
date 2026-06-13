---
name: inventory-engine
description: Inventory & replenishment rules for this backend — StockMovement-first mutation, polymorphic InventoryNode, thresholds/alerts, the replenishment cascade, and map-marker color. Use when editing server/src/modules/inventory/ or replenishment/, or any stock quantity change.
---

# Inventory Engine (Agent Ops Platform)

`InventoryNode` = per-SKU stock at one location (`Store` XOR `Warehouse`, polymorphic via optional FKs + `type` discriminator).

## No direct quantity mutation — ever
Every change creates a `StockMovement` row **first**:
- `INBOUND` / `OUTBOUND` / `ADJUSTMENT` — single node.
- `TRANSFER` — requires **both** source and destination nodes.

There is no path to mutate `quantity` without a movement. This is both data-integrity and a hard security rule: movement history is **immutable** (never delete/edit `StockMovement`), it's a financial audit trail.

## Alerts
- `quantity < minThreshold` → low-stock alert.
- `quantity == 0` → stockout alert; may auto-create a `ReplenishmentRequest`.

## Replenishment cascade + status machine
`PENDING → APPROVED → IN_TRANSIT → DELIVERED` (or `REJECTED`).
```
Store stock < threshold → alert → ReplenishmentRequest
  → APPROVED (warehouse stock RESERVED + pickup Task created)
  → Driver picks up (StockMovement OUTBOUND, IN_TRANSIT)
  → Driver delivers (StockMovement INBOUND, DELIVERED, Store node updated)
  → map marker recolors
```

## Map
Store marker color is derived from **aggregate** node state (🟢 healthy / 🟡 low / 🔴 stockout). Never render individual inventory items as map markers — details belong in the entity Drawer.

## Domain boundaries (hard)
Store = retail only (shelfInventory, pointOfSale). Warehouse = bulk only (bulkStorage, pickPack, supplierRelations). Never cross-contaminate.
