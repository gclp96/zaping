# Módulo de Clientes — Zaping ERP

**Módulo:** Customers
**Producto:** Zaping ERP Core
**Versión:** 2.0.0
**Estado:** Aprobado
**Estado de implementación:** IMPLEMENTED / EN EVOLUCIÓN
**Última actualización:** 2026-08-19
**Responsable:** Zaping ERP Team

---

# 1. Propósito

El módulo Customers administra el catálogo maestro de clientes de una Company.

Su responsabilidad principal es responder:

```text
¿A quién le vendemos?
¿Cómo identificamos al cliente?
¿Cómo podemos contactarlo?
¿Puede participar actualmente en nuevas operaciones?
¿Qué actividad comercial existe con él?
```

Customer representa una contraparte comercial del ERP.

---

# 2. Principio fundamental

```text
Customer
=
contraparte comercial
```

mientras:

```text
Quote
=
propuesta comercial
```

y:

```text
SalesOrder
=
compromiso comercial
```

Por tanto:

> Customer identifica a la parte comercial. Sales administra las operaciones realizadas con ella.

---

# 3. Responsabilidades

Customers es propietario de información maestra como:

* nombre;
* tipo;
* email;
* teléfono;
* dirección;
* contacto;
* límite de crédito de referencia;
* notas;
* estado activo/inactivo;
* identidad dentro de la Company.

---

# 4. Fuera del alcance

Customers no es propietario de:

* Quote lifecycle;
* SalesOrder lifecycle;
* Delivery;
* Inventory;
* facturación;
* cuentas por cobrar;
* pagos;
* Hospital;
* Doctor;
* Healthcare Case;
* Payer;
* pricing avanzado.

---

# 5. Modelo actual

El modelo vigente contiene conceptualmente:

```text
Customer
├── id
├── companyId
├── name
├── type
├── email
├── phone
├── address
├── contactName
├── creditLimit
├── notes
├── isActive
├── createdAt
├── updatedAt
├── quotes
└── sales
```

La definición técnica exacta permanece en `schema.prisma`.

La relación actual con `Sale` pertenece al modelo comercial legacy y deberá evolucionar junto con ADR-011.

---

# 6. Identificador

Customer utiliza UUID como identificador técnico.

```text
id
→ UUID
```

El usuario normalmente identifica al cliente mediante su nombre y, en etapas futuras, mediante códigos empresariales adicionales cuando sean necesarios.

---

# 7. Multi-tenancy

Cada Customer pertenece a una Company.

```text
Company
↓
Customer
```

Un Customer de una Company no debe ser accesible desde otra.

---

# 8. Customer como Master Data

Customer sigue ADR-012.

Su lifecycle principal debe ser:

```text
ACTIVE
↓
INACTIVE
```

y no:

```text
EXISTS
↓
DELETED
```

como estrategia predeterminada.

---

# 9. Customer activo

Un Customer activo puede utilizarse normalmente en nuevas operaciones como:

```text
Quote
SalesOrder
```

y otros workflows comerciales autorizados.

---

# 10. Customer inactivo

Un Customer inactivo:

* continúa existiendo;
* conserva sus documentos históricos;
* puede consultarse;
* permanece relacionado con Quotes y Sales existentes;
* normalmente no debe participar en nuevas operaciones.

---

# 11. Desactivación

Cuando el objetivo sea dejar de trabajar comercialmente con un cliente, la acción correcta es:

```text
Desactivar cliente
```

no:

```text
Eliminar cliente
```

si ya existe historia relacionada.

---

# 12. Reactivación

Cuando sea válido:

```text
INACTIVE
↓
ACTIVE
```

puede reactivarse.

La operación debe respetar:

* tenant;
* autorización;
* reglas vigentes.

---

# 13. Hard Delete

La eliminación física únicamente puede considerarse cuando el Customer:

* fue creado por error;
* no tiene Quotes;
* no tiene Sales/SalesOrders;
* no tiene relaciones históricas;
* y la operación está permitida explícitamente.

No es la estrategia habitual.

---

# 14. Comportamiento legacy de eliminación

Versiones previas de la UI o API pueden contener una acción denominada:

```text
Delete Customer
```

o un `DELETE /customers/:id`.

Eso no convierte Soft Delete global en una regla vigente.

El comportamiento deberá revisarse progresivamente contra ADR-012.

