# ADR-006 — API First Architecture

**Status:** Accepted

**Version:** 1.0.0

**Date:** 2026-07-10

**Decision Makers**
Zaping Architecture Team

---

# Decision Summary

Zaping adopts an API First architecture.

Every business capability exposed by the platform must first exist as a well-defined API before being consumed by any user interface.

The API is considered a first-class product.

---

# Context

Zaping is designed as an ecosystem composed of multiple clients:

- ERP Web
- Customer Portal
- Mobile Applications
- Public API
- Radar
- AI Services
- Future Integrations

A tightly coupled frontend/backend architecture would significantly reduce flexibility.

---

# Problem Statement

Should the frontend communicate directly with internal services?

Or should every business capability be exposed through a stable API?

---

# Decision Drivers

Scalability

Maintainability

Reusability

Integration

Mobile Support

Future Products

Third-party Connectivity

---

# Options Considered

## Option A — UI Driven Development

Frontend requirements define backend implementation.

Advantages

Fast initial development.

Simple architecture.

Disadvantages

Duplicated logic.

Backend coupled to UI.

Poor API quality.

Limited integrations.

---

## Option B — API First (Selected)

Business capabilities are designed as APIs before UI implementation.

Advantages

Reusable services.

Independent clients.

Better documentation.

Stable contracts.

Future integrations.

Disadvantages

Requires additional planning.

Higher initial effort.

---

# Decision

Every business capability should be represented by an API endpoint.

User interfaces consume APIs.

No business logic is implemented inside frontend applications.

---

# API Principles

RESTful architecture.

JSON payloads.

Stateless requests.

Consistent naming.

Versioned endpoints.

Predictable responses.

---

# Endpoint Standards

Base URL

/api/v1

Resources

/customers

/products

/inventory

/purchases

/sales

/quotes

/dashboard

Plural resource names are mandatory.

---

# Response Standards

Every response follows a consistent structure.

Example

Success

{
  "data": {},
  "meta": {}
}

Error

{
  "error": {
    "code": "",
    "message": ""
  }
}

---

# Versioning Strategy

Current

/api/v1

Future

/api/v2

Older versions remain available during migration periods.

Breaking changes require a new API version.

---

# Documentation

Every endpoint must include:

Purpose

Authentication

Permissions

Request

Response

Validation Rules

Error Codes

Examples

---

# Security

Every endpoint must implement:

Authentication

Authorization

DTO Validation

Tenant Isolation

Audit Logging (when applicable)

---

# Consequences

Positive

Reusable APIs.

Independent frontend.

Easy mobile development.

Future integrations.

Partner ecosystem.

Negative

Additional documentation.

Contract maintenance.

Version management.

---

# Trade-offs

We accept additional API design effort in exchange for a stable platform capable of supporting multiple applications.

---

# Related Documents

Software Design

Architecture Overview

API Standards

Security Principles

ADR-001

ADR-005

---

# Future Evolution

GraphQL Gateway (evaluation)

Public Developer Portal

OpenAPI Specification

SDK Generation

Webhook Support

---

# Final Principle

User interfaces consume APIs.

APIs define the platform.