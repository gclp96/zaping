# ADR-008 — Documentation First

**Estado:** ACCEPTED
**Fecha original:** 2026-07-10
**Última revisión:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Contexto

Zaping contiene procesos empresariales con reglas que pueden afectar:

* inventario;
* dinero;
* seguridad;
* ventas;
* compras;
* trazabilidad;
* Healthcare.

Implementar antes de comprender adecuadamente una regla puede generar:

* migraciones incorrectas;
* refactors;
* inconsistencias;
* comportamiento contradictorio;
* pérdida de trazabilidad;
* deuda técnica.

---

# 2. Problema

Se necesita una práctica que obligue al proyecto a comprender suficientemente una funcionalidad antes de modificar arquitectura o código.

Sin embargo, documentar excesivamente también genera:

* archivos duplicados;
* documentos vacíos;
* información obsoleta;
* mayor mantenimiento;
* burocracia.

---

# 3. Opciones consideradas

## Opción A — Code First

Implementar inmediatamente y documentar después.

### Riesgos

* decisiones implícitas;
* reglas no validadas;
* documentación inexistente;
* mayor probabilidad de retrabajo.

---

## Opción B — Documentation First proporcional

Comprender y documentar primero lo que sea necesario para reducir incertidumbre.

La profundidad depende del riesgo.

---

# 4. Decisión

Zaping adopta **Documentation First proporcional**.

Para cambios relevantes:

```text
Problema
↓
Análisis
↓
Documentación suficiente
↓
Diseño
↓
Código
↓
Pruebas
↓
Sincronización documental
```

La documentación debe existir antes de una decisión difícil de revertir.

---

# 5. Documentation First no significa más documentos

La decisión no exige crear:

```text
un archivo
por
cada pequeño cambio
```

Si el conocimiento pertenece a un documento existente, debe actualizarse ese documento.

---

# 6. Una verdad, una fuente

Ejemplos:

```text
Visión
→ PRODUCT_VISION.md

Requerimientos
→ PRODUCT_REQUIREMENTS.md

Arquitectura vigente
→ ARCHITECTURE.md

Decisión
→ ADR

Regla funcional
→ Module Documentation

UX
→ ZAPING_WAY.md

Trabajo actual
→ PROJECT_BOARD.md
```

Evitar múltiples fuentes activas de la misma regla.

---

# 7. Proporcionalidad

## Cambio menor

Puede requerir únicamente:

```text
comprender
→ implementar
→ validar
```

---

## Funcionalidad estándar

Puede requerir:

```text
requerimiento
→ reglas
→ implementación
→ tests
→ documentación
```

---

## Cambio crítico

Debe considerar:

* producto;
* arquitectura;
* datos;
* API;
* seguridad;
* UX;
* pruebas;
* ADR.

Ejemplos:

* cambio de Inventory;
* autenticación;
* multi-tenancy;
* Healthcare;
* nuevo flujo Sales/Delivery.

---

# 8. Documentación antes de Prisma

Los cambios significativos al esquema deben estar respaldados por una regla aprobada.

No realizar migraciones mientras todavía esté abierta una decisión crítica de dominio.

---

# 9. ADR

Las decisiones arquitectónicas relevantes deben registrarse antes o durante la implementación, no meses después intentando reconstruirlas de memoria.

---

# 10. Documentación después del código

Documentation First no elimina la actualización posterior.

Después de implementar debe comprobarse:

> ¿El documento todavía representa lo que realmente construimos?

Si no:

* corregir código;
* corregir documentación;
* o revisar la decisión.

---

# 11. Código como evidencia

La documentación no puede asumir que describe la realidad únicamente porque está marcada `Approved`.

Cuando exista discrepancia con el sistema implementado debe investigarse cuál representa la decisión correcta.

No se debe “corregir” silenciosamente documentación o código sin revisar la regla.

---

# 12. Historial

Git conserva la historia de documentos.

No es necesario mantener indefinidamente:

* especificaciones temporales;
* archivos duplicados;
* planes antiguos;
* documentos vacíos.

Los ADR se conservan porque explican decisiones históricas.

---

# 13. Requerimientos de un documento

Un documento debe existir cuando aporta una función clara.

No debe crearse solamente para completar una estructura de carpetas.

Se deben evitar:

* placeholders vacíos;
* headings sin contenido;
* documentos cuya única función sea enlazar otro documento;
* copias manuales de información.

---

# 14. Estado documental

Los documentos pueden usar estados:

```text
DRAFT
PROPOSED
APPROVED
DEPRECATED
SUPERSEDED
```

No debe marcarse `Approved` información que todavía representa una hipótesis no validada.

---

# 15. Documentación modular

Cada módulo importante debe mantener suficiente información para comprender:

* propósito;
* flujo;
* reglas;
* estados;
* permisos;
* entidades;
* integración;
* pendientes relevantes.

No necesita necesariamente un documento por cada feature histórica.

---

# 16. Beneficios

* decisiones explícitas;
* menor retrabajo;
* mejor arquitectura;
* trazabilidad;
* onboarding técnico;
* conocimiento duradero;
* mejor colaboración.

---

# 17. Costos

* requiere tiempo;
* requiere mantenimiento;
* puede convertirse en burocracia si se aplica incorrectamente.

La solución es proporcionalidad y fuentes claras.

---

# 18. Relación con el workflow

`DEVELOPMENT_WORKFLOW.md` define cómo aplicar Documentation First durante el ciclo de desarrollo.

---

# 19. Consecuencias de esta revisión

La consolidación documental de 2026-08 corrige una interpretación excesivamente granular de esta decisión.

Se eliminarán:

* archivos vacíos;
* documentos duplicados;
* documentación histórica innecesariamente fragmentada.

Esto **no contradice** Documentation First.

Lo refuerza al mejorar la calidad de las fuentes de verdad.

---

# 20. ADR relacionados

* ADR-005 — Arquitectura por capas.
* ADR-009 — Modular Monolith.
* `DEVELOPMENT_WORKFLOW.md`.
* `QUALITY_STANDARDS.md`.

---

# 21. Decisión final

> Documentar primero significa comprender antes de comprometer el diseño.

No significa maximizar la cantidad de archivos.

La documentación debe reducir incertidumbre, no crearla.
