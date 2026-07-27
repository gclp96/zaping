# Architecture Overview

**Version:** 1.0.0
**Status:** Approved
**Last Updated:** 2026-07-10
**Owner:** Zaping Team

---

# 1. Purpose

This document provides a high-level view of the Zaping architecture.

It explains how all major systems interact and establishes the architectural principles used across the platform.

Detailed implementation decisions are documented separately in ADRs and module specifications.

---

# 2. Architectural Vision

Zaping is a cloud-native, modular, API-first and multi-tenant SaaS platform.

The architecture is designed around business capabilities rather than technical layers.

Every module should be independently maintainable while remaining fully integrated within the platform.

---

# 3. Platform Overview

                     Zaping Platform

                           │

        ┌──────────────────┼──────────────────┐

        │                  │                  │

      ERP               Radar               AI

        │                  │                  │

        └──────────────┬───┘                  │

                       │                      │

                Business Intelligence         │

                       │                      │

                       ▼                      ▼

                Customer Portal         Mobile Apps

                       │

                       ▼

                  Public REST API

---

# 4. Core Architectural Principles

- Cloud Native
- Multi-Tenant
- API First
- Modular Design
- Domain-Oriented
- Event Ready
- Security by Design
- Documentation First

---

# 5. System Layers

Presentation Layer

↓

Application Layer

↓

Domain Layer

↓

Infrastructure Layer

↓

Persistence Layer

---

## Presentation Layer

Responsible for user interaction.

Applications:

- ERP Web
- Customer Portal
- Mobile Apps
- Public API

---

## Application Layer

Coordinates business use cases.

Examples:

Create Purchase

Create Sale

Approve Quote

Adjust Inventory

Generate Dashboard

---

## Domain Layer

Contains business rules.

Examples:

Inventory validation

Quote lifecycle

Purchase approval

Pricing rules

Lot traceability

---

## Infrastructure Layer

Provides technical capabilities.

Examples:

Authentication

Email

Storage

Logging

Caching

Docker

Prisma

---

## Persistence Layer

Responsible for data storage.

PostgreSQL

Indexes

Migrations

Repositories

---

# 6. Backend Architecture

Controller

↓

Service

↓

Repository

↓

Prisma

↓

PostgreSQL

Responsibilities:

Controllers

Receive requests

Validate DTOs

Return responses

Services

Business Logic

Repositories

Persistence only

---

# 7. Frontend Architecture

Pages

↓

Layouts

↓

Features

↓

Business Components

↓

UI Components

---

# 8. Module Architecture

Each module should contain:

Controller

Service

DTO

Repository

Entities

Tests

Documentation

Modules communicate through services.

Never through direct database access.

---

# 9. Business Flow

Customer

↓

Quote

↓

Sale

↓

Inventory

↓

Dashboard

↓

Reports

---

Purchase

↓

Inventory

↓

Dashboard

---

# 10. Data Ownership

Every module owns its own business logic.

Examples

Inventory owns stock calculations.

Sales owns sales lifecycle.

Purchases own procurement lifecycle.

Dashboard never owns business logic.

---

# 11. Integration Principles

Modules communicate through:

Services

Domain Events (Future)

REST APIs

Never through direct database manipulation.

---

# 12. Security Architecture

Authentication

↓

Authorization

↓

Business Validation

↓

Data Access

↓

Audit

Every request follows this order.

---

# 13. Multi-Tenant Architecture

Company

↓

Users

↓

Business Data

↓

Resources

Every query must respect tenant boundaries.

---

# 14. Future Evolution

Current

Modular Monolith

↓

Future

Service-Oriented Architecture

↓

Future

Event-Driven Architecture

↓

Future

Microservices (Only if justified)

---

# 15. Technology Stack

Frontend

Next.js

React

TypeScript

Backend

NestJS

TypeScript

Database

PostgreSQL

ORM

Prisma

Infrastructure

Docker

Cloud

---

# 16. Architectural Decisions

Major architectural decisions are documented as ADRs.

Examples:

ADR-001 Multi-Tenant

ADR-002 Inventory Movement

ADR-003 Soft Delete

ADR-004 UUID Strategy

ADR-005 API Versioning

---

# 17. Quality Attributes

Maintainability

Scalability

Reliability

Performance

Security

Observability

Extensibility

---

# 18. Guiding Principle

The architecture exists to support the business.

Technology decisions must always reinforce business value rather than dictate it.

2026

Modular Monolith

        │

        ▼

2027

Domain Events

        │

        ▼

2028

Service-Oriented Architecture

        │

        ▼

Future

Microservices (if justified)