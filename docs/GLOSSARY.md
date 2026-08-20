# Glosario — Zaping

**Producto:** Zaping
**Versión:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-19
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento define los términos oficiales utilizados dentro de Zaping.

Su objetivo es mantener un lenguaje consistente entre:

* producto;
* negocio;
* arquitectura;
* desarrollo;
* documentación;
* UX;
* Zaping ERP Core;
* Zaping Healthcare;
* Zaping Radar;
* y futuras integraciones.

Cuando exista ambigüedad sobre el significado de un término, este glosario debe utilizarse como referencia junto con la documentación específica del dominio.

Los nombres técnicos utilizados directamente en código pueden mantenerse en inglés.

---

# 2. Plataforma y producto

## Zaping

Plataforma empresarial SaaS, cloud-native y multiempresa.

Su objetivo es integrar gestión empresarial, verticales especializadas, inteligencia de negocio, información externa, integraciones y futuras capacidades de inteligencia artificial.

---

## Zaping Platform

Plataforma tecnológica y funcional compartida sobre la que operan los diferentes productos y verticales de Zaping.

---

## Zaping ERP Core

Núcleo empresarial genérico de Zaping.

Contiene capacidades reutilizables como:

* clientes;
* proveedores;
* productos;
* compras;
* recepciones;
* inventario;
* cotizaciones;
* ventas;
* entregas;
* devoluciones;
* usuarios;
* permisos;
* y auditoría.

Debe mantenerse tan independiente de industrias específicas como sea razonablemente posible.

---

## Zaping Healthcare

Primera vertical especializada de Zaping.

Está orientada a empresas relacionadas con distribución de suministros, dispositivos y equipos médicos.

Incluye conceptos como:

* médicos;
* hospitales;
* Cases;
* calendario;
* técnicos;
* maletines;
* custodia;
* equipo reutilizable;
* retornos;
* conciliación;
* pagadores;
* y aseguradoras.

No representa un expediente clínico electrónico.

---

## Zaping Radar

Producto de inteligencia externa orientado a identificar y organizar información relevante fuera de la operación interna.

Ejemplos:

* licitaciones;
* oportunidades;
* regulaciones;
* alertas;
* fechas límite;
* inteligencia de mercado.

---

## Zaping AI

Futura capa inteligente del ecosistema.

Su función será analizar información confiable generada por otros dominios y producir:

* análisis;
* alertas;
* recomendaciones;
* predicciones;
* y asistencia mediante lenguaje natural.

No debe convertirse en la fuente primaria de información empresarial.

---

## Vertical

Conjunto de capacidades especializadas para una industria determinada construido sobre Zaping ERP Core.

Ejemplo:

**Zaping Healthcare.**

Una vertical reutiliza capacidades del Core sin duplicarlas innecesariamente.

---

# 3. Multi-tenancy y organización

## Company

Entidad empresarial que utiliza Zaping.

Cada `Company` representa un tenant independiente.

Una Company es propietaria de su información empresarial.

---

## Tenant

Espacio lógico aislado perteneciente a una Company dentro de la plataforma multiempresa.

Los datos de un tenant no deben ser accesibles desde otro tenant.

---

## Multi-tenancy

Arquitectura mediante la cual una misma plataforma atiende múltiples empresas manteniendo aislamiento lógico entre sus datos.

---

## companyId

Identificador utilizado para relacionar información empresarial con la Company a la que pertenece.

Debe obtenerse o validarse utilizando el contexto autenticado cuando corresponda.

No debe confiarse únicamente en un `companyId` recibido desde frontend.

---

## Organization

Concepto empresarial general para representar una organización que puede desempeñar diferentes funciones.

Ejemplos futuros:

* cliente;
* hospital;
* aseguradora;
* pagador;
* proveedor.

Su incorporación definitiva al modelo de datos todavía requiere una decisión arquitectónica específica.

---

# 4. Usuarios y seguridad

## User

Persona autenticable dentro de Zaping.

Un User pertenece a una Company y puede recibir roles o permisos.

---

## Authentication

Proceso mediante el cual el sistema verifica la identidad de un usuario.

Actualmente Zaping utiliza JWT como parte de este mecanismo.

---

## Authorization

Proceso mediante el cual el sistema determina qué operaciones puede realizar un usuario autenticado.

---

## Role

Conjunto de permisos agrupados para facilitar la administración de accesos.

Ejemplos posibles:

* Administrator;
* Warehouse;
* Sales;
* Technician.

---

## Permission

Autorización granular para ejecutar una acción determinada.

Ejemplo conceptual:

```text
inventory.adjust
purchases.approve
cases.assign
```

---

## RBAC

**Role-Based Access Control.**

Modelo de autorización basado en roles y permisos.

---

## JWT

**JSON Web Token.**

Token firmado utilizado actualmente para representar el contexto autenticado de un usuario.

Un JWT firmado no implica que su contenido esté cifrado.

---

## Audit

Registro permanente o suficientemente durable de acciones relevantes del negocio.

Debe permitir identificar, según corresponda:

* quién;
* qué;
* cuándo;
* sobre qué entidad;
* y qué cambio ocurrió.

---

## Soft Delete

Estrategia de eliminación lógica en la que un registro deja de considerarse activo sin destruir inmediatamente su historia.

Puede implementarse mediante campos como:

```text
deletedAt
```

o mecanismos equivalentes.

No todas las entidades requieren Soft Delete.

---

# 5. Clientes, contactos y proveedores

## Customer

Persona u organización con la que existe una relación comercial como cliente.

Un Customer no debe asumirse automáticamente como:

* hospital;
* pagador;
* aseguradora;
* o médico.

---

## Contact

Persona relacionada con una organización o proceso empresarial.

Ejemplos:

* comprador;
* administrador;
* médico;
* contacto de hospital.

Un Contact no es necesariamente un usuario autenticable.

---

## Supplier

Organización que suministra productos o servicios a la empresa.

Se relaciona principalmente con el dominio de Compras.

---

# 6. Productos

## Product

Artículo administrado por Zaping.

Puede ser:

* consumible;
* vendible;
* trazable por lote;
* trazable por serie;
* sujeto a caducidad;
* o posteriormente relacionado con equipo especializado.

---

## SKU

**Stock Keeping Unit.**

Clave interna utilizada para identificar un producto dentro de la empresa.

---

## Barcode

Código de barras asociado a un producto o unidad.

Su uso avanzado forma parte de etapas posteriores del producto.

---

## Category

Clasificación utilizada para organizar productos.

Pertenece a una Company.

---

## Business Code

Identificador legible utilizado en documentos o entidades de negocio.

Ejemplos:

```text
CAS-000281
MAL-000128
OC-000421
```

El UUID continúa siendo el identificador técnico principal cuando corresponda.

---

# 7. Compras

## Purchase

Orden o transacción de abastecimiento realizada con un Supplier.

Representa un compromiso de compra.

### Regla

> Una Purchase no incrementa inventario por sí sola.

El inventario se incrementa cuando existe una recepción física confirmada.

---

## Purchase Item

Línea de una Purchase.

Normalmente identifica:

* producto;
* cantidad ordenada;
* costo;
* subtotal;
* y otra información comercial.

---

## Purchase Receipt

Recepción física de mercancía asociada a una Purchase.

Puede ser total o parcial.

Una compra puede tener múltiples Purchase Receipts.

---

## Purchase Receipt Item

Artículo individual recibido dentro de una Purchase Receipt.

Puede contener:

* producto;
* cantidad recibida;
* lote;
* caducidad;
* serie;
* costo;
* y referencia al Purchase Item original.

---

## Pending Quantity

Cantidad de una Purchase que todavía no ha sido recibida.

Conceptualmente:

```text
Cantidad pendiente
=
Cantidad ordenada
-
Cantidad recibida
```

---

# 8. Inventario

## Inventory

Dominio responsable de las existencias y de las reglas relacionadas con sus movimientos.

Inventario no debe entenderse únicamente como un número editable.

La existencia debe ser consecuencia de operaciones trazables.

---

## Stock

Cantidad de producto existente bajo una condición determinada.

Dependiendo de la evolución del sistema puede distinguirse entre:

* disponible en almacén;
* bajo custodia;
* reservado;
* en mantenimiento;
* no disponible;
* u otros estados.

---

## Inventory Movement

Evento trazable que modifica o representa un cambio relevante en el inventario.

Debe registrar contexto suficiente para identificar su origen.

Ejemplos:

* recepción;
* entrega;
* ajuste;
* devolución;
* consumo.

Los movimientos confirmados no deben reescribirse arbitrariamente.

---

## Inventory Adjustment

Corrección controlada de inventario.

Debe:

* requerir motivo;
* identificar al usuario;
* registrar fecha;
* y generar trazabilidad.

No significa editar directamente `stock`.

---

## IN

Movimiento definitivo o reconocido como entrada de existencias al contexto correspondiente.

Ejemplo:

una Purchase Receipt confirmada.

---

## OUT

Salida definitiva de existencias cuando el producto deja de estar disponible como propiedad o inventario utilizable de la empresa según la regla del dominio.

Ejemplo:

una Delivery confirmada hacia el cliente.

Una salida temporal a Case no debe confundirse automáticamente con un OUT comercial definitivo.

---

## Lot

Lote de fabricación o agrupación utilizada para trazabilidad.

Puede contener:

* número de lote;
* producto;
* cantidad;
* fecha de caducidad;
* origen;
* historial.

---

## Serial Number

Identificador único de una unidad física específica.

Utilizado cuando el producto requiere trazabilidad individual.

---

## Expiration Date

Fecha después de la cual un producto no debe considerarse normalmente disponible para utilización o venta.

Las reglas exactas dependen del producto y dominio.

---

## FEFO

**First Expired, First Out.**

Estrategia de selección de inventario donde se prioriza el producto cuya caducidad ocurrirá primero.

Forma parte de la evolución de trazabilidad avanzada.

---

## Physical Stock

Cantidad físicamente propiedad de la empresa dentro de los estados o ubicaciones reconocidos por el modelo.

No debe confundirse necesariamente con stock disponible para venta.

---

## Available Stock

Cantidad que puede utilizarse inmediatamente para una operación determinada.

En el futuro puede considerar factores como:

* reservas;
* caducidad;
* ubicación;
* custodia;
* y estado.

La fórmula definitiva depende del modelo de inventario que sea aprobado.

---

## Reserved Stock

Cantidad comprometida para una operación futura pero todavía no entregada.

Capacidad prevista para una etapa posterior.

No debe considerarse implementada mientras no exista su funcionalidad formal.

---

## Custody

Responsabilidad temporal sobre material o equipo que continúa siendo propiedad de la empresa.

Ejemplo:

```text
Almacén
→ Técnico
→ Case
```

El cambio de custodia no implica necesariamente una venta.

---

# 9. Cotizaciones, ventas y entregas

## Quote

Propuesta comercial enviada a un Customer.

Puede convertirse posteriormente en una operación comercial.

### Regla

> Una Quote no modifica inventario.

---

## Sales Order

Compromiso comercial para vender productos o servicios.

Puede originarse desde:

* una Quote;
* venta directa;
* o posteriormente un Case.

### Regla

> Confirmar una Sales Order no significa que el producto haya salido físicamente.

---

## Sale

Concepto comercial relacionado con la venta de productos o servicios.

En la arquitectura objetivo, la venta comercial debe distinguirse del evento físico de entrega.

La terminología definitiva entre `Sale` y `SalesOrder` deberá mantenerse consistente con el módulo de Sales cuando éste sea actualizado.

---

## Delivery

Evento que representa la entrega física definitiva de productos.

Puede ser:

* completa;
* parcial;
* local;
* recolectada;
* o enviada.

### Regla

> La Delivery es el evento que puede provocar una salida definitiva de inventario.

---

## Shipment

Modalidad de Delivery donde los productos son enviados a un destino mediante transporte o paquetería.

Puede incorporar posteriormente:

* guía;
* transportista;
* fecha de envío;
* estado;
* entrega.

---

## Return

Operación mediante la cual productos previamente entregados regresan.

Debe relacionarse con la operación original y preservar trazabilidad.

Una devolución no debe implementarse simplemente incrementando manualmente el stock.

---

## Invoice

Documento fiscal o comercial utilizado para facturar una operación.

Debe mantenerse conceptualmente separado de:

* Case;
* Sales Order;
* Delivery.

Puede emitirse antes o después de una entrega o procedimiento dependiendo del proceso comercial.

---

## Payer

Organización o entidad responsable de cubrir total o parcialmente una obligación comercial.

Puede ser diferente del Customer, Hospital o lugar donde ocurrió un procedimiento.

---

## Insurer

Aseguradora que puede actuar como Payer dentro de un proceso Healthcare.

---

## Billing Responsibility

Relación que representa quién tiene responsabilidad sobre un importe facturable.

Su modelo definitivo deberá formalizarse antes de implementación.

---

# 10. Zaping Healthcare

## Doctor

Profesional médico relacionado con oportunidades o Cases.

No debe asumirse automáticamente como:

* Customer;
* User;
* ni Payer.

Puede estar relacionado con múltiples hospitales.

---

## Hospital

Institución donde puede realizarse un procedimiento o con la que existe una relación comercial.

Un Hospital no debe asumirse automáticamente como quien paga la operación.

---

## Technician

Usuario interno que puede participar en operaciones Healthcare.

Dependiendo de su responsabilidad puede actuar como:

* técnico de soporte;
* responsable de Case;
* custodio de material/equipo;
* o participante comercial.

---

## Opportunity

Posibilidad comercial identificada antes de una venta o Case.

Puede originarse por:

* solicitud directa;
* prospección;
* u otros canales que se definan posteriormente.

Una Opportunity puede terminar en:

* Quote;
* Sales Order;
* Case;
* o cierre sin venta.

---

## Case

Procedimiento o evento operativo Healthcare que requiere coordinación.

Puede relacionarse con:

* hospital;
* médico;
* técnico;
* fecha;
* horario;
* material;
* equipo;
* maletines;
* oportunidades;
* ventas;
* y pagadores.

Una venta puede existir sin Case.

---

## Case Calendar

Vista operacional que presenta los Cases programados en un calendario.

No es una fuente independiente de agenda.

Las fechas pertenecen al Case.

---

## Case Preparation

Proceso mediante el cual se determinan y preparan los recursos necesarios para un Case.

Puede involucrar:

* productos;
* lotes;
* series;
* material de apoyo;
* equipo;
* y maletines.

---

## Kit Template

Configuración reutilizable que define qué artículos suelen requerirse para determinado procedimiento.

No representa inventario físico.

---

## Case Kit

Conjunto real de materiales y/o equipos preparados para un Case específico.

También puede representarse en la interfaz como:

**Maletín de caso.**

---

## Case Dispatch

Operación mediante la cual material o equipo es entregado desde almacén para un Case.

Debe registrar:

* Case;
* técnico responsable;
* artículos;
* cantidades;
* lotes;
* series;
* fecha;
* y usuario que entrega.

### Regla

> Case Dispatch representa una salida temporal o cambio de custodia, no necesariamente una venta.

---

## Case Return

Operación mediante la cual material o equipo entregado para un Case regresa al almacén.

Debe estar relacionada con la salida original.

---

## Inspection

Revisión realizada al recibir material o equipo retornado.

Puede determinar condiciones como:

* correcto;
* dañado;
* incompleto;
* no utilizable;
* requiere revisión.

---

## Reconciliation

Proceso de conciliación entre lo que salió a un Case y lo que finalmente ocurrió.

Compara:

```text
Entregado
vs.
Utilizado
vs.
Retornado
vs.
Pendiente
```

Las diferencias deben resolverse o registrarse mediante una incidencia.

---

## Used Material

Material utilizado durante un Case.

Puede generar posteriormente:

* Delivery;
* Sale;
* Inventory OUT;
* y facturación.

---

## Reusable Equipment

Equipo propiedad de la empresa utilizado temporalmente en operaciones.

Ejemplos:

* programadores;
* consolas;
* cables;
* instrumental;
* equipos de apoyo.

Su utilización no representa una venta.

---

## Equipment Asset

Unidad física identificable de equipo reutilizable.

Puede contener:

* código;
* modelo;
* número de serie;
* estado;
* condición;
* custodio;
* Case actual;
* historial.

---

## Incident

Diferencia o problema detectado durante una operación Healthcare.

Ejemplos:

* material faltante;
* equipo dañado;
* retorno incompleto;
* diferencia no conciliada.

---

# 11. UX y diseño

## Zaping Way

Conjunto de principios que define cómo debe sentirse y funcionar la experiencia de Zaping.

Principios centrales:

* simple por defecto;
* complejidad bajo demanda;
* contexto antes que navegación;
* consistencia;
* orientación a tareas;
* datos → contexto → acción.

---

## Design System

Sistema de reglas y elementos visuales reutilizables.

Incluye conceptos como:

* colores;
* tipografía;
* espaciado;
* iconografía;
* componentes;
* estados.

---

## Design Token

Valor visual reutilizable del Design System.

Ejemplos:

* color;
* tamaño;
* espacio;
* radio;
* tipografía.

---

## UI Component

Componente visual reutilizable sin conocimiento específico de negocio.

Ejemplos:

```text
Button
Modal
Input
Table
Badge
```

---

## Business Component

Componente reutilizable que incorpora significado o comportamiento empresarial.

Ejemplos:

```text
StatusBadge
ProductSelector
CustomerSelector
SupplierSelector
```

---

## Feature

Capacidad o workflow funcional compuesto por uno o varios componentes.

---

## Page

Ruta o pantalla responsable de componer una experiencia de usuario.

No debe convertirse en el lugar principal para reglas complejas de negocio.

---

## 360 View

Patrón de experiencia para presentar en un único contexto la información relacionada con una entidad.

Ejemplos:

* Product 360;
* Purchase 360;
* Receipt 360;
* Sale 360;
* Case 360;
* Equipment 360.

---

## Workspace

Experiencia orientada a tareas que combina información proveniente de uno o varios dominios.

Ejemplo:

**Warehouse Operations.**

Un Workspace no necesariamente representa un módulo backend independiente.

---

## Warehouse Operations

Experiencia orientada al trabajo diario del almacén.

Puede combinar tareas como:

* compras por recibir;
* Cases por preparar;
* maletines por entregar;
* retornos;
* pedidos;
* envíos.

Utiliza dominios existentes en lugar de duplicar su lógica.

---

# 12. Arquitectura

## Module

Capacidad empresarial con responsabilidad y límites definidos.

Ejemplos:

* Inventory;
* Purchases;
* Sales;
* Healthcare.

---

## Modular Monolith

Estilo arquitectónico actual de Zaping.

La aplicación se despliega como una unidad principal pero mantiene módulos internos con responsabilidades claramente separadas.

---

## Controller

Componente backend responsable principalmente de:

* recibir requests HTTP;
* resolver parámetros;
* aplicar Guards/decoradores;
* delegar al Service;
* devolver respuestas.

No debe contener reglas complejas de negocio.

---

## Service

Componente que coordina casos de uso y reglas de negocio.

Puede interactuar con persistencia u otros dominios mediante contratos permitidos.

---

## Repository

Capa opcional dedicada principalmente al acceso y persistencia de datos.

Debe utilizarse cuando mejora separación, claridad o testabilidad.

No todos los módulos requieren obligatoriamente un Repository independiente.

---

## DTO

**Data Transfer Object.**

Objeto utilizado para definir, transportar y validar información entre límites de la aplicación.

---

## Entity

Objeto de dominio o persistencia que representa un concepto empresarial identificable.

Su definición exacta depende de la capa en la que se utilice el término.

---

## API

Interfaz mediante la cual capacidades del sistema pueden ser consumidas por otros clientes o sistemas.

---

## REST

Estilo utilizado actualmente para las APIs HTTP principales de Zaping.

---

## API First

Principio mediante el cual las capacidades de negocio se diseñan para poder ser utilizadas mediante contratos de API y no únicamente desde una interfaz específica.

---

## UUID

Identificador universalmente único utilizado como estrategia principal para identificar entidades.

La dificultad de adivinar un UUID no sustituye los controles de autorización.

---

## ADR

**Architecture Decision Record.**

Documento que registra una decisión arquitectónica relevante.

Debe contener al menos:

* contexto;
* decisión;
* alternativas;
* consecuencias;
* estado.

---

## Superseded

Estado de un ADR o decisión que fue válida históricamente pero posteriormente fue reemplazada por una nueva decisión.

Un ADR reemplazado no debe eliminarse.

---

## RFC

**Request for Comments.**

Documento opcional utilizado para discutir una propuesta antes de adoptarla formalmente.

No toda decisión necesita un RFC.

---

## Domain Event

Representación de un evento significativo ocurrido dentro del dominio.

Ejemplos conceptuales futuros:

```text
PurchaseReceived
CaseReconciled
DeliveryConfirmed
```

Zaping está preparado conceptualmente para utilizar eventos cuando aporten valor, pero no requiere una arquitectura event-driven distribuida para su etapa actual.

---

# 13. Datos y persistencia

## Prisma

ORM utilizado actualmente por Zaping para interactuar con PostgreSQL.

---

## PostgreSQL

Sistema de base de datos relacional principal de Zaping.

---

## Migration

Cambio versionado del esquema de base de datos.

Debe ser reproducible y preservar integridad de los datos existentes.

---

## Transaction

Conjunto de operaciones de base de datos que deben confirmarse o revertirse como una única unidad.

Ejemplo:

```text
Purchase Receipt
+
Receipt Items
+
Inventory Batch
+
Inventory Movement
+
Stock
```

---

## Constraint

Regla aplicada a la base de datos para proteger integridad.

Ejemplos:

* unique;
* foreign key;
* not null.

---

## Index

Estructura utilizada para mejorar el rendimiento de determinadas consultas.

Debe añadirse cuando exista una necesidad justificada.

---

# 14. Desarrollo y calidad

## Documentation First

Principio mediante el cual los cambios relevantes se comprenden y documentan antes de ser implementados.

No significa crear documentos innecesarios.

---

## Business First

Principio según el cual las reglas del negocio deben dirigir el diseño técnico.

---

## Definition of Ready

Condiciones mínimas que indican que una funcionalidad está suficientemente comprendida para comenzar implementación.

---

## Definition of Done

Condiciones que deben cumplirse para considerar una funcionalidad realmente terminada.

Puede incluir, según el cambio:

* implementación;
* seguridad;
* pruebas;
* lint;
* build;
* migraciones;
* UX;
* documentación.

---

## Quality Gate

Control aplicado antes de aprobar una implementación.

Su profundidad depende del riesgo del cambio.

---

## P0

Prioridad crítica para completar y estabilizar Zaping ERP Core.

---

## P1

Prioridad estratégica inmediatamente posterior al Core.

Incluye principalmente diferenciadores necesarios para adopción y Zaping Healthcare v1.

---

## P2

Capacidades de expansión que pueden implementarse después de estabilizar P0 y P1.

---

## Backlog

Lista de necesidades, mejoras o ideas pendientes que todavía no forman parte del alcance activo.

---

## Technical Debt

Solución provisional o limitación técnica conocida aceptada conscientemente.

Debe registrarse y no ocultarse.

---

# 15. Proyecto y documentación

## PRODUCT_VISION

Documento que define:

> qué queremos que Zaping llegue a ser.

---

## PRODUCT_REQUIREMENTS

Documento que define:

> qué debe ser capaz de hacer Zaping.

---

## ARCHITECTURE

Documento que define:

> cómo está estructurado técnicamente Zaping.

---

## ZAPING_WAY

Documento que define:

> cómo debe funcionar y sentirse la experiencia de Zaping.

---

## PROJECT_BOARD

Fuente de verdad del trabajo operativo actual.

Responde:

> ¿qué estamos haciendo ahora?

---

## ROADMAP

Documento que define dirección y prioridades futuras.

Responde:

> ¿qué construiremos después?

---

## CHANGELOG

Registro de cambios completados y releases relevantes.

Responde:

> ¿qué cambió?

---

# 16. Regla de actualización

Cuando un nuevo concepto pase a formar parte oficial del dominio de Zaping debe evaluarse su inclusión en este glosario.

No es necesario incorporar:

* nombres de variables triviales;
* componentes temporales;
* términos obvios de librerías;
* detalles internos sin significado empresarial.

El glosario debe permanecer útil y legible.

---

# 17. Principio final

Zaping debe utilizar el mismo lenguaje para:

```text
Negocio
↓
Producto
↓
Documentación
↓
Interfaz
↓
Código
```

Cuando el negocio, la documentación y el código utilizan términos diferentes para el mismo concepto, aumenta el riesgo de errores.

El objetivo de este glosario es reducir esa ambigüedad.
