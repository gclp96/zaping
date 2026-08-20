# Business Components — Zaping

**Producto:** Zaping
**Versión:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-20
**Responsable:** Zaping Product & Engineering Team

---

# 1. Propósito

Este documento define la Business Components Library de Zaping.

Los Business Components son componentes reutilizables de frontend que conocen conceptos del negocio, pero no pertenecen exclusivamente a un módulo específico.

Su objetivo es:

* reducir duplicación;
* mantener experiencias consistentes;
* facilitar workflows;
* centralizar patrones empresariales reutilizables;
* y acelerar el desarrollo de nuevos módulos.

---

# 2. Clasificación de componentes

Zaping distingue tres niveles principales.

## UI Components

Responsabilidad:

> Presentación genérica.

Ejemplos:

```text
Button
Card
Modal
Table
Input
Badge
```

No deben conocer reglas específicas del negocio.

---

## Business Components

Responsabilidad:

> Resolver una interacción empresarial reutilizable.

Ejemplos actuales:

```text
StatusBadge
MoneyInput
DateInput
CustomerSelector
ProductSelector
```

Pueden conocer:

* entidades;
* estados;
* formatos empresariales;
* APIs;
* patrones de selección.

No deben convertirse en propietarios de reglas centrales del dominio.

---

## Feature Components

Responsabilidad:

> Resolver necesidades específicas de un workflow o módulo.

Ejemplos:

```text
PurchaseForm
PurchaseItemsTable
QuotePreview
PurchaseReceiptForm
```

Deben permanecer dentro del feature mientras su comportamiento no sea realmente reutilizable.

---

# 3. Arquitectura conceptual

```text
Feature / Form
      ↓
Business Component
      ↓
UI Component
```

Ejemplo:

```text
Inventory Feature
      ↓
StatusBadge
      ↓
Badge
```

Otro ejemplo:

```text
Product Form
      ↓
MoneyInput
      ↓
Input
```

---

# 4. Principios

Todos los Business Components deben buscar:

* reutilización real;
* responsabilidad única;
* tipado fuerte;
* consistencia;
* accesibilidad;
* independencia de un módulo concreto;
* integración mediante servicios comunes;
* mantenimiento sencillo.

---

# 5. Cuándo crear un Business Component

Debe evaluarse cuando:

* el patrón aparece en varios módulos;
* representa un concepto empresarial reutilizable;
* reduce duplicación;
* mejora consistencia;
* simplifica workflows recurrentes.

Como señal orientativa:

> Si aparece en tres o más contextos distintos, debe evaluarse su extracción.

Esto no constituye una regla automática.

---

# 6. Cuándo no crear uno

No debe extraerse a Business Component cuando:

* solo pertenece a un workflow;
* contiene reglas exclusivas de un módulo;
* requiere demasiada configuración para ser reutilizable;
* la abstracción aumenta más la complejidad de la que elimina.

En esos casos debe permanecer dentro del feature.

---

# 7. Comunicación con backend

Los Business Components que necesiten información del servidor deben utilizar la capa común de acceso a API.

Actualmente la documentación histórica identifica:

```text
services/api.ts
```

como esa capa.

No deben distribuir llamadas `fetch` directas dentro de componentes compartidos sin una razón arquitectónica.

---

# 8. Estado actual de la librería

La documentación consolidada confirma los siguientes componentes:

| ID     | Componente       | Estado      |
| ------ | ---------------- | ----------- |
| BC-001 | StatusBadge      | IMPLEMENTED |
| BC-002 | MoneyInput       | IMPLEMENTED |
| BC-003 | DateInput        | IMPLEMENTED |
| BC-005 | CustomerSelector | IMPLEMENTED |
| BC-006 | ProductSelector  | IMPLEMENTED |

No existe actualmente documentación fuente para `BC-004`.

El identificador no será reutilizado únicamente para completar la secuencia.

---

# 9. BC-001 — StatusBadge

**Estado:** IMPLEMENTED
**Origen:** Sprint 09

## Propósito

`StatusBadge` representa visualmente el estado de una entidad o proceso mediante un patrón consistente.

Casos documentados incluyen:

* En stock;
* Bajo stock;
* Sin stock;
* Activo;
* Inactivo;
* Pendiente;
* Aprobado;
* Rechazado;
* Completado;
* Cancelado.

---

# 10. Arquitectura de StatusBadge

```text
Feature / Module
      ↓
StatusBadge
      ↓
Badge
```

`StatusBadge` reutiliza el componente UI genérico `Badge`.

---

# 11. Responsabilidad

`StatusBadge` representa un estado.

