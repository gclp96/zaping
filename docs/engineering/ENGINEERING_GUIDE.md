# Guía de Ingeniería — Zaping

**Producto:** Zaping
**Versión:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-19
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento define los principios de ingeniería, estándares de desarrollo y prácticas técnicas utilizadas en todo el ecosistema Zaping.

Su objetivo es mantener un código:

* legible;
* consistente;
* mantenible;
* seguro;
* escalable;
* reutilizable;
* y comprensible a largo plazo.

Toda nueva funcionalidad debe respetar estas reglas salvo que exista una decisión arquitectónica documentada que justifique una excepción.

---

# 2. Filosofía de ingeniería

Las decisiones técnicas deben priorizar:

1. valor para el negocio;
2. corrección;
3. simplicidad;
4. mantenibilidad;
5. seguridad;
6. consistencia;
7. escalabilidad;
8. trazabilidad;
9. reutilización;
10. pensamiento a largo plazo.

La tecnología debe resolver las necesidades del negocio.

El negocio no debe adaptarse innecesariamente a las limitaciones de una implementación técnica.

---

# 3. Principios fundamentales

## 3.1 Documentation First

Las funcionalidades relevantes deben documentarse antes de implementarse.

El flujo esperado es:

```text
Problema
↓
Análisis de negocio
↓
Documentación
↓
Diseño
↓
Implementación
↓
Pruebas
↓
Actualización documental
```

La documentación debe representar el comportamiento real del sistema.

---

## 3.2 Business First

Las reglas de negocio determinan el diseño del software.

No se deben introducir estructuras únicamente porque una tecnología determinada las favorezca.

---

## 3.3 Simplicidad

Se debe preferir la solución más simple que resuelva correctamente el problema.

Evitar:

* abstracciones prematuras;
* capas sin responsabilidad clara;
* patrones innecesarios;
* dependencias sin justificación;
* y sobreingeniería.

---

## 3.4 Responsabilidad única

Cada:

* módulo;
* servicio;
* componente;
* función;
* clase;
* y archivo

debe tener una responsabilidad clara.

Cuando una unidad comienza a resolver demasiadas cosas, debe evaluarse su separación.

---

## 3.5 Reutilización

Evitar duplicar:

* código;
* componentes;
* validaciones;
* tipos;
* reglas de negocio;
* consultas;
* y conocimiento.

La reutilización debe aplicarse cuando exista un patrón real.

No se debe abstraer una solución únicamente porque dos fragmentos se parezcan superficialmente.

---

## 3.6 Consistencia

Las nuevas funcionalidades deben seguir los patrones existentes mientras estos continúen siendo válidos.

Las excepciones deben ser justificadas.

---

## 3.7 API First

La lógica de negocio no debe depender exclusivamente de la interfaz web.

Las capacidades deben diseñarse mediante contratos reutilizables que puedan ser consumidos posteriormente por:

* frontend web;
* aplicaciones móviles;
* portal de clientes;
* integraciones;
* y API pública.

---

## 3.8 Security by Design

La seguridad forma parte de la arquitectura.

No debe añadirse al final.

Toda funcionalidad debe evaluar:

* autenticación;
* autorización;
* multi-tenancy;
* validación;
* exposición de datos;
* auditoría;
* y datos sensibles.

---

## 3.9 Performance Awareness

No optimizar prematuramente.

Primero:

1. diseñar correctamente;
2. medir;
3. identificar el cuello de botella;
4. optimizar.

Sin embargo, desde el diseño deben evitarse problemas evidentes como:

* consultas N+1;
* cargas innecesarias;
* procesamiento repetitivo;
* y consultas sin índices cuando sean necesarios.

---

## 3.10 Mejora continua

Cada etapa de desarrollo debe dejar el proyecto en mejor estado.

No solamente se agregan funcionalidades.

También se debe mejorar progresivamente:

* deuda técnica;
* cobertura de pruebas;
* documentación;
* rendimiento;
* consistencia;
* seguridad;
* y experiencia de usuario.

---

# 4. TypeScript

Zaping utiliza TypeScript como lenguaje principal.

