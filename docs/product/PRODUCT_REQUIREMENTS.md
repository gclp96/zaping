# Requerimientos de Producto — Zaping

**Producto:** Zaping
**Versión del documento:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-20
**Responsable:** Zaping Team

---

# 1. Propósito del documento

Este documento define los requerimientos funcionales y no funcionales de Zaping, así como el alcance esperado de sus principales etapas de desarrollo.

Su objetivo es establecer una fuente de verdad para responder:

* qué problemas debe resolver Zaping;
* qué capacidades forman parte del producto;
* qué reglas de negocio deben respetarse;
* qué queda fuera de alcance en cada etapa;
* y qué condiciones deben cumplirse para considerar una versión lista para uso comercial.

Este documento complementa `PRODUCT_VISION.md`.

`PRODUCT_VISION.md` define hacia dónde va Zaping.

`PRODUCT_REQUIREMENTS.md` define qué debe ser capaz de hacer.

---

# 2. Resumen ejecutivo

Zaping es una plataforma empresarial SaaS, cloud-native y multiempresa orientada inicialmente a pequeñas y medianas empresas de distribución, con especialización inicial en el sector de suministros, dispositivos y equipos médicos.

La plataforma se estructura alrededor de:

* **Zaping ERP Core**, que proporciona las capacidades empresariales generales;
* **Zaping Healthcare**, como primera vertical especializada;
* **Zaping Radar**, como futura capa de inteligencia externa;
* y **Zaping AI**, como futura capa de inteligencia y recomendaciones.

El desarrollo debe priorizar primero un ERP Core confiable y comercializable.

Las capacidades especializadas deben construirse sobre ese núcleo sin duplicar sus responsabilidades.

---

# 3. Problema

Muchas pequeñas y medianas empresas continúan operando mediante:

* hojas de cálculo;
* software de escritorio heredado;
* documentos físicos;
* sistemas desconectados;
* procesos manuales;
* y conocimiento operativo que depende de personas específicas.

Esto genera problemas como:

* información fragmentada;
* duplicidad de captura;
* errores de inventario;
* baja trazabilidad;
* dificultad para conocer el origen de los movimientos;
* poca visibilidad de la operación en tiempo real;
* interfaces complejas;
* procesos administrativos lentos;
* dificultad para coordinar almacén, ventas y compras;
* y baja capacidad de análisis.

En empresas del sector médico aparecen además necesidades específicas como:

* lotes;
* caducidades;
* números de serie;
* procedimientos programados;
* material preparado para cirugías;
* equipo reutilizable;
* custodia por técnicos;
* salidas y retornos;
* aseguradoras;
* y conciliación de lo utilizado contra lo retornado.

Zaping debe resolver estos problemas mediante una plataforma moderna, integrada y trazable.

---

# 4. Objetivos del producto

Zaping debe permitir a las empresas:

* administrar clientes y contactos;
* administrar proveedores;
* administrar productos;
* gestionar compras;
* registrar recepciones;
* controlar inventario;
* mantener trazabilidad;
* generar cotizaciones;
* administrar ventas;
* registrar entregas;
* gestionar devoluciones;
* consultar indicadores;
* controlar usuarios y permisos;
* mantener auditoría;
* reducir trabajo manual;
* mejorar coordinación operacional;
* y tomar mejores decisiones.

Para empresas del sector salud, Zaping deberá además permitir coordinar procedimientos, técnicos, material, equipo, maletines, retornos y responsables de pago.

---

# 5. Alcance del producto

Zaping se divide conceptualmente en cuatro grandes capas.

## 5.1 Zaping ERP Core

Responsable de los procesos empresariales reutilizables entre industrias.

## 5.2 Zaping Healthcare

Responsable de procesos especializados del sector médico.

## 5.3 Zaping Radar

Responsable de información y oportunidades externas.

## 5.4 Zaping AI

Responsable de análisis y recomendaciones futuras.

ERP Core es la base del producto.

Healthcare, Radar y AI deben reutilizar sus capacidades mediante contratos bien definidos.

---

# 6. Usuarios objetivo

## 6.1 Propietario / Dirección

Necesita:

* visibilidad general del negocio;
* indicadores;
* alertas;
* ventas;
* compras;
* inventario;
* riesgos;
* y seguimiento operacional.

---

## 6.2 Administrador

Necesita:

* administrar usuarios;
* roles;
* permisos;
* configuración;
* catálogos;
* y operación general.

---

## 6.3 Vendedor / Ejecutivo comercial

Necesita:

* clientes;
* contactos;
* oportunidades;
* cotizaciones;
* ventas;
* seguimiento;
* y disponibilidad de productos.

---

## 6.4 Responsable de compras

Necesita:

* proveedores;
* órdenes de compra;
* recepción pendiente;
* costos;
* productos;
* y seguimiento de abastecimiento.

