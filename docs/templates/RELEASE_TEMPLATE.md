# Zaping — Release [versión]

**Versión:** X.Y.Z
**Estado:** DRAFT / RC / RELEASED
**Fecha:** YYYY-MM-DD
**Responsable:** Zaping Team

---

# 1. Resumen

Describir brevemente qué representa esta release y cuál es su objetivo principal.

---

# 2. Cambios principales

## Nuevas capacidades

* ...
* ...

## Mejoras

* ...
* ...

## Correcciones

* ...
* ...

---

# 3. Cambios de arquitectura

Registrar únicamente cambios relevantes.

Ejemplo:

```text
Antes
...
↓
Ahora
...
```

Referenciar ADR cuando exista.

---

# 4. Database / Migrations

Indicar:

```text
¿Hay migraciones Prisma?
¿Son backward compatible?
¿Requieren backup?
¿Transforman datos?
¿Existe riesgo de pérdida?
```

Listar las migraciones correspondientes.

---

# 5. API

Registrar:

* nuevos contratos;
* cambios;
* deprecaciones;
* breaking changes.

El detalle técnico completo debe permanecer en OpenAPI cuando esté disponible.

---

# 6. Seguridad

Indicar:

```text
Security fixes:
Authorization changes:
Tenant changes:
Secret/config changes:
```

No incluir secretos reales.

---

# 7. Breaking Changes

Si no existen:

```text
No known breaking changes.
```

Si existen, explicar:

* qué cambia;
* quién se ve afectado;
* cómo migrar.

---

# 8. Compatibilidad Legacy

Cuando exista una transición:

```text
CURRENT / LEGACY
...
```

```text
TARGET
...
```

Indicar qué permanece temporalmente soportado.

---

# 9. Validación

Registrar lo ejecutado:

* [ ] backend tests;
* [ ] frontend tests;
* [ ] lint;
* [ ] build;
* [ ] migration validation;
* [ ] tenant isolation;
* [ ] authorization;
* [ ] manual QA;
* [ ] critical workflows.

---

# 10. Deployment

Describir únicamente pasos especiales que no formen parte del proceso habitual.

---

# 11. Rollback

Indicar si existe una consideración específica para revertir:

* código;
* schema;
* datos;
* configuración.

---

# 12. Known Issues

| ID  | Problema | Impacto | Workaround |
| --- | -------- | ------- | ---------- |
| ... | ...      | ...     | ...        |

---

# 13. Documentación

Confirmar actualizaciones necesarias:

* [ ] módulos;
* [ ] ADR;
* [ ] Project Board;
* [ ] Roadmap;
* [ ] Changelog;
* [ ] API/OpenAPI;
* [ ] seguridad.

---

# 14. Changelog

Después de liberar:

```text
Release Notes
↓
extract relevant permanent history
↓
docs/project/CHANGELOG.md
```

No es necesario conservar indefinidamente un archivo de Release dentro de `docs/` si toda la información permanente ya fue consolidada.

---

# 15. Aprobación

```text
Release readiness:
APPROVED / NOT APPROVED

Approved by:
...

Date:
...
```
