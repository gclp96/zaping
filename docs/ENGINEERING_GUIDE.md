# Engineering Guide

**Version:** 1.0.0
**Status:** Approved

---

# 1. Purpose

This document defines the engineering standards, development philosophy and technical practices used across the Zaping ecosystem.

Every contributor should understand and follow these principles before implementing new functionality.

---

# 2. Engineering Philosophy

Engineering decisions should prioritize:

Business Value

Maintainability

Scalability

Consistency

Long-term thinking

---

# 3. Development Principles

## Documentation First

No feature is implemented before its documentation.

---

## Business First

Business rules define software architecture.

Not the opposite.

---

## Simplicity

Prefer the simplest solution that solves the problem correctly.

---

## Reusability

Avoid duplicate code.

Avoid duplicate components.

Avoid duplicate business rules.

---

## Consistency

Follow existing patterns.

Avoid unnecessary exceptions.

---

## API First

Design APIs before implementing UI.

---

## Security by Design

Security is part of architecture.

Not an afterthought.

---

## Performance Awareness

Measure before optimizing.

Optimize only where necessary.

---

## Continuous Improvement

Every Sprint should improve the codebase.

Not only add features.

---

# 4. Development Workflow

Idea

↓

Business Analysis

↓

Documentation

↓

Architecture Review

↓

Database

↓

Backend

↓

Frontend

↓

Testing

↓

Documentation Update

↓

Release

---

# 5. Coding Standards

TypeScript strict mode.

ESLint clean.

Prettier formatting.

Meaningful naming.

Small functions.

Readable code.

---

# 6. Backend Guidelines

Controllers remain thin.

Business logic belongs to Services.

Repositories only access data.

DTO validation is mandatory.

Never expose internal entities directly.

---

# 7. Frontend Guidelines

Pages orchestrate.

Features contain workflows.

Business Components encapsulate business UI.

UI Components remain generic.

No business logic inside presentation components.

---

# 8. Database Guidelines

UUID primary keys.

Soft Delete.

CreatedAt.

UpdatedAt.

Indexes where necessary.

Explicit relations.

---

# 9. Documentation Standards

Every module requires:

Overview

Scope

Business Flow

Rules

Permissions

Events

Architecture

Roadmap

---

# 10. Code Review Checklist

Architecture respected.

Business rules preserved.

Security validated.

Performance acceptable.

Documentation updated.

Tests executed.

No duplicated code.

---

# 11. Definition of Done

A feature is complete only if:

Implementation finished.

Tests passed.

Documentation updated.

Lint clean.

Review approved.

Release notes updated.

---

# 12. Continuous Improvement

Technical debt should be reduced continuously.

Every Sprint should leave the project in a better state than before.

---

# Final Principle

Build software that will still be understandable five years from now.