# Módulo de Dashboard — Zaping ERP

**Módulo:** Dashboard
**Producto:** Zaping ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** IMPLEMENTED / EN EVOLUCIÓN
**Última actualización:** 2026-08-19
**Responsable:** Zaping ERP Team

---

# 1. Propósito

Dashboard proporciona una vista consolidada del estado operativo y comercial de una Company.

Su responsabilidad es transformar información distribuida entre distintos módulos en una vista que permita responder rápidamente:

```text
¿Qué está ocurriendo?
¿Qué necesita atención?
¿Qué cambió recientemente?
¿Qué debería revisar ahora?
```

Dashboard es principalmente un:

> **Read Model y punto de coordinación de información.**

No constituye un dominio transaccional independiente.

---

# 2. Principio fundamental

La evolución de Dashboard sigue:

```text
Datos
↓
Contexto
↓
Atención
↓
Acción
```

No debe limitarse a mostrar números aislados.

---

# 3. Objetivo de experiencia

El Dashboard debe ayudar al usuario a:

* comprender el estado general de la empresa;
* detectar problemas rápidamente;
* identificar trabajo pendiente;
* navegar directamente a la operación relacionada;
* reducir consultas manuales entre módulos;
* apoyar decisiones operativas.

---

# 4. Dashboard no almacena la verdad de otros dominios

Dashboard consume información proveniente de:

```text
Customers
Suppliers
Products
Inventory
Purchases
Quotes
Sales
Returns
Healthcare
Audit
Notifications
```

según las capacidades disponibles.

No debe convertirse en propietario de esos datos.

---

# 5. Ejemplo

Incorrecto:

```text
Dashboard.lowStock = true
```

como regla independiente.

Correcto:

```text
Inventory
→ determina qué significa Low Stock

Dashboard
→ consulta y presenta esos productos
```

---

# 6. Responsabilidades

Dashboard puede ser responsable de:

* agregación;
* KPIs;
* contadores;
* resúmenes;
* tendencias;
* actividad reciente;
* alertas visibles;
* tareas accionables;
* enlaces contextuales;
* Read Models optimizados.

---

# 7. Fuera del alcance

Dashboard no es propietario de:

* creación de Customer;
* aprobación de Purchase;
* confirmación de Receipt;
* modificación de stock;
* confirmación de Delivery;
* lifecycle de Quote;
* reglas de Return;
* reglas Healthcare.

---

# 8. Quick Actions

Dashboard puede ofrecer accesos como:

```text
[Nueva cotización]
[Nueva compra]
[Registrar recepción]
[Revisar bajo stock]
```

pero estas acciones deben:

```text
abrir / iniciar
el workflow correspondiente
```

No trasladar la lógica del dominio al Dashboard.

---

# 9. Estado actual

La implementación actual de Zaping ya dispone de un Dashboard operativo con información agregada.

El estado registrado del proyecto incluye métricas como:

```text
Customers
Suppliers
Products
Quotes
Purchases
Sales
Inventory Value
Low Stock Products
Recent Sales
```

La implementación técnica exacta debe verificarse en el código vigente.

---

# 10. Dashboard actual

La primera versión cumple principalmente una función de:

```text
Operational Overview
```

mediante:

* contadores;
* métricas;
* inventario;
* actividad reciente.

Esto constituye la base.

No representa todavía el diseño completo del Action Dashboard objetivo.

---

# 11. Dirección objetivo

Según `ZAPING_WAY.md`, Dashboard debe evolucionar hacia:

> **Action Dashboard**

donde la prioridad es:

```text
Qué requiere atención
↓
Qué puedo hacer
↓
Indicadores
↓
Actividad y tendencias
```

---

# 12. Jerarquía objetivo

Una dirección recomendada es:

```text
1. Atención / tareas
2. KPIs importantes
3. Actividad reciente
4. Tendencias
5. Información secundaria
```

No todos los bloques deben aparecer para todos los usuarios.

---

# 13. Ejemplo de Action Dashboard

