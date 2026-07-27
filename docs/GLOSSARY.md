# Foundation v1.0

Release Date

2026-07-XX

Status

Released

---

## Summary

Foundation Phase completed.

Architecture baseline established.

Engineering standards approved.

Documentation framework completed.

---

## Included

Vision

PRD

Software Design

Engineering Guide

Workflow

Security

Quality

Architecture

10 ADRs

Documentation Templates

Glossary

---

## Next Phase

Core ERP Development

Sprint 09

Company

Definition

A legal entity that uses the Zaping platform.

Each Company represents an independent tenant.

Related Terms

Tenant
User
Customer
Supplier

Notes

A Company owns all its business data.

User

Definition

A person authenticated in the system.

A User always belongs to one Company.

Related Terms

Role
Permission
Authentication
Customer

Definition

A company or individual that purchases products or services.

Related Terms

Quote
Sale
Invoice
Supplier

Definition

A company that provides products or services.

Related Terms

Purchase
Product
Product

Definition

An item managed by inventory.

Products may include:

Lots
Serial Numbers
Expiration Dates
Quote

Definition

A commercial proposal sent to a Customer.

A Quote may later become a Sale.

Sale

Definition

A confirmed commercial transaction.

A Sale generates inventory movements.

Purchase

Definition

A procurement transaction with a Supplier.

A Purchase increases inventory.

Inventory

Definition

The current stock projection calculated from Inventory Movements.

Notes

Inventory is not the source of truth.

Inventory Movements are.

Inventory Movement

Definition

An immutable business event that changes inventory.

Examples:

Purchase
Sale
Adjustment
Return
Inventory Adjustment

Definition

A manual correction to inventory.

Always generates an Inventory Movement.

Lot

Definition

A manufacturing batch used for traceability.

Serial Number

Definition

A unique identifier assigned to one physical unit.

Expiration Date

Definition

The date after which a product should no longer be sold or used.

Reserved Stock

Definition

Inventory committed to future transactions.

Not yet implemented.

Available Stock

Definition

Inventory available for immediate allocation.

Available Stock = Physical Stock − Reserved Stock

Physical Stock

Definition

The quantity physically available before reservations.

Security
Authentication

Definition

The process of verifying a user's identity.

Authorization

Definition

The process of determining whether a user may perform an action.

Role

Definition

A collection of Permissions assigned to Users.

Permission

Definition

Authorization to perform a business action.

Example:

customers.read

Audit

Definition

A permanent record of important business actions.

Tenant

Definition

An isolated Company inside the multi-tenant platform.

Architecture
Module

Definition

An independent business capability.

Examples:

Customers

Products

Sales

Inventory

Controller

Definition

Receives HTTP requests.

Coordinates application flow.

Contains no business logic.

Service

Definition

Coordinates business use cases.

Repository

Definition

Responsible only for data persistence.

DTO

Definition

A Data Transfer Object.

Used to validate and transport data.

Entity

Definition

A business object stored in the database.

ADR

Definition

Architecture Decision Record.

Documents important architectural decisions.

RFC

Definition

Request for Comments.

Used to discuss architectural proposals before adoption.

Design System
Design Token

Definition

The smallest visual element of the design system.

Examples:

Colors

Spacing

Typography

UI Component

Definition

A reusable visual component without business knowledge.

Business Component

Definition

A reusable component aware of business concepts.

Example:

InventoryBadge

CustomerCard

QuoteStatus

Feature

Definition

A complete business workflow composed of multiple components.

Page

Definition

A route within the application responsible for composing Features.

Infrastructure
API

Definition

The official communication interface of the platform.

REST

Definition

Architectural style used by the Zaping API.

UUID

Definition

Globally unique identifier used as the primary key for all business entities.

Soft Delete

Definition

Logical deletion strategy using the deletedAt field instead of permanently removing records.

Business Code

Definition

Human-readable identifier used in business documents.

Examples:

CUS-000123

SAL-2026-000045

PUR-2026-000018