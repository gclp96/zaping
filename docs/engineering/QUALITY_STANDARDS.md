# Estándares de Calidad — Zaping

**Producto:** Zaping
**Versión:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-19
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento define los estándares mínimos de calidad para los cambios realizados dentro del ecosistema Zaping.

La calidad no se limita al código.

También incluye:

* producto;
* reglas de negocio;
* arquitectura;
* backend;
* frontend;
* base de datos;
* seguridad;
* multi-tenancy;
* rendimiento;
* pruebas;
* documentación;
* y experiencia de usuario.

El objetivo es evitar que una funcionalidad se considere terminada únicamente porque compila o funciona en un escenario aislado.

---

# 2. Principio de calidad

Todo cambio debe aspirar a ser:

* correcto;
* consistente;
* comprensible;
* mantenible;
* seguro;
* trazable;
* probado;
* documentado;
* y proporcional a su riesgo.

La profundidad de validación depende del tipo de cambio.

Una corrección de texto no requiere los mismos controles que una modificación al inventario, autenticación o modelo multiempresa.

---

# 3. Relación con otros documentos

Este documento define **qué nivel de calidad se exige**.

Otros documentos definen cómo alcanzarlo.

```text
ENGINEERING_GUIDE.md
→ prácticas de ingeniería

DEVELOPMENT_WORKFLOW.md
→ proceso de desarrollo

SECURITY_PRINCIPLES.md
→ reglas específicas de seguridad

PRODUCT_REQUIREMENTS.md
→ comportamiento requerido

ZAPING_WAY.md
→ experiencia de usuario

ARCHITECTURE.md
→ estructura técnica
```

No se deben duplicar en este documento reglas extensas que pertenecen a esas fuentes.

---

# 4. Quality Gates

Los Quality Gates se aplican según el alcance y riesgo del cambio.

Las categorías principales son:

1. Producto y negocio
2. Arquitectura
3. Backend
4. Frontend
5. Base de datos
6. Seguridad
7. Multi-tenancy
8. Rendimiento
9. Pruebas
10. Documentación
11. Release

---

# 5. Gate — Producto y negocio

Antes de aprobar una funcionalidad relevante debe verificarse:

* [ ] resuelve el problema definido;
* [ ] respeta el alcance aprobado;
* [ ] mantiene las reglas de negocio;
* [ ] contempla estados y excepciones relevantes;
* [ ] no introduce comportamiento contradictorio;
* [ ] cumple los criterios de aceptación.

Para funcionalidades relacionadas con inventario, dinero, ventas, compras o Healthcare, las reglas deben validarse explícitamente.

---

# 6. Gate — Arquitectura

Cuando el cambio tenga impacto arquitectónico debe verificarse:

* [ ] respeta los límites entre dominios;
* [ ] el módulo correcto es propietario de la regla;
* [ ] no existe acoplamiento innecesario;
* [ ] no se duplica lógica existente;
* [ ] las dependencias apuntan en la dirección correcta;
* [ ] se evaluó reutilización;
* [ ] existe ADR cuando corresponde.

Ejemplo:

Healthcare no debe modificar directamente las existencias evitando las reglas de Inventory.

---

# 7. Gate — Backend

Para cambios backend deben verificarse los puntos aplicables:

* [ ] DTOs y entradas validadas;
* [ ] Controller ligero;
* [ ] reglas de negocio en la capa correcta;
* [ ] manejo de errores;
* [ ] respuestas HTTP apropiadas;
* [ ] autorización verificada;
* [ ] información sensible protegida;
* [ ] transacciones cuando se requiere atomicidad;
* [ ] código legible;
* [ ] sin lógica duplicada innecesaria.

---

# 8. Gate — Frontend

Para cambios frontend deben verificarse los estados relevantes.

Como mínimo, cuando correspondan:

```text
Loading
Empty
Data
Error
```

También debe verificarse:

* [ ] acción primaria clara;
* [ ] mensajes comprensibles;
* [ ] validación;
* [ ] feedback de guardado;
* [ ] prevención de doble submit;
* [ ] estados deshabilitados correctos;
* [ ] responsive design;
* [ ] accesibilidad básica;
* [ ] componentes existentes reutilizados;
* [ ] consistencia con patrones de Zaping.

Una pantalla no debe quedar silenciosamente vacía ante un error o falta de información.

---

# 9. Gate — Base de datos

Cuando exista modificación de persistencia:

* [ ] modelo revisado;
* [ ] relaciones validadas;
* [ ] cardinalidades correctas;
* [ ] nullabilidad justificada;
* [ ] constraints evaluados;
* [ ] unicidad evaluada;
* [ ] índices evaluados;
* [ ] `companyId` incorporado cuando corresponde;
* [ ] Soft Delete respetado cuando corresponde;
* [ ] migración revisada;
* [ ] datos existentes considerados;
* [ ] integridad posterior validada.

No debe modificarse el modelo únicamente para evitar un error de migración si eso produce un dominio incorrecto.

---

# 10. Gate — Migraciones

Para migraciones relevantes:

## Antes

* [ ] schema revisado;
* [ ] impacto conocido;
* [ ] datos existentes evaluados;
* [ ] riesgo de pérdida analizado.

## Durante

* [ ] migración ejecutada correctamente;
* [ ] no se realizó reset destructivo sin autorización;
* [ ] errores revisados.

## Después

* [ ] datos validados;
* [ ] relaciones verificadas;
* [ ] aplicación compilada;
* [ ] flujo afectado probado.

Una migración exitosa no significa automáticamente que la funcionalidad sea correcta.

---

# 11. Gate — Seguridad

Todo cambio debe evaluar si afecta:

* autenticación;
* autorización;
* datos sensibles;
* validación;
* exposición de información;
* logs;
* secretos;
* auditoría.

Cuando aplique:

* [ ] endpoint protegido;
* [ ] permisos verificados;
* [ ] datos sensibles no expuestos;
* [ ] inputs validados;
* [ ] errores no filtran información interna;
* [ ] secretos no están hardcodeados.

Los requisitos completos vivirán en `SECURITY_PRINCIPLES.md`.

---

# 12. Gate — Multi-tenancy

Para cualquier entidad empresarial:

* [ ] la operación respeta `companyId`;
* [ ] no se confía exclusivamente en `companyId` enviado por frontend;
* [ ] los reads están aislados;
* [ ] los updates están aislados;
* [ ] los deletes están aislados;
* [ ] las relaciones no permiten referencias cruzadas entre empresas.

Los cambios en aislamiento multiempresa son considerados de alto riesgo.

---

# 13. Gate — Inventario

Cualquier funcionalidad que afecte inventario debe verificar adicionalmente:

* [ ] Inventory conserva la propiedad de sus reglas;
* [ ] el stock no se modifica directamente;
* [ ] existe operación trazable;
* [ ] origen documentado;
* [ ] cantidad válida;
* [ ] lote/serie respetados cuando aplican;
* [ ] no se genera stock negativo cuando esté prohibido;
* [ ] operación transaccional cuando corresponde;
* [ ] correcciones preservan historia.

Reglas críticas actuales:

```text
Compra
≠
Entrada de inventario

Recepción confirmada
→
puede generar entrada

Cotización
≠
Salida

Entrega definitiva
→
puede generar salida
```

---

# 14. Gate — Dinero

Cuando se manejen precios o totales debe verificarse:

* [ ] cálculo correcto;
* [ ] cantidades válidas;
* [ ] impuestos aplicados correctamente;
* [ ] redondeos consistentes;
* [ ] precio editable solo cuando corresponde;
* [ ] datos financieros no se alteran accidentalmente después de confirmar una operación.

Cambios relacionados con facturación o CFDI requerirán controles adicionales cuando sean implementados.

---

# 15. Gate — Rendimiento

No todos los cambios requieren pruebas formales de performance.

Sin embargo, debe evitarse:

* consultas N+1;
* traer datasets completos innecesariamente;
* filtros exclusivamente en frontend cuando el volumen puede crecer;
* joins o includes excesivos;
* procesamiento repetitivo;
* renderizados innecesarios.

Cuando corresponda:

* [ ] paginación;
* [ ] índices;
* [ ] consultas revisadas;
* [ ] tiempos medidos.

