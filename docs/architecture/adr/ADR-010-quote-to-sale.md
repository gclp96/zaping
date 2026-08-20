# ADR-010 — Conversión Directa Quote → Sale

**Estado:** SUPERSEDED
**Reemplazado por:** ADR-011 — Sales Order y Delivery
**Origen:** Foundation 2026
**Última revisión:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Propósito histórico

Este ADR preserva la arquitectura comercial utilizada durante las primeras etapas de Zaping.

El flujo original se modeló conceptualmente como:

```text
Quote
↓
Sale
↓
Inventory OUT
```

Esta estructura permitió implementar rápidamente el flujo inicial de cotización, venta e inventario.

---

# 2. Contexto original

Durante el desarrollo inicial, Zaping necesitaba cubrir:

* cotizaciones;
* conversión a venta;
* actualización de inventario;
* trazabilidad básica.

La separación entre:

* pedido comercial;
* fulfillment;
* entrega física;
* facturación;

todavía no había sido necesaria.

---

# 3. Decisión histórica

Una Quote podía convertirse en Sale.

La Sale representaba simultáneamente gran parte del compromiso comercial y del resultado físico de la operación.

Conceptualmente:

```text
Quote
↓
Sale
↓
Inventory Movement OUT
```

---

# 4. Beneficio original

La decisión permitió:

* implementar el módulo rápidamente;
* mantener un flujo simple;
* validar el proceso comercial básico;
* completar una primera integración con Inventory.

---

# 5. Limitaciones descubiertas

Al evolucionar el producto aparecieron escenarios que el modelo directo no representa correctamente.

Ejemplos:

* entregas parciales;
* venta sin entrega inmediata;
* envío posterior;
* facturación antes de entrega;
* facturación después de entrega;
* preparación de pedidos;
* Healthcare Cases;
* material bajo custodia temporal;
* conciliación de material utilizado;
* devoluciones.

---

# 6. Problema principal

La arquitectura original mezclaba dos hechos diferentes:

```text
Compromiso comercial
```

y:

```text
Movimiento físico de mercancía
```

En operaciones reales no siempre ocurren al mismo tiempo.

---

# 7. Ejemplo

Un cliente puede confirmar una compra hoy:

```text
Sales Order
2026-08-19
```

pero recibir el producto posteriormente:

```text
Delivery
2026-08-21
```

Reducir inventario el primer día no representa correctamente la operación física.

---

# 8. Healthcare

La limitación se vuelve más evidente en Healthcare.

Material puede:

```text
salir del almacén
↓
quedar bajo custodia de técnico
↓
utilizarse parcialmente
↓
regresar parcialmente
```

La salida inicial no puede interpretarse directamente como venta definitiva.

---

# 9. Decisión actual

La conversión directa:

```text
Quote
→ Sale
→ Inventory OUT
```

deja de ser la arquitectura objetivo.

Este ADR queda:

**SUPERSEDED**

por:

**ADR-011 — Sales Order y Delivery.**

---

# 10. Compatibilidad

La existencia de este ADR como `SUPERSEDED` no obliga a modificar inmediatamente toda la implementación existente.

La migración debe realizarse mediante el workflow correspondiente.

Mientras exista código basado en el modelo anterior, debe considerarse:

```text
legacy behavior
```

y no utilizarse como precedente para nuevas funcionalidades.

---

# 11. Historia

No eliminar este documento.

Su función es explicar:

* por qué existe parte del diseño actual;
* qué problema resolvía;
* por qué posteriormente fue reemplazado.

---

# 12. ADR relacionado

* ADR-002 — Inventory Movements.
* ADR-011 — Sales Order y Delivery.

---

# 13. Decisión final

> La primera arquitectura comercial fue adecuada para validar el Core inicial, pero ya no representa correctamente la separación entre comercio y movimiento físico.

La evolución se formaliza en ADR-011.