---

# 15. Regla histórica descartada

La documentación API antigua indicaba:

```text
DELETE /customers/:id
→ Soft Delete
```

como comportamiento oficial.

Esa regla queda descartada.

El modelo actual utiliza:

```text
isActive
```

y la semántica correcta es lifecycle empresarial.

---

# 16. Nombre

`name` es actualmente la identidad empresarial principal del Customer.

Ejemplos:

```text
Hospital San José
```

```text
Distribuidora Médica ABC
```

```text
Clínica del Norte
```

---

# 17. Unicidad del nombre

El modelo actual **no establece una restricción única sobre `Customer.name`**.

Por tanto, este documento no introduce una regla ficticia como:

```text
unique(companyId, name)
```

---

# 18. Clientes con nombres iguales

Dos Customers pueden tener nombres similares o incluso iguales si el modelo técnico lo permite.

En esos casos el usuario debe poder diferenciarlos mediante contexto adicional.

Ejemplos futuros:

* RFC;
* sucursal;
* dirección;
* código de cliente.

---

# 19. Detección de duplicados futura

Conforme crezca el catálogo puede ser necesario advertir posibles duplicados.

Por ejemplo:

```text
Nombre similar
+
mismo RFC
```

o:

```text
Nombre
+
misma dirección
```

Pero esa lógica no existe formalmente todavía.

---

# 20. Identificador fiscal

El modelo actual de Customer **no contiene un campo fiscal específico como RFC**.

Por tanto, queda descartada la antigua regla documental:

```text
Duplicate tax identifiers are not allowed.
```

hasta que exista realmente un identificador fiscal estructurado.

---

# 21. Perfil fiscal futuro

Billing / CFDI probablemente requerirá posteriormente información como:

```text
RFC
Razón social
Régimen fiscal
Código postal fiscal
Uso CFDI
```

La estructura deberá diseñarse junto con Billing.

No debe agregarse de forma aislada únicamente dentro de Customers.

---

# 22. Persona comercial vs razón social

En algunos negocios puede existir diferencia entre:

```text
Nombre comercial
```

y:

```text
Razón social
```

El modelo actual no formaliza completamente esta distinción.

Debe abordarse junto con el diseño fiscal futuro.

---

# 23. Type

El modelo vigente contiene:

```text
type String?
```

como clasificación opcional.

---

# 24. Semántica actual de Type

La semántica de `type` no está suficientemente formalizada como para convertirla todavía en una regla arquitectónica fuerte.

Puede utilizarse actualmente como clasificación cuando la implementación lo permita.

---

# 25. No usar Type como solución universal

No debemos convertir:

```text
Customer.type
```

en una forma de representar indistintamente:

```text
Hospital
Doctor
Insurer
Distributor
Government Agency
Payer
```

sin diseñar primero sus diferencias reales.

---

# 26. Free-form type

Mientras `type` continúe siendo un `String?`, no debe utilizarse como fundamento crítico para:

* permisos;
* facturación;
* lifecycle;
* Healthcare;
* reglas fiscales.

Una cadena libre no proporciona suficiente integridad para esas decisiones.

---

# 27. Evolución de Type

Si aparecen categorías estables y útiles, podrá evolucionar hacia:

* enum;
* catálogo;
* clasificación configurable;

dependiendo de las necesidades reales.

No debe decidirse prematuramente.

---

# 28. Email

`email` es opcional.

Puede utilizarse para:

* comunicación;
* envío futuro de documentos;
* contacto comercial;
* Customer Portal futuro.

---

# 29. Email no es identidad de login

Actualmente:

```text
Customer.email
```

no debe confundirse con:

```text
User.email
```

Un Customer no se convierte automáticamente en usuario autenticado de Zaping.

---

# 30. Customer Portal

El futuro Customer Portal requerirá una identidad externa o mecanismo de acceso controlado.

Conceptualmente:

```text
Customer
↓
External Portal Access
↓
Authorized External User
```

No debe reutilizarse directamente el registro Customer como credencial.

---

# 31. Phone

`phone` es opcional.

Se utiliza como dato de contacto.

No debe ser utilizado como identificador único sin una decisión explícita.

---

# 32. Address

Actualmente Customer utiliza:

```text
address
```

como información de dirección.

El modelo todavía no posee una estructura avanzada de múltiples domicilios.

