# Sales Module

## Estado

En desarrollo avanzado.

Última actualización: 2026-08-18.

---

## Objetivo

El módulo Sales administra el ciclo de vida de las ventas de Zaping ERP.

Actualmente soporta:

- ventas manuales;
- aprobación de ventas;
- cancelación de borradores;
- conversión de cotizaciones;
- actualización de inventario;
- movimientos de inventario;
- generación de PDF.

---

## Flujo de venta manual

```text
Crear venta
    ↓
DRAFT
    ↓
 ┌───────────────┐
 │               │
approve         cancel
 │               │
 ▼               ▼
CONFIRMED     CANCELLED
 │
 ▼
Inventory OUT