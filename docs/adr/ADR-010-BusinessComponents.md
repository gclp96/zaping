# ADR-010: Arquitectura de Componentes de Negocio

**Estado:** Propuesto
**Fecha:** 2026-07-11
**Responsable:** Zaping Team
**Alcance:** Frontend del ecosistema Zaping

---

# Decision Summary

Zaping separates presentation components into two distinct categories:

- UI Components
- Business Components

This separation allows reusable visual elements while encapsulating business-specific presentation logic.

---

# Context

As the application grows, many UI elements become tightly coupled to business rules.

Examples include:

Status Badges

Money Display

Inventory Indicators

Product Cards

Quote Status

Customer Summary

These components should not exist inside generic UI libraries.

---

# Problem Statement

Should all reusable components belong to the Design System?

Or should business-oriented components be separated?

---

# Decision Drivers

Maintainability

Reusability

Consistency

Business Isolation

Scalability

---

# Options Considered

## Option A — Single Component Library

All components live inside one folder.

Advantages

Simple

Easy discovery

Disadvantages

Business logic mixed with UI

Large component library

Poor separation

---

## Option B — UI + Business Components (Selected)

UI Components

↓

Business Components

↓

Features

↓

Pages

Advantages

Clear responsibilities

Reusable UI

Reusable business widgets

Scalable frontend

Disadvantages

More folders

Requires discipline

---

# Decision

The frontend is organized into four levels.

Pages

↓

Features

↓

Business Components

↓

UI Components

Each level has a specific responsibility.

---

# Responsibilities

## UI Components

Generic visual elements.

Examples

Button

Input

Modal

Card

Table

Badge

Tooltip

Spinner

Dialog

Pagination

These components never contain business rules.

---

## Business Components

Business-oriented visual components.

Examples

CustomerCard

ProductCard

QuoteStatus

InventorySummary

StockBadge

CurrencyField

LotStatus

ExpirationBadge

Business components may combine multiple UI components.

---

## Features

Business workflows.

Examples

Create Customer

Create Sale

Approve Quote

Purchase Wizard

Inventory Adjustment

A Feature coordinates multiple Business Components.

---

## Pages

Application entry points.

Responsibilities

Routing

Layout

Data loading

Feature composition

Pages contain almost no business logic.

---

# Communication Rules

Pages use Features.

Features use Business Components.

Business Components use UI Components.

UI Components never depend on Business Components.

---

# Folder Structure

components/

ui/

business/

features/

pages/

---

# Examples

Button

↓

CustomerCard

↓

CreateCustomerForm

↓

CustomersPage

---

Money

↓

ProductPrice

↓

QuoteItem

↓

QuotesPage

---

# Design Principles

UI Components

Reusable

Framework independent

Pure presentation

Business Components

Business aware

Composable

Reusable across modules

Features

Workflow oriented

Pages

Navigation oriented

---

# Consequences

Positive

Clean Design System

Low duplication

Easy maintenance

Easy onboarding

Clear responsibilities

Negative

More project organization

Additional abstractions

---

# Trade-offs

We accept a slightly more structured frontend in exchange for long-term consistency and maintainability.

---

# Related Documents

Design System

Software Design

Engineering Guide

ADR-005 Layered Architecture

---

# Future Evolution

Shared Component Library

Cross-platform Components

Mobile Component Library

Storybook Integration

Component Documentation

---

# Final Principle

UI Components render.

Business Components explain the business.

Features execute workflows.

Pages compose the application.