```text
Requiere atención

5 productos con bajo stock
[Revisar]

3 compras pendientes de recepción
[Recibir]

2 pedidos pendientes de entrega
[Preparar]

1 devolución pendiente
[Revisar]
```

---

# 14. KPIs

Los KPIs deben responder una pregunta empresarial concreta.

Ejemplos:

```text
Ventas
Compras
Clientes
Productos
Valor de inventario
Bajo stock
Cotizaciones
```

---

# 15. No mostrar métricas por disponibilidad técnica

Una métrica no debe existir únicamente porque sea fácil ejecutar:

```sql
COUNT(*)
```

Debe tener utilidad para el usuario.

---

# 16. Total Customers

Puede mostrar el tamaño actual del catálogo de Customers.

Debe quedar claro si en el futuro representa:

```text
todos
```

o:

```text
solo activos
```

No deben mezclarse ambas semánticas.

---

# 17. Total Suppliers

Puede proporcionar contexto de abastecimiento.

Al igual que Customers, debe definirse qué lifecycle participa en la métrica.

---

# 18. Total Products

Representa el catálogo según la semántica definida.

Cuando sea necesario deberá distinguir:

```text
Products activos
Products inactivos
```

---

# 19. Quotes

Puede mostrar métricas como:

```text
Total Quotes
Quotes Draft
Quotes Confirmed
Quotes pendientes de seguimiento
```

cuando sus definiciones sean claras.

---

# 20. Purchases

Puede evolucionar desde:

```text
Total Purchases
```

hacia información más operativa:

```text
Pending Receipt
Partially Received
Received Today
```

---

# 21. Sales

Mientras exista `Sale` legacy, Dashboard puede consumir ese modelo.

Después del refactor debe migrar hacia:

```text
SalesOrder
Delivery
```

sin mantener métricas duplicadas permanentemente.

---

# 22. Inventory Value

La implementación actual incluye:

```text
inventoryValue
```

como indicador operativo.

Antes de presentarlo como cifra contable oficial debe existir una política de valuación formal.

Por tanto:

> Inventory Value actual es una métrica operacional, no necesariamente un valor financiero auditado.

---

# 23. Low Stock

Dashboard puede consumir la regla de Inventory para mostrar productos con:

```text
stock bajo
```

No debe implementar su propia definición distinta.

---

# 24. Recent Sales

La implementación actual incluye actividad de Sales reciente.

Con ADR-011 deberá evolucionar progresivamente hacia eventos más precisos como:

```text
SalesOrder created
Delivery confirmed
```

según lo que aporte mayor valor.

---

# 25. Comparación contra períodos

La documentación histórica contempla que ciertos KPIs puedan mostrar:

```text
Current Value
Previous Period
Trend
Percentage Variation
```

Esta capacidad es TARGET salvo donde ya exista implementación específica.

---

# 26. Ejemplo

```text
Ventas del mes
$420,000 MXN
↑ 12.5 % vs mes anterior
```

La comparación debe utilizar períodos equivalentes y reglas de cálculo explícitas.

---

# 27. No inventar tendencias

Si Zaping no dispone de suficiente historial o el período no es comparable, no debe mostrar:

```text
+25 %
```

sin una base válida.

---

# 28. Charts

La documentación original propone gráficas para:

### Sales

```text
Daily Sales
Monthly Sales
Sales by Customer
Sales by Salesperson
```

### Purchases

```text
Monthly Purchases
Purchases by Supplier
```

### Inventory

```text
Top Products
Low Stock
Inventory Value
Products Near Expiration
```

Estas capacidades constituyen principalmente evolución TARGET.

---

# 29. Gráficas con propósito

No debe agregarse una gráfica únicamente para hacer que Dashboard parezca más completo.

Cada visualización debe permitir:

* detectar tendencia;
* comparar;
* identificar anomalía;
* tomar una decisión.

---

# 30. Ejemplo incorrecto

```text
Pie chart
20 categorías
20 colores
```

sin una pregunta empresarial clara.

---

# 31. Ejemplo útil

```text
Compras por mes
últimos 6 meses
```

puede ayudar a identificar tendencias de abastecimiento.