---

## 6.5 Responsable de almacén

Necesita:

* inventario confiable;
* recepciones;
* lotes;
* series;
* caducidades;
* movimientos;
* preparación de pedidos;
* preparación de casos;
* salidas;
* retornos;
* inspección;
* y pendientes operativos.

---

## 6.6 Técnico Healthcare

Necesita:

* casos asignados;
* calendario;
* hospital;
* médico;
* material requerido;
* equipo;
* maletines;
* custodia;
* retornos;
* y seguimiento de oportunidades cuando tenga responsabilidades comerciales.

---

# 7. Modelo de prioridades

Los requerimientos se clasifican utilizando cuatro niveles.

## P0 — Core requerido

Necesario para estabilizar y comercializar Zaping ERP Core.

## P1 — Diferenciación estratégica

Capacidades necesarias para la primera versión especializada de Zaping Healthcare y mejoras comerciales críticas.

## P2 — Expansión

Capacidades importantes que pueden incorporarse después de estabilizar P0 y P1.

## Futuro

Capacidades estratégicas que requieren mayor madurez del producto o suficientes datos operativos.

---

# 8. Requerimientos funcionales — ERP Core

# 8.1 Autenticación

**Prioridad:** P0

El sistema debe permitir:

* iniciar sesión;
* validar credenciales;
* generar sesiones seguras mediante JWT;
* obtener información del usuario autenticado;
* recuperar o restablecer contraseña;
* y proteger endpoints privados.

Las contraseñas nunca deben almacenarse ni devolverse en texto plano.

La respuesta de autenticación no debe exponer hashes de contraseña ni información sensible innecesaria.

---

# 8.2 Empresas y multiempresa

**Prioridad:** P0

Zaping debe operar bajo un modelo multiempresa.

Toda entidad empresarial debe pertenecer a una empresa mediante `companyId` cuando corresponda.

Un usuario no debe acceder a información perteneciente a otra empresa salvo que exista una capacidad futura explícita para ello.

El aislamiento multiempresa debe aplicarse tanto en interfaz como en backend.

---

# 8.3 Usuarios, roles y permisos

**Prioridad:** P0

El sistema debe permitir:

* usuarios;
* roles;
* permisos;
* asignación de roles;
* autorización por operación;
* y restricciones por empresa.

La arquitectura debe evolucionar progresivamente hacia permisos granulares.

Ejemplos futuros:

```text
inventory.adjust
purchases.approve
receipts.create
cases.assign
caseKits.prepare
caseKits.dispatch
billing.view
```

Los roles deben agrupar permisos.

---

# 8.4 Clientes

**Prioridad:** P0

El sistema debe permitir:

* crear clientes;
* consultar clientes;
* actualizar clientes;
* desactivar clientes;
* consultar historial relacionado;
* y asociar información comercial.

La eliminación destructiva debe evitarse cuando existan relaciones históricas.

---

# 8.5 Contactos

**Prioridad:** P1

Debe existir una forma consistente de representar personas relacionadas con organizaciones.

Esto permitirá posteriormente relacionar:

* compradores;
* responsables administrativos;
* médicos;
* contactos de hospitales;
* y otras personas.

Un contacto no debe confundirse necesariamente con un usuario del sistema.

---

# 8.6 Proveedores

**Prioridad:** P0

El sistema debe permitir:

* crear proveedores;
* consultar proveedores;
* actualizar proveedores;
* desactivar proveedores;
* registrar datos de contacto;
* registrar dirección;
* registrar notas;
* y utilizar proveedores en compras.

---

# 8.7 Productos

**Prioridad:** P0

El sistema debe permitir administrar productos con información como:

* SKU;
* nombre;
* descripción;
* marca;
* categoría;
* código de barras;
* costo;
* precio;
* stock mínimo;
* estado activo/inactivo.

El sistema debe soportar reglas de unicidad por empresa cuando corresponda.

El stock no debe modificarse directamente desde la edición del producto.

---

# 8.8 Categorías

**Prioridad:** P0

Debe permitirse:

* crear;
* consultar;
* actualizar;
* desactivar;
* y asignar categorías a productos.

Las categorías deben pertenecer a una empresa.

---

# 8.9 Compras

**Prioridad:** P0

El sistema debe permitir:

* crear órdenes de compra;
* seleccionar proveedor;
* agregar productos;
* cantidades;
* costos;
* subtotales;
* impuestos;
* totales;
* editar compras en estados permitidos;
* consultar detalle;
* confirmar o aprobar compras;
* y generar documentos asociados.

Una compra representa un compromiso de abastecimiento.

## Regla crítica

> Crear o aprobar una compra no debe aumentar el inventario.

El inventario cambia únicamente cuando existe una recepción física confirmada.

---

# 8.10 Recepciones de compra

