# FEAT-XXX — Nombre de la funcionalidad

**Producto:** Zaping
**Módulo:** [módulo]
**Estado:** PROPOSED
**Prioridad:** P0 / P1 / P2
**Fecha:** YYYY-MM-DD
**Responsable:** Zaping Team

---

# 1. Objetivo

Explicar qué problema resuelve esta funcionalidad.

```text
Problema actual
↓
Cambio propuesto
↓
Resultado esperado
```

---

# 2. Motivación

¿Por qué vale la pena construirla?

Considerar:

* valor para el usuario;
* riesgo operativo;
* necesidad comercial;
* dependencia arquitectónica;
* deuda técnica;
* seguridad.

---

# 3. Alcance

## Incluye

* ...
* ...
* ...

## No incluye

* ...
* ...
* ...

Mantener explícitos los límites.

---

# 4. Estado actual

Describir lo que realmente existe hoy.

```text
CURRENT
...
```

No describir la arquitectura objetivo como si estuviera implementada.

---

# 5. Estado objetivo

```text
TARGET
...
```

Describir cómo debe comportarse el sistema después de completar la feature.

---

# 6. Flujo

```text
Step 1
↓
Step 2
↓
Step 3
```

Utilizar lenguaje empresarial antes que detalles de implementación.

---

# 7. Reglas de negocio

Registrar únicamente reglas relevantes para esta feature.

Ejemplo:

```text
Quantity
> 0
```

```text
Resource Company
=
Authenticated Company
```

Las reglas permanentes deberán trasladarse posteriormente al documento del módulo responsable.

---

# 8. Datos / Modelo

Indicar si requiere:

```text
New model
New field
Enum change
Relation
Index
Migration
```

Si no se ha tomado una decisión técnica, marcar:

```text
TBD
```

No inventar schema prematuramente.

---

# 9. Backend

Cambios previstos:

```text
Controller:
Service:
DTO:
Persistence:
Domain validation:
Transactions:
```

---

# 10. API

Describir capacidades de negocio necesarias.

Ejemplo conceptual:

```text
POST /resource/:id/action
```

El contrato detallado definitivo deberá quedar posteriormente en OpenAPI.

---

# 11. Frontend / UX

Describir:

* pantalla;
* acción principal;
* estados;
* Loading;
* Empty;
* Error;
* Confirmation;
* feedback;
* responsive cuando aplique.

Seguir:

```text
product/ZAPING_WAY.md
ux/DESIGN_SYSTEM.md
ux/BUSINESS_COMPONENTS.md
```

---

# 12. Seguridad

Revisar explícitamente:

```text
Authentication
Authorization
Tenant Isolation
Sensitive Data
Mass Assignment
Audit
```

Utilizar `N/A` únicamente cuando realmente no aplique.

---

# 13. Concurrencia / Idempotencia

Cuando la operación modifica:

* estados;
* Inventory;
* dinero;
* cantidades acumuladas;

evaluar explícitamente:

```text
Concurrency:
Idempotency:
Transaction:
```

---

# 14. Migración

Si existe comportamiento anterior:

```text
Legacy
↓
Migration
↓
Target
```

Indicar:

* datos existentes;
* compatibilidad;
* rollback;
* riesgos.

---

# 15. Tests

Como mínimo según riesgo:

```text
Unit:
Integration:
Frontend:
Tenant isolation:
Authorization:
Regression:
Manual QA:
```

---

# 16. Definition of Done

La feature puede considerarse completada cuando corresponda:

* [ ] código implementado;
* [ ] reglas de negocio validadas;
* [ ] tests aprobados;
* [ ] lint aprobado;
* [ ] build aprobado;
* [ ] seguridad revisada;
* [ ] migración validada;
* [ ] QA completado;
* [ ] documentación permanente actualizada;
* [ ] Project Board actualizado.

---

# 17. Impacto documental

Indicar qué documentos permanentes deben modificarse:

```text
MODULE:
ADR:
ARCHITECTURE:
API_GUIDELINES:
SECURITY:
UX:
PROJECT_BOARD:
CHANGELOG:
```

---

# 18. Cierre de la Feature

Cuando esta feature termine:

```text
conocimiento permanente
→ documento responsable

estado completado
→ CHANGELOG
```

Este archivo no debe convertirse automáticamente en una segunda fuente permanente del comportamiento del módulo.

Si ya no aporta valor histórico o de implementación, puede retirarse después de consolidar la información importante.
