# ADR-001 — Multi-Tenant Architecture

**Status:** Accepted

**Date:** 2026-07-10

**Decision Makers:**
Zaping Architecture Team

---

# Context

Zaping is intended to serve multiple independent companies using the same cloud platform.

The architecture must guarantee complete isolation of business data while maximizing maintainability, scalability and operational efficiency.

The primary question is:

How should multiple companies coexist within the platform?

---

# Options Considered

## Option A — Single Tenant

Each customer owns an independent deployment.

Advantages

- Complete isolation.
- Easier infrastructure customization.
- Independent deployments.

Disadvantages

- Higher infrastructure costs.
- Difficult maintenance.
- Multiple deployments.
- Complicated updates.

---

## Option B — Multi-Tenant (Selected)

All companies share the same platform.

Each business entity belongs to one Company.

Advantages

- Lower infrastructure cost.
- Centralized maintenance.
- Easier deployments.
- Better scalability.
- Simpler monitoring.
- Faster onboarding.

Disadvantages

- Stronger security requirements.
- Mandatory tenant isolation.
- Greater architectural discipline.

---

# Decision

Zaping adopts a Multi-Tenant architecture.

Every business entity belongs to exactly one Company.

Every authenticated request must operate within the user's Company context.

Cross-company access is never allowed unless explicitly supported by future platform-level administration features.

---

# Consequences

Positive

Lower operating costs.

Better scalability.

Cloud-native architecture.

Simpler deployments.

Future SaaS readiness.

---

Negative

Additional authorization validation.

Tenant-aware services.

Stronger testing requirements.

---

# Implementation Rules

Every business entity includes:

CompanyId

Every Service validates CompanyId.

Every Repository filters by CompanyId.

Every API request executes inside tenant context.

Every audit record includes CompanyId.

---

# Modules Affected

Customers

Suppliers

Products

Inventory

Purchases

Quotes

Sales

Dashboard

Audit

Notifications

Future Modules

---

# Related Documents

Architecture Overview

Security Principles

Software Design

Engineering Guide

---

# Future Evolution

Future platform administration may support:

Platform administrators

Cross-company analytics

Tenant management

Company provisioning

Billing

These capabilities must never compromise tenant isolation.

---

# Final Principle

Tenant isolation is a fundamental architectural guarantee.

No implementation may bypass Company boundaries.