**Prioridad:** P0

El sistema debe permitir:

* registrar una recepción contra una compra;
* recibir cantidades parciales;
* registrar varias recepciones para una misma compra;
* identificar el usuario que recibe;
* registrar fecha;
* notas;
* lote;
* caducidad;
* número de serie cuando corresponda;
* costo;
* y relación con el item de compra original.

Una recepción confirmada debe generar las operaciones necesarias de inventario de forma transaccional.

El sistema debe conocer:

```text
Cantidad ordenada
Cantidad recibida
Cantidad pendiente
```

La suma de las recepciones no debe superar la cantidad ordenada salvo que exista posteriormente una regla explícita que lo autorice.

---

# 8.11 Inventario

**Prioridad:** P0

Inventario es el propietario de las reglas relacionadas con existencias.

El sistema debe proporcionar:

* stock actual;
* movimientos;
* entradas;
* salidas;
* ajustes controlados;
* lote;
* caducidad;
* serie;
* stock mínimo;
* alertas;
* y trazabilidad.

## Regla crítica

> El stock es una consecuencia de operaciones trazables, no un dato que el usuario edita libremente.

---

# 8.12 Movimientos de inventario

**Prioridad:** P0

Todo cambio relevante en la existencia debe estar representado mediante un movimiento o evento equivalente trazable.

Cada movimiento debe poder identificar:

* empresa;
* producto;
* cantidad;
* tipo;
* fecha;
* origen;
* documento relacionado;
* usuario;
* lote;
* serie cuando aplique.

Los movimientos confirmados no deben reescribirse arbitrariamente.

Las correcciones deben realizarse mediante movimientos compensatorios o mecanismos equivalentes auditables.

---

# 8.13 Lotes y caducidades

**Prioridad:** P0

Para productos que lo requieran, el sistema debe permitir:

* número de lote;
* fecha de caducidad;
* cantidad disponible por lote;
* origen del lote;
* historial;
* y utilización posterior.

El sistema debe poder detectar:

* producto vencido;
* producto próximo a vencer;
* y disponibilidad válida.

Los productos vencidos no deben considerarse automáticamente disponibles para venta.

---

# 8.14 Números de serie

**Prioridad:** P1

Para productos serializados, Zaping debe permitir identificar unidades individuales.

Un número de serie debe poder rastrearse desde su recepción hasta su destino.

---

# 8.15 FEFO

**Prioridad:** P1

Para productos con caducidad, Zaping debe ser capaz de sugerir o aplicar reglas de salida basadas en:

**First Expired, First Out.**

La implementación deberá respetar excepciones operativas documentadas.

---

# 8.16 Cotizaciones

**Prioridad:** P0

El sistema debe permitir:

* crear cotizaciones;
* seleccionar cliente;
* agregar productos;
* cantidades;
* precios;
* impuestos;
* totales;
* estados;
* consulta;
* edición mientras sea válida;
* generación de documento;
* y conversión comercial posterior.

## Regla crítica

> Una cotización no mueve inventario.

---

# 8.17 Pedidos de venta

**Prioridad:** P0

Zaping debe evolucionar hacia un concepto explícito de `SalesOrder`.

Un pedido de venta representa un compromiso comercial.

Debe poder originarse desde:

* una cotización;
* una venta directa;
* o posteriormente un Case.

Debe contener:

* cliente;
* productos;
* cantidades;
* precios;
* impuestos;
* estado;
* y referencias comerciales.

## Regla crítica

> Confirmar una venta no significa necesariamente que el producto haya salido físicamente.

---

# 8.18 Entregas

**Prioridad:** P0

La salida física definitiva hacia un cliente debe estar representada mediante una entrega.

Una entrega puede soportar posteriormente modalidades como:

* entrega local;
* recolección;
* envío.

Debe ser posible realizar entregas parciales.

## Regla crítica

> La entrega física es el evento que debe provocar una salida definitiva de inventario cuando el producto deja de pertenecer a la empresa.

Para artículos por lote o serie, la asignación concreta debe realizarse como máximo al momento de la entrega.

---

# 8.19 Envíos

**Prioridad:** P1

Las entregas deben poder evolucionar para registrar envíos a otras ciudades.

Información futura posible:

* dirección;
* transportista;
* guía;
* fecha de salida;
* estado;
* fecha de entrega.

Las integraciones con paqueterías no forman parte del P0.

---

# 8.20 Devoluciones

**Prioridad:** P0/P1

El sistema debe permitir registrar devoluciones relacionadas con operaciones originales.

Una devolución debe preservar:

* producto;
* cantidad;
* lote;
* serie;
* cliente;
* documento original;
* motivo;
* usuario;
* fecha.

La devolución no debe implementarse simplemente incrementando manualmente el stock.

Debe generar una operación trazable.

Cuando el producto requiera inspección antes de regresar a disponibilidad, el sistema deberá permitir un estado intermedio.

---

# 8.21 Facturación

**Prioridad:** P1

Zaping debe prepararse para administrar o integrarse con facturación.

La facturación debe mantenerse conceptualmente separada de:

* venta;
* entrega;
* y Case.

Una factura puede emitirse antes o después de la entrega dependiendo del proceso comercial.

La integración fiscal mexicana mediante CFDI deberá diseñarse como una capacidad específica posterior.

Zaping no pretende convertirse inicialmente en un sistema contable completo.

---

# 8.22 Dashboard

**Prioridad:** P0

El sistema debe mostrar información relevante como:

* clientes;
* proveedores;
* productos;
* compras;
* ventas;
* inventario;
* valor de inventario;
* productos con stock bajo;
* actividad reciente.

El Dashboard debe evolucionar progresivamente desde indicadores estáticos hacia un **Action Dashboard**.

La prioridad será mostrar:

* qué requiere atención;
* qué está pendiente;
* qué representa riesgo;
* y qué acción puede realizar el usuario.

---

# 8.23 Auditoría

**Prioridad:** P0

Las operaciones importantes deben generar trazabilidad de auditoría.

Debe poder conocerse:

* qué ocurrió;
* qué usuario lo realizó;
* cuándo;
* sobre qué entidad;
* y, cuando corresponda, el valor anterior y nuevo.

La auditoría no debe depender únicamente de logs técnicos.

---

# 8.24 Importación de datos

**Prioridad:** P1

Zaping deberá permitir progresivamente importar información desde archivos como:

* CSV;
* XLSX.

Entidades iniciales candidatas:

* clientes;
* proveedores;
* productos;
* inventario inicial.

La importación debe contemplar:

* mapeo de columnas;
* validación previa;
* errores por fila;
* vista previa;
* ejecución por lotes;
* y reporte final.

La importación será especialmente importante para migrar clientes desde sistemas existentes.

---

# 8.25 Código de barras y QR

**Prioridad:** P2

El sistema deberá evolucionar para utilizar:

* códigos de barras;
* QR;
* y posteriormente estándares aplicables al sector.

Casos de uso:

* recepción;
* búsqueda de productos;
* lotes;
* series;
* inventarios;
* maletines;
* equipos;
* entregas;
* retornos.

---

# 8.26 Multi-almacén

**Prioridad:** P1/P2

La arquitectura debe permitir evolucionar hacia múltiples almacenes sin exigir su implementación completa en el MVP inicial.

La existencia deberá poder distinguir progresivamente entre:

* almacén;
* ubicación;
* custodia;
* campo;
* mantenimiento;
* y otros estados operativos.

---

# 9. Requerimientos funcionales — Zaping Healthcare

# 9.1 Organizaciones Healthcare

**Prioridad:** P1

Zaping debe poder representar organizaciones relacionadas con operaciones médicas, entre ellas:

* hospitales;
* clínicas;
* aseguradoras;
* y otras entidades.

La arquitectura no debe asumir que:

```text
Hospital = Cliente = Pagador
```

Una misma organización puede desempeñar uno o varios roles.

La migración del modelo actual `Customer` hacia un modelo más general de organización debe analizarse antes de implementarse.

---

# 9.2 Médicos

**Prioridad:** P1

El sistema debe poder registrar médicos como contactos profesionales relacionados con:

* hospitales;
* oportunidades;
* Cases;
* técnicos;
* y actividad comercial.

Un médico puede relacionarse con más de una institución.

Un médico no debe convertirse obligatoriamente en cliente ni usuario del sistema.

---

# 9.3 Oportunidades comerciales Healthcare

**Prioridad:** P1

El sistema debe contemplar oportunidades que puedan originarse por:

* solicitud directa de un médico o institución;
* prospección realizada por un técnico o vendedor.

Una oportunidad puede posteriormente convertirse en:

* venta directa;
* cotización;
* o Case.

La implementación completa de CRM automatizado no forma parte de P1.

---

# 9.4 Cases

**Prioridad:** P1

Un `Case` representa un procedimiento o evento operativo Healthcare que requiere coordinación.

Debe poder registrar:

* folio;
* hospital;
* médico;
* procedimiento;
* técnico;
* fecha;
* hora de inicio;
* hora estimada de finalización;
* estado;
* preparación;
* observaciones operativas;
* y relaciones comerciales.

Un Case puede generar una venta.

Una venta puede existir sin Case.

---

# 9.5 Estados de Case

**Prioridad:** P1

El modelo debe soportar un ciclo de vida claro.

Estados iniciales propuestos:

```text
DRAFT
SCHEDULED
PREPARING
READY
IN_CASE
RETURN_PENDING
COMPLETED
CANCELLED
```

