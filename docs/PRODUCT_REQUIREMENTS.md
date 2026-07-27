# Product Requirements Document (PRD)

**Product:** Zaping ERP
**Version:** 1.0.0
**Status:** Approved
**Last Updated:** 2026-07-10
**Owner:** Zaping Team

---

# 1. Executive Summary

Zaping is a cloud-native, multi-tenant ERP platform designed to help small and medium-sized businesses manage their daily operations through a modern, scalable and intelligent software ecosystem.

The first commercial release targets medical supply distributors, while the platform architecture remains industry-agnostic to support future expansion.

---

# 2. Problem Statement

Many SMEs still rely on spreadsheets or legacy desktop software.

Common challenges include:

- Fragmented information
- Manual processes
- Inventory inaccuracies
- Limited traceability
- Poor reporting
- Lack of real-time information
- Complex user interfaces
- High implementation costs

Zaping aims to solve these problems with a modern cloud platform.

---

# 3. Product Goals

The platform should enable companies to:

- Manage customers.
- Manage suppliers.
- Control inventory.
- Register purchases.
- Register sales.
- Generate quotations.
- Track inventory movements.
- Monitor business performance.
- Improve operational efficiency.

---

# 4. Non-Goals (MVP)

The initial release will NOT include:

- Accounting
- Payroll
- Manufacturing (MRP)
- CRM Automation
- BI Cubes
- Marketplace
- E-commerce
- AI Assistant
- Multi-warehouse logistics

These capabilities belong to future phases.

---

# 5. Target Users

## Company Owner

Needs complete business visibility.

---

## Sales Representative

Needs quick quote and sales creation.

---

## Warehouse Operator

Needs inventory accuracy.

---

## Purchasing Manager

Needs supplier and purchasing management.

---

## Administrator

Needs full system administration.

---

# 6. Functional Requirements

Core modules:

- Authentication
- Companies
- Users
- Roles
- Permissions
- Customers
- Suppliers
- Products
- Inventory
- Purchases
- Quotes
- Sales
- Dashboard
- Audit

---

# 7. Non-Functional Requirements

## Performance

Dashboard < 500 ms.

CRUD operations < 300 ms.

---

## Security

JWT Authentication.

Role Based Access Control.

Audit Logs.

HTTPS.

Encrypted passwords.

---

## Scalability

Cloud-native.

Multi-tenant.

Horizontal scaling ready.

---

## Availability

Target availability:

99.9%

---

## Maintainability

Modular architecture.

Reusable components.

Clear documentation.

---

# 8. Product Differentiators

Compared to traditional ERP systems:

- Modern UI
- Cloud-native architecture
- Healthcare specialization
- Inventory traceability
- Business Intelligence
- AI-ready architecture
- Open APIs

---

# 9. Success Criteria

The MVP will be considered successful when:

- All core modules are functional.
- Multi-tenant architecture is stable.
- Inventory traceability is complete.
- Documentation is complete.
- Production deployment is successful.

---

# 10. Product Roadmap

Foundation

↓

Core ERP

↓

Business Intelligence

↓

Radar

↓

Customer Portal

↓

Mobile Apps

↓

Artificial Intelligence

---

# 11. Risks

- Scope creep
- Overengineering
- Security vulnerabilities
- Performance bottlenecks
- Regulatory changes
- Limited development resources

---

# 12. Assumptions

- Users have internet access.
- SMEs are willing to adopt SaaS.
- Cloud infrastructure remains available.
- PostgreSQL remains the primary database.

---

# 13. Constraints

Backend:

NestJS

Frontend:

React + Next.js

Database:

PostgreSQL

ORM:

Prisma

Authentication:

JWT

Deployment:

Docker

---

# 14. Out of Scope

Anything not aligned with the Product Vision or current Roadmap requires evaluation before implementation.

---

# 15. Acceptance Criteria

The product is ready for MVP release when:

✓ All core modules are operational.

✓ Documentation is complete.

✓ Quality standards are met.

✓ Security review is approved.

✓ Performance goals are achieved.

✓ Release checklist is completed.