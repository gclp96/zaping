# ADR-003 — Soft Delete Strategy

**Status:** Accepted

**Version:** 1.0.0

**Date:** 2026-07-10

**Decision Makers:**
Zaping Architecture Team

---

# Context

Business systems contain information that often has legal, operational and historical value.

Deleting records permanently may break audit trails, reports and historical references.

The platform requires long-term traceability.

---

# Problem

How should records be deleted?

Should information be permanently removed?

Or should it remain available for historical purposes?

---

# Options Considered

## Option A — Hard Delete

DELETE FROM table

Advantages

- Simple
- Less storage

Disadvantages

- Data loss
- Broken references
- Lost audit history
- Impossible recovery

---

## Option B — Soft Delete (Selected)

Records remain stored.

A timestamp marks deletion.

Advantages

- Full history
- Recovery
- Audit support
- Better reporting
- Regulatory compliance

Disadvantages

- Slightly more complex queries
- Additional indexes

---

# Decision

Business entities use Soft Delete.

Deleted records remain stored.

Applications treat deleted records as inactive.

---

# Implementation

Every business entity contains:

deletedAt DateTime?

Active records:

deletedAt = NULL

Deleted records:

deletedAt != NULL

---

# Business Rules

Deleted records:

Cannot be modified.

Cannot appear in normal searches.

May appear in audit reports.

May be restored when business rules allow.

---

# Modules Affected

Customers

Suppliers

Products

Quotes

Sales

Purchases

Users

Companies

Future Modules

---

# Modules Excluded

Inventory Movements

Audit Logs

Security Logs

These records are immutable.

They are never deleted.

---

# Query Rules

Default queries exclude deleted records.

Administrative reports may include them.

Restoration requires proper authorization.

---

# Consequences

Positive

Historical integrity

Audit support

Safer operations

Recovery capability

Negative

Additional query filtering

Additional indexing

---

# Related ADRs

ADR-001 Multi-Tenant

ADR-002 Inventory Movements

---

# Final Principle

Business data should disappear from the user interface, not from history.