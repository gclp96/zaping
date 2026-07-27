# ADR-004 — UUID Primary Keys

**Status:** Accepted

**Version:** 1.0.0

**Date:** 2026-07-10

**Decision Makers**
Zaping Architecture Team

---

# Decision Summary

All business entities in Zaping use UUIDs as their primary identifiers instead of auto-incrementing integers.

---

# Context

Zaping is a cloud-native SaaS platform designed to support multiple companies.

Entities may eventually be created from:

- ERP
- Mobile App
- Customer Portal
- Public API
- Future Offline Clients

The identifier strategy must support distributed systems.

---

# Problem Statement

Should primary keys use sequential integers or UUIDs?

---

# Decision Drivers

Cloud Native

Distributed Systems

Offline Support

Security

Scalability

Replication

API Consistency

---

# Options Considered

## Option A

Auto Increment Integer

Advantages

Simple

Small indexes

Readable IDs

Disadvantages

Easy enumeration

Poor distributed support

Merge conflicts

Database dependency

---

## Option B

UUID (Selected)

Advantages

Globally unique

Offline generation

Distributed friendly

Secure URLs

Easy replication

Future microservices ready

Disadvantages

Larger indexes

Less human readable

Slight storage increase

---

# Decision

Every business entity uses UUID.

Primary keys never change.

Business documents may expose human-readable numbers independently.

Example

Customer

id

UUID

Customer Code

CUS-000123

Invoice

UUID

Invoice Number

INV-2026-000125

---

# Architecture

Internal Identifier

UUID

Business Identifier

Configurable Number

Both identifiers coexist.

They serve different purposes.

---

# Implementation Guidelines

Use UUID for every entity.

Business numbering must never replace UUID.

UUIDs are immutable.

External integrations should use UUID whenever possible.

---

# Consequences

Positive

Distributed architecture

Secure APIs

Replication support

Future synchronization

Offline support

Negative

Larger indexes

Less readable debugging

Requires proper indexing

---

# Trade-offs

We accept a small storage cost in exchange for significantly better scalability and security.

---

# Related Documents

Architecture Overview

Software Design

Database Standards

ADR-001

---

# Future Evolution

Future public APIs

Offline synchronization

Mobile applications

Multi-region deployments

Microservices

---

# Final Principle

Business identifiers belong to the business.

Primary keys belong to the architecture.