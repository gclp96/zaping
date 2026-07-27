SalesController

↓

SalesService   
     --------
                createSale()

                ↓

                validateCustomer()

                ↓

                validateInventory()

                ↓

                createInventoryMovement()

                ↓

                createAuditLog()

                ↓

                return response

↓

InventoryService

↓

InventoryRepository

↓

Prisma

## Responsibilities

What does this level do?

---

## Components

What elements belong here?

---

## Communication

How do components communicate?

---

## Constraints

What is NOT allowed?

---

## Related ADRs

Architecture decisions that affect this level.