Los objetivos de rendimiento deben medirse antes de convertirse en garantías formales.

---

# 16. Gate — Testing

Las pruebas deben ser proporcionales al riesgo.

Pueden incluir:

* unit tests;
* integration tests;
* component tests;
* regression tests;
* manual QA;
* migration testing;
* security testing.

No es obligatorio crear todos los tipos de prueba para cada cambio.

Sí es obligatorio proporcionar evidencia suficiente de que la funcionalidad funciona correctamente.

---

# 17. Flujos que requieren atención especial

Las funcionalidades que involucren las siguientes áreas deben tener mayor rigor:

* autenticación;
* autorización;
* multi-tenancy;
* inventario;
* lotes;
* series;
* caducidades;
* compras;
* recepciones;
* ventas;
* entregas;
* devoluciones;
* dinero;
* facturación;
* Healthcare;
* custodia;
* auditoría;
* datos sensibles.

---

# 18. Gates técnicos

Antes de cerrar una funcionalidad relevante deben ejecutarse los controles correspondientes al proyecto.

Como mínimo normalmente:

```bash
npm run lint
npm run build
npm test
```

o los comandos equivalentes del workspace correspondiente.

Si existen suites específicas de frontend o backend, deben ejecutarse según el área modificada.

Los errores no deben ocultarse únicamente para hacer pasar el gate.

---

# 19. ESLint

No deben existir errores de ESLint en código nuevo o modificado.

Los warnings deben evaluarse.

No deben desactivarse reglas globalmente únicamente para evitar resolver un problema local.

---

# 20. TypeScript

No deben aceptarse errores de TypeScript.

No utilizar:

```ts
// @ts-ignore
```

como solución predeterminada.

Los errores deben resolverse desde su causa.

---

# 21. Código muerto

No debe introducirse:

* código comentado abandonado;
* imports inutilizados;
* funciones sin uso;
* componentes duplicados;
* flags permanentes sin razón;
* endpoints obsoletos sin una estrategia de retirada.

Git conserva el historial.

No es necesario conservar código muerto como respaldo.

---

# 22. Duplicación

La duplicación debe evaluarse en:

* reglas de negocio;
* queries;
* componentes;
* validaciones;
* tipos;
* documentación.

No toda similitud requiere una abstracción.

Pero una misma regla crítica no debe mantenerse manualmente en múltiples implementaciones.

---

# 23. Calidad UI

Toda pantalla debe comunicar claramente su estado.

Debe evitar:

* acciones sin feedback;
* mensajes técnicos;
* formularios que pierden datos ante un error;
* botones activos durante operaciones duplicables;
* confirmaciones genéricas;
* estados ambiguos;
* color como único indicador.

La interfaz debe permitir que el usuario comprenda qué ocurrió y qué puede hacer a continuación.

---

# 24. Accesibilidad

Los cambios UI deben evaluar:

* navegación mediante teclado;
* labels;
* contraste;
* estados de foco;
* semántica;
* textos alternativos cuando corresponda;
* botones y controles correctamente identificables.

La accesibilidad debe incorporarse desde el componente, no agregarse únicamente al final.

---

# 25. Calidad API

Todo endpoint debe contemplar según aplique:

* validación;
* autenticación;
* autorización;
* multi-tenancy;
* contrato consistente;
* errores;
* status codes;
* paginación;
* auditoría;
* documentación.

No debe retornar modelos de persistencia completos automáticamente si incluyen información no perteneciente al contrato público.

---

# 26. Calidad documental

La documentación debe ser:

* actual;
* clara;
* necesaria;
* consistente;
* ubicada en la fuente correcta.

No se debe crear un documento simplemente porque exista una plantilla.

No deben existir dos documentos activos que definan versiones diferentes de la misma regla.

---

# 27. Requisitos mínimos de un documento

El contenido depende del tipo de documento.

Una documentación de módulo puede incluir:

* propósito;
* alcance;
* flujo;
* reglas;
* estados;
* actores;
* permisos;
* entidades;
* impacto en inventario;
* API relevante;
* criterios de aceptación;
* pendientes.

Pero no debe contener secciones vacías únicamente para cumplir estructura.

---

# 28. Calidad de ADR

Un ADR debe contener información suficiente para entender:

* contexto;
* decisión;
* alternativas;
* consecuencias;
* estado.

Una decisión reemplazada debe marcarse como:

```text
SUPERSEDED
```

en lugar de eliminarse.

Esto conserva la historia arquitectónica.

---

# 29. Code Review

Cuando exista revisión de código debe evaluar los aspectos aplicables:

## Correctness

¿Hace lo que debe hacer?

## Business

¿Respeta las reglas?

## Architecture

¿Está en el módulo correcto?

## Security

¿Expone o permite algo que no debería?

## Multi-tenancy

¿Existe riesgo de acceso cruzado?

## Maintainability

¿Se podrá entender y modificar posteriormente?

## Testing

¿Existe evidencia suficiente?

## Documentation

¿La fuente correspondiente quedó actualizada?

---

# 30. Definition of Done

Una funcionalidad puede considerarse terminada cuando, según su alcance:

* [ ] cumple el requerimiento;
* [ ] reglas de negocio correctas;
* [ ] arquitectura respetada;
* [ ] implementación completada;
* [ ] seguridad revisada;
* [ ] multi-tenancy validado;
* [ ] errores manejados;
* [ ] UX completa;
* [ ] pruebas relevantes pasan;
* [ ] lint pasa;
* [ ] build pasa;
* [ ] migraciones validadas cuando existen;
* [ ] documentación sincronizada;
* [ ] criterios de aceptación cumplidos.

---

# 31. Definition of Done proporcional

No todas las casillas aplican a todos los cambios.

Por ejemplo:

### Cambio de texto

Puede requerir:

```text
revisión
+
build/frontend check
```

### Nueva recepción de compras

Puede requerir:

```text
documentación
+
arquitectura
+
backend
+
database
+
transaction
+
inventory
+
frontend
+
tests
+
QA
+
build
```

La proporcionalidad no significa reducir controles necesarios.

Significa evitar burocracia sin sacrificar calidad.

---

# 32. Severidad de problemas

Los problemas encontrados durante QA pueden clasificarse como:

## Critical

Puede provocar:

* pérdida de datos;
* exposición de información;
* acceso entre empresas;
* corrupción de inventario;
* error financiero grave;
* sistema inutilizable.

Bloquea release.

---

## High

Funcionalidad principal incorrecta o riesgo significativo.

Normalmente bloquea release.

---

## Medium

Problema relevante con workaround aceptable.

Debe evaluarse según alcance.

---

## Low

Problema menor que no impide uso correcto.

Puede pasar a backlog.

---

# 33. Regresión

Una corrección no debe romper un flujo previamente funcional.

Las modificaciones en áreas compartidas deben revisar módulos dependientes.

Ejemplos:

```text
ProductSelector
→ Purchases
→ Quotes
→ Sales
→ Healthcare
```

Cambiar un componente compartido requiere evaluar sus consumidores.

---

# 34. No ocultar fallos

No se deben aprobar cambios mediante:

* desactivar tests válidos;
* eliminar validaciones;
* silenciar errores;
* ignorar TypeScript;
* capturar excepciones sin procesarlas;
* comentar código problemático;
* reducir temporalmente controles sin registrar la decisión.

Un gate existe para revelar problemas, no para ser evitado.

---

# 35. Calidad antes de release

Antes de una release debe existir evidencia suficiente de:

* estabilidad;
* integridad;
* seguridad;
* compatibilidad;
* migraciones;
* documentación;
* rollback cuando corresponda.

Una release debe ser reproducible.

---

# 36. Mejora continua

Los estándares actuales representan el mínimo esperado.

Deben evolucionar conforme maduren:

* infraestructura;
* automatización;
* CI/CD;
* observabilidad;
* clientes productivos;
* seguridad;
* volumen de datos.

No se deben imponer procesos enterprise antes de que exista una necesidad real.

Pero tampoco debe posponerse una práctica necesaria únicamente porque el producto aún esté en desarrollo.

---

# 37. Principio final

La calidad en Zaping no significa perfección.

Significa:

> entregar cambios correctos, seguros, comprensibles y suficientemente probados para el riesgo que representan.

La velocidad sostenible depende de mantener esa disciplina.
