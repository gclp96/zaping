# Design System — Zaping

**Producto:** Zaping
**Versión:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-29
**Responsable:** Zaping Product & Engineering Team

---

# 1. Propósito

Este documento define los fundamentos visuales y estructurales utilizados para construir la interfaz de Zaping.

El Design System busca mantener:

* consistencia;
* reutilización;
* claridad;
* accesibilidad;
* simplicidad;
* velocidad de desarrollo;
* y una experiencia reconocible entre módulos.

Este documento define principalmente:

> cómo se construyen visualmente las interfaces.

Los principios más amplios sobre:

* experiencia;
* navegación;
* workflows;
* jerarquía;
* vistas 360;
* workspaces;
* y filosofía de interacción

se documentan en `ZAPING_WAY.md`.

---

# 2. Principio fundamental

Zaping sigue la filosofía:

> **Simple por defecto. Poderoso cuando se necesita.**

La interfaz no debe mostrar toda la complejidad disponible desde el primer momento.

Debe presentar primero:

* información necesaria;
* acción principal;
* estado;
* contexto inmediato.

La complejidad adicional debe aparecer cuando el usuario la necesite.

---

# 3. Objetivos del Design System

El Design System debe permitir:

* construir nuevos módulos más rápido;
* mantener una experiencia consistente;
* reducir componentes duplicados;
* evitar decisiones visuales arbitrarias;
* facilitar mantenimiento;
* mejorar accesibilidad;
* permitir evolución progresiva del producto.

---

# 4. Principios

## 4.1 Consistencia

Una misma interacción debe verse y comportarse de manera similar en toda la plataforma.

Ejemplo:

Un botón de confirmación no debe cambiar radicalmente de comportamiento entre:

```text
Purchases
Sales
Inventory
Healthcare
```

---

## 4.2 Simplicidad

La interfaz debe evitar:

* ruido visual;
* exceso de controles;
* columnas innecesarias;
* acciones duplicadas;
* información técnica sin valor para el usuario.

---

## 4.3 Jerarquía

Cada pantalla debe comunicar claramente:

```text
¿Qué estoy viendo?
¿Qué es importante?
¿Qué puedo hacer?
¿Qué ocurrió?
¿Qué sigue?
```

---

## 4.4 Reutilización

Los patrones repetidos deben implementarse mediante componentes compartidos cuando exista reutilización real.

No debe crearse una abstracción únicamente porque dos componentes se parezcan superficialmente.

---

## 4.5 Accesibilidad

Los componentes deben considerar desde su diseño:

* teclado;
* foco;
* labels;
* contraste;
* semántica;
* estados;
* mensajes;
* tecnologías asistivas.

---

## 4.6 Responsabilidad única

Un componente debe resolver una responsabilidad principal.

Evitar componentes gigantes que intenten resolver múltiples workflows mediante decenas de propiedades.

---

## 4.7 Composition over Configuration

Preferir composición de componentes simples:

```text
PageHeader
+
Section
+
+
DataTable / StaticTable
+
Actions
```

sobre un componente universal altamente configurable que intente representar cualquier pantalla.

---

# 5. Capas del frontend

La arquitectura visual se organiza conceptualmente en:

```text
Pages / Routes
      ↓
Features
      ↓
Business Components
      ↓
UI Components
```

Cada nivel tiene una responsabilidad diferente.

---

# 6. UI Components

Los UI Components son elementos visuales genéricos.

No deben conocer reglas específicas del negocio.

Ejemplos actuales o esperados:

```text
Button
Input
Modal
DataTable
StaticTable
Badge
Card
Section
PageHeader
PageContainer
EmptyState
LoadingSpinner
ConfirmDialog
```

Ubicación conceptual:

```text
components/ui/
```

La estructura concreta del código puede evolucionar siempre que mantenga esta separación.

---

# 7. Business Components

Los Business Components son reutilizables pero conocen conceptos empresariales.

Ejemplos:

```text
StatusBadge
MoneyInput
DateInput
ProductSelector
CustomerSelector
SupplierSelector
```

Su documentación se mantiene en:

```text
docs/ux/BUSINESS_COMPONENTS.md
```

---

# 8. Feature Components

Los Feature Components resuelven necesidades específicas de un workflow o módulo.

Ejemplos:

```text
PurchaseForm
PurchaseItemsTable
PurchaseReceiptForm
SalesOrderForm
CasePreparation
CaseReconciliation
```

Deben permanecer dentro de su feature mientras la lógica no sea verdaderamente reutilizable.

---

# 9. Pages

Las páginas deben principalmente:

* componer;
* organizar;
* cargar el workflow;
* ofrecer contexto;
* conectar navegación.

No deben acumular toda la lógica del feature.

---

# 10. Estructura base de página

Cuando corresponda, las páginas deben utilizar la estructura compartida existente:

```tsx
<PageContainer>
  <PageHeader />
  {/* contenido */}
</PageContainer>
```

No debe reproducirse manualmente el mismo layout en cada módulo.

---

# 11. PageContainer

Responsable de proporcionar una estructura visual consistente para el contenido principal.

Puede controlar aspectos como:

* ancho;
* padding;
* separación;
* comportamiento responsive.

No debe contener reglas específicas de negocio.

---

# 12. PageHeader

Debe proporcionar contexto inmediato.

Puede contener:

* título;
* descripción breve;
* acción primaria;
* acciones secundarias limitadas;
* breadcrumbs cuando sean necesarios.

Ejemplo conceptual:

```text
Compras

Administra órdenes de compra y recepciones.

                         [Nueva compra]
```

---

# 13. Sections

Las pantallas complejas deben dividir información mediante secciones claras.

Ejemplo:

```text
Información general

Proveedor
Fecha
Estado
Folio
```

seguido de:

```text
Productos
```

en lugar de presentar un bloque continuo difícil de escanear.

---

# 14. Acción primaria

Cada pantalla debe intentar mantener una acción principal claramente identificable.

Ejemplos:

```text
[Nuevo cliente]

[Nueva compra]

[Registrar recepción]

[Preparar Case]
```

No todos los botones deben competir visualmente con la acción principal.

---

# 15. Acciones secundarias

Acciones secundarias deben utilizar menor jerarquía visual.

Ejemplos:

* editar;
* exportar;
* imprimir;
* ver historial;
* cancelar.

Las acciones destructivas deben diferenciarse claramente.

---

# 16. Acciones destructivas

Acciones como:

* eliminar;
* cancelar;
* revertir;
* desactivar;

deben comunicar su consecuencia real.

Evitar confirmaciones genéricas como:

```text
¿Estás seguro?
```

Preferir:

```text
Cancelar esta compra conservará su historial,
pero ya no podrá continuar con nuevas recepciones.
```

---

# 17. Botones

Los botones deben utilizar variantes consistentes.

Conceptualmente:

```text
Primary
Secondary
Ghost
Danger
```

No crear estilos de botón aislados dentro de cada módulo.

---

# 18. Estado de botones

Los botones deben representar correctamente:

* default;
* hover;
* focus;
* disabled;
* loading.

Una operación en progreso debe impedir envíos duplicados cuando corresponda.

---

# 19. Inputs

Los inputs deben proporcionar:

* label;
* valor;
* estado;
* error;
* ayuda cuando sea necesaria.

Evitar depender exclusivamente de `placeholder` como label.

---

# 20. Mensajes de error

El error debe mostrarse cerca del campo o acción que lo provocó.

Preferir:

```text
El SKU ya existe.
```

sobre:

```text
Request failed with status code 409.
```

---

# 21. Formularios

Los formularios deben:

* reducir captura innecesaria;
* agrupar campos relacionados;
* indicar requeridos;
* conservar datos tras errores;
* evitar doble submit;
* mostrar progreso;
* proporcionar resultado claro.

---

# 22. Progressive Disclosure

Los formularios extensos deben mostrar primero lo necesario.

Campos avanzados pueden agruparse mediante:

* secciones;
* acordeones;
* tabs;
* paneles secundarios;

cuando realmente exista complejidad.

No esconder campos indispensables.

---

# 23. Dinero

Los valores monetarios deben presentarse de forma consistente.

Ejemplo:

```text
$1,250.00 MXN
```

La edición debe utilizar `MoneyInput` cuando corresponda.

El formato visual y el valor transmitido a API son responsabilidades diferentes.

---

# 24. Fechas

Las fechas deben distinguir entre:

## Fecha de negocio

Ejemplo:

```text
2026-08-19
```