---

# 32. Activity Timeline

La documentación histórica contempla un Timeline de actividad.

Puede mostrar eventos como:

```text
Purchase created
PurchaseReceipt registered
Quote confirmed
Sale / SalesOrder confirmed
Delivery confirmed
Inventory adjusted
Customer created
Return confirmed
```

según la arquitectura vigente.

---

# 33. Fuente del Timeline

El Timeline no debe reconstruirse mediante lógica duplicada en frontend.

La dirección objetivo es utilizar:

```text
Audit / Domain Events / Read Models
```

cuando la infraestructura correspondiente exista.

---

# 34. No confundir actividad con auditoría completa

Dashboard puede mostrar:

```text
actividad reciente
```

pero no sustituye un módulo de Audit.

Audit debe conservar mayor detalle y trazabilidad.

---

# 35. Alertas

Dashboard puede presentar alertas operativas.

Ejemplos:

```text
Producto sin stock
Producto con bajo stock
Caducidad próxima
Compra pendiente de recepción
Pedido pendiente de entrega
Return pendiente
Healthcare Case sin preparar
Incidencia de reconciliación
```

según los módulos implementados.

---

# 36. Severidad

La documentación histórica propone niveles:

```text
Critical
High
Medium
Low
```

La idea es válida, pero el uso debe estandarizarse para evitar que cada módulo asigne severidad de forma arbitraria.

---

# 37. Semántica recomendada

Puede alinearse visualmente con el Design System:

```text
Info
Warning
Danger
```

mientras la prioridad operacional puede manejarse de forma separada cuando sea necesario.

---

# 38. Alertas accionables

Una alerta debe permitir pasar al contexto relacionado.

Ejemplo:

```text
5 productos con bajo stock

[Revisar productos]
```

No debe ser solo texto decorativo.

---

# 39. Alertas no son Notifications

Debe distinguirse:

```text
Dashboard Alert
→ información visible al abrir Dashboard
```

de:

```text
Notification
→ comunicación dirigida al usuario
```

Un mismo evento puede alimentar ambos sistemas en el futuro, pero no son equivalentes.

---

# 40. Quick Actions

La documentación histórica incluye:

```text
New Sale
New Purchase
New Customer
New Product
Create Quote
Inventory Adjustment
```

La dirección continúa siendo válida con algunos ajustes de arquitectura.

---

# 41. Quick Actions objetivo

Con el modelo futuro podrían existir:

```text
Nueva cotización
Nueva venta / SalesOrder
Nueva compra
Registrar recepción
Registrar cliente
Registrar producto
```

según permisos y contexto.

---

# 42. Inventory Adjustment

Debido a su sensibilidad, no debe aparecer como acción rápida para todos los usuarios únicamente porque exista una capacidad técnica.

Debe depender de:

```text
RBAC
+
business need
```

---

# 43. Acciones por rol

Un Dashboard puede adaptarse progresivamente a las responsabilidades del usuario.

Ejemplo:

### Sales

```text
Nueva cotización
Pedidos pendientes
Clientes recientes
```

### Warehouse

```text
Por recibir
Por entregar
Bajo stock
Returns
```

### Management

```text
KPIs
Tendencias
Alertas
```

---

# 44. Role-Based Dashboard

La documentación histórica lo planteaba como una evolución posterior.

La dirección continúa siendo válida.

No significa crear desde ahora un Dashboard completamente distinto por cada rol.

---

# 45. Personalización

Capacidades futuras pueden incluir:

```text
Favorite Widgets
Saved Filters
Custom Dashboards
```

pero deben posponerse hasta conocer cómo utilizan realmente los usuarios el producto.

---

# 46. Drag & Drop

La documentación antigua propone:

```text
Drag & Drop Widgets
```

como una fase futura.

No constituye prioridad actual.

Un Dashboard configurable pero confuso puede ofrecer peor UX que uno bien diseñado.

---

# 47. Global Filters

La documentación original contempla filtros globales.

Pueden incluir posteriormente:

```text
Date Range
Branch
Warehouse
Salesperson
```

