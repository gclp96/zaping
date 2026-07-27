# 🧩 Business Components Library

| Campo | Valor |
|--------|-------|
| Estado | 🟢 Activo |
| Versión | 1.0 |
| Última actualización | Sprint 09 |

---

# Objetivo

Definir la arquitectura, organización y estándares de los Business Components utilizados en Zaping ERP.

Los Business Components encapsulan lógica relacionada con el dominio del negocio y pueden reutilizarse entre múltiples módulos del sistema.

---

# ¿Qué es un Business Component?

Es un componente reutilizable que conoce el negocio, pero no pertenece a un módulo específico.

Ejemplos:

- ProductSelector
- SupplierSelector
- CustomerSelector
- MoneyInput
- DateInput
- StatusBadge

---

# Diferencias

## UI Components

Responsabilidad:

Presentación.

No conocen el negocio.

Ejemplos:

- Button
- Card
- Modal
- Table
- Input

---

## Business Components

Responsabilidad:

Resolver problemas del dominio.

Conocen entidades del sistema.

Ejemplos:

- ProductSelector
- SupplierSelector
- PurchaseTotals

---

## Feature Components

Responsabilidad:

Resolver necesidades exclusivas de un módulo.

Ejemplos:

- PurchaseForm
- PurchaseItemsTable
- QuotePreview

---

# Organización

components/

    ui/

    business/

        selectors/

        inputs/

        badges/

        tables/

        totals/

---

# Principios

Todos los Business Components deben cumplir:

- Reutilización.
- Responsabilidad única.
- Independencia del módulo.
- Tipado fuerte.
- Integración mediante servicios.
- Fácil mantenimiento.

---

# Cuándo crear un Business Component

Debe evaluarse cuando:

- Se utilizará en tres o más módulos.
- Implementa lógica de negocio reutilizable.
- Mejora la consistencia del sistema.
- Reduce duplicación.

---

# Cuándo NO crear uno

No crear un Business Component cuando:

- Solo será utilizado por un módulo.
- Contiene reglas exclusivas de un proceso.
- Aumenta la complejidad sin aportar reutilización.

En estos casos deberá permanecer dentro de:

features/

---

# Comunicación con Backend

Todos los Business Components consumirán la información mediante:

services/api.ts

No deberán consumir fetch directamente.

---

# Componentes Planeados

## Selectores

- ProductSelector
- SupplierSelector
- CustomerSelector

---

## Inputs

- MoneyInput
- DateInput
- QuantityInput

---

## Badges

- StatusBadge

---

## Tablas

- PurchaseItemsTable
- SalesItemsTable

---

## Totales

- PurchaseTotals
- SalesTotals

---

# Roadmap

## Versión 1.0

- StatusBadge
- MoneyInput
- DateInput

---

## Versión 1.1

- SupplierSelector
- CustomerSelector
- ProductSelector

---

## Versión 1.2

- PurchaseItemsTable
- PurchaseTotals

---

# Objetivo Final

Construir una librería de componentes de negocio reutilizable que acelere el desarrollo de nuevos módulos y garantice una experiencia consistente para el usuario.