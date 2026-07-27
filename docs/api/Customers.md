# Customers API

Version

v1

Authentication

Required

---

# Purpose

Manage customer information.

---

# Base Endpoint

/api/v1/customers

---

# Permissions

customers.read

customers.create

customers.update

customers.delete

---

# Endpoints

GET /customers

Returns paginated customers.

---

GET /customers/{id}

Returns one customer.

---

POST /customers

Creates a customer.

---

PATCH /customers/{id}

Updates customer information.

---

DELETE /customers/{id}

Soft Deletes customer.

---

# Business Rules

Customer belongs to one Company.

Deleted customers cannot be modified.

Duplicate tax identifiers are not allowed.

---

# DTOs

CreateCustomerDto

UpdateCustomerDto

CustomerResponseDto

---

# Responses

200 OK

201 Created

400 Validation Error

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

---

# Related ADRs

ADR-001

ADR-003

ADR-006

ADR-007