cuando esos conceptos existan.

---

# 48. Filtros no aplicables

No todos los widgets deben responder artificialmente a todos los filtros.

Ejemplo:

```text
Date Range
```

puede tener sentido para Sales.

Pero no necesariamente para:

```text
Current Product Count
```

Debe definirse semántica clara.

---

# 49. Current Company

En el uso normal:

```text
Dashboard
→ authenticated Company
```

No debe aceptar un `companyId` arbitrario desde frontend para cambiar de tenant.

---

# 50. Multi-Company Dashboard futuro

La documentación histórica contempla:

```text
Multi-company dashboards
```

como capacidad futura.

Esto requeriría permisos y contexto explícito.

No debe debilitar el aislamiento multi-tenant normal.

---

# 51. Arquitectura

Conceptualmente:

```text
Domain Modules
     │
     ▼
Read / Aggregation Layer
     │
     ▼
DashboardService
     │
     ▼
Dashboard API
     │
     ▼
Dashboard UI
```

---

# 52. DashboardService

`DashboardService` puede encargarse de:

* coordinar consultas;
* ejecutar agregaciones;
* construir DTOs de lectura;
* proporcionar un modelo optimizado para frontend.

---

# 53. Regla importante

La documentación antigua decía:

> Business logic must never exist inside dashboard components.

Esta regla se conserva.

Pero requiere precisión.

DashboardService **sí puede contener lógica de agregación específica del Read Model**.

Lo que no debe hacer es redefinir reglas de dominio.

---

# 54. Ejemplo válido

```text
DashboardService
↓
count Purchases with pending receipt
```

utilizando estados/reglas proporcionados por Purchases.

---

# 55. Ejemplo inválido

```text
DashboardService
↓
decide cuándo una Purchase debe cambiar a RECEIVED
```

Esa regla pertenece a Purchases.

---

# 56. Frontend

El frontend de Dashboard debe recibir un modelo orientado a presentación.

No debería necesitar realizar una cascada como:

```text
GET customers
GET suppliers
GET products
GET purchases
GET quotes
GET sales
GET inventory
```

y reconstruir todas las métricas por sí mismo.

---

# 57. API agregada

Es preferible contar con una API similar conceptualmente a:

```text
GET /dashboard
```

o endpoints de Read Model específicos.

El contrato exacto debe verificarse en código/OpenAPI.

---

# 58. Razón

Esto reduce:

* requests;
* duplicación;
* conocimiento de dominios en frontend;
* inconsistencias;
* complejidad de Dashboard.

---

# 59. Read Model

Dashboard puede devolver una estructura optimizada para consumo.

Ejemplo conceptual:

```json
{
  "totals": {},
  "inventory": {},
  "activity": [],
  "attention": []
}
```

No es necesario reproducir directamente todas las entidades Prisma.

---

# 60. DTO dedicado

Dashboard debe preferir DTOs de lectura específicos.

No devolver modelos completos únicamente para obtener un contador.

---

# 61. Performance

La documentación histórica establece como objetivo:

```text
Dashboard < 500 ms
```

bajo condiciones normales.

Se mantiene como **objetivo de rendimiento**, no como garantía absoluta para cualquier cantidad de datos o infraestructura.

---

# 62. Estrategias de performance

Conforme crezca el producto pueden utilizarse:

* aggregate queries;
* índices;
* queries paralelas cuando sean seguras;
* Read Models;
* caching;
* pre-aggregation.

---

# 63. No optimizar prematuramente

No introducir:

```text
Redis
materialized views
event pipelines
analytics warehouse
```

únicamente porque Dashboard podría necesitarlos algún día.

Primero medir.

---

# 64. Cache

Puede utilizarse cuando:

* la consulta sea costosa;
* la métrica tolere cierta latencia;
* exista beneficio medible.

No toda métrica debe cachearse.

---

# 65. Datos altamente operativos

Información como:

```text
Pending Receipt
Pending Delivery
Critical Stock
```

puede requerir mayor frescura que una gráfica mensual.

La estrategia de caching debe considerar esa diferencia.

