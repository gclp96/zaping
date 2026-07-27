# ADR-002 — Inventory Movements as the Source of Truth

**Status:** Accepted

**Version:** 1.0.0

**Date:** 2026-07-10

**Decision Makers:**
Zaping Architecture Team

---

# Context

Inventory management is one of the most critical capabilities of the Zaping platform.

Traditional ERP systems often store inventory as a mutable stock value directly on each product.

Example:

Product

CurrentStock = 150

While simple, this approach makes auditing, traceability and historical reconstruction difficult.

The platform requires complete traceability for industries such as healthcare.

---

# Problem

How should inventory be represented inside Zaping?

Should inventory be stored as a mutable quantity?

Or should inventory be calculated from business events?

---

# Options Considered

## Option A — Mutable Stock

Each product stores a current stock value.

Inventory operations modify that value directly.

Advantages

Simple implementation.

Fast queries.

Easy reporting.

Disadvantages

No historical reconstruction.

Poor auditability.

High risk of inconsistencies.

Corrections overwrite history.

Not suitable for regulated industries.

---

## Option B — Inventory Movements (Selected)

Inventory is represented as immutable movements.

Current stock is calculated as the result of those movements.

Advantages

Complete traceability.

Historical inventory.

Immutable audit trail.

Supports lots and serial numbers.

Supports expiration management.

Supports future warehouses.

Supports inventory valuation.

Disadvantages

More complex implementation.

Requires aggregation.

Requires optimized queries.

---

# Decision

InventoryMovement is the source of truth.

Inventory represents a projection optimized for querying.

Current stock must always be derivable from Inventory Movements.

---

# Conceptual Model

Purchase

↓

Inventory Movement

↓

Inventory Projection

↓

Current Stock

↓

Dashboard

Every inventory operation generates a movement.

Inventory is never modified manually.

---

# Implementation Rules

Every inventory change creates an Inventory Movement.

Inventory records are projections.

Inventory movements are immutable.

Inventory corrections generate compensating movements.

Inventory movements are never deleted.

---

# Supported Movement Types

INITIAL_BALANCE

PURCHASE

SALE

RETURN_IN

RETURN_OUT

ADJUSTMENT_IN

ADJUSTMENT_OUT

TRANSFER_IN

TRANSFER_OUT

STOCK_COUNT

---

# Consequences

Positive

Full auditability.

Historical inventory reconstruction.

Complete traceability.

Healthcare compliance.

Future warehouse support.

Future analytics.

Future AI forecasting.

Negative

Additional implementation complexity.

More aggregation queries.

Need for performance optimization.

---

# Future Evolution

The architecture supports future features including:

Multiple warehouses.

Batch traceability.

Serial tracking.

Inventory valuation.

FIFO.

FEFO.

LIFO (configurable if required).

Demand forecasting.

Automatic replenishment.

Inventory AI.

---

# Modules Affected

Inventory

Purchases

Sales

Dashboard

Audit

Reports

Notifications

Future WMS

---

# Related ADRs

ADR-001 Multi-Tenant

ADR-003 Soft Delete

ADR-005 Layered Architecture

---

# Final Principle

Inventory is not a number.

Inventory is the result of business events.

InventoryMovement is the only source of truth.