# ADR-007 — Role-Based Access Control (RBAC)

**Status:** Accepted

**Version:** 1.0.0

**Date:** 2026-07-10

**Decision Makers**
Zaping Architecture Team

---

# Decision Summary

Zaping adopts a Role-Based Access Control (RBAC) model.

Permissions are assigned to Roles.

Users receive permissions through Roles.

Business logic should validate permissions rather than user types.

---

# Context

The platform serves organizations with multiple users performing different responsibilities.

Examples include:

Administrators

Sales Representatives

Warehouse Operators

Purchasing Managers

Finance

Auditors

Different users require different capabilities.

---

# Problem Statement

Should authorization be based only on user roles?

Or should permissions be managed independently?

---

# Decision Drivers

Flexibility

Maintainability

Scalability

Security

Enterprise Readiness

---

# Options Considered

## Option A — Role Only

Users belong to one role.

Role defines behavior.

Advantages

Simple

Easy implementation

Disadvantages

Rigid

Role explosion

Poor flexibility

---

## Option B — Permission Based (Selected)

Users receive Roles.

Roles aggregate Permissions.

Authorization validates permissions.

Advantages

Flexible

Scalable

Reusable

Enterprise standard

Disadvantages

Slightly more complex

More administration

---

# Decision

Authorization is permission-based.

Roles exist only as permission groups.

Business logic validates permissions.

Never role names.

---

# Authorization Model

User

↓

Role

↓

Permissions

↓

Resources

↓

Business Action

---

# Permission Naming

resource.action

Examples

customers.read

customers.create

customers.update

customers.delete

sales.create

sales.cancel

inventory.adjust

dashboard.read

audit.read

notifications.manage

---

# Implementation Rules

Controllers declare required permissions.

Authorization Guards validate permissions.

Services assume authorization has already been verified.

Repositories never perform authorization.

---

# Role Examples

Administrator

Full access.

Sales

Quotes

Sales

Customers

Warehouse

Inventory

Products

Purchases

Purchasing

Suppliers

Purchases

Inventory

Finance (Future)

Invoices

Payments

Reports

Auditor

Read-only access.

---

# Multi-Tenant Integration

Permissions never bypass tenant isolation.

Authorization flow

Authentication

↓

Tenant Validation

↓

Permission Validation

↓

Business Rules

↓

Persistence

---

# Consequences

Positive

Fine-grained authorization.

Easy customization.

Future enterprise support.

Delegation.

Custom roles.

Negative

Additional administration.

Permission management UI.

---

# Trade-offs

We accept additional configuration complexity in exchange for flexibility and long-term maintainability.

---

# Related Documents

Security Principles

Software Design

ADR-001 Multi-Tenant

ADR-006 API First

---

# Future Evolution

Custom Roles

Permission Groups

Temporary Permissions

Delegated Administration

Field-Level Security

Approval Workflows

---

# Final Principle

Users receive roles.

Roles contain permissions.

Business logic authorizes permissions.