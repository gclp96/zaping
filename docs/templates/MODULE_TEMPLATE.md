# Módulo de [Nombre] — Zaping

**Módulo:** [Nombre]
**Producto:** Zaping ERP Core / Healthcare / Radar / Platform
**Versión:** 1.0.0
**Estado:** PROPOSED
**Estado de implementación:** NOT IMPLEMENTED / PARTIAL / IMPLEMENTED / LEGACY
**Última actualización:** YYYY-MM-DD
**Responsable:** Zaping Team

---

# 1. Propósito

Explicar qué responsabilidad empresarial resuelve el módulo.

Debe responder:

```text
¿Qué representa?
¿Qué problema resuelve?
¿Qué verdad es responsable de mantener?
```

---

# 2. Principio fundamental

Definir en una frase la frontera principal.

Ejemplo:

```text
Purchase
=
qué se ordenó
```

```text
PurchaseReceipt
=
qué llegó físicamente
```

---

# 3. Responsabilidades

El módulo es propietario de:

* ...
* ...
* ...

---

# 4. Fuera del alcance

El módulo no es propietario de:

* ...
* ...
* ...

Esta sección es obligatoria para evitar fronteras ambiguas.

---

# 5. Conceptos / Entidades

Describir las entidades o conceptos principales.

Ejemplo:

```text
Module
├── Entity A
├── Entity B
└── Entity C
```

El modelo técnico exacto continúa perteneciendo a `schema.prisma`.

---

# 6. Lifecycle

Cuando aplique:

```text
STATE A
↓
STATE B
↓
STATE C
```

Explicar:

* transiciones;
* estados terminales;
* edición;
* cancelación;
* inmutabilidad.

---

# 7. Reglas de negocio

Registrar las reglas permanentes del dominio.

Ejemplo:

```text
Confirmed historical event
→ immutable
```

---

# 8. Invariantes

Las condiciones que nunca deben violarse.

```text
...
```

---

# 9. Multi-tenancy

Definir cómo se determina la Company.

```text
Authenticated User
↓
Company Context
↓
Module Resource
```

Registrar relaciones cross-tenant que deben rechazarse.

---

# 10. Authorization

Indicar las capacidades conceptuales relevantes.

Ejemplo:

```text
module.read
module.create
module.confirm
```

Distinguir:

```text
CURRENT
```

de:

```text
TARGET
```

cuando Permissions todavía no estén implementados.

---

# 11. Integraciones

Documentar cómo se relaciona con otros módulos.

Ejemplo:

```text
Module A
↓
Module B
```

Sin duplicar las reglas del módulo vecino.

---

# 12. Inventory

Cuando aplique, indicar explícitamente:

```text
¿produce Inventory IN?
¿produce Inventory OUT?
¿solo consulta Inventory?
¿no tiene efecto físico?
```

---

# 13. Datos financieros

Cuando aplique, distinguir:

```text
commercial value
financial value
accounting value
```

y evitar inferir capacidades contables no implementadas.

---

# 14. API

Documentar capacidades conceptuales y acciones empresariales.

No mantener aquí un contrato exhaustivo por endpoint.

El contrato técnico detallado deberá evolucionar a OpenAPI.

---

# 15. UX

Definir:

* listado;
* detalle / 360;
* acción principal;
* estados;
* confirmaciones;
* errores;
* información contextual.

Seguir `ZAPING_WAY.md`.

---

# 16. Auditoría

Indicar qué acciones del módulo son candidatas relevantes para Audit.

---

# 17. CURRENT

Describir únicamente capacidades verificadas como existentes.

```text
...
```

---

# 18. TARGET

Describir arquitectura o comportamiento aprobado pero pendiente.

```text
...
```

---

# 19. FUTURE

Registrar posibles evoluciones sin presentarlas como compromiso inmediato.

```text
...
```

---

# 20. Anti-patrones

Registrar errores de diseño que el módulo debe evitar.

Ejemplo:

```text
editar directamente una proyección
```

en lugar de registrar el evento que la origina.

---

# 21. ADR relacionados

* ADR-...
* ADR-...

---

# 22. Documentos relacionados

```text
...
```

---

# 23. Fuente de verdad

Definir claramente:

```text
THIS_MODULE.md
→ comportamiento funcional

schema.prisma
→ modelo técnico vigente

backend
→ implementación actual

tests
→ comportamiento validado

ADR
→ decisiones arquitectónicas

PROJECT_BOARD
→ estado del trabajo
```

---

# 24. Principio final

Cerrar con la regla más importante del dominio.

> **[Principio breve y recordable.]**
