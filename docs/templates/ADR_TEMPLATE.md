# ADR-XXX — Título de la decisión

**Estado:** PROPOSED
**Fecha:** YYYY-MM-DD
**Responsable:** Zaping Team
**Decisión relacionada con:** [módulo / arquitectura / plataforma]

---

# 1. Contexto

Describir el problema que requiere una decisión arquitectónica.

Responder:

```text
¿Qué está ocurriendo?
¿Por qué necesitamos decidirlo?
¿Qué restricciones existen?
¿Qué problema queremos evitar?
```

Incluir únicamente el contexto necesario para comprender la decisión.

---

# 2. Decisión

Describir claramente la decisión adoptada.

Ejemplo:

```text
Se utilizará X para resolver Y.
```

La decisión debe ser concreta y verificable.

---

# 3. Razones

Explicar por qué esta alternativa fue seleccionada.

Considerar cuando corresponda:

* simplicidad;
* mantenibilidad;
* seguridad;
* consistencia;
* experiencia de usuario;
* rendimiento;
* migración;
* escalabilidad;
* costo operativo.

---

# 4. Consecuencias positivas

Registrar los beneficios esperados.

Ejemplo:

* reduce duplicación;
* mejora trazabilidad;
* separa responsabilidades;
* simplifica evolución futura.

---

# 5. Consecuencias y trade-offs

Registrar explícitamente los costos o limitaciones introducidos.

Ejemplo:

* requiere migración;
* añade una entidad;
* incrementa validaciones;
* mantiene compatibilidad temporal con un modelo legacy.

Un ADR no debe presentar una decisión como si no tuviera trade-offs.

---

# 6. Alternativas consideradas

## Alternativa A

Descripción.

**Por qué no se eligió:**

Motivo.

## Alternativa B

Descripción.

**Por qué no se eligió:**

Motivo.

Eliminar esta sección únicamente cuando realmente no hayan existido alternativas relevantes.

---

# 7. Impacto

Indicar qué áreas pueden verse afectadas.

```text
Database:
Backend:
Frontend:
API:
Security:
Multi-tenancy:
UX:
Documentation:
Migration:
```

Utilizar `N/A` cuando una dimensión no aplique.

---

# 8. Migración / Compatibilidad

Si la decisión sustituye comportamiento existente, explicar:

```text
CURRENT
→ comportamiento actual

TARGET
→ comportamiento aprobado
```

y cómo deberá realizarse la transición.

No afirmar que una migración ya ocurrió si todavía está pendiente.

---

# 9. Invariantes

Registrar las reglas que deben permanecer verdaderas.

Ejemplo:

```text
Business action
→ must preserve tenant isolation
```

---

# 10. Estado de implementación

```text
CURRENT:
...

TARGET:
...

PENDING:
...
```

Esta sección es especialmente importante cuando la decisión arquitectónica precede a la implementación.

---

# 11. ADR superseded

Si este ADR reemplaza otro:

```text
Supersedes:
ADR-XXX
```

El ADR anterior deberá cambiar a:

```text
SUPERSEDED
```

pero no eliminarse.

---

# 12. Referencias

* documentos relacionados;
* módulos;
* ADR relacionados;
* issues/features relevantes.

---

# 13. Principio final

Cerrar con una frase breve que resuma la decisión y facilite recordarla.

Ejemplo:

> **La decisión debe preservar X sin mezclar Y.**