cuando no existe hora relevante.

## Timestamp

Ejemplo:

```text
2026-08-19T18:30:00Z
```

cuando importa el momento exacto.

`DateInput` debe utilizarse para fechas de negocio sin introducir conversiones de zona horaria innecesarias.

---

# 25. Tablas

Las tablas son una parte central del ERP.

Deben priorizar:

* lectura;
* comparación;
* escaneo rápido;
* acciones frecuentes.

---

# 26. Columnas

Mostrar únicamente columnas útiles para la tarea principal.

Una entidad puede tener 25 campos en base de datos y no necesita mostrar los 25 en el listado.

La información secundaria pertenece a:

* detalle;
* vista 360;
* panel adicional.

---

# 27. Orden visual de columnas

Como patrón general:

```text
Identidad
↓
Contexto
↓
Estado
↓
Información clave
↓
Acciones
```

Ejemplo:

```text
Folio
Proveedor
Fecha
Total
Estado
Acciones
```

---

# 28. Acciones de tabla

Evitar llenar cada fila con demasiados botones.

Preferir:

* una acción principal;
* menú secundario;
* click al detalle;

según el workflow.

---

# 29. Responsive Tables

Las tablas deben considerar pantallas reducidas.

Opciones según el caso:

* scroll horizontal;
* ocultar columnas secundarias;
* cambiar a cards;
* priorizar columnas clave.

No intentar mostrar la tabla de escritorio completa comprimida.

---

# 30. Estados de datos

Toda experiencia dependiente de datos debe evaluar:

```text
Loading
Empty
Data
Error
```

cuando correspondan.

---

# 31. Loading

El usuario debe saber que existe una operación activa.

Puede utilizarse:

* `LoadingSpinner`;
* skeletons;
* estado de botón;
* indicador local.

No bloquear toda la aplicación cuando únicamente se está actualizando una pequeña parte.

---

# 32. Empty State

Un estado vacío debe explicar:

1. qué falta;
2. por qué puede estar vacío;
3. qué puede hacer el usuario.

Ejemplo:

```text
Todavía no hay proveedores.

Registra tu primer proveedor para comenzar
a crear órdenes de compra.

[Agregar proveedor]
```

---

# 33. Error State

Un error debe permitir comprender:

* qué ocurrió;
* si puede reintentarse;
* cuál es la siguiente acción.

Evitar páginas completamente vacías ante fallos.

---

# 34. Success Feedback

Las operaciones relevantes deben confirmar visualmente que fueron realizadas.

Ejemplos:

```text
Compra creada correctamente.
```

```text
Recepción registrada.
```

```text
Cliente actualizado.
```

El feedback no debe interrumpir innecesariamente el workflow.

---

# 35. StatusBadge

Los estados empresariales deben representarse mediante un patrón consistente.

`StatusBadge` utiliza `Badge` como base visual.

Importante:

> StatusBadge representa el estado; no lo calcula.

El dominio continúa siendo propietario de la regla.

---

# 36. Color y significado

El color debe apoyar el significado, no ser la única forma de comunicarlo.

Incorrecto:

```text
●
```

sin texto.

Preferir:

```text
● Bajo stock
```

La interpretación debe continuar siendo posible para usuarios con dificultades de percepción de color.

---

# 37. Sistema semántico de estados

El Design System debe utilizar categorías semánticas en lugar de colores arbitrarios.

Ejemplos conceptuales:

```text
Neutral
Info
Success
Warning
Danger
```

Un componente solicita la intención semántica.

La implementación visual determina:

* color;
* borde;
* fondo;
* icono;
* contraste.

---

# 38. Colores

No se crea por ahora un catálogo documental separado `Colors.md`.

Los colores concretos deben vivir preferentemente como:

* tokens;
* configuración Tailwind;
* variables CSS;
* componentes.

Este documento mantiene las reglas de uso.

Cuando exista un sistema formal de tokens suficientemente estable, podrá documentarse aquí o mediante referencia automatizada.

---

# 39. Tipografía

No se mantiene un `Typography.md` vacío independiente.

La tipografía debe mantener jerarquía clara entre:

```text
Page Title
Section Title
Body
Secondary Text
Label
Caption
```

Evitar crear tamaños arbitrarios dentro de features.

Las decisiones concretas deben centralizarse en los estilos/tokens del frontend.

---

# 40. Espaciado

El sistema debe utilizar una escala consistente de espaciado.

Evitar valores arbitrarios repetidos como:

```text
13px
19px
27px
```

cuando ya existe una escala definida por el sistema visual.

---

# 41. Bordes y radios

Los componentes deben utilizar un lenguaje consistente para:

* border;
* radius;
* shadow;
* elevation.

No deben aparecer estilos completamente diferentes entre módulos sin una razón funcional.

---

# 42. Iconos

Los iconos deben:

* apoyar comprensión;
* utilizar una librería consistente;
* mantener tamaños coherentes;
* tener significado reconocible.

No deben utilizarse exclusivamente como decoración cuando añaden ruido.

---

# 43. Icon-only buttons

Un botón compuesto únicamente por icono debe tener nombre accesible.

Ejemplo conceptual:

```tsx
<button aria-label="Editar producto">
  <EditIcon />
</button>
```

---

# 44. Modales

Los modales deben utilizarse para interacciones que:

* requieren atención;
* son relativamente acotadas;
* no necesitan una pantalla completa.

Ejemplos:

* crear registro simple;
* editar información acotada;
* confirmar acción.

---

# 45. Cuándo evitar Modal

No utilizar Modal para workflows extensos con:

* demasiadas secciones;
* navegación;
* múltiples pasos;
* gran cantidad de contexto.

En esos casos es preferible una página o workspace.

---

# 46. ConfirmDialog

`ConfirmDialog` debe utilizarse para acciones con consecuencias importantes.

El mensaje debe explicar la acción.

La variante visual debe corresponder al riesgo.

---

# 47. Cards

Las Cards deben agrupar información relacionada.

No deben utilizarse simplemente para rodear absolutamente todo con bordes.

Una Card debe aportar jerarquía o separación.

---

# 48. Dashboard Cards

Los indicadores deben responder preguntas útiles.

Evitar métricas únicamente porque son fáciles de calcular.

Un Dashboard debe evolucionar progresivamente hacia:

```text
Dato
↓
Contexto
↓
Acción
```

---

# 49. Navegación

Los patrones globales de navegación se definirán principalmente en `ZAPING_WAY.md`.

Visualmente deben mantenerse:

* consistentes;
* predecibles;
* fáciles de escanear.

No agregar navegación secundaria diferente en cada módulo.

---

# 50. Breadcrumbs

Utilizar breadcrumbs cuando la profundidad real de navegación los justifique.

No añadirlos automáticamente a todas las páginas.

Ejemplo útil:

```text
Compras
/
OC-000421
/
Recepción REC-002
```

---

# 51. Tabs

Las Tabs deben utilizarse para vistas relacionadas del mismo contexto.

Ejemplo futuro:

```text
Product 360
├── General
├── Inventario
├── Movimientos
└── Historial
```

No deben utilizarse como sustituto de navegación entre módulos diferentes.

---

# 52. Vistas 360

Entidades importantes podrán utilizar un patrón 360.

Ejemplos:

```text
Customer 360
Product 360
Purchase 360
SalesOrder 360
Case 360
Equipment 360
```

La vista debe reunir contexto relacionado sin duplicar la propiedad de los datos.

---

# 53. Workspaces

Un Workspace está orientado a una tarea o función operativa.

Ejemplo:

```text
Warehouse Operations
```

puede reunir:

```text
Por recibir
Por preparar
Por entregar
Por retornar
Incidencias
```

Esto es diferente a simplemente mostrar el menú de módulos.

---

# 54. Search

La búsqueda debe diseñarse para reducir navegación y escaneo manual.

Los selectores existentes ya aplican este principio:

```text
CustomerSelector
ProductSelector
```

Una búsqueda global será una evolución posterior de esta filosofía.

---

# 55. Selectores

Los catálogos con crecimiento potencial no deben depender permanentemente de `<select>` con cientos de opciones.

Se prefieren componentes de búsqueda como:

```text
ProductSelector
CustomerSelector
SupplierSelector
```

cuando exista suficiente volumen o reutilización.

---

# 56. Creación contextual

Cuando sea seguro y aporte eficiencia, un selector puede permitir crear la entidad faltante sin abandonar el workflow.

Ejemplo:

```text
CustomerSelector
↓
"Crear nuevo cliente"
↓
CustomerFormModal
↓
regresar al workflow original
```

Debe evitarse perder el estado del formulario principal.

---

# 57. Responsive Design

Zaping debe ser usable en diferentes tamaños de pantalla.

Prioridad inicial:

```text
Desktop
↓
Tablet
↓
Mobile-compatible
```

No significa que todos los workflows complejos deban ser idénticos en teléfono.

La futura Mobile App tendrá necesidades propias.

---

# 58. Densidad

Un ERP necesita mostrar información suficiente.

Zaping no debe confundir:

```text
simplicidad
```

con:

```text
interfaces excesivamente vacías
```

La densidad debe equilibrar:

* velocidad;
* lectura;
* contexto;
* claridad.

---

# 59. Accesibilidad de formularios

Debe evaluarse:

* orden de tabulación;
* labels;
* focus;
* mensajes de error;
* `aria` cuando corresponda;
* controles nativos cuando sean adecuados.

---

# 60. Accesibilidad de estados

No depender únicamente de:

* color;
* posición;
* animación.

Debe existir información textual o semántica suficiente.

---

# 61. Animaciones

Las animaciones deben:

* ayudar a comprender transición;
* ser breves;
* no retrasar el trabajo.

Zaping no necesita animación decorativa excesiva en workflows empresariales.

---

# 62. Microinteracciones

Pequeños feedbacks pueden mejorar claridad.

Ejemplos:

* botón cambia a Loading;
* check de operación exitosa;
* fila actualizada;
* tooltip contextual.

Deben utilizarse con moderación.

---

# 63. Tooltips

Utilizar tooltips cuando un control necesita contexto adicional breve.

No esconder instrucciones indispensables únicamente dentro de tooltips.

---

# 64. Texto

El lenguaje de interfaz debe ser:

* claro;
* corto;
* empresarial;
* consistente.

Preferir:

```text
Registrar recepción
```

sobre:

```text
Ejecutar operación de entrada
```

---

# 65. Lenguaje técnico

No mostrar al usuario términos internos como:

```text
Prisma
DTO
HTTP 409
Foreign Key
Mutation
```

salvo interfaces destinadas específicamente a usuarios técnicos.

---

# 66. Nombres de negocio

La interfaz debe reflejar el lenguaje oficial definido en `GLOSSARY.md`.

Ejemplo:

Si la operación es:

```text
Recepción
```

no utilizar indistintamente en distintas pantallas:

```text
Entrada
Ingreso
Receiving
Stock Entry
```

sin una razón clara.

---

# 67. Internacionalización

La arquitectura del producto debe permitir soporte multilenguaje.

La documentación oficial se mantiene actualmente en español.

Los textos de UI no deben diseñarse de manera que impidan posteriormente traducción.

---

# 68. No hardcodear reglas visuales por módulo

Evitar:

```text
Purchases usa un verde propio
Sales usa otro verde
Inventory usa otro Badge
```

si todos representan el mismo estado semántico.

Las diferencias deben tener significado.

---

# 69. Design Tokens

El sistema debe evolucionar hacia tokens para representar decisiones visuales.

Categorías posibles:

```text
color
spacing
radius
typography
shadow
breakpoint
```

No es necesario crear una infraestructura compleja de tokens hasta que exista suficiente estabilidad.

---

# 70. Fuente de verdad técnica

Los valores visuales exactos deben permanecer principalmente en:

* configuración Tailwind;
* CSS;
* componentes;
* tokens cuando existan.

Este documento define intención y reglas.

No debe duplicar cientos de valores técnicos manualmente.

---

# 71. Component API

Los componentes reutilizables deben tener APIs simples.

Evitar componentes con gran cantidad de props como:

```text
showTitle
showIcon
isCompact
isTable
isModal
isDashboard
isHealthcare
...
```

cuando sería más claro componer componentes independientes.

---

# 72. Variantes

Las variantes deben representar diferencias visuales reales y reutilizables.

Ejemplo:

```text
Button
├── primary
├── secondary
├── ghost
└── danger
```

No agregar una variante por cada feature.

---

# 73. Component Ownership

## UI Component

Propietario:

```text
Design System
```

## Business Component

Propietario:

```text
Shared Business UI
```

## Feature Component

Propietario:

```text
Feature / Module
```

Esta clasificación ayuda a evitar componentes compartidos innecesariamente.

---

# 74. Regla de reutilización

Como señal orientativa:

> si un patrón se utiliza en tres o más contextos diferentes, debe evaluarse su extracción.

No constituye una regla automática.

La cohesión tiene prioridad sobre el número de usos.

---

# 75. Testing de componentes

Los componentes compartidos importantes deben probar comportamientos críticos.

Especialmente:

* estados;
* accesibilidad;
* interacción;
* errores;
* teclado;
* callbacks.

No es necesario probar detalles visuales irrelevantes.

---

# 76. Estado actual del Design System

Actualmente Zaping ya cuenta con una base de componentes reutilizables que incluye elementos como:

```text
PageContainer
PageHeader
Section
EmptyState
LoadingSpinner
Badge
Button
DataTable
StaticTable
ConfirmDialog
Modal
Input
```

La biblioteca debe evolucionar de manera incremental.

---

# 77. Business Components actuales documentados

La biblioteca histórica contiene documentación para:

```text
StatusBadge
MoneyInput
DateInput
CustomerSelector
ProductSelector
```

y referencias a:

```text
SupplierSelector
```

Su estado concreto se consolidará en `BUSINESS_COMPONENTS.md`.

---

# 78. Evolución

Las nuevas necesidades deben resolverse en este orden:

```text
¿Ya existe el componente?
        ↓ no
¿Puede componerse con componentes existentes?
        ↓ no
¿Es específico de un feature?
        ↓ no
¿Es realmente reutilizable?
        ↓ sí
Crear componente compartido
```

---

# 79. Anti-patrones

Evitar:

## Component Duplication

```text
PurchaseButton
SalesButton
InventoryButton
```

si todos son simplemente `Button`.

---

## Giant Universal Component

Un componente con decenas de configuraciones para representar workflows distintos.

---

## Domain Logic in UI Component

```text
Badge
↓
calcula si Product está low stock
```

Incorrecto.

El dominio calcula el estado.

Badge lo representa.

---

## Direct API calls in generic UI

Un `Button`, `DataTable` o `StaticTable` genérico no debe conocer endpoints de
negocio.

---

## Styling aislado

No inventar un sistema visual nuevo dentro de cada feature.

---

# 80. Relación con Zaping Way

Este documento define:

> los bloques visuales y reglas de construcción.

`ZAPING_WAY.md` definirá:

> cómo se organiza la experiencia completa alrededor del trabajo del usuario.

Ejemplo:

```text
DESIGN_SYSTEM
→ cómo se ve StatusBadge

ZAPING_WAY
→ cuándo y por qué mostramos el estado
```

---

# 81. Relación con Business Components

`BUSINESS_COMPONENTS.md` documenta los componentes reutilizables que conocen conceptos de negocio.

Este documento define las reglas que esos componentes deben respetar.

---

# 82. Relación con Engineering

La implementación debe seguir:

```text
ENGINEERING_GUIDE.md
QUALITY_STANDARDS.md
```

especialmente en:

* TypeScript;
* estructura;
* accesibilidad;
* testing;
* reutilización.

---

# 83. Regla para nuevos componentes

Antes de crear un componente compartido debe responderse:

1. ¿Qué problema resuelve?
2. ¿Ya existe una solución?
3. ¿Es visual o empresarial?
4. ¿Se reutilizará realmente?
5. ¿Puede componerse con componentes existentes?
6. ¿Dónde debe vivir?
7. ¿Cómo se comporta en estados de error/loading/disabled?
8. ¿Es accesible?

---

# 84. Documentación de componentes

No se creará automáticamente un `.md` por cada componente.

Un componente debe tener documentación independiente únicamente cuando su complejidad lo justifique.

La documentación general vive en:

```text
DESIGN_SYSTEM.md
BUSINESS_COMPONENTS.md
```

El código y las pruebas describen los detalles de implementación.

---

# 85. Principio final

El Design System de Zaping existe para conseguir:

```text
Consistencia
+
Claridad
+
Velocidad
+
Accesibilidad
+
Reutilización
```

sin convertir el frontend en una biblioteca abstracta más compleja que el propio producto.

> La interfaz debe sentirse como un solo sistema, aunque esté compuesta por muchos módulos.
