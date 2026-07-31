# ADR-010 — Conversión de cotización a venta

**Estado:** Aceptado  
**Fecha:** 2026-07-31  
**Decisión:** Conversión directa de cotización confirmada a venta confirmada.

---

## Contexto

Una cotización representa una propuesta comercial y no debe modificar el inventario.

El inventario debe afectarse únicamente cuando la operación comercial se convierta efectivamente en una venta.

Para el MVP se busca evitar un paso adicional de confirmación dentro del módulo de Ventas.

---

## Decisión

Una cotización seguirá este flujo:

```text
DRAFT
→ CONFIRMED
→ CONVERTIDA A VENTA