---

# 33. Múltiples direcciones

Una evolución comercial puede requerir:

```text
Billing Address
Shipping Address
Branch Address
Fiscal Address
```

Estas necesidades deberán diseñarse con Sales, Delivery y Billing.

---

# 34. No sobrecargar address

Mientras exista un único campo, no debe asumirse que sirve simultáneamente como:

```text
dirección fiscal
+
dirección de entrega
+
hospital del Case
```

Esos conceptos pueden diferir.

---

# 35. Contact Name

`contactName` representa actualmente el contacto principal del Customer.

Ejemplo:

```text
Customer
Hospital ABC

Contacto
Lic. María Pérez
```

---

# 36. Contacto no es Customer

El contacto es una persona relacionada con el Customer.

No constituye necesariamente la contraparte contractual.

---

# 37. Contacto no es User

También:

```text
Customer.contactName
≠
Zaping User
```

No se deben derivar permisos o acceso desde este campo.

---

# 38. Múltiples contactos

En una etapa posterior puede ser necesario representar:

```text
Customer
└── Contacts[]
```

con roles como:

* compras;
* administración;
* almacén;
* pagos;
* dirección.

No se implementa hasta tener una necesidad real.

---

# 39. Credit Limit

El modelo vigente contiene:

```text
creditLimit Decimal?
```

---

# 40. Significado actual de Credit Limit

`creditLimit` debe considerarse actualmente información comercial de referencia.

Su mera existencia no significa que Zaping ya cuente con:

* cuentas por cobrar;
* crédito disponible;
* cartera;
* antigüedad de saldos;
* bloqueo automático;
* motor de riesgo.

---

# 41. Credit Limit no equivale a available credit

No debe suponerse:

```text
Available Credit
=
creditLimit
-
Sales total
```

porque esto requeriría considerar:

* facturas;
* pagos;
* notas de crédito;
* vencimientos;
* saldos;
* documentos pendientes.

Ese dominio todavía no está formalizado.

---

# 42. Enforcement futuro

Cuando se implemente Credit Management podrá definirse una regla como:

```text
SalesOrder
↓
Credit Check
↓
Approve / Warn / Block
```

pero requerirá una decisión funcional específica.

---

# 43. Decimal

`creditLimit` utiliza actualmente `Decimal`, lo cual debe preservarse correctamente en:

* DTO;
* serialización;
* frontend;
* cálculos.

No debe convertirse accidentalmente a un valor impreciso sin revisar su tratamiento.

---

# 44. Notes

`notes` permite almacenar contexto administrativo secundario.

Ejemplo:

```text
Solicita cotizaciones por correo antes de las 14:00.
```

---

# 45. Notes no debe convertirse en modelo oculto

No almacenar únicamente en notes información estructurada que controle operaciones.

Ejemplo problemático:

```text
"Crédito 30 días, pagador AXA,
entregar siempre en Hospital Norte"
```

si esos datos posteriormente determinan workflows.

---

# 46. Customer y Quote

El flujo actual y objetivo conserva:

```text
Customer
↓
Quote
```

Una Quote debe referenciar un Customer válido dentro de la Company.

---

# 47. Customer y SalesOrder

Arquitectura objetivo:

```text
Customer
↓
SalesOrder
```

SalesOrder representa el compromiso comercial con el Customer.

---

# 48. Customer y Delivery

Delivery representa el cumplimiento físico.

El destino físico puede coincidir o no con la dirección principal del Customer.

Por tanto:

```text
Customer
≠
Delivery Address
```

como regla universal.

---

# 49. Customer histórico

Si el Customer cambia:

* dirección;
* teléfono;
* email;
* nombre;

posteriormente, debe evaluarse qué información histórica del documento debe conservarse como snapshot.

---

# 50. Document snapshots

Una futura estrategia puede requerir que documentos como:

```text
Quote
SalesOrder
Invoice
```

conserven información comercial relevante tal como existía cuando fueron emitidos.

No todo documento debe depender eternamente del registro maestro actualizado.

---

# 51. Customer vs Organization

Healthcare y otras verticales requerirán distinguir un concepto organizacional más amplio.

Conceptualmente:

```text
Organization
```

puede representar una entidad del mundo real como:

* hospital;
* clínica;
* aseguradora;
* distribuidor;
* institución pública.

---