Los estados finales deberán formalizarse durante el diseño del módulo.

---

# 9.6 Calendario de Cases

**Prioridad:** P1

El sistema debe proporcionar un calendario de procedimientos agendados.

Debe contemplar:

* vista diaria;
* semanal;
* mensual;
* agenda;
* filtros;
* técnico;
* hospital;
* médico;
* estado;
* preparación.

Al seleccionar un evento debe abrirse el `Case 360`.

## Regla crítica

> El calendario no almacena una agenda independiente.

Las fechas pertenecen al Case.

El calendario únicamente las representa.

---

# 9.7 Conflictos de agenda

**Prioridad:** P1

Zaping debe poder advertir cuando:

* un técnico está asignado a dos Cases incompatibles;
* un equipo requerido ya está reservado para otro Case;
* o existen recursos indispensables no disponibles.

Las reglas exactas deberán definirse con el módulo.

---

# 9.8 Preparación de Case

**Prioridad:** P1

Un técnico debe poder solicitar al almacén el material y/o equipo necesario para un procedimiento.

El almacén debe poder visualizar:

* Case;
* responsable;
* hospital;
* cirugía/procedimiento;
* fecha;
* productos solicitados;
* material de apoyo;
* referencias;
* cantidades;
* lotes;
* series;
* disponibilidad;
* y estado de preparación.

---

# 9.9 Plantillas de maletín

**Prioridad:** P1

Zaping debe permitir definir configuraciones reutilizables de material y equipo requeridos normalmente para determinados procedimientos.

Una plantilla no representa inventario físico.

Representa una configuración esperada.

---

# 9.10 Maletines de Case

**Prioridad:** P1

Un maletín debe representar la preparación real asociada a un Case.

Debe poder registrar:

* identificador;
* Case;
* responsable;
* artículos;
* cantidades;
* lotes;
* series;
* material de apoyo;
* equipo;
* estado.

Estados iniciales propuestos:

```text
DRAFT
PREPARING
READY
DISPATCHED
RETURN_PENDING
RETURNED
RECONCILED
CANCELLED
```

---

# 9.11 Salida a Case

**Prioridad:** P1

Cuando el almacén entrega un maletín o artículos a un técnico debe registrarse una salida operacional.

Debe registrarse como mínimo:

* responsable;
* usuario de almacén que entrega;
* hospital;
* procedimiento;
* fecha;
* artículos;
* cantidades;
* lote;
* serie;
* referencias;
* y Case relacionado.

## Regla crítica

> Una salida a Case no equivale automáticamente a una salida definitiva de la propiedad de la empresa.

Los artículos cambian de ubicación o custodia.

---

# 9.12 Custodia

**Prioridad:** P1

Zaping debe permitir conocer:

* qué material está fuera del almacén;
* qué técnico lo tiene;
* para qué Case;
* desde cuándo;
* y qué debe regresar.

Para equipo reusable debe poder conocerse el custodio actual.

---

# 9.13 Retorno de Case

**Prioridad:** P1

Después del procedimiento, el sistema debe permitir registrar el retorno contra la salida original.

Zaping debe presentar automáticamente lo que salió.

El usuario debe poder registrar:

* utilizado;
* retornado;
* faltante;
* dañado;
* pendiente.

---

# 9.14 Inspección

**Prioridad:** P1

El responsable del almacén debe poder verificar el estado de los artículos retornados.

Para material podrá contemplarse:

* íntegro;
* empaque dañado;
* no utilizable.

Para equipo:

* correcto;
* dañado;
* incompleto;
* requiere revisión.

La clasificación final se definirá con las reglas del módulo.

---

# 9.15 Conciliación de Case

**Prioridad:** P1

El sistema debe comparar:

```text
Entregado
vs.
Utilizado
vs.
Retornado
vs.
Pendiente
```

La suma debe ser consistente.

Una conciliación no debe cerrarse con diferencias sin resolver salvo que exista una incidencia formal.

---

# 9.16 Consumo → Venta

**Prioridad:** P1

El material efectivamente utilizado durante un Case debe poder originar una operación comercial.

Zaping deberá poder generar un borrador de venta o entrega a partir de la conciliación.

El usuario autorizado deberá revisar y confirmar la operación.

La automatización no debe eliminar controles comerciales como precio, cliente o pagador.

---

# 9.17 Equipo reutilizable

**Prioridad:** P1

Zaping debe soportar equipos propiedad de la empresa utilizados temporalmente.

Debe poder registrar:

* código de activo;
* producto/modelo;
* serie;
* estado;
* condición;
* Case actual;
* custodio;
* disponibilidad;
* historial.

Estados iniciales posibles:

```text
AVAILABLE
ASSIGNED
RETURN_PENDING
MAINTENANCE
INACTIVE
```

El diseño definitivo deberá formalizarse antes de Prisma.

---

# 9.18 Pagadores y aseguradoras

**Prioridad:** P1

Zaping debe distinguir entre:

* institución donde ocurre el procedimiento;
* cliente comercial;
* responsable de pago;
* aseguradora.

Un Case puede estar relacionado con un pagador diferente del hospital.

La arquitectura deberá permitir evolucionar posteriormente hacia procesos más avanzados sin asumir que existe siempre un único tipo de pagador.

---

# 9.19 Autorizaciones

**Prioridad:** P2

Cuando el proceso comercial lo requiera, Zaping podrá administrar referencias o autorizaciones asociadas a aseguradoras u otras entidades.

El proceso exacto debe validarse antes de implementarse.

---

# 9.20 Warehouse Operations

**Prioridad:** P1

Zaping debe ofrecer una experiencia orientada a tareas para almacén.

Debe poder mostrar información como:

* compras por recibir;
* Cases por preparar;
* maletines en preparación;
* maletines listos;
* salidas pendientes;
* retornos pendientes;
* retornos atrasados;
* pedidos por preparar;
* envíos.

`Warehouse Operations` será principalmente una experiencia que utiliza varios dominios.

No deberá duplicar la lógica de Inventory.

---

# 10. Requerimientos de experiencia de usuario

**Prioridad:** P0 continuo

La experiencia deberá seguir `ZAPING_WAY.md`.

Principios mínimos:

* simple por defecto;
* complejidad bajo demanda;
* contexto dentro del workflow;
* consistencia;
* acciones claras;
* lenguaje de negocio;
* estados visibles;
* validación cercana al error;
* feedback inmediato;
* accesibilidad;
* responsive design;
* y reducción de captura duplicada.

---

# 11. Patrones UX requeridos

## 11.1 Una acción primaria

Cada pantalla debe priorizar una acción principal.

Acciones secundarias deben mantener una jerarquía clara.

---

## 11.2 Tablas simples

Las tablas deben mostrar inicialmente solo las columnas necesarias.

Filtros frecuentes deben ser accesibles sin abrir configuraciones complejas.

---

## 11.3 Vistas 360

Entidades importantes deberán evolucionar hacia vistas consistentes.

Ejemplos:

* Product 360;
* Purchase 360;
* Receipt 360;
* Sale 360;
* Case 360;
* Equipment 360.

---

## 11.4 Estados consistentes

Los estados deben usar lenguaje y representación visual coherentes en toda la plataforma.

---

## 11.5 Flujos orientados a tareas

La aplicación debe permitir trabajar desde pendientes y acciones, no únicamente navegar por catálogos.

---

# 12. Requerimientos no funcionales

# 12.1 Seguridad

Zaping debe utilizar:

* autenticación segura;
* JWT;
* hash de contraseñas;
* RBAC;
* permisos;
* aislamiento multiempresa;
* validación de entrada;
* auditoría;
* HTTPS en producción;
* configuración mediante variables de entorno;
* y principio de mínimo privilegio.

Los endpoints no deben confiar únicamente en restricciones de la interfaz.

---

# 12.2 Privacidad

Zaping Healthcare no debe convertirse inicialmente en un expediente clínico electrónico.

Solo deben almacenarse datos personales o relacionados con procedimientos cuando sean necesarios para la operación empresarial.

Información clínica sensible adicional requerirá una evaluación específica de:

* necesidad;
* privacidad;
* seguridad;
* permisos;
* retención;
* y cumplimiento.

---

# 12.3 Rendimiento

Objetivos iniciales heredados del PRD v1:

* operaciones CRUD comunes: objetivo menor a 300 ms;
* dashboard: objetivo menor a 500 ms.

Estos valores deben considerarse objetivos de referencia, no garantías absolutas.

Las mediciones deberán realizarse bajo condiciones definidas antes de convertirse en SLO formales.

---

# 12.4 Escalabilidad

La aplicación debe ser:

* cloud-native;
* multi-tenant;
* modular;
* preparada para escalamiento horizontal cuando sea necesario;
* y capaz de evolucionar sin requerir una reescritura completa.

---

# 12.5 Disponibilidad

Objetivo de largo plazo:

**99.9 %**

Este objetivo debe formalizarse cuando exista infraestructura productiva y medición real.

---

# 12.6 Mantenibilidad

El sistema debe mantener:

* arquitectura modular;
* responsabilidades claras;
* componentes reutilizables;
* APIs consistentes;
* documentación actualizada;
* pruebas;
* y estándares de calidad.

---

# 12.7 Integridad transaccional

Operaciones que afectan varias entidades relacionadas deben ejecutarse de manera atómica cuando la consistencia lo requiera.

Ejemplos:

* recepción de compra;
* generación de lote;
* movimiento de inventario;
* conciliación;
* salida definitiva.

