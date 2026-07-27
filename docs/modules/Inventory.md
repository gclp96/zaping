# Inventory Module

**Version:** 1.0.0
**Status:** Approved
**Sprint:** Sprint 09
**Last Updated:** 2026-07-10
**Owner:** Zaping Team

---

# 1. Overview

## Purpose

The Inventory module manages product availability through an inventory movement model, providing complete traceability, auditability and consistency across the ERP.

Unlike traditional systems that only store a stock value, Zaping treats inventory as a sequence of immutable business events.

---

## Business Goals

- Know stock levels in real time.
- Track every inventory movement.
- Manage lots.
- Manage serial numbers.
- Control expiration dates.
- Prevent inventory inconsistencies.
- Support healthcare industry requirements.
- Enable future warehouse management.

---

# 2. Scope

### Included

- Inventory entries
- Inventory outputs
- Inventory adjustments
- Initial balances
- Lots
- Serial numbers
- Expiration dates
- Inventory movements
- Inventory valuation (future)

### Excluded

- Warehouse management
- Picking
- Packing
- Logistics
- Purchase forecasting

---

# 3. Business Flow

```text
Purchase
    │
    ▼
Inventory Entry
    │
    ▼
Available Inventory
    │
 ┌──┴──────────────┐
 ▼                 ▼
Sale          Adjustment
 │                 │
 ▼                 ▼
Inventory Movement
 │
 ▼
Updated Inventory
```

---

# 4. Inventory Philosophy

Inventory is never modified directly.

Every change must generate an Inventory Movement.

```
Stock = Σ Inputs − Σ Outputs
```

Inventory records exist only as projections generated from movement history.

---

# 5. Inventory Movement Types

| Type | Description |
|------|-------------|
| INITIAL_BALANCE | Initial inventory |
| PURCHASE | Purchase entry |
| SALE | Sale output |
| RETURN_IN | Customer return |
| RETURN_OUT | Supplier return |
| ADJUSTMENT_IN | Positive adjustment |
| ADJUSTMENT_OUT | Negative adjustment |
| TRANSFER_IN | Warehouse transfer in |
| TRANSFER_OUT | Warehouse transfer out |
| STOCK_COUNT | Physical inventory count |

---

# 6. Inventory Movement

Each movement stores:

- Company
- Product
- Quantity
- Unit Cost
- Movement Type
- Source Document
- User
- Date
- Notes
- Lot
- Serial Number
- Expiration Date
- Warehouse (future)

---

# 7. Lots

Each lot includes:

- Lot Number
- Supplier
- Purchase
- Manufacturing Date
- Expiration Date
- Remaining Quantity

---

# 8. Serial Numbers

Each serial number stores:

- Serial Number
- Product
- Purchase
- Sale
- Current Customer
- Status

---

# 9. Expiration Management

Supported features:

- Expiration alerts
- FEFO inventory allocation
- Block expired products
- Expiration dashboard

---

# 10. Business Rules

## Inventory cannot become negative.

---

## Inventory movements are immutable.

---

## Inventory is never edited manually.

---

## Inventory corrections generate compensating movements.

---

## Products may require:

- Lot
- Serial
- Expiration Date

depending on product configuration.

---

# 11. Permissions

| Permission | Description |
|------------|-------------|
| inventory.read | View inventory |
| inventory.adjust | Perform adjustments |
| inventory.transfer | Transfer inventory |
| inventory.count | Physical counts |
| inventory.export | Export information |

---

# 12. Validations

### Entry

Quantity > 0

---

### Output

Available Stock ≥ Requested Quantity

---

### Serial

Must be unique.

---

### Lot

Required if product configuration requires it.

---

### Expiration

Expired products cannot be sold.

---

# 13. Domain Events

- InventoryMovementCreated
- InventoryAdjusted
- InventoryTransferred
- InventoryCountCompleted
- InventoryLowStock
- InventoryExpired
- InventoryNegativeAttemptBlocked

---

# 14. Module Integrations

| Module | Purpose |
|----------|---------|
| Products | Product information |
| Purchases | Inventory entries |
| Sales | Inventory outputs |
| Suppliers | Purchase source |
| Customers | Returns |
| Audit | History |
| Dashboard | KPIs |
| Notifications | Alerts |

---

# 15. KPIs

- Current Stock
- Low Stock
- Out of Stock
- Inventory Value
- Products Expiring Soon
- Inventory Turnover
- Monthly Entries
- Monthly Outputs
- Inventory Adjustments

---

# 16. Future Roadmap

## Phase 1

- Inventory Movements
- Lots
- Serials
- Expiration

## Phase 2

- Warehouses
- Transfers
- Cycle Counting

## Phase 3

- Warehouse Locations
- Barcode Scanner
- QR Scanner
- Mobile Warehouse App

## Phase 4

- RFID
- Smart Replenishment
- AI Forecasting
- WMS Integration

---

# 17. Technical Architecture

```
Purchase
        │
        ▼
InventoryMovement
        │
        ▼
Inventory Projection
        │
        ▼
Current Stock
```

InventoryMovement is the source of truth.

Inventory represents a calculated projection optimized for read performance.

---

# 18. Future Improvements

- Multi-company inventory analytics.
- Multi-warehouse support.
- Batch traceability reports.
- Regulatory compliance reports.
- Automatic replenishment.
- Predictive inventory.

---

# INV-003B — Purchase Inventory Batches

**Version:** 1.0.0  
**Status:** Ready for Implementation  
**Module:** Inventory  
**Related Module:** Purchases  
**Priority:** Critical  

## 1. Purpose

Allow inventory batches to be created automatically when a purchase is confirmed.

Each batch provides traceability for:

- Product.
- Company.
- Lot number.
- Expiration date.
- Current quantity.
- Inventory movements.
- Purchase of origin.

## 2. Scope

This feature includes:

- Capturing a lot number in each purchase item.
- Capturing an expiration date in each purchase item.
- Creating or updating an inventory batch when confirming a purchase.
- Creating an inventory movement of type `IN`.
- Associating the inventory movement with the batch.
- Updating the product stock.
- Preventing duplicate inventory entries.

## 3. Business Flow

```text
Purchase DRAFT
      ↓
Capture lot and expiration date
      ↓
Confirm purchase
      ↓
Validate purchase and products
      ↓
Create or update inventory batch
      ↓
Create inventory movement IN
      ↓
Update product stock
      ↓
Purchase CONFIRMED