---

# 66. “Real-time”

En el contexto actual:

> Real-time significa información operacional suficientemente actual para la tarea, normalmente calculada al consultar/refrescar Dashboard.

No implica necesariamente:

```text
WebSockets
Server-Sent Events
streaming
```

---

# 67. Actualización futura

Si los workflows requieren actualización automática, podrán evaluarse:

* polling;
* revalidation;
* WebSockets;
* server events.

La tecnología debe responder a la necesidad real.

---

# 68. Error isolation

Un fallo en una métrica secundaria no debería necesariamente inutilizar todo el Dashboard si la arquitectura permite degradación segura.

Ejemplo futuro:

```text
Sales metrics ✓
Inventory metrics ✓
Recent activity ✗
```

podría mostrar el resto junto con un error localizado.

---

# 69. No ocultar errores críticos

Si el Dashboard no puede cargar información fundamental, debe comunicarlo claramente.

No presentar:

```text
0
```

cuando en realidad ocurrió:

```text
query failed
```

---

# 70. Zero vs unavailable

Debe distinguirse:

```text
0 compras pendientes
```

de:

```text
No fue posible consultar compras pendientes.
```

---

# 71. Loading

Dashboard puede utilizar:

* skeletons;
* LoadingSpinner;
* loading localizado;

según la estructura.

No debe mostrar una pantalla vacía mientras carga.

---

# 72. Empty State

Al inicio de una empresa nueva, muchos KPIs serán cero.

Dashboard debe orientar.

Ejemplo:

```text
Todavía no tienes productos.

Agrega tu catálogo para comenzar a utilizar Inventory.

[Agregar producto]
```

---

# 73. Onboarding Dashboard

Una Company recién creada puede beneficiarse más de:

```text
Completa estos pasos
```

que de:

```text
Ventas: 0
Compras: 0
Inventario: 0
```

---

# 74. Onboarding objetivo

Conceptualmente:

```text
Configura tu empresa      ✓
Agrega productos          ○
Agrega clientes           ○
Crea primera cotización   ○
Registra primera compra   ○
```

Esta es una capacidad futura de experiencia.

---

# 75. Inventory alerts

Dashboard puede mostrar:

```text
Low Stock
Out of Stock
Near Expiration
Expired
```

cuando Inventory soporte de forma confiable cada concepto.

---

# 76. Near Expiration

No debe mostrarse como feature actual únicamente porque `expirationDate` existe.

Debe existir:

* regla de ventana;
* consulta;
* UX;
* definición de lotes elegibles.

---

# 77. Products Near Expiration

Es una capacidad TARGET coherente con Healthcare y Inventory avanzado.

Puede evolucionar hacia períodos como:

```text
30 días
60 días
90 días
```

configurables o definidos por producto/empresa en el futuro.

---

# 78. Purchase summary

El Dashboard objetivo debe priorizar información operacional:

```text
Purchases pending receipt
Partially received
Recent receipts
```

por encima de únicamente:

```text
Purchases this month
```

cuando el usuario está realizando trabajo operativo.

---

# 79. Sales summary

Después de ADR-011:

```text
SalesOrder pending delivery
Partially delivered
Recent deliveries
```

serán indicadores más precisos que tratar cualquier `Sale` como un único evento.

---

# 80. Quote summary

Una evolución futura puede mostrar:

```text
Draft Quotes
Confirmed Quotes
Quotes awaiting follow-up
Conversion rate
```

pero la métrica `conversion rate` requiere definir claramente:

```text
qué constituye conversión
qué período
qué denominator
```

---

# 81. Average Ticket

La documentación histórica propone:

```text
Average Ticket
```

como KPI.

Debe definirse antes de implementarlo.

Ejemplo:

```text
Confirmed Sales total
/
Confirmed Sales count
```

puede ser distinto a utilizar Invoice o Delivery.

---

# 82. Salesperson metrics

La documentación histórica menciona:

```text
Sales by Salesperson
```

pero el modelo actual no formaliza completamente ownership comercial.

