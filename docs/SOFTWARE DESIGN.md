# Software Design Document (SDD)

**Project:** Zaping ERP
**Version:** 1.0.0
**Status:** Approved
**Last Updated:** 2026-07-10
**Owner:** Zaping Team

---

# 1. Purpose

This document defines the overall software architecture of Zaping.

It describes the major components of the system, their responsibilities, communication patterns, technology stack, architectural principles and long-term evolution.

This document serves as the primary technical reference for developers.

---

# 2. Architecture Goals

The architecture must be:

- Modular
- Scalable
- Maintainable
- Secure
- Cloud Native
- API First
- Multi Tenant
- Testable

---

# 3. High-Level Architecture

```

Browser

↓

Next.js Frontend

↓

REST API

↓

NestJS Backend

↓

Business Layer

↓

Repository Layer

↓

Prisma ORM

↓

PostgreSQL

```

---

# 4. Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- TailwindCSS
- React Hook Form
- TanStack Query (Future)

---

## Backend

- NestJS
- TypeScript
- Prisma ORM
- JWT Authentication
- RBAC Authorization

---

## Database

- PostgreSQL

---

## Infrastructure

- Docker
- Docker Compose
- Nginx (Future)
- CI/CD (Future)

---

## 5.1 Arquitectura de monolito modular

Zaping utiliza una arquitectura de monolito modular.

El backend se despliega como una sola aplicación NestJS, pero se divide
internamente en módulos de negocio independientes.

Estructura conceptual:

```text
Aplicación NestJS
│
├── Auth
├── Companies
├── Users
├── Customers
├── Suppliers
├── Products
├── Inventory
├── Purchases
├── Quotes
├── Sales
├── Dashboard
└── Audit

```

Responsibilities:

## Controller

- Receives HTTP requests
- Validates input
- Returns responses

No business logic allowed.

---

## Service

Contains business rules.

Coordinates domain operations.

---

## Repository

Responsible for data persistence only.

No business logic.

---

## Database

Stores application data.

---

# 6. Frontend Architecture

```

Pages

↓

Layouts

↓

Features

↓

Components

↓

Shared UI

```

Component hierarchy:

```

Page

↓

Feature

↓

Business Component

↓

UI Component

```

---

# 7. Module Organization

Each module should contain:

```

customers/

controller

service

dto

entities

repository

tests

```

Every module should be independent.

---

# 8. API Design

REST API.

JSON responses.

Stateless.

Versioned endpoints.

```

/api/v1/

```

Future versions:

```

/api/v2/

```

---

# 9. Authentication

JWT Access Tokens.

Refresh Tokens (Future).

Password hashing with bcrypt.

Role Based Access Control.

---

# 10. Authorization

Permission-based authorization.

Roles aggregate permissions.

Users inherit permissions through roles.

---

# 11. Multi-Tenant

Every business entity belongs to a Company.

```

Company

↓

Users

↓

Customers

↓

Products

↓

Inventory

↓

Sales

↓

Purchases

```

No cross-company access.

---

# 12. Data Flow

Example:

```

User

↓

Frontend

↓

API

↓

Controller

↓

Service

↓

Repository

↓

Database

↓

Response

↓

Frontend

```

---

# 13. Error Handling

Centralized Exception Filters.

Standard error responses.

HTTP Status Codes.

Validation Errors.

Business Errors.

---

# 14. Logging

System logs.

Application logs.

Audit logs.

Future centralized logging.

---

# 15. Security

HTTPS.

JWT.

RBAC.

DTO Validation.

Input Sanitization.

Soft Delete.

Audit Trail.

---

# 16. Performance

Avoid N+1 queries.

Pagination.

Lazy Loading.

Indexes.

Caching (Future).

---

# 17. Testing Strategy

Unit Tests.

Integration Tests.

E2E Tests.

Manual QA.

---

# 18. Deployment

Docker.

Environment Variables.

CI/CD (Future).

Cloud Deployment.

---

# 19. Future Architecture

Future components:

- Message Queue
- Event Bus
- AI Services
- Radar Services
- Notification Service
- Reporting Service

---

# 20. Guiding Principles

Business Logic belongs to Services.

Controllers stay thin.

Repositories only access data.

Frontend never contains business logic.

Documentation precedes implementation.

Architecture favors long-term maintainability over short-term speed.