No debe calcular la regla empresarial que determina ese estado.

Ejemplo correcto:

```text
Inventory
↓
calcula LOW_STOCK
↓
StatusBadge
↓
representa visualmente
```

No:

```text
StatusBadge
↓
consulta stock
↓
decide reglas de Inventory
```

---

# 12. Uso

Puede reutilizarse en contextos como:

* Inventory;
* Products;
* Customers;
* Suppliers;
* Purchases;
* Quotes;
* Sales;
* Users;
* Healthcare;
* Radar.

La integración efectiva debe realizarse únicamente cuando el módulo utilice un estado compatible.

---

# 13. Semántica visual

Los estados deben mapearse hacia intenciones semánticas del Design System.

Conceptualmente:

```text
Neutral
Info
Success
Warning
Danger
```

La lógica del módulo determina el estado.

El componente determina su representación.

---

# 14. Accesibilidad

El estado no debe comunicarse únicamente mediante color.

Debe existir texto comprensible.

Preferir:

```text
● Bajo stock
```

sobre un indicador visual sin descripción.

---

# 15. Evidencia histórica de implementación

La documentación original registra:

* componente creado;
* reutilización de `Badge`;
* mapeo semántico de tones;
* integración inicial en Inventory;
* separación entre regla y presentación;
* accesibilidad básica;
* pruebas unitarias;
* ESLint correcto;
* build correcto.

La cantidad exacta de pruebas pertenece al historial de implementación y no se mantiene como requisito permanente de este documento.

---

# 16. BC-002 — MoneyInput

**Estado:** IMPLEMENTED
**Origen:** Sprint 09

## Propósito

`MoneyInput` proporciona una forma consistente de capturar importes monetarios.

La primera versión fue diseñada principalmente para pesos mexicanos.

---

# 17. Arquitectura de MoneyInput

```text
Feature / Form
      ↓
MoneyInput
      ↓
Input
```

---

# 18. Comportamiento documentado

La implementación original incluye:

* captura controlada mediante `string`;
* normalización de coma decimal hacia punto;
* límite configurable de decimales;
* valores negativos deshabilitados por defecto;
* prefijo monetario;
* soporte inicial de MXN;
* error;
* texto auxiliar;
* accesibilidad.

---

# 19. Regla de MoneyInput

El componente controla **entrada y presentación**.

No debe convertirse en propietario de:

* precios;
* impuestos;
* descuentos;
* reglas financieras;
* autorizaciones.

Ejemplo:

```text
MoneyInput
→ captura 1250.50
```

pero:

```text
Sales domain
→ decide si el usuario puede modificar el precio
```

---

# 20. Formato visual vs valor de API

Debe distinguirse:

```text
Visual:
$1,250.50 MXN
```

de:

```text
Business value:
1250.50
```

El contrato API no debe recibir símbolos o formato localizado como parte del valor numérico.

---

# 21. Precisión monetaria

`MoneyInput` no determina por sí mismo la estrategia financiera general de Zaping.

La precisión de:

* almacenamiento;
* cálculo;
* redondeo;

debe ser definida por los dominios financieros correspondientes.

---

# 22. BC-003 — DateInput

**Estado:** IMPLEMENTED
**Origen:** Sprint 09

## Propósito

`DateInput` captura fechas de negocio que no requieren hora.

Ejemplos documentados:

* fecha de caducidad;
* fecha de entrega;
* fecha de recepción;
* fecha de vigencia;
* fechas de documentos comerciales.

---

# 23. Arquitectura de DateInput

```text
Feature / Form
      ↓
DateInput
      ↓
Input
      ↓
string YYYY-MM-DD
```

---

# 24. Regla principal de DateInput

Las fechas de negocio sin hora deben mantenerse como:

```text
YYYY-MM-DD
```

cuando ese sea el significado real.

No deben convertirse innecesariamente mediante objetos `Date` si esto puede provocar cambios de día por zona horaria.

---

# 25. Comportamiento documentado

La implementación existente incluye:

* valor controlado mediante `string`;
* formato `YYYY-MM-DD`;
* ausencia de conversión automática mediante `Date`;
* soporte `min`;
* soporte `max`;
* `required`;
* `disabled`;
* errores;
* helper text;
* accesibilidad.

---

# 26. Integración inicial

La documentación original registra su integración en:

```text
Purchase Receipt
↓
Expiration Date
```

El payload conserva:

```text
expirationDate
```

como `YYYY-MM-DD`.

---

# 27. Fecha vs timestamp

`DateInput` no debe utilizarse automáticamente para cualquier fecha.

Debe distinguirse:

