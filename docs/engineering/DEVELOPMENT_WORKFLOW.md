# Flujo de Desarrollo — Zaping

**Producto:** Zaping
**Versión:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-19
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento define el ciclo oficial de desarrollo utilizado para crear, modificar y liberar funcionalidades dentro del ecosistema Zaping.

Su objetivo es asegurar:

* consistencia;
* calidad;
* trazabilidad;
* seguridad;
* predictibilidad;
* documentación actualizada;
* y alineación entre producto, arquitectura e implementación.

El workflow aplica a:

* nuevas funcionalidades;
* nuevos módulos;
* cambios de arquitectura;
* correcciones;
* mejoras de UX;
* mejoras de rendimiento;
* mejoras de seguridad;
* migraciones;
* y cambios relevantes en reglas de negocio.

---

# 2. Principio general

El desarrollo de Zaping sigue el principio:

> Entender primero. Diseñar después. Implementar al final.

El flujo general es:

```text
Idea
↓
Análisis de negocio
↓
Validación de producto
↓
Documentación funcional
↓
Revisión de arquitectura
↓
Diseño de datos
↓
Diseño de API
↓
Diseño UI/UX
↓
Implementación Backend
↓
Implementación Frontend
↓
Pruebas
↓
Actualización documental
↓
Revisión
↓
Release
```

No todos los cambios requieren el mismo nivel de profundidad.

El proceso debe ser proporcional al riesgo y alcance.

---

# 3. Clasificación del cambio

Antes de iniciar una implementación debe determinarse su nivel.

## Nivel A — Cambio menor

Ejemplos:

* corrección de texto;
* ajuste visual pequeño;
* corrección aislada;
* cambio que no modifica reglas de negocio.

Puede utilizar un flujo reducido.

---

## Nivel B — Funcionalidad estándar

Ejemplos:

* nueva pantalla;
* nuevo endpoint;
* validación de negocio;
* mejora de un módulo existente;
* nuevo workflow dentro de un dominio conocido.

Debe pasar por análisis, documentación, implementación, pruebas y actualización documental.

---

## Nivel C — Cambio crítico o arquitectónico

Ejemplos:

* nuevo módulo;
* modificación del modelo de inventario;
* nueva frontera de dominio;
* cambio multi-tenant;
* cambios de autenticación o autorización;
* migraciones complejas;
* nuevo sistema de permisos;
* integración externa crítica;
* cambios que afectan dinero o trazabilidad;
* Zaping Healthcare;
* cambios relevantes de infraestructura.

Debe pasar por el workflow completo y puede requerir uno o más ADR.

---

# 4. Fase 1 — Idea

Toda implementación comienza con una necesidad.

Puede originarse en:

* solicitud de usuario;
* problema operativo;
* feedback de cliente;
* bug;
* análisis competitivo;
* oportunidad comercial;
* mejora técnica;
* riesgo de seguridad;
* deuda técnica;
* necesidad de rendimiento.

## Preguntas mínimas

* ¿Qué problema existe?
* ¿Quién lo experimenta?
* ¿Qué resultado esperamos?
* ¿Por qué vale la pena resolverlo?

## Entregable

**Problem Statement**

Debe describir brevemente:

* problema;
* usuario afectado;
* impacto;
* resultado esperado.

---

# 5. Fase 2 — Análisis de negocio

Antes de diseñar software debe entenderse el proceso real.

Preguntas:

* ¿Quién utiliza esta capacidad?
* ¿Qué problema resuelve?
* ¿Cómo se realiza actualmente?
* ¿Qué reglas existen?
* ¿Qué excepciones existen?
* ¿Qué información participa?
* ¿Qué ocurre antes?
* ¿Qué ocurre después?
* ¿Qué otros módulos están involucrados?
* ¿Qué riesgo existe si funciona incorrectamente?

Cuando sea posible, utilizar procesos operativos reales como fuente de discovery.

No asumir reglas de negocio sin validarlas.

## Entregable

**Business Analysis**

Puede formar parte directamente de la documentación del módulo.

---

# 6. Fase 3 — Validación de producto

Evaluar si la funcionalidad debe construirse.

Considerar:

* alineación con `PRODUCT_VISION.md`;
* requerimientos de `PRODUCT_REQUIREMENTS.md`;
* prioridad P0 / P1 / P2 / Futuro;
* impacto;
* complejidad;
* dependencias;
* valor comercial;
* riesgo;
* costo de mantenimiento;
* alternativas más simples.

