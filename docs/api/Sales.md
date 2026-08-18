# Sales API

## Estado

Activo.

Última actualización: 2026-08-18.

---

## Objetivo

El módulo Sales administra ventas manuales y ventas generadas desde cotizaciones confirmadas.

Las operaciones están aisladas por `companyId`.

---

## Estados

Una venta puede encontrarse en:

- `DRAFT`
- `CONFIRMED`
- `CANCELLED`

Transiciones permitidas para venta manual:

```text
DRAFT
├── approve ──> CONFIRMED
└── cancel  ──> CANCELLED