```text
Expiration Date
→ calendar date
→ YYYY-MM-DD
```

de:

```text
Case scheduled start
→ date + time
→ timestamp / zoned date-time strategy
```

---

# 28. BC-005 — CustomerSelector

**Estado:** IMPLEMENTED
**Origen:** Sprint 09

## Propósito

`CustomerSelector` permite localizar y seleccionar clientes dentro de workflows comerciales.

Fue creado para reemplazar listas `<select>` tradicionales cuando el catálogo de clientes puede crecer.

---

# 29. Arquitectura conceptual

```text
Feature / Form
      ↓
CustomerSelector
      ↓
Search / Selection
```

La documentación original contempla además creación contextual:

```text
CustomerSelector
      ↓
CustomerFormModal
      ↓
POST /customers
```

---

# 30. Objetivos de CustomerSelector

Debe facilitar:

* búsqueda;
* identificación del cliente;
* selección;
* escalabilidad ante catálogos mayores.

No debe cargar permanentemente cientos o miles de opciones dentro de un `<select>` tradicional cuando exista una alternativa más eficiente.

---

# 31. Creación contextual

Cuando el workflow lo permita, el usuario puede iniciar el registro de un cliente sin abandonar el proceso actual.

Conceptualmente:

```text
Crear SalesOrder
↓
CustomerSelector
↓
Cliente no existe
↓
Crear cliente
↓
Seleccionar cliente creado
↓
Continuar SalesOrder
```

La experiencia debe intentar preservar el estado del formulario principal.

---

# 32. Responsabilidad

`CustomerSelector` selecciona un Customer.

No debe convertirse en propietario de:

* validaciones comerciales del cliente;
* crédito;
* permisos;
* reglas de Sales.

El backend continúa validando la relación antes de confirmar la operación.

---

# 33. Multi-tenancy

Los resultados deben pertenecer al tenant autenticado.

La UI no debe utilizar el selector como mecanismo de seguridad.

El backend debe garantizar el aislamiento.

---

# 34. Catálogos inactivos

Como regla de UX, los Customers inactivos normalmente no deben aparecer entre las opciones disponibles para nuevas operaciones.

La regla definitiva pertenece al módulo Customers y ADR-012.

---

# 35. BC-006 — ProductSelector

**Estado:** IMPLEMENTED
**Origen:** Sprint 09

## Propósito

`ProductSelector` permite buscar y seleccionar productos dentro de workflows de Zaping.

Fue diseñado para reemplazar listas `<select>` tradicionales y soportar el crecimiento del catálogo.

---

# 36. Arquitectura conceptual

```text
Feature / Form
      ↓
ProductSelector
      ↓
Search / Filters
      ↓
Selected Product
```

---

# 37. Casos de uso

Puede reutilizarse en:

* Purchases;
* Purchase Receipts cuando corresponda;
* Quotes;
* Sales;
* Inventory;
* Healthcare;
* otros workflows que necesiten seleccionar productos.

---

# 38. Responsabilidad

El componente debe permitir encontrar y seleccionar.

No debe decidir:

* disponibilidad definitiva;
* precio final;
* lote;
* FEFO;
* cantidad permitida;
* autorización.

Ejemplo:

```text
ProductSelector
→ selecciona Product A
```

Después:

```text
Inventory
→ determina disponibilidad
```

---

# 39. Productos inactivos

Los productos inactivos normalmente no deben aparecer para nuevas operaciones.

Los documentos históricos continúan mostrando los productos previamente utilizados.

---

# 40. Escalabilidad

El selector debe continuar siendo usable conforme aumente el catálogo.

La evolución puede incluir:

* búsqueda server-side;
* paginación;
* filtros;
* debounce;
* carga incremental.

Estas capacidades deben implementarse cuando exista necesidad y no se consideran automáticamente parte de la versión actual.

---

# 41. SupplierSelector

**Estado:** IMPLEMENTED

`SupplierSelector` se encuentra implementado y es utilizado actualmente
dentro del flujo de Purchases para localizar y seleccionar Suppliers.

El componente pertenece a la Business Components Library porque resuelve
una necesidad reutilizable de selección empresarial.

Purchases continúa siendo propietario de la validación del Supplier y de
las reglas de negocio relacionadas con la compra.

---

# 42. Propósito de SupplierSelector

El componente sigue conceptualmente el patrón:

```text
Feature
↓
SupplierSelector
↓
Search / Selection
```

orientado a workflows como Purchases.

Los detalles deberán definirse durante su implementación.

---

# 43. Otros componentes planeados históricos

El `Overview.md` original menciona también:

```text
QuantityInput
PurchaseItemsTable
SalesItemsTable
PurchaseTotals
SalesTotals
```

Estos nombres se conservan únicamente como referencias históricas de ideas de la librería.

No constituyen componentes aprobados ni implementados automáticamente.

---

# 44. PurchaseItemsTable y SalesItemsTable

Aunque aparecieron originalmente dentro del roadmap de Business Components, debe revisarse su clasificación antes de implementarlos.

Un componente como:

```text
PurchaseItemsTable
```

puede pertenecer mejor al Feature `Purchases` si contiene reglas exclusivas de compras.

No debe convertirse en Business Component únicamente porque incluya una tabla.

---

# 45. PurchaseTotals y SalesTotals

La misma regla aplica a componentes de totales.

Si únicamente representan una UI genérica:

```text
Subtotal
Tax
Total
```

puede ser posible extraer un patrón reutilizable.

Si calculan reglas propias del dominio, deben permanecer en su módulo.

---

# 46. QuantityInput

Un futuro `QuantityInput` debe evaluarse según la diferencia entre:

* comportamiento visual reutilizable;
* validación específica de inventario o negocio.

No debe contener reglas como:

```text
quantity <= availableStock
```

si esas reglas pertenecen al dominio.

---

# 47. Estructura sugerida del código

Conceptualmente:

```text
components/
│
├── ui/
│
└── business/
    ├── badges/
    ├── inputs/
    └── selectors/
```

Esta estructura es orientativa.

La estructura física puede evolucionar si existe una organización más adecuada.

---

# 48. Selectores

Los selectores empresariales comparten el objetivo de:

```text
Buscar
↓
Identificar
↓
Seleccionar
↓
Regresar valor al workflow
```

No deben convertirse en mini-módulos CRUD completos.

---

# 49. Creación desde selector

La creación contextual es una capacidad útil, pero no obligatoria para todos los selectores.

Debe utilizarse cuando:

* el usuario tiene permiso;
* crear la entidad es razonablemente corto;
* no rompe el workflow;
* evita pérdida de contexto.

---

# 50. Inputs

Los Business Inputs resuelven formatos empresariales recurrentes.

Ejemplos actuales:

```text
MoneyInput
DateInput
```

No debe crearse un nuevo input empresarial si un `Input` genérico resuelve correctamente el problema.

---

# 51. Badges

Actualmente:

```text
StatusBadge
```

es el principal patrón compartido.

Un nuevo Badge empresarial debe justificar una semántica diferente.

---

# 52. Regla de negocio vs presentación

Principio transversal:

```text
Domain
→ determina significado

Business Component
→ adapta interacción/presentación

UI Component
→ renderiza
```

---

# 53. API y seguridad

Los componentes compartidos pueden facilitar la interacción, pero nunca sustituyen validaciones backend.

Ejemplo:

```text
ProductSelector
→ muestra solamente productos activos
```

no significa que backend deba aceptar cualquier `productId` recibido.

Debe verificar nuevamente:

* existencia;
* tenant;
* estado;
* permisos;
* reglas aplicables.

---

# 54. Loading

Los Business Components que consulten datos deben representar estados como:

```text
Loading
Empty
Error
Data
```

cuando correspondan.

---

# 55. Empty

Un selector sin resultados debe diferenciar:

```text
No existen registros
```

de:

```text
No hay coincidencias para la búsqueda
```

cuando sea útil para el usuario.

---

# 56. Error

Los errores técnicos deben transformarse en mensajes comprensibles.

No mostrar directamente:

```text
AxiosError
HTTP 500
Prisma error
```

dentro del componente.

---

# 57. Disabled

Los componentes deben soportar estado deshabilitado cuando el workflow lo requiera.

Debe ser visual y semánticamente reconocible.

---

# 58. Accesibilidad

Los Business Components deben considerar:

* navegación por teclado;
* labels;
* roles semánticos;
* focus;
* mensajes de error;
* nombres accesibles;
* selección clara.

Esto es especialmente importante para componentes de búsqueda personalizados.

---

# 59. Responsive

Los componentes deben funcionar dentro de layouts responsive.

Un selector no debe depender de un ancho fijo propio de desktop.

---

# 60. Tipado

Las APIs de componentes deben utilizar tipos explícitos.

Evitar:

```ts
value: any
```

cuando el dominio pueda expresarse claramente.

---

# 61. Component API

Un Business Component debe exponer solamente lo necesario.

Ejemplo conceptual:

```tsx
<ProductSelector
  value={productId}
  onChange={setProductId}
/>
```

es preferible a una API con decenas de flags para soportar todos los módulos imaginables.

---

# 62. Extensión

Si un nuevo caso requiere modificar significativamente un componente compartido, evaluar primero:

1. ¿Es una necesidad realmente común?
2. ¿Puede resolverse mediante composición?
3. ¿Debe ser otro componente?
4. ¿La lógica pertenece al feature?

No agregar propiedades indefinidamente.

---

# 63. Testing

Los Business Components deben probar especialmente:

* interacción principal;
* estado controlado;
* errores relevantes;
* accesibilidad crítica;
* callbacks;
* casos límite importantes.

Las pruebas no deben depender innecesariamente de detalles internos.

---

# 64. Historial de pruebas

Los documentos individuales originales registraban cantidades concretas de pruebas ejecutadas durante su implementación.

Esos números no se mantienen aquí como estado actual porque pueden cambiar conforme evolucione la suite.

La fuente actual de pruebas es el código de test.

---

# 65. Versionado de la librería

No se mantendrá por ahora un roadmap rígido como:

```text
Business Components v1.0
Business Components v1.1
Business Components v1.2
```

independiente del producto.

Los componentes evolucionan con Zaping.

Los cambios relevantes deben registrarse mediante documentación, tests y `CHANGELOG` cuando corresponda.

---

# 66. Nuevos IDs BC

Los IDs históricos:

```text
BC-001
BC-002
BC-003
BC-005
BC-006
```

se conservan como referencia documental.

No es obligatorio continuar asignando un nuevo `BC-XXX` a cada componente futuro.

El nombre del componente es suficiente como identidad principal salvo que exista una razón de gestión del proyecto para mantener IDs.

---

# 67. BC-004

No existe evidencia documental de qué componente habría correspondido a `BC-004`.

Por tanto:

> No se asigna retrospectivamente.

Git conserva la historia si posteriormente se necesita investigar su origen.

---

# 68. Fuente de verdad

Este archivo es la fuente documental para:

* definición de Business Component;
* componentes compartidos implementados;
* principios de diseño;
* estado general de la librería.

Los detalles actuales de:

* props;
* tipos;
* tests;
* comportamiento exacto;

deben verificarse en el código cuando sea necesario.

---

# 69. Relación con Design System

```text
DESIGN_SYSTEM.md
→ reglas visuales y estructurales

BUSINESS_COMPONENTS.md
→ patrones empresariales reutilizables
```

---

# 70. Relación con Zaping Way

```text
BUSINESS_COMPONENTS
→ herramientas reutilizables

ZAPING_WAY
→ experiencia completa del workflow
```

Ejemplo:

```text
CustomerSelector
```

es un Business Component.

Pero decidir que el usuario pueda crear un cliente sin abandonar una cotización es una decisión de experiencia.

---

# 71. Relación con módulos

Los módulos consumen Business Components.

No deben delegarles sus reglas centrales.

Ejemplo:

```text
Purchases
↓
SupplierSelector
```

Purchases continúa siendo propietario de la validación del Supplier dentro de la compra.

---

# 72. Regla de mantenimiento

Al modificar un Business Component:

* revisar todos sus consumidores;
* evitar breaking changes innecesarios;
* ejecutar pruebas relevantes;
* validar accesibilidad;
* mantener tipado;
* actualizar este documento solamente si cambia su contrato conceptual.

---

# 73. Anti-patrones

Evitar:

## Regla de dominio dentro del componente

```text
ProductSelector
→ calcula stock disponible
```

---

## Componente universal

```text
EntitySelector
```

con decenas de opciones para Customer, Supplier, Product, Doctor, Equipment y cualquier entidad futura sin una razón real.

---

## Duplicación

```text
PurchaseProductSelector
QuoteProductSelector
SalesProductSelector
```

si todos resuelven exactamente el mismo patrón.

---

## Abstracción prematura

Extraer un componente específico de una sola pantalla antes de demostrar reutilización.

---

# 74. Estado consolidado

## Implementados

```text
StatusBadge
MoneyInput
DateInput
CustomerSelector
ProductSelector
```

## Referenciado / pendiente de verificar o implementar


## Ideas históricas no comprometidas

```text
QuantityInput
PurchaseItemsTable
SalesItemsTable
PurchaseTotals
SalesTotals
```

---

# 75. Principio final

Los Business Components deben ocupar el espacio entre:

```text
UI genérica
```

y:

```text
Feature específica
```

Su función es encapsular patrones empresariales realmente reutilizables sin absorber las reglas que pertenecen a los dominios.

> Compartir una interacción útil es bueno. Compartir accidentalmente la lógica del negocio equivocado no lo es.