## Resultado

Una iniciativa puede quedar:

```text
APPROVED
DEFERRED
REJECTED
NEEDS_DISCOVERY
```

## Entregable

Decisión de producto registrada en documentación o `PROJECT_BOARD`.

---

# 7. Fase 4 — Documentación funcional

Antes de modificar código debe existir suficiente claridad funcional.

Crear o actualizar, según corresponda:

* documentación del módulo;
* propósito;
* alcance;
* flujo;
* actores;
* reglas de negocio;
* estados;
* permisos;
* validaciones;
* eventos;
* casos límite;
* impacto en otros módulos;
* criterios de aceptación.

No deben crearse documentos separados únicamente para llenar una plantilla.

La información debe vivir en la fuente de verdad adecuada.

## Entregable

**Functional Specification**

Normalmente contenida dentro de:

```text
docs/modules/...
```

---

# 8. Fase 5 — Revisión de arquitectura

Debe realizarse cuando la funcionalidad:

* afecta varios dominios;
* introduce una nueva responsabilidad;
* modifica contratos entre módulos;
* cambia una decisión arquitectónica;
* introduce infraestructura;
* cambia seguridad;
* cambia multi-tenancy;
* modifica el modelo fundamental de datos;
* o es difícil de revertir.

Evaluar:

* dominio propietario;
* límites;
* dependencias;
* alternativas;
* escalabilidad;
* seguridad;
* compatibilidad;
* impacto futuro.

## ADR

Debe crearse un ADR cuando exista una decisión arquitectónica suficientemente relevante.

No crear ADR para decisiones triviales.

## Entregable

Arquitectura aprobada y, cuando aplique:

```text
ADR-XXX
```

---

# 9. Fase 6 — Diseño de datos

Cuando exista impacto en persistencia, revisar:

* entidades;
* relaciones;
* cardinalidad;
* tipos;
* nullabilidad;
* constraints;
* índices;
* unicidad;
* multi-tenancy;
* auditoría;
* Soft Delete;
* trazabilidad;
* migraciones;
* compatibilidad con datos existentes.

## Regla

El esquema de base de datos debe representar correctamente el dominio.

No adaptar las reglas de negocio únicamente para simplificar Prisma.

## Antes de migrar

Debe verificarse:

1. modelo aprobado;
2. impacto sobre datos existentes;
3. posibilidad de migrar sin pérdida;
4. relaciones;
5. restricciones;
6. rollback o estrategia de corrección.

## Entregable

Diseño de datos aprobado.

---

# 10. Fase 7 — Diseño de API

Cuando exista API nueva o modificada se debe definir:

* endpoint;
* método HTTP;
* parámetros;
* DTO;
* validaciones;
* autenticación;
* permisos;
* tenant;
* request;
* response;
* errores;
* estados HTTP;
* paginación cuando corresponda.

La API debe representar correctamente el negocio.

Ejemplo:

```text
POST /purchases/:id/receipts
```

puede expresar mejor una operación que un CRUD artificial.

## Compatibilidad

Antes de modificar un contrato existente debe revisarse qué consumidores pueden verse afectados.

## Entregable

Contrato de API suficientemente definido para implementar.

---

# 11. Fase 8 — Diseño UI/UX

Antes de desarrollar una experiencia relevante debe definirse:

* objetivo de la pantalla;
* usuario;
* tarea principal;
* información necesaria;
* acción primaria;
* estados;
* navegación;
* validaciones;
* feedback;
* comportamiento responsive;
* accesibilidad.

Revisar como mínimo:

```text
Loading
Empty
Data
Error
```

cuando corresponda.

También considerar:

* permisos;
* confirmaciones;
* acciones destructivas;
* tablas;
* formularios;
* modales;
* vista móvil.

La experiencia debe seguir:

```text
ZAPING_WAY.md
DESIGN_SYSTEM.md
BUSINESS_COMPONENTS.md
```

cuando esos documentos apliquen.

## Entregable

Experiencia suficientemente definida para implementación.

No se requieren mockups de alta fidelidad para cada cambio si el patrón ya existe.

---

# 12. Fase 9 — Implementación Backend

La implementación backend debe seguir `ENGINEERING_GUIDE.md`.

Según el módulo puede incluir:

* Controller;
* DTO;
* Guards;
* permisos;
* Service;
* Repository cuando sea útil;
* Prisma;
* transacciones;
* reglas de negocio;
* errores;
* logs;
* pruebas.

## Checklist mínimo

* [ ] reglas implementadas;
* [ ] DTO validado;
* [ ] autorización aplicada;
* [ ] `companyId` respetado;
* [ ] errores manejados;
* [ ] transacciones utilizadas cuando sean necesarias;
* [ ] información sensible protegida;
* [ ] pruebas relevantes ejecutadas.

## Entregable

Backend funcional y validado.

---

# 13. Fase 10 — Implementación Frontend

La implementación frontend puede incluir:

* Page;
* Feature;
* Hooks;
* Business Components;
* UI Components;
* formularios;
* tablas;
* estados;
* manejo de errores;
* integración con API;
* responsive behavior.

## Checklist mínimo

* [ ] acción principal clara;
* [ ] loading;
* [ ] empty state;
* [ ] error handling;
* [ ] validaciones;
* [ ] feedback;
* [ ] prevención de doble submit;
* [ ] permisos considerados;
* [ ] comportamiento responsive;
* [ ] reutilización de componentes existentes.

## Entregable

Frontend funcional.

---

# 14. Fase 11 — Pruebas

La estrategia depende del riesgo de la funcionalidad.

Puede incluir:

* pruebas unitarias;
* pruebas de integración;
* pruebas de componentes;
* pruebas de regresión;
* QA manual;
* pruebas de migración;
* pruebas de seguridad;
* validaciones de rendimiento.

---

## 14.1 Funciones críticas

Deben recibir atención especial los cambios relacionados con:

* inventario;
* lotes;
* series;
* dinero;
* compras;
* ventas;
* recepciones;
* devoluciones;
* seguridad;
* permisos;
* multi-tenancy;
* auditoría;
* Healthcare;
* datos sensibles.

---

## 14.2 Gates técnicos

Antes de considerar completada una funcionalidad deben ejecutarse los gates correspondientes.

Normalmente:

```bash
npm run lint
npm run build
npm test
```

o sus equivalentes en el workspace correspondiente.

No es obligatorio ejecutar toda la suite en cada edición durante el desarrollo.

Sí debe existir una validación completa adecuada antes de cerrar una funcionalidad relevante o release.

## Entregable

QA aprobado.

---

# 15. Fase 12 — Actualización documental

Después de implementar debe revisarse nuevamente la documentación.

Actualizar únicamente las fuentes relevantes.

Ejemplos:

* módulo;
* ADR;
* `PROJECT_BOARD`;
* `ROADMAP`;
* `CHANGELOG`;
* arquitectura;
* requerimientos.

No se debe documentar el mismo cambio en múltiples archivos sin necesidad.

## Regla

> Si el comportamiento cambió, la documentación correspondiente también debe cambiar.

## Entregable

Documentación sincronizada.

---

# 16. Fase 13 — Revisión final

Antes de cerrar una funcionalidad se debe evaluar:

## Producto

* [ ] resuelve el problema definido;
* [ ] cumple criterios de aceptación;
* [ ] no introduce complejidad innecesaria.

## Arquitectura

* [ ] respeta límites de dominio;
* [ ] dependencias correctas;
* [ ] ADR cumplido cuando aplica.

## Backend

* [ ] reglas correctas;
* [ ] seguridad;
* [ ] multi-tenancy;
* [ ] errores;
* [ ] transacciones.

## Frontend

* [ ] UX consistente;
* [ ] estados cubiertos;
* [ ] validaciones;
* [ ] responsive.

## Calidad

* [ ] lint;
* [ ] build;
* [ ] tests;
* [ ] QA.

## Documentación

* [ ] actualizada.

## Entregable

Cambio aprobado.

---

# 17. Fase 14 — Release

Cuando el cambio forme parte de una release, preparar según el nivel de madurez del producto:

* versión;
* changelog;
* migraciones;
* variables de entorno;
* despliegue;
* pruebas post-deploy;
* monitoreo;
* rollback;
* comunicación cuando corresponda.

No todas las funcionalidades individuales requieren una release independiente.

## Entregable

Release lista para el entorno correspondiente.

---

# 18. Workflow reducido

Los cambios menores no necesitan recorrer artificialmente todas las fases.

Ejemplo:

```text
Bug visual pequeño
↓
Identificar causa
↓
Corregir
↓
Validar
↓
Actualizar documentación si corresponde
↓
Cerrar
```

Un cambio puede omitir una fase únicamente cuando esa fase **realmente no aplica**.

No debe omitirse para ahorrar tiempo cuando existe riesgo relevante.

---

# 19. Workflow para bugs

Los bugs deben seguir:

```text
Reporte
↓
Reproducción
↓
Identificación de causa raíz
↓
Evaluación de impacto
↓
Corrección
↓
Prueba
↓
Regresión
↓
Documentación si aplica
↓
Cierre
```

Evitar corregir únicamente el síntoma cuando exista una causa estructural identificable.

---

# 20. Workflow para migraciones

Las migraciones requieren atención específica.

Antes:

* revisar schema;
* revisar datos existentes;
* validar relaciones;
* identificar riesgo;
* crear respaldo cuando corresponda.

Durante:

* ejecutar migración;
* revisar errores;
* evitar resets destructivos salvo autorización explícita.

Después:

* verificar schema;
* validar datos;
* ejecutar pruebas;
* ejecutar build;
* validar comportamiento afectado.

Una migración exitosa técnicamente no garantiza que el dominio haya quedado correcto.

---

# 21. Workflow para cambios de seguridad

Los cambios relacionados con:

* autenticación;
* JWT;
* roles;
* permisos;
* datos sensibles;
* multi-tenancy;
* exposición de endpoints;

deben revisar obligatoriamente:

* amenazas;
* autorización;
* validación;
* aislamiento;
* logs;
* pruebas.

No deben tratarse como cambios CRUD normales.

---

# 22. Control de alcance

Durante una implementación pueden aparecer mejoras relacionadas.

No deben agregarse automáticamente.

Clasificar cada descubrimiento como:

```text
BLOCKER
REQUIRED
FOLLOW-UP
BACKLOG
```

## BLOCKER

Impide completar correctamente la funcionalidad.

Debe resolverse.

## REQUIRED

Forma parte necesaria del alcance aprobado.

## FOLLOW-UP

Importante, pero puede abordarse inmediatamente después.

## BACKLOG

Idea válida que no debe expandir el sprint actual.

Esto protege al proyecto contra scope creep.

---

# 23. Cambios descubiertos durante implementación

Si durante desarrollo se descubre que la arquitectura o regla aprobada era incorrecta:

> detener la parte afectada y revisar la decisión.

No adaptar silenciosamente el código.

Dependiendo del impacto:

* actualizar especificación;
* actualizar ADR;
* modificar diseño;
* recalcular alcance.

Después continuar.

---

# 24. Definition of Ready

Una funcionalidad importante está suficientemente lista para implementación cuando se conoce:

* problema;
* usuario;
* objetivo;
* prioridad;
* reglas principales;
* alcance;
* dependencias;
* dominio propietario;
* criterios de aceptación.

Cambios críticos además deben tener:

* arquitectura;
* datos;
* contratos;
* y estrategia de pruebas suficientemente definidos.

---

# 25. Definition of Done

Una funcionalidad está terminada cuando, según su alcance:

* implementación está completa;
* reglas funcionan;
* multi-tenancy funciona;
* seguridad fue revisada;
* errores están manejados;
* UX está completa;
* migraciones funcionan;
* pruebas relevantes pasan;
* lint pasa;
* build pasa;
* documentación está sincronizada;
* y criterios de aceptación fueron cumplidos.

“Funciona en mi máquina” no es Definition of Done.

---

# 26. Fuente de verdad

Cada tipo de información debe mantenerse en su documento responsable.

Ejemplos:

```text
Visión
→ PRODUCT_VISION.md

Requerimientos
→ PRODUCT_REQUIREMENTS.md

Arquitectura
→ ARCHITECTURE.md

Decisión arquitectónica
→ ADR

Regla de módulo
→ docs/modules/

Estado actual
→ PROJECT_BOARD.md

Dirección futura
→ ROADMAP.md

Cambios terminados
→ CHANGELOG.md
```

Evitar mantener el mismo estado manualmente en múltiples documentos.

---

# 27. Principio final

El workflow existe para reducir errores y aumentar claridad.

No debe convertirse en burocracia.

Para cambios pequeños:

**rápido y proporcional.**

Para cambios críticos:

**riguroso y trazable.**

La velocidad sostenible proviene de entender correctamente qué se está construyendo antes de implementarlo.