## 4.1 Tipado fuerte

Evitar `any`.

Incorrecto:

```ts
const data: any;
```

Preferido:

```ts
type Customer = {
  id: string;
  name: string;
};
```

Si un tipo necesario no existe, debe definirse.

Cuando un valor sea realmente desconocido, debe preferirse `unknown` y validarse antes de utilizarse.

---

## 4.2 Types e interfaces

Preferir `type` para estructuras simples y composiciones.

Ejemplo:

```ts
type Customer = {
  id: string;
  name: string;
};
```

Utilizar `interface` cuando exista una necesidad clara de extensión o herencia estructural.

La consistencia dentro de cada dominio tiene prioridad sobre preferencias personales.

---

## 4.3 No ignorar errores de tipos

No utilizar soluciones como:

```ts
// @ts-ignore
```

salvo casos excepcionales claramente justificados.

Los errores de TypeScript deben resolverse en la causa original siempre que sea posible.

---

# 5. Convenciones de nombres

## 5.1 Componentes React

Utilizar `PascalCase`.

```text
Button.tsx
PageHeader.tsx
ConfirmDialog.tsx
ProductSelector.tsx
```

---

## 5.2 Tipos y clases

Utilizar `PascalCase`.

```text
Customer
Supplier
PurchaseItem
PurchaseReceipt
```

---

## 5.3 Variables y funciones

Utilizar `camelCase`.

```ts
customerName;
totalAmount;
pageLoading;
getPurchase();
```

---

## 5.4 Hooks

Utilizar el prefijo `use`.

```ts
useAuth();
useProducts();
usePurchaseForm();
```

---

## 5.5 Constantes globales

Cuando representen constantes reales, utilizar una convención consistente como:

```ts
MAX_PAGE_SIZE;
DEFAULT_CURRENCY;
```

No convertir variables normales en constantes globales innecesariamente.

---

# 6. Código legible

El código debe priorizar claridad sobre reducción artificial de líneas.

Preferir:

```ts
const pendingQuantity =
  orderedQuantity - receivedQuantity;
```

sobre expresiones complejas difíciles de interpretar.

Las funciones deben tener nombres que expliquen su intención.

---

# 7. Funciones y clases

Las funciones deben:

* resolver una responsabilidad;
* evitar efectos secundarios innecesarios;
* tener nombres descriptivos;
* mantener complejidad razonable.

Las clases deben mantener cohesión.

Una clase grande no es automáticamente incorrecta, pero si contiene responsabilidades diferentes debe dividirse.

---

# 8. Comentarios

Los comentarios deben explicar:

> por qué existe una decisión.

No deben repetir lo que el código ya expresa claramente.

Evitar:

```ts
// Incrementa quantity
quantity++;
```

Preferir comentarios cuando exista contexto no evidente:

```ts
// Over-receipt is intentionally blocked until
// supplier tolerance rules are implemented.
```

---

# 9. Frontend

La arquitectura frontend debe mantener responsabilidades claras.

La dirección general es:

```text
Pages
↓
Features
↓
Business Components
↓
UI Components
```

---

# 10. Pages

Las páginas deben principalmente:

* organizar la experiencia;
* cargar workflows;
* manejar composición;
* proporcionar contexto.

No deben acumular reglas complejas de negocio.

---

# 11. Features

Una `feature` representa un workflow o capacidad funcional.

Puede contener:

* hooks;
* formularios;
* lógica de interacción;
* componentes específicos;
* tipos;
* adaptadores.

La lógica debe ubicarse lo más cerca posible del dominio que la utiliza sin duplicarse.

---

# 12. UI Components

Los componentes UI deben ser genéricos.

Ejemplos:

```text
Button
Modal
Table
Badge
Input
EmptyState
LoadingSpinner
ConfirmDialog
```

No deben contener reglas específicas de:

* compras;
* inventario;
* Healthcare;
* ventas;
* u otros dominios.

---

# 13. Business Components

Los Business Components encapsulan patrones de interfaz reutilizables que sí contienen significado de negocio.

Ejemplos:

```text
StatusBadge
ProductSelector
CustomerSelector
SupplierSelector
MoneyInput
```

Si un patrón aparece repetidamente en varios módulos, debe evaluarse su extracción.

Como regla orientativa, si un componente se utiliza en tres o más contextos diferentes puede ser candidato a reutilización.

No es una obligación automática.

---

# 14. Tamaño de componentes

No existe un límite rígido universal.

Sin embargo, cuando un componente React supera aproximadamente **250–300 líneas**, debe evaluarse si contiene responsabilidades que puedan separarse.

La decisión debe basarse en cohesión, no solamente en cantidad de líneas.

---

# 15. Estados de pantalla

Toda pantalla basada en datos debe evaluar al menos:

* Loading;
* Empty;
* Data;
* Error.

Cuando corresponda también:

* Unauthorized;
* Disabled;
* Partial;
* Success.

Nunca debe dejarse al usuario frente a una pantalla vacía sin explicación.

---

# 16. Formularios

Los formularios deben:

* validar información;
* mostrar mensajes claros;
* indicar operaciones en progreso;
* evitar envíos duplicados;
* preservar información útil cuando ocurre un error;
* utilizar componentes existentes cuando sea razonable.

Las validaciones críticas deben existir también en backend.

La validación frontend mejora UX, pero no representa una barrera de seguridad.

---

# 17. Estructura visual base

Las páginas deberán utilizar los componentes de layout oficiales cuando corresponda.

Ejemplo:

```tsx
<PageContainer>
  <PageHeader />
  {/* contenido */}
</PageContainer>
```

No se debe copiar manualmente el mismo layout en cada página.

---

# 18. Consumo de API

No consumir APIs mediante `fetch` disperso directamente por las páginas.

Las solicitudes deben pasar por la capa oficial de acceso a API.

Actualmente:

```text
services/api.ts
```

o la abstracción que posteriormente la reemplace.

Esto permite centralizar:

* base URL;
* autenticación;
* headers;
* manejo de errores;
* y comportamiento común.

---

# 19. Manejo de errores frontend

Los errores deben convertirse en mensajes útiles para el usuario.

Evitar mostrar:

* stack traces;
* errores internos de Prisma;
* respuestas técnicas sin procesar;
* información sensible.

La aplicación debe diferenciar cuando sea posible:

* validación;
* autorización;
* conflicto;
* recurso inexistente;
* error inesperado.

---

# 20. Backend

La estructura backend debe mantener el flujo:

```text
Controller
↓
Service
↓
Repository / Prisma
↓
PostgreSQL
```

No todos los módulos requieren obligatoriamente una capa Repository independiente.

La capa se utiliza cuando mejora realmente la separación y testabilidad.

---

# 21. Controllers

Los Controllers deben permanecer ligeros.

Sus responsabilidades principales son:

* recibir solicitudes;
* resolver parámetros;
* aplicar Guards y decoradores;
* delegar al Service;
* devolver la respuesta.

No deben contener reglas complejas de negocio.

---

# 22. Services

Los Services contienen:

* reglas de negocio;
* coordinación;
* validaciones de dominio;
* transacciones;
* llamadas a otros servicios mediante contratos permitidos.

Un Service no debe convertirse en una colección desorganizada de funciones sin relación.

---

# 23. Repositories y persistencia

Cuando exista una capa Repository, su responsabilidad principal será acceso a datos.

No debe contener reglas centrales de negocio.

Actualmente Prisma es el mecanismo principal de persistencia.

---

# 24. Prisma

Toda operación normal de persistencia debe realizarse mediante Prisma ORM.

No utilizar SQL manual salvo que exista una necesidad técnica concreta y documentada.

Cuando se utilice SQL manual debe revisarse especialmente:

* seguridad;
* multi-tenancy;
* compatibilidad;
* mantenibilidad;
* y pruebas.

---

# 25. Transacciones

Las operaciones que deben mantenerse consistentes como una sola unidad deben ejecutarse transaccionalmente.

Ejemplos:

```text
Purchase Receipt
├── Receipt
├── Receipt Items
├── Inventory Batch
├── Inventory Movement
└── Stock
```

Si una parte crítica falla, la operación completa debe revertirse.

---

# 26. Multi-tenancy

Toda operación empresarial debe respetar `companyId`.

Nunca se debe confiar solamente en un identificador recibido desde frontend para determinar el tenant.

El tenant debe derivarse del contexto autenticado cuando corresponda.

Consultas, actualizaciones y eliminaciones deben validar pertenencia a la empresa.

Incorrecto conceptualmente:

```ts
findUnique({
  where: { id },
});
```

cuando el recurso empresarial requiere aislamiento.

Debe utilizarse una estrategia que garantice:

```text
id + companyId
```

o una validación equivalente.

---

# 27. DTOs y validación

La entrada de las APIs debe validarse mediante DTOs.

Zaping utiliza:

* `class-validator`;
* `class-transformer`;
* `ValidationPipe`.

Las validaciones deben proteger:

* tipos;
* formatos;
* campos requeridos;
* valores permitidos;
* y reglas estructurales.

Las reglas de negocio complejas corresponden al Service o dominio.

---

# 28. Manejo de errores backend

Los errores deben:

* utilizar respuestas HTTP apropiadas;
* ser comprensibles para el cliente;
* evitar exponer detalles internos;
* permitir diagnóstico mediante logs.