Por tanto esta métrica permanece FUTURE/TARGET hasta que exista una relación confiable.

---

# 83. Active Customers

El término:

```text
Active Customers
```

puede significar:

1. `isActive = true`, o
2. Customers que han comprado recientemente.

No deben mezclarse.

---

# 84. Nombres de métricas

Las etiquetas deben comunicar su significado.

Preferir:

```text
Clientes habilitados
```

si significa `isActive`.

O:

```text
Clientes con compra en 90 días
```

si significa actividad comercial.

---

# 85. Top Customers

Una métrica de Top Customers debe especificar:

* período;
* medida;
* estados incluidos.

Ejemplo:

```text
Top Customers by confirmed sales
Current month
```

---

# 86. Top Products

También debe definirse:

```text
por unidades
por revenue
por margen
```

antes de utilizar la etiqueta genérica:

```text
Top Products
```

---

# 87. Purchases by Supplier

Puede calcularse según:

* importe;
* número de órdenes;
* unidades;

por lo que Dashboard debe evitar métricas ambiguas.

---

# 88. KPI definitions

Cuando Dashboard crezca, conviene mantener cada métrica con una definición explícita en código/documentación técnica.

Ejemplo:

```text
Metric:
pendingPurchaseReceipts

Definition:
Purchases with remaining quantity > 0
and lifecycle allowing receipt
```

---

# 89. Metric ownership

Dashboard puede ser propietario de:

```text
cómo se presenta una métrica agregada
```

pero debe reutilizar la semántica de los módulos fuente.

---

# 90. Audit integration

Cuando Audit esté implementado, Dashboard podrá utilizarlo para Recent Activity.

Debe respetar:

* tenant;
* permisos;
* minimización.

---

# 91. Información sensible

No todos los usuarios necesitan ver:

* revenue;
* costos;
* márgenes;
* valor de inventario;
* actividad de otros usuarios.

Dashboard debe respetar autorización.

---

# 92. `dashboard.read`

La documentación histórica contempla:

```text
dashboard.read
```

como permiso.

Esta dirección es coherente con ADR-007.

---

# 93. Permisos de datos subyacentes

Tener:

```text
dashboard.read
```

no debería convertirse automáticamente en acceso a toda información sensible de la Company.

Un Dashboard por rol debe considerar las políticas aplicables a sus métricas.

---

# 94. `dashboard.export`

La documentación histórica propone:

```text
dashboard.export
```

para exportación de métricas.

Esta capacidad sigue siendo futura mientras no exista el workflow correspondiente.

---

# 95. Export

Cuando exista, exportar Dashboard debe respetar:

* permisos;
* filtros;
* tenant;
* datos sensibles;
* límites de volumen.

---

# 96. Multi-tenancy

Toda métrica debe estar aislada por Company.

Nunca:

```text
SUM sales
```

sin:

```text
Company context
```

en una consulta multi-tenant.

---

# 97. Cross-tenant aggregation

Debe evitarse cualquier consulta que accidentalmente calcule:

```text
Company A + Company B
```

para un usuario normal.

---

# 98. Multi-company future

Un usuario autorizado podría algún día consultar varias Companies.

Esto requerirá un modelo explícito de:

* membership;
* autorización;
* scope.

No se obtiene removiendo el filtro de tenant.

---

# 99. Healthcare Dashboard

Healthcare podrá añadir una experiencia operacional especializada.

Ejemplos:

```text
Cases today
Cases requiring preparation
CaseKit pending
Equipment conflict
Returns pending
Reconciliation incidents
```

---

# 100. Healthcare no debe contaminar Dashboard Core

Una empresa que no utiliza Healthcare no necesita widgets como:

```text
Cases
Doctors
Hospitals
```

en su Dashboard principal.

La experiencia debe especializarse según capacidades habilitadas.

---

# 101. Case Calendar vs Dashboard

Debe distinguirse:

```text
Dashboard
→ resumen y atención
```

de:

```text
Case Calendar
→ planificación temporal Healthcare
```

Pueden enlazarse, pero no son la misma vista.

---

# 102. Warehouse Workspace vs Dashboard

También:

```text
Dashboard
→ panorama
```

mientras:

```text
Warehouse Operations
→ workspace de ejecución
```

Dashboard puede mostrar:

```text
3 recepciones pendientes
```

y enlazar al Workspace correspondiente.

---

# 103. Radar

En el futuro Zaping Radar podrá proporcionar información externa.

No debe mezclarse con KPIs internos sin distinguir el origen.

Ejemplo:

```text
ERP
→ operación interna

Radar
→ oportunidad externa
```

---

# 104. Zaping AI

La capa futura de inteligencia puede añadir:

```text
Insights
Recommendations
Anomaly detection
Natural-language queries
```

---

# 105. AI no sustituye KPI

Una recomendación de IA debe apoyarse en datos verificables.

Ejemplo:

```text
Recomendamos revisar Product CAT-001.

Stock: 4
MinStock: 10
Pending Purchases: 0
```

---

# 106. AI explicable

No mostrar:

```text
Compra 50 unidades.
```

sin explicar la razón.

---

# 107. Natural Language futuro

Una capacidad futura puede permitir preguntas como:

```text
¿Qué productos tienen bajo stock?
```

o:

```text
¿Cuáles fueron mis ventas este mes?
```

Debe respetar los mismos permisos y reglas que las APIs tradicionales.

---

# 108. Executive Dashboard

La documentación histórica contempla:

```text
Executive Dashboard
```

como evolución futura.

Podría priorizar:

* tendencias;
* revenue;
* compras;
* inventario;
* riesgos;
* performance.

No debe construirse antes de contar con datos confiables.

---

# 109. Financial Dashboard

Requiere primero dominios financieros suficientemente sólidos.

No debe utilizar:

```text
Sales total
```

como sustituto automático de:

```text
Revenue recognized
Cash collected
Profit
```

---

# 110. Warehouse Dashboard

Puede evolucionar mejor como:

```text
Warehouse Operations Workspace
```

orientado a tareas.

Esto está alineado con Zaping Way.

---

# 111. Mobile Dashboard

Una futura App móvil puede necesitar un Dashboard distinto por contexto.

No debe suponerse que la pantalla desktop debe copiarse pixel por pixel.

---

# 112. Estado CURRENT

El estado registrado del proyecto incluye actualmente un Dashboard con información agregada como:

```text
customer totals
supplier totals
product totals
quote totals
purchase totals
sale totals
inventory value
low-stock products
recent sales
```

---

# 113. Estado TARGET

La evolución aprobada incluye:

```text
Action Dashboard
Operational alerts
Task-oriented summaries
Contextual navigation
Recent activity
More precise KPIs
Charts where useful
Purchase receipt indicators
SalesOrder / Delivery indicators
Expiration alerts
Role-aware presentation
```

---

# 114. Estado FUTURE

Capacidades posteriores:

```text
Custom Dashboards
Favorite Widgets
Saved Filters
Drag & Drop
Multi-company views
Executive Dashboard
Financial Dashboard
Advanced Analytics
PDF / Excel exports
AI Insights
Predictive Analytics
Natural Language Queries
```

---

# 115. Invariantes

```text
Dashboard
→ belongs to authenticated Company context
```

```text
Dashboard
→ consumes domain information
```

```text
Dashboard
→ does not own transactional lifecycle
```

```text
Dashboard
→ does not directly change Inventory
```

```text
Dashboard metric
→ must have explicit meaning
```

```text
Zero
≠
Query failure
```

```text
Quick Action
→ delegates to owning workflow
```

```text
Dashboard UI
→ should not independently reconstruct every domain
```

---

# 116. Anti-patrones

## Database Counter Dashboard

Mostrar únicamente:

```text
Customers: 45
Products: 810
Sales: 92
```

sin contexto ni acciones.

---

## Duplicated Business Rules

Reimplementar Low Stock, Purchase Pending o Delivery Status dentro de Dashboard.

---

## Dashboard as Transaction Service

```text
POST /dashboard/adjust-stock
```

---

## Frontend Aggregation Explosion

Hacer muchas consultas independientes y reconstruir toda la lógica en React.

---

## Metric Without Definition

Mostrar:

```text
Active Customers
```

sin poder explicar qué significa “Active”.

---

## Decorative Charts

Agregar gráficas que no ayudan a tomar decisiones.

---

## False Zero

Mostrar `0` cuando ocurrió un error de consulta.

---

## Unprotected Financial Metrics

Mostrar costos/revenue a cualquier usuario únicamente porque puede abrir Dashboard.

---

## Premature BI Platform

Construir infraestructura analítica compleja antes de que el Core y los workflows estén maduros.

---

# 117. Relación con Customers

Customers proporciona los datos del catálogo.

Dashboard puede mostrar:

```text
counts
activity
commercial summaries
```

sin modificar Customers.

---

# 118. Relación con Suppliers

Suppliers proporciona contexto para métricas de abastecimiento.

---

# 119. Relación con Products

Products proporciona identidad de catálogo.

Inventory proporciona las métricas físicas relacionadas.

---

# 120. Relación con Purchases

Dashboard debe evolucionar hacia métricas operativas como:

```text
Pending Receipt
Partially Received
```

basadas en el lifecycle real.

---

# 121. Relación con Inventory

Inventory es propietario de:

* stock;
* movements;
* batches;
* availability.

Dashboard los presenta.

---

# 122. Relación con Quotes

Quotes puede alimentar:

* volumen;
* estados;
* actividad;
* futuras conversiones.

---

# 123. Relación con Sales

CURRENT:

```text
Sale metrics
```

TARGET:

```text
SalesOrder
Delivery
```

Dashboard debe migrar junto con Sales.

---

# 124. Relación con Returns

Cuando Returns sea operativo puede aportar:

```text
Returns pending
Returns confirmed
Return rate
```

según las reglas definidas.

---

# 125. Relación con Healthcare

Healthcare aportará Read Models especializados sin transferir sus reglas al Dashboard Core.

---

# 126. Relación con Zaping Way

`ZAPING_WAY.md` define el objetivo:

> pasar de un Dashboard de métricas a un Dashboard orientado a atención y acción.

Este documento define cómo esa dirección aplica al módulo Dashboard.

---

# 127. Relación con Design System

`DESIGN_SYSTEM.md` gobierna:

* Cards;
* estados;
* jerarquía;
* Loading;
* Empty;
* Error;
* responsive;
* accesibilidad.

Dashboard no debe crear un sistema visual paralelo.

---

# 128. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-011 — SalesOrder y Delivery.
* ADR-012 — Entity Lifecycle.
* ADR-013 — Inventory Custody & Case Logistics.

---

# 129. Documentos relacionados

```text
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md

architecture/ARCHITECTURE.md

engineering/API_GUIDELINES.md
engineering/QUALITY_STANDARDS.md
engineering/SECURITY_PRINCIPLES.md

ux/DESIGN_SYSTEM.md

modules/erp/CUSTOMERS.md
modules/erp/SUPPLIERS.md
modules/erp/PRODUCTS.md
modules/erp/PURCHASES.md
modules/erp/INVENTORY.md
modules/erp/QUOTES.md
modules/erp/SALES.md
modules/erp/RETURNS.md
```

---

# 130. Fuente de verdad

```text
DASHBOARD.md
→ reglas funcionales del Read Model y experiencia Dashboard

módulos ERP
→ significado de los datos

ZAPING_WAY.md
→ dirección de experiencia

backend
→ implementación actual

tests
→ comportamiento validado

PROJECT_BOARD.md
→ estado del trabajo
```

---

# 131. Principio final

Dashboard no debe responder únicamente:

```text
¿Cuántos registros existen?
```

Debe evolucionar hacia:

```text
¿Qué está pasando?
↓
¿Qué necesita atención?
↓
¿Por qué?
↓
¿Qué puedo hacer?
```

La regla es:

> **El Dashboard no gobierna la empresa. Hace visible lo que los dominios ya saben y ayuda al usuario a actuar sobre ello.**