No se debe dejar el sistema en estados parcialmente confirmados.

---

# 12.8 Observabilidad

**Prioridad:** P1/P2

El sistema debe evolucionar hacia:

* logs estructurados;
* identificación de errores;
* métricas;
* monitoreo;
* y trazabilidad técnica.

---

# 13. Reglas de negocio transversales

Las siguientes reglas deben considerarse principios operativos de Zaping.

## BR-001

Toda entidad empresarial debe respetar el aislamiento por empresa.

## BR-002

El stock no se edita directamente.

## BR-003

Una compra no aumenta inventario.

## BR-004

Una recepción confirmada puede aumentar inventario.

## BR-005

Una cotización no mueve inventario.

## BR-006

Una venta comercial no representa necesariamente una salida física.

## BR-007

Una entrega definitiva puede reducir inventario.

## BR-008

Una salida temporal a Case cambia custodia, no necesariamente propiedad.

## BR-009

Lo utilizado en Case puede convertirse en venta/salida definitiva.

## BR-010

Lo no utilizado en Case debe poder retornar.

## BR-011

Los movimientos confirmados no deben reescribirse sin trazabilidad.

## BR-012

Una venta puede existir sin Case.

## BR-013

Un Case puede existir antes de que exista factura.

## BR-014

Una factura puede emitirse antes o después del procedimiento según la operación.

## BR-015

Hospital, cliente y pagador no son necesariamente la misma entidad.

---

# 14. Fuera de alcance — ERP Core inicial

La primera etapa no pretende implementar completamente:

* contabilidad general;
* nómina;
* manufactura / MRP;
* comercio electrónico;
* marketplace;
* CRM de automatización avanzada;
* BI avanzado;
* AI Assistant;
* planificación de rutas;
* WMS avanzado;
* múltiples almacenes complejos;
* mantenimiento industrial;
* integración con todas las paqueterías;
* expediente clínico;
* claims management de aseguradoras;
* ni funcionalidades no alineadas con el roadmap aprobado.

Estas capacidades pueden incorporarse posteriormente si existe valor validado.

---

# 15. Integraciones futuras

Zaping debe prepararse para integrarse con:

* CFDI;
* proveedores fiscales;
* sistemas contables;
* paqueterías;
* plataformas de comercio electrónico;
* código de barras;
* QR;
* sistemas externos;
* portales;
* aplicaciones móviles;
* y APIs de clientes.

---

# 16. Zaping Radar

**Prioridad general:** P2 / futura etapa

Radar deberá permitir progresivamente:

* detectar licitaciones;
* registrar oportunidades externas;
* filtrar información relevante;
* generar alertas;
* gestionar fechas;
* y conectar oportunidades con ERP/Healthcare.

Radar no debe retrasar la estabilización del ERP Core.

---

# 17. Zaping AI

**Prioridad:** Futuro

Zaping AI deberá utilizar información confiable producida por los sistemas operativos.

No será la fuente de verdad.

Posibles funciones:

* resúmenes;
* recomendaciones;
* predicciones;
* detección de anomalías;
* riesgo de inventario;
* priorización de oportunidades;
* y asistencia natural.

No debe implementarse AI crítica sobre datos cuya calidad todavía no esté garantizada.

---

# 18. Criterios de éxito — ERP Core

ERP Core podrá considerarse listo para una primera implementación comercial cuando:

* autenticación sea estable;
* multi-tenancy esté validado;
* permisos básicos funcionen;
* clientes funcionen;
* proveedores funcionen;
* productos funcionen;
* compras funcionen;
* recepciones funcionen;
* inventario sea trazable;
* lotes/caducidades funcionen en los productos requeridos;
* cotizaciones funcionen;
* ventas funcionen;
* entregas funcionen;
* devoluciones críticas estén cubiertas;
* dashboard sea útil;
* auditoría básica exista;
* documentación esté sincronizada;
* pruebas críticas pasen;
* seguridad sea revisada;
* migraciones sean reproducibles;
* y despliegue productivo sea viable.

---

# 19. Criterios de éxito — Zaping Healthcare v1

Healthcare v1 podrá considerarse comercialmente usable cuando soporte de manera confiable:

* médicos;
* hospitales;
* técnicos;
* Cases;
* calendario;
* preparación;
* maletines;
* salidas;
* custodia;
* retornos;
* inspección;
* conciliación;
* equipo básico;
* material utilizado;
* relación con venta;
* pagador;
* y experiencia operativa de almacén.

No será requisito inicial:

* aplicación móvil nativa;
* mantenimiento avanzado;
* calibración;
* QR avanzado;
* claims;
* AI;
* ni automatización predictiva.

---

# 20. Riesgos

Riesgos principales:

## Scope creep

El número de ideas y posibilidades puede crecer más rápido que la capacidad de implementación.

Mitigación:

priorización P0/P1/P2.

---

## Sobreingeniería

Diseñar para escenarios no validados puede aumentar complejidad innecesariamente.

Mitigación:

implementar primero reglas comprobadas por procesos reales.

---

## Documentación desactualizada

Documentos contradictorios pueden provocar decisiones incorrectas.

Mitigación:

una fuente de verdad por tema y mantenimiento continuo.

---

## Seguridad

Errores de autorización o aislamiento multiempresa pueden exponer información.

Mitigación:

Security by Design, pruebas y revisión.

---

## Inventario inconsistente

Modificar stock fuera del dominio de Inventory puede destruir trazabilidad.

Mitigación:

Inventory como propietario del stock y operaciones transaccionales.

---

## Dependencia de un solo flujo operativo

Diseñar Healthcare exactamente para una sola empresa puede limitar el producto.

Mitigación:

usar procesos reales como punto de partida y validar posteriormente con otros distribuidores.

---

## Recursos limitados

La capacidad de desarrollo es limitada.

Mitigación:

priorizar comercialización del Core antes de funcionalidades avanzadas.

---

# 21. Supuestos

Se asume que:

* los usuarios cuentan con conexión a internet;
* las empresas objetivo pueden adoptar SaaS;
* la nube será la infraestructura principal;
* PostgreSQL continuará inicialmente como base de datos;
* APIs REST serán la interfaz principal entre frontend y backend;
* la primera vertical comercial será Healthcare;
* y los nuevos dominios se incorporarán de manera modular.

---

# 22. Restricciones tecnológicas actuales

## Backend

NestJS
Node.js
TypeScript

## Frontend

Next.js
React
TypeScript
Tailwind CSS

## Base de datos

PostgreSQL

## ORM

Prisma

## Autenticación

JWT

## Infraestructura

Docker

Estas tecnologías representan la arquitectura actual.

Un cambio significativo debe estar respaldado por una decisión arquitectónica documentada.

---

# 23. Estrategia de roadmap

## P0 — ERP Core comercializable

Prioridades principales:

* estabilización;
* Purchase Receipts;
* Inventory Traceability;
* Sales Orders;
* Deliveries;
* UX Core;
* seguridad;
* auditoría;
* pruebas;
* producción.

---

## P1 — Especialización y adopción

Prioridades:

* Healthcare v1;
* importación;
* serialización;
* FEFO;
* mejora multi-almacén;
* facturación/integración fiscal;
* onboarding;
* Warehouse Operations.

---

## P2 — Expansión

Prioridades:

* mobile;
* QR/barcode avanzado;
* shipping integrations;
* mantenimiento/calibración;
* autorizaciones;
* Radar;
* analytics avanzado.

---

## Futuro

* AI;
* predicción;
* optimización;
* automatización avanzada;
* nuevas verticales.

---

# 24. Criterios de aceptación para una release

Una release no debe considerarse lista únicamente porque compile.

Debe cumplir, según su alcance:

* requerimientos funcionales aprobados;
* reglas de negocio validadas;
* migraciones correctas;
* multi-tenancy validado;
* autorización;
* manejo de errores;
* pruebas;
* lint;
* build;
* revisión de seguridad;
* documentación;
* UX consistente;
* y checklist de release.

---

# 25. Control de alcance

Toda funcionalidad nueva debe responder al menos:

1. ¿Qué problema real resuelve?
2. ¿Qué usuario la necesita?
3. ¿En qué prioridad está?
4. ¿Qué dominio es responsable?
5. ¿Afecta inventario?
6. ¿Afecta multi-tenancy?
7. ¿Requiere auditoría?
8. ¿Introduce datos sensibles?
9. ¿Existe una solución más simple?
10. ¿Está alineada con `PRODUCT_VISION.md`?

Si estas preguntas no pueden responderse con claridad, la funcionalidad no debería entrar directamente a implementación.

---

# 26. Relación con otros documentos

Este PRD debe mantenerse alineado con:

* `PRODUCT_VISION.md`
* `ZAPING_WAY.md`
* `ARCHITECTURE.md`
* ADRs
* documentación de módulos
* `ROADMAP.md`
* `PROJECT_BOARD.md`
* `QUALITY_STANDARDS.md`
* `SECURITY_PRINCIPLES.md`

Cuando exista conflicto:

* el comportamiento implementado debe revisarse;
* la decisión correcta debe formalizarse;
* y la documentación obsoleta debe actualizarse o reemplazarse.

---

# 27. Declaración final

Zaping debe construirse mediante capas de valor.

Primero:

**operaciones confiables.**

Después:

**especialización.**

Después:

**inteligencia.**

El crecimiento del producto no debe sacrificar:

* simplicidad;
* seguridad;
* trazabilidad;
* mantenibilidad;
* ni coherencia arquitectónica.