Ejemplos:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
```

No convertir automáticamente todo error en `500`.

---

# 29. Seguridad de respuestas

Nunca devolver información sensible innecesaria.

Ejemplos:

* `passwordHash`;
* secretos;
* tokens internos;
* credenciales;
* información técnica privada.

Los objetos persistidos no deben devolverse ciegamente si contienen información que no pertenece al contrato público.

---

# 30. Arquitectura modular

Zaping utiliza actualmente un **Modular Monolith**.

Cada módulo debe ser propietario de sus reglas.

Ejemplo:

```text
Inventory
```

es responsable de las reglas de inventario.

Healthcare no debe modificar directamente tablas de Inventory evitando su lógica.

Debe utilizar contratos o servicios permitidos.

---

# 31. Límites entre dominios

Evitar:

```text
HealthcareService
↓
actualiza directamente stock
```

Preferir:

```text
HealthcareService
↓
InventoryService / contrato público
↓
Inventory
```

El mismo principio aplica entre:

* Purchases;
* Inventory;
* Sales;
* Healthcare;
* Equipment;
* Billing.

---

# 32. Base de datos

Las entidades deberán seguir las convenciones aprobadas por arquitectura.

Principios actuales:

* UUID como identificadores;
* relaciones explícitas;
* `createdAt`;
* `updatedAt`;
* índices donde tengan valor;
* aislamiento por empresa;
* Soft Delete cuando corresponda.

No todas las tablas requieren Soft Delete.

Debe utilizarse cuando exista necesidad de preservar historia o relaciones.

---

# 33. Migraciones

Toda modificación del esquema debe:

1. estar respaldada por documentación;
2. revisar compatibilidad;
3. generar migración reproducible;
4. validar los datos existentes;
5. ejecutar pruebas relevantes.

Nunca modificar una migración ya aplicada en entornos compartidos sin una razón excepcional.

---

# 34. Integridad referencial

Las relaciones deben reflejar reglas de negocio reales.

Se debe evitar utilizar relaciones opcionales únicamente para resolver errores de migración.

Antes de modificar cardinalidades se debe validar el dominio.

---

# 35. APIs

Los endpoints deben mantener convenciones consistentes.

Ejemplos:

```text
GET    /products
GET    /products/:id
POST   /products
PATCH  /products/:id
DELETE /products/:id
```

Las operaciones que representan acciones de negocio pueden utilizar endpoints explícitos cuando corresponda.

Ejemplo:

```text
POST /purchases/:id/receipts
```

La API debe representar el negocio, no únicamente operaciones CRUD.

---

# 36. Respuestas de API

Las respuestas deben mantener contratos estables.

No devolver información innecesaria.

Los cambios incompatibles deben evaluarse antes de introducirse.

---

# 37. Paginación

Listados que puedan crecer significativamente deben soportar paginación.

No cargar miles de registros para después filtrarlos únicamente en frontend.

---

# 38. Logging

Los errores relevantes deben registrarse.

Los logs deben ayudar a responder:

* qué ocurrió;
* dónde;
* cuándo;
* bajo qué contexto técnico.

Nunca deben registrar:

* contraseñas;
* JWT completos;
* secretos;
* ni información sensible innecesaria.

---

# 39. Testing

Las pruebas deben priorizar comportamiento de negocio y flujos críticos.

Tipos utilizados según necesidad:

* unitarias;
* integración;
* componentes;
* manual QA;
* regresión.

No es necesario probar detalles internos que no aporten confianza.

Sí es necesario probar reglas donde un error afectaría:

* inventario;
* seguridad;
* multi-tenancy;
* dinero;
* trazabilidad;
* o información crítica.

---

# 40. Pruebas backend

Los Services con reglas críticas deben tener pruebas cuando sea razonable.

Las pruebas deben verificar especialmente:

* validaciones;
* permisos;
* aislamiento;
* estados;
* operaciones transaccionales;
* y errores.

---

# 41. Pruebas frontend

Las pruebas deben verificar el comportamiento visible.

Preferir probar:

> lo que el usuario puede observar y realizar.

Evitar acoplar innecesariamente las pruebas a detalles internos de implementación.

---

# 42. Lint y TypeScript

Antes de considerar una implementación terminada deben ejecutarse los controles aplicables.

Como mínimo:

```text
lint
build
tests relevantes
```

No deben ignorarse errores para aprobar una entrega.

---

# 43. ESLint

El código debe mantenerse sin errores de ESLint.

Los warnings deben revisarse y resolverse cuando representen problemas reales.

No se deben desactivar reglas globalmente únicamente para evitar corregir el código.

---

# 44. Formateo

La base de código debe utilizar un formato consistente.

Prettier puede utilizarse cuando esté configurado en el proyecto.

No se deben realizar cambios masivos de formato mezclados con cambios funcionales sin necesidad.

---

# 45. Documentación técnica

Cada módulo relevante debe explicar, según corresponda:

* propósito;
* alcance;
* flujo;
* reglas;
* estados;
* permisos;
* relaciones;
* impacto en inventario;
* decisiones arquitectónicas relevantes;
* y pendientes.

No todos los documentos necesitan secciones vacías para cumplir una plantilla.

La documentación debe contener solamente información útil.

---

# 46. ADR

Debe crearse un Architecture Decision Record cuando una decisión:

* afecta varios módulos;
* modifica una regla arquitectónica;
* introduce una tecnología importante;
* cambia una frontera de dominio;
* o puede ser difícil de revertir.

No crear ADR para decisiones triviales.

---

# 47. Code Review

Toda revisión debe evaluar, según aplique:

* arquitectura;
* reglas de negocio;
* seguridad;
* multi-tenancy;
* legibilidad;
* duplicación;
* performance;
* pruebas;
* documentación.

El objetivo no es únicamente encontrar errores.

También es mantener coherencia del sistema.

---

# 48. Definition of Done

Una funcionalidad no está terminada únicamente porque “funcione”.

Debe cumplir, según su alcance:

* implementación completa;
* reglas validadas;
* pruebas relevantes;
* lint limpio;
* build correcto;
* manejo de errores;
* seguridad revisada;
* multi-tenancy validado;
* UX consistente;
* documentación actualizada;
* migraciones validadas cuando existan.

---

# 49. Deuda técnica

La deuda técnica debe registrarse cuando conscientemente se acepte una solución provisional.

No utilizar “lo arreglamos después” como sustituto de una decisión.

Debe conocerse:

* qué deuda existe;
* por qué se aceptó;
* impacto;
* prioridad aproximada.

---

# 50. Regla final

Construir software que pueda seguir siendo comprendido y mantenido dentro de cinco años.

El objetivo no es escribir más código.

El objetivo es construir un sistema confiable, entendible y capaz de evolucionar.