# 52. Customer no siempre equivale a Organization

Una Organization puede existir operacionalmente sin ser todavía un Customer.

Ejemplo:

```text
Hospital X
↓
Case occurs there
```

pero la contraparte comercial puede ser:

```text
Distributor Y
```

---

# 53. Organization puede asumir roles

Una evolución posible es:

```text
Organization
├── Customer role
├── Hospital role
├── Payer role
└── Supplier role
```

si el dominio real justifica un modelo común.

Este ADR/documento no decide todavía esa arquitectura.

---

# 54. No crear Organization todavía desde Customers

Aunque el concepto es importante, no debemos reemplazar inmediatamente Customer por una entidad genérica sin revisar:

* Suppliers;
* Healthcare;
* Billing;
* Contacts;
* migrations;
* APIs.

La separación conceptual se establece ahora para evitar errores futuros.

---

# 55. Customer vs Doctor

Regla Healthcare:

```text
Customer
≠
Doctor
```

Un Doctor puede:

* solicitar un producto;
* participar en un Case;
* generar una oportunidad;
* trabajar en varios hospitales;

sin ser quien compra o paga.

---

# 56. Doctor que también compra

Es posible que en ciertos negocios un Doctor pueda actuar además como Customer.

Eso debe representarse como dos roles reales.

No significa que todas las entidades Doctor deban convertirse en Customers.

---

# 57. Customer vs Hospital

También:

```text
Customer
≠
Hospital
```

El hospital puede ser:

* lugar del procedimiento;
* comprador;
* pagador;
* ninguno de los anteriores;

según la operación.

---

# 58. Hospital como Customer

En una operación determinada:

```text
Hospital ABC
```

puede ser la contraparte comercial.

En ese caso puede existir una relación correspondiente con Customer.

Pero no debe asumirse globalmente:

```text
Hospital
=
Customer
```

---

# 59. Customer vs Payer

Otra distinción fundamental:

```text
Customer
≠
Payer
```

La entidad que recibe o solicita el producto puede no ser quien finalmente paga.

---

# 60. Ejemplo Healthcare

Puede existir:

```text
Doctor
Dr. López

Hospital
Hospital Central

Customer
Distribuidora ABC

Payer
Aseguradora XYZ
```

dentro del contexto ampliado de una operación.

---

# 61. No inferir pagador

Zaping no debe asumir automáticamente:

```text
customerId
=
payerId
```

cuando Billing soporte múltiples responsables económicos.

---

# 62. Case

Healthcare Case puede relacionarse con Customer cuando exista contexto comercial.

Pero Case no debe requerir Customer en todos los escenarios si la operación comienza antes de conocer la contraparte comercial.

---

# 63. Opportunity antes de Customer definitivo

Un flujo Healthcare puede ser:

```text
Doctor contact
↓
Opportunity
↓
Case
↓
Commercial responsibility resolved
↓
Customer / Payer
```

Esto permite que la operación real ocurra sin inventar prematuramente un Customer.

---

# 64. Direct Sales

Fuera de Healthcare, el flujo continúa siendo simple:

```text
Customer
↓
SalesOrder
↓
Delivery
```

No debe requerirse Hospital, Doctor o Case.

---

# 65. CustomerSelector

`CustomerSelector` es un Business Component implementado.

Permite localizar clientes dentro de workflows comerciales.

---

# 66. Arquitectura de CustomerSelector

```text
Quote / SalesOrder
↓
CustomerSelector
↓
Customer
```

El componente no es propietario de las reglas de Customer.

---

# 67. Búsqueda

CustomerSelector debe evolucionar para localizar clientes mediante información útil como:

```text
name
contactName
email
```

y posteriormente:

* RFC;
* código;
* organización;

cuando esos campos existan.

---

# 68. Clientes inactivos en selector

Normalmente:

```text
Customer.isActive = false
```

debe excluirlo de nuevas operaciones.

La documentación histórica continúa mostrándolo donde ya exista relación.

---

# 69. Creación contextual

Una de las capacidades UX más útiles es:

```text
New Quote
↓
CustomerSelector
↓
Customer not found
↓
Create Customer
↓
Select new Customer
↓
Continue Quote
```

---

# 70. Preservar formulario

La creación contextual no debe provocar pérdida de:

* items;
* cantidades;
* precios;
* notas;
* contexto comercial.

---

# 71. Formulario actual

La UI puede organizar información mediante secciones como:

```text
General
Contacto
Dirección
Crédito
Notas
```

cuando el número de campos lo justifique.

---

# 72. General

Puede contener:

```text
Nombre
Tipo
Estado
```

---

# 73. Contacto

Puede contener:

```text
Contacto
Email
Teléfono
```

---

# 74. Dirección

Actualmente representa principalmente:

```text
address
```

sin afirmar todavía soporte de múltiples direcciones.

---

# 75. Crédito

Puede contener:

```text
creditLimit
```

dejando claro que el módulo aún no tiene un motor completo de crédito.

---

# 76. Listado

La tabla principal debe priorizar información reconocible.

Ejemplo:

```text
Cliente
Contacto
Email
Teléfono
Estado
Acciones
```

Los campos exactos pueden evolucionar según la experiencia.

---

# 77. Customer 360

La arquitectura objetivo contempla:

```text
Customer 360
```

como una vista contextual importante.

---

# 78. Objetivo de Customer 360

Debe responder:

```text
¿Quién es?
¿Está activo?
¿Cómo lo contacto?
¿Qué le hemos cotizado?
¿Qué ha comprado?
¿Qué entregas tiene?
¿Qué documentos existen?
¿Qué necesita atención?
```

---

# 79. Estructura conceptual

Una evolución posible:

```text
General
Cotizaciones
Pedidos
Entregas
Facturación
Actividad
Documentos
Historial
```

No todas las secciones necesitan existir en el primer release.

---

# 80. Customer 360 no absorbe Sales

La vista consume datos de otros dominios.

No convierte Customers en propietario de:

* Quote;
* SalesOrder;
* Delivery;
* Invoice.

---

# 81. Métricas comerciales

En el futuro Customer 360 puede mostrar:

```text
Ventas acumuladas
Última compra
Cotizaciones abiertas
Saldo
Pedidos pendientes
```

cuando existan fuentes confiables.

---

# 82. No inventar métricas

No mostrar conceptos como:

```text
Customer profitability
```

o:

```text
payment risk
```

si Zaping todavía no cuenta con los datos y reglas para calcularlos correctamente.

---

# 83. API

El módulo utiliza conceptualmente:

```text
GET    /customers
GET    /customers/:id
POST   /customers
PATCH  /customers/:id
```

La implementación técnica vigente debe verificarse en el backend.

---

# 84. DELETE legacy

Si actualmente existe:

```text
DELETE /customers/:id
```

debe revisarse para determinar si:

* desactiva;
* elimina físicamente;
* o debe sustituirse.

No debe describirse automáticamente como Soft Delete.

---

# 85. Lifecycle API objetivo

Para desactivación puede preferirse:

```text
PATCH /customers/:id

{
  "isActive": false
}
```

o una acción explícita equivalente.

---

# 86. Create Customer

El backend debe obtener:

```text
companyId
```

del contexto autenticado.

No debe confiar en un valor de tenant enviado libremente por frontend.

---

# 87. Update Customer

La operación puede actualizar campos maestros permitidos.

No debe permitir Mass Assignment de:

```text
companyId
createdAt
internal relations
```

u otros campos no autorizados.

---

# 88. Tenant isolation

Debe impedirse:

```text
Company A user
↓
GET Customer Company B
```

y:

```text
Company A user
↓
PATCH Customer Company B
```

---

# 89. Customer relacionado en Quote

Al crear Quote, backend debe validar:

```text
Customer exists
AND
Customer belongs to Company
```

y, cuando aplique:

```text
Customer is active
```

---

# 90. Customer relacionado en SalesOrder

La misma regla se aplica al flujo comercial objetivo.

Frontend no constituye autoridad suficiente.

---

# 91. RBAC

Permisos conceptuales futuros:

```text
customers.read
customers.create
customers.update
customers.deactivate
```

La implementación granular seguirá ADR-007.

---

# 92. Credit permissions

En etapas futuras puede tener sentido separar:

```text
customers.update
```

de:

```text
customers.credit.update
```

si modificar límites de crédito se convierte en una operación sensible.

No se requiere todavía.

---

# 93. Auditoría

Eventos relevantes pueden incluir:

```text
Customer created
Customer updated
Customer deactivated
Customer reactivated
Credit limit changed
```

cuando exista auditoría suficiente.

---

# 94. Privacidad

Customer contiene información empresarial y posiblemente datos de contacto de personas.

Deben aplicarse:

* minimización;
* autorización;
* tenant isolation;
* exposición limitada.

---

# 95. Datos personales

Campos como:

```text
contactName
email
phone
```

pueden representar información personal.

No deben utilizarse fuera del propósito empresarial sin necesidad.

---

# 96. Healthcare privacy

Customer no debe convertirse en un lugar para almacenar:

* diagnóstico;
* expediente médico;
* historia clínica;
* datos del paciente.

Healthcare debe seguir la política de minimización definida en `SECURITY_PRINCIPLES.md`.

---

# 97. Patient

Zaping no necesita actualmente:

```text
Customer = Patient
```

ni un Patient master para resolver sus procesos comerciales/logísticos.

Si algún proceso futuro requiere información de paciente, deberá evaluarse específicamente debido a su sensibilidad.

---

# 98. Importación

Customers es una entidad prioritaria para Data Import.

Debe soportarse posteriormente:

```text
CSV / XLSX
↓
Mapping
↓
Validation
↓
Duplicate analysis
↓
Import
```

---

# 99. Migraciones

Al importar desde sistemas como:

```text
CONTPAQi
Aspel
Microsip
Odoo
SAP
Excel
```

puede existir información como:

* código externo;
* razón social;
* RFC;
* crédito;
* contactos;
* direcciones.

La estrategia debe mapearla explícitamente.

---

# 100. External customer code

Muchos ERP utilizan un código de cliente.

El modelo actual no documenta uno como campo oficial.

Si los clientes reales lo requieren, debe añadirse deliberadamente en lugar de reutilizar UUID o `type`.

---

# 101. Customer Portal

En el futuro Customer 360 interno y Customer Portal externo son experiencias diferentes.

```text
Customer 360
→ usuarios internos

Customer Portal
→ usuarios externos autorizados
```

No deben confundirse.

---

# 102. Portal capabilities futuras

El portal puede permitir:

```text
Quotes
Sales Orders
Deliveries
Invoices
Documents
```

según permisos y alcance.

El Customer master continúa siendo la contraparte empresarial.

---

# 103. Dashboard

Dashboard puede consumir información de Customers como:

```text
total customers
active customers
recent customers
sales by customer
```

cuando sea útil.

No debe convertirse en propietario de Customers.

---

# 104. Sales analytics

Métricas como:

```text
Top Customers
Sales by Customer
Customer inactivity
```

deben derivarse de operaciones comerciales reales.

No deben almacenarse manualmente en Customer.

---

# 105. AI futura

Una capa de inteligencia podría identificar:

```text
Este cliente lleva 90 días sin comprar.
```

o:

```text
Las compras de este cliente han disminuido 30 %.
```

pero solo cuando exista suficiente historial confiable.

---

# 106. Customer Value

Una futura segmentación puede considerar:

* facturación;
* frecuencia;
* margen;
* recurrencia;
* productos;
* comportamiento.

No debe introducirse un campo manual genérico como:

```text
customerValue = HIGH
```

sin un modelo definido.

---

# 107. Estado CURRENT

El modelo consolidado actual contempla:

```text
Customer
companyId
name
type
email
phone
address
contactName
creditLimit
notes
isActive
Quote relationship
legacy Sale relationship
CustomerSelector
CRUD UI
```

La implementación exacta continúa verificándose en código.

---

# 108. Estado TARGET

Evolución aprobada:

```text
Correct active/inactive lifecycle
Customer 360
Improved searchable selection
Contextual creation
Audit improvements
SalesOrder integration
OpenAPI documentation
Import support
Clear commercial identity
```

---

# 109. Estado FUTURE

Posibilidades posteriores:

```text
Fiscal Profile
Multiple Contacts
Multiple Addresses
Customer Code
Credit Management
Accounts Receivable
Payment Terms
Price Lists
Customer Segmentation
Customer Portal
Documents
Advanced Analytics
AI Recommendations
```

No constituyen alcance inmediato.

---

# 110. Invariantes

```text
Customer
→ belongs to one Company
```

```text
Customer companyId
→ comes from authenticated tenant
```

```text
Inactive Customer
→ remains historically visible
```

```text
Inactive Customer
→ normally unavailable for new commercial operations
```

```text
Customer deactivation
→ does not delete Quotes or Sales
```

```text
Customer
≠
Doctor
```

```text
Customer
≠
Hospital
```

```text
Customer
≠
Payer
```

```text
Customer.email
≠
User login identity
```

```text
creditLimit
≠
complete credit engine
```

---

# 111. Anti-patrones

## Universal Soft Delete

Asumir:

```text
DELETE Customer
→ deletedAt
```

cuando el modelo no posee esa estrategia.

---

## Fake Tax Identifier Rule

Documentar unicidad de RFC/tax ID cuando el campo ni siquiera existe.

---

## Customer = Hospital

Utilizar Customer como sustituto obligatorio de Hospital en Healthcare.

---

## Customer = Doctor

Crear Doctors dentro de Customers únicamente para evitar modelar el dominio correspondiente.

---

## Customer = Payer

Asumir que quien compra, recibe y paga siempre es la misma entidad.

---

## Contact = User

Utilizar el email de contacto como credencial automática.

---

## Credit Limit = Available Credit

Bloquear ventas mediante una resta incompleta sin Accounts Receivable.

---

## Notes as Structured Model

Guardar fiscal, pago, Hospital, Payer y direcciones múltiples dentro de notes.

---

# 112. Relación con Quotes

```text
Customer
↓
Quote
```

Customer identifica la contraparte.

Quote conserva la propuesta.

---

# 113. Relación con Sales

Arquitectura objetivo:

```text
Customer
↓
SalesOrder
↓
Delivery
```

Cada capa conserva su responsabilidad.

---

# 114. Relación con Healthcare

Healthcare puede asociar contexto comercial con Customer cuando corresponda.

Pero mantiene separados:

```text
Doctor
Hospital
Customer
Payer
```

---

# 115. Relación con Billing

Billing utilizará Customer o la estructura comercial/fiscal correspondiente para generar documentos financieros.

La definición fiscal no pertenece completamente a Customers en este momento.

---

# 116. Relación con Business Components

`CustomerSelector` pertenece a:

```text
ux/BUSINESS_COMPONENTS.md
```

Customers proporciona el recurso.

CustomerSelector proporciona la experiencia reutilizable de selección.

---

# 117. Relación con Zaping Way

`Customer 360`, creación contextual y búsqueda deben reducir navegación sin alterar las fronteras del dominio.

---

# 118. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-004 — UUID.
* ADR-005 — Layered Architecture.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.
* ADR-011 — SalesOrder y Delivery.
* ADR-012 — Entity Lifecycle.
* ADR-013 — Inventory Custody & Case Logistics.

---

# 119. Documentos relacionados

```text
product/PRODUCT_REQUIREMENTS.md
product/ZAPING_WAY.md
architecture/ARCHITECTURE.md
engineering/API_GUIDELINES.md
engineering/SECURITY_PRINCIPLES.md
ux/BUSINESS_COMPONENTS.md
modules/erp/PRODUCTS.md
modules/erp/SUPPLIERS.md
```

Futuros documentos relacionados:

```text
modules/erp/QUOTES.md
modules/erp/SALES.md
modules/healthcare/HEALTHCARE.md
```

---

# 120. Fuente de verdad

```text
CUSTOMERS.md
→ reglas del catálogo de clientes

QUOTES / SALES
→ operaciones comerciales

Healthcare
→ Doctor / Hospital / Case

Billing
→ Payer / fiscal / financial behavior

schema.prisma
→ modelo técnico vigente

backend
→ implementación actual

tests
→ comportamiento validado

PROJECT_BOARD.md
→ estado del trabajo
```

---

# 121. Principio final

Customer debe responder una pregunta clara:

> **¿Quién es nuestra contraparte comercial?**

No debe convertirse en una entidad genérica donde se introduzca cualquier persona u organización relacionada con una operación.

La separación correcta es:

```text
Customer
→ relación comercial

Doctor
→ participante Healthcare

Hospital
→ contexto organizacional / lugar

Payer
→ responsabilidad económica
```

Estas funciones pueden coincidir en ciertos escenarios, pero Zaping no debe asumir que son equivalentes.

> **Modelar correctamente a quién vendemos es diferente de modelar dónde ocurre la operación, quién genera la demanda o quién finalmente paga.**
