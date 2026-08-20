# Visión de Producto — Zaping

**Producto:** Zaping
**Versión del documento:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-19
**Responsable:** Zaping Team

---

# 1. Resumen ejecutivo

Zaping es una plataforma empresarial SaaS, cloud-native y multiempresa diseñada para ayudar a las organizaciones a administrar su operación, mantener trazabilidad, reducir trabajo manual y tomar mejores decisiones mediante tecnología.

Zaping no busca convertirse únicamente en un ERP.

La visión de largo plazo es construir una **plataforma inteligente de operación empresarial** capaz de integrar:

* gestión empresarial;
* soluciones especializadas por industria;
* inteligencia de negocio;
* automatización;
* información externa;
* movilidad;
* integraciones;
* y, posteriormente, inteligencia artificial.

El primer mercado especializado de Zaping son las empresas dedicadas a la distribución de suministros, dispositivos y equipos médicos.

Este sector presenta necesidades que van más allá de un ERP horizontal tradicional, entre ellas:

* trazabilidad por lote;
* números de serie;
* fechas de caducidad;
* control de equipo reutilizable;
* custodia de material;
* logística asociada a procedimientos;
* coordinación de técnicos;
* salidas y retornos de material;
* aseguradoras y otros responsables de pago;
* y seguimiento operativo especializado.

Para responder a estas necesidades sin limitar la evolución futura del producto, Zaping separa sus capacidades empresariales generales de sus verticales especializadas.

La primera vertical será:

**Zaping Healthcare.**

---

# 2. Misión

Construir software que ayude a las empresas a tomar mejores decisiones, no solamente a almacenar información.

Zaping busca simplificar operaciones empresariales mediante tecnología moderna, reduciendo complejidad administrativa, errores y trabajo repetitivo.

---

# 3. Visión

Convertir Zaping en una plataforma empresarial inteligente de referencia para pequeñas y medianas empresas en Latinoamérica, combinando gestión operativa, especialización por industria, automatización, inteligencia de negocio e integraciones dentro de un mismo ecosistema.

---

# 4. Filosofía de producto

Zaping parte de una idea fundamental:

> El software empresarial debe ayudar activamente a que una empresa opere mejor.

Cada funcionalidad debe resolver un problema real.

Cada pantalla debe reducir complejidad.

Cada flujo debe facilitar el trabajo del usuario.

Cada operación importante debe poder rastrearse.

Cada decisión técnica debe preservar la evolución futura de la plataforma.

La tecnología no es el producto.

**El valor generado para el negocio es el producto.**

---

# 5. Principios de producto

## 5.1 Valor para el cliente primero

Toda funcionalidad debe resolver un problema real del usuario o generar valor operacional, comercial o estratégico.

No se deben crear funcionalidades únicamente porque técnicamente sean posibles.

---

## 5.2 Simplicidad sobre complejidad

Cuando existan varias soluciones válidas, se debe preferir la alternativa más sencilla que resuelva correctamente el problema.

Zaping debe ser:

**simple por defecto y poderoso cuando sea necesario.**

---

## 5.3 Configurable antes que personalizado

Se deben preferir capacidades configurables sobre desarrollos exclusivos para un solo cliente.

Las necesidades específicas de una industria deben resolverse mediante verticales y configuraciones reutilizables.

---

## 5.4 Cloud Native

Toda nueva funcionalidad debe ser compatible con el modelo SaaS y el despliegue en nube.

---

## 5.5 API First

Las capacidades de negocio deben diseñarse para poder ser utilizadas mediante APIs.

La interfaz web no debe ser la única forma de acceder a la lógica de negocio.

---

## 5.6 Mobile Friendly

Los workflows deben diseñarse considerando su futura utilización desde dispositivos móviles cuando el contexto operativo lo requiera.

---

## 5.7 Data Driven

Las decisiones deben apoyarse progresivamente en datos reales.

Antes de optimizar, se debe medir.

Antes de automatizar, se debe comprender el proceso.

---

## 5.8 Pensamiento a largo plazo

Se deben evitar soluciones rápidas que generen deuda técnica o limiten innecesariamente la evolución del producto.

---

## 5.9 Documentation First

Las decisiones relevantes de producto, negocio y arquitectura deben documentarse antes de implementarse.

La documentación debe representar el comportamiento real del sistema y mantenerse sincronizada con él.

---

## 5.10 Seguridad desde el diseño

La seguridad, autorización, aislamiento multiempresa y auditoría son parte del diseño del producto, no mejoras opcionales posteriores.

---

# 6. Valores del producto

Zaping debe ser:

* Simple.
* Confiable.
* Seguro.
* Trazable.
* Modular.
* Escalable.
* Consistente.
* Accesible.
* Profesional.
* Orientado a acciones.
* Preparado para integraciones.
* Capaz de evolucionar.

---

# 7. Arquitectura conceptual del producto

El ecosistema Zaping se organiza alrededor de una plataforma común y productos especializados.

```text
                         ZAPING PLATFORM
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
             ▼                  ▼                  ▼

      Zaping ERP Core    Zaping Healthcare    Zaping Radar

             └──────────────────┬──────────────────┘
                                │
                                ▼
                     Business Intelligence
                                │
                                ▼
                           Zaping AI
                                │
                  ┌─────────────┼─────────────┐
                  ▼             ▼             ▼

           Customer Portal   Mobile Apps   Public API
```

---

# 8. Zaping ERP Core

Zaping ERP Core constituye la base empresarial de la plataforma.

Su responsabilidad es administrar capacidades genéricas reutilizables por distintas industrias.

Entre sus principales dominios se encuentran:

* Empresas.
* Usuarios.
* Roles.
* Permisos.
* Clientes.
* Contactos.
* Proveedores.
* Productos.
* Categorías.
* Compras.
* Recepciones de compra.
* Inventario.
* Lotes.
* Números de serie.
* Caducidades.
* Cotizaciones.
* Pedidos de venta.
* Entregas.
* Devoluciones.
* Facturación.
* Documentos.
* Auditoría.
* Dashboard.
* Reportes.

El ERP Core debe mantenerse tan independiente de una industria específica como sea razonablemente posible.

Las reglas exclusivas de un sector deben implementarse mediante verticales especializadas.

---

# 9. Zaping Healthcare

Zaping Healthcare será la primera vertical especializada construida sobre Zaping ERP Core.

Su objetivo es resolver procesos comerciales, logísticos y operativos propios de empresas distribuidoras de suministros, dispositivos y equipos médicos.

Zaping Healthcare **no pretende convertirse en un expediente clínico electrónico**.

Su ámbito es la operación empresarial que rodea los procedimientos médicos.

---

## 9.1 Healthcare CRM

Debe permitir representar relaciones comerciales especializadas con:

* hospitales;
* clínicas;
* médicos;
* técnicos;
* contactos;
* oportunidades comerciales;
* y organizaciones relacionadas.

Una oportunidad puede originarse, entre otros escenarios, por:

* una solicitud directa de un médico o institución;
* o prospección realizada por un técnico o vendedor.

La persona que solicita, utiliza, recibe y paga un producto no necesariamente es la misma entidad.

---

## 9.2 Casos

Un `Case` representa un procedimiento o evento operativo que requiere coordinación de recursos.

Puede relacionarse con:

* hospital;
* médico;
* procedimiento;
* técnico responsable;
* fecha;
* hora;
* oportunidad comercial;
* material requerido;
* equipo requerido;
* ventas;
* pagadores;
* y actividad operacional.

Una venta puede existir sin un Case.

Un Case puede existir y posteriormente generar una venta.

La arquitectura no debe obligar a que ambos conceptos sean inseparables.

---

## 9.3 Calendario de casos

Zaping Healthcare incluirá un calendario operacional para visualizar casos programados.

Debe permitir vistas como:

* día;
* semana;
* mes;
* agenda.

El calendario podrá utilizar información como:

* hospital;
* médico;
* técnico;
* procedimiento;
* fecha y horario;
* estado del caso;
* estado de preparación;
* maletines;
* material;
* equipo;
* y retornos pendientes.

El calendario será una representación de los datos de `Case`.

No deberá convertirse en una segunda fuente de verdad.

---

## 9.4 Preparación de casos

Antes de un procedimiento puede ser necesario preparar material y equipo.

El flujo podrá incluir:

```text
Case
  ↓
Solicitud de material/equipo
  ↓
Preparación de almacén
  ↓
Maletín
  ↓
Salida
  ↓
Custodia del técnico
```

El personal de almacén debe poder conocer qué casos requieren preparación y qué recursos necesitan.

---

## 9.5 Maletines de caso

Zaping Healthcare deberá contemplar el concepto de **maletín de caso**.

Un maletín representa un conjunto de materiales y/o equipos preparados para una operación específica.

Podrá contener:

* productos;
* cantidades;
* lotes;
* números de serie;
* material de apoyo;
* equipos reutilizables;
* referencias;
* y otros elementos requeridos.

Podrán existir:

### Plantillas de maletín

Definen qué suele necesitar un tipo determinado de procedimiento.

### Maletines de caso

Representan el conjunto real preparado para un Case específico.

Esto permitirá combinar rapidez operacional y trazabilidad.

---

## 9.6 Salida y custodia

Cuando material o equipo sale físicamente del almacén para un Case, no necesariamente deja de pertenecer a la empresa.

Zaping deberá distinguir entre:

> salida del almacén

y

> salida definitiva del inventario propiedad de la empresa.

Ejemplo:

```text
Almacén
   ↓
Case Dispatch
   ↓
Custodia del técnico
   ↓
Procedimiento
```

El sistema debe registrar:

* responsable;
* usuario que entrega;
* fecha y hora;
* Case;
* hospital;
* material;
* equipo;
* lotes;
* series;
* cantidades;
* y referencias.

---

## 9.7 Retorno e inspección

Después del procedimiento, el material o equipo que corresponda debe regresar al almacén.

El personal responsable de la recepción debe poder:

* consultar qué salió;
* registrar qué regresó;
* registrar qué fue utilizado;
* verificar cantidades;
* verificar condición;
* detectar faltantes;
* detectar daño;
* y generar incidencias.

El retorno debe estar relacionado con la salida original.

No se debe volver a capturar toda la operación desde cero.

---

## 9.8 Conciliación

El resultado del procedimiento puede clasificar el material en diferentes resultados:

```text
Entregado al caso
        │
        ├── Utilizado
        │      ↓
        │   Venta / salida definitiva
        │
        ├── No utilizado
        │      ↓
        │   Retorno a inventario disponible
        │
        ├── Dañado
        │      ↓
        │   Incidencia
        │
        └── Faltante
               ↓
            Incidencia
```

La conciliación debe preservar trazabilidad completa.

---

## 9.9 Equipos reutilizables

Zaping Healthcare podrá administrar equipos propiedad de la empresa que se entregan temporalmente para procedimientos.

Ejemplos:

* programadores;
* consolas;
* cables;
* instrumental;
* dispositivos de apoyo;
* equipos especializados.

El control deberá evolucionar para soportar:

* código de activo;
* modelo;
* número de serie;
* estado;
* condición;
* custodio actual;
* Case actual;
* historial;
* y disponibilidad.

En fases posteriores podrá incorporar:

* mantenimiento;
* calibración;
* documentación;
* y control técnico del activo.

---

## 9.10 Responsabilidad de pago y aseguradoras

La organización donde ocurre el procedimiento no necesariamente es quien cubre el costo.

Zaping debe distinguir conceptualmente entre:

* hospital o lugar del servicio;
* cliente comercial;
* responsable de pago;
* aseguradora;
* y otras organizaciones involucradas.

La facturación podrá ocurrir:

* antes del procedimiento;
* después del procedimiento;
* o independientemente de un procedimiento.

No se debe diseñar el sistema bajo la suposición:

```text
Hospital = Cliente = Pagador
```

En fases posteriores podrán incorporarse:

* autorizaciones;
* referencias;
* cobertura;
* responsabilidades divididas;
* y procesos más avanzados relacionados con aseguradoras.

---

# 10. Zaping Radar

Zaping Radar representa la capa de inteligencia externa del ecosistema.

Su objetivo es identificar y organizar información que se origina fuera de la empresa.

Podrá incluir:

* licitaciones públicas;
* oportunidades comerciales;
* cambios regulatorios;
* alertas sanitarias;
* noticias del sector;
* precios de referencia;
* fechas límite;
* seguimiento;
* y notificaciones.

Radar deberá poder integrarse progresivamente con el ERP y Healthcare.

Ejemplo futuro:

```text
Licitación
   ↓
Oportunidad
   ↓
Cliente / Hospital
   ↓
Cotización
   ↓
Venta / Case
```

---

# 11. Zaping AI

Zaping AI constituirá la futura capa inteligente de la plataforma.

No deberá ser la fuente primaria de los datos.

Su función será analizar información confiable proveniente del ERP, Healthcare, Radar y otras fuentes autorizadas.

Posibles capacidades futuras:

* resúmenes ejecutivos;
* análisis de inventario;
* detección de anomalías;
* riesgo de caducidad;
* recomendaciones de compra;
* seguimiento comercial;
* priorización de oportunidades;
* alertas operativas;
* preparación de casos;
* predicciones;
* y consultas mediante lenguaje natural.

La inteligencia artificial no es una dependencia del MVP.

Primero se debe construir una base operacional confiable.

---

# 12. Evolución de la información

Una de las metas centrales de Zaping es transformar los datos en acciones.

La evolución esperada es:

```text
Dato
  ↓
Información
  ↓
Contexto
  ↓
Alerta
  ↓
Acción
  ↓
Recomendación
```

Un ERP tradicional puede responder:

> ¿Cuánto vendí?

Zaping debe evolucionar para ayudar a responder también:

> ¿Qué requiere mi atención hoy?

y posteriormente:

> ¿Qué debería hacer a continuación?

---

# 13. Experiencia de producto — Zaping Way

Zaping debe ser un sistema orientado a tareas y decisiones, no únicamente a módulos y formularios.

Los principios principales de experiencia serán:

## Simple por defecto

Mostrar primero únicamente lo que el usuario necesita.

## Complejidad bajo demanda

Las funciones avanzadas deben estar disponibles sin saturar la experiencia básica.

## Contexto antes que navegación

La información necesaria para completar una tarea debe aparecer dentro del workflow cuando sea posible.

## Un patrón en toda la plataforma

Acciones similares deben funcionar de forma similar en todos los módulos.

## Datos → contexto → acción

Cada pantalla debe ayudar al usuario a entender:

1. qué está ocurriendo;
2. por qué importa;
3. qué puede hacer después.

## Workspaces orientados a tareas

Los usuarios operativos deben poder trabajar mediante pendientes como:

* compras por recibir;
* casos por preparar;
* maletines por entregar;
* retornos pendientes;
* pedidos por enviar;
* productos por revisar;
* e incidencias.

Los detalles completos de esta experiencia vivirán en `ZAPING_WAY.md`.

---

# 14. Customer Portal

En fases futuras, el portal de clientes podrá proporcionar autoservicio controlado.

Posibles capacidades:

* cotizaciones;
* pedidos;
* facturas;
* documentos;
* estado de entregas;
* información de cuenta;
* y soporte.

---

# 15. Aplicaciones móviles

Las aplicaciones móviles extenderán Zaping a operaciones en campo.

Posibles experiencias:

## Ventas

* clientes;
* oportunidades;
* cotizaciones;
* seguimiento.

## Técnicos Healthcare

* calendario;
* casos asignados;
* información del caso;
* material bajo custodia;
* equipo bajo custodia;
* maletines;
* retornos;
* futuras operaciones mediante QR o código de barras.

## Almacén

* recepciones;
* preparación;
* escaneo;
* salidas;
* retornos;
* inventarios.

## Dirección

* dashboards;
* alertas;
* indicadores;
* recomendaciones.

---

# 16. API pública e integraciones

Zaping debe evolucionar hacia un ecosistema abierto.

Posibles integraciones:

* CFDI y proveedores fiscales;
* sistemas contables;
* comercio electrónico;
* paqueterías;
* sistemas de clientes;
* soluciones de escaneo;
* plataformas externas;
* y desarrollos personalizados.

Las APIs son una capacidad estratégica del producto.

---

# 17. Mercado objetivo

## Fase 1 — Distribución médica

Mercado inicial:

* distribuidores de insumos médicos;
* distribuidores de dispositivos médicos;
* proveedores de equipos médicos;
* empresas que brindan soporte a procedimientos;
* y organizaciones comerciales especializadas en salud.

La propuesta estará compuesta principalmente por:

**Zaping ERP Core + Zaping Healthcare.**

---

## Fase 2 — Ecosistema ampliado de salud

Posibles expansiones:

* laboratorios;
* proveedores especializados;
* operaciones logísticas médicas;
* empresas de servicios relacionados;
* y otros actores del sector.

---

## Fase 3 — Otras industrias de distribución

El ERP Core podrá utilizarse como base para nuevas verticales.

Ejemplos potenciales:

* distribución mayorista;
* suministros industriales;
* distribuidores especializados;
* y otras PyMEs intensivas en inventario.

---

# 18. Posicionamiento

Zaping no debe competir intentando tener la mayor cantidad posible de módulos.

Su diferenciación debe construirse alrededor de:

* excelente experiencia de usuario;
* especialización Healthcare;
* trazabilidad;
* control de lotes, series y caducidades;
* logística de casos;
* maletines;
* custodia;
* equipos;
* coordinación operacional;
* arquitectura cloud;
* inteligencia externa mediante Radar;
* e inteligencia futura mediante AI.

El objetivo es posicionar Zaping como:

> Una plataforma empresarial moderna diseñada alrededor de cómo realmente operan las empresas especializadas.

---

# 19. Estrategia de evolución

## Etapa 1 — ERP Core confiable

Completar y estabilizar:

* compras;
* recepciones;
* inventario;
* trazabilidad;
* cotizaciones;
* ventas;
* entregas;
* UX Core;
* seguridad;
* auditoría;
* pruebas;
* y producción.

---

## Etapa 2 — Zaping Healthcare

Incorporar:

* médicos;
* hospitales;
* oportunidades;
* Cases;
* calendario;
* técnicos;
* preparación;
* plantillas de maletines;
* maletines;
* salidas;
* custodia;
* retornos;
* inspección;
* conciliación;
* equipos;
* pagadores;
* y operación de almacén.

---

## Etapa 3 — Inteligencia de negocio

Utilizar información operacional confiable para proporcionar:

* análisis;
* alertas;
* indicadores;
* tendencias;
* y contexto.

---

## Etapa 4 — Zaping Radar

Integrar inteligencia externa con la operación interna.

---

## Etapa 5 — Movilidad e integraciones

Expandir mediante:

* aplicaciones móviles;
* portal;
* código de barras;
* QR;
* APIs;
* e integraciones.

---

## Etapa 6 — Inteligencia artificial

Introducir funciones predictivas y recomendaciones cuando exista suficiente información confiable.

---

# 20. Criterios de éxito

Una funcionalidad de Zaping debe considerarse exitosa cuando produzca resultados como:

* menor tiempo operativo;
* menor captura manual;
* menor duplicidad de información;
* reducción de errores;
* mejor trazabilidad;
* mejor coordinación;
* mayor visibilidad;
* mejores decisiones;
* y mayor valor para el cliente.

Una funcionalidad no es exitosa simplemente porque haya sido implementada.

Debe mejorar la operación real.

---

# 21. Visión a cinco años

Zaping debe evolucionar desde un ERP especializado hasta una plataforma empresarial inteligente.

Para una empresa del sector salud, Zaping debería poder conectar:

```text
Oportunidades
↓
Clientes / Hospitales / Médicos
↓
Productos
↓
Compras
↓
Recepciones
↓
Inventario
↓
Lotes / Series / Caducidades
↓
Casos
↓
Calendario
↓
Maletines
↓
Técnicos
↓
Equipo
↓
Ventas
↓
Entregas
↓
Facturación
↓
Pagadores
↓
Inteligencia de negocio
```

La organización debe utilizar Zaping no solamente para registrar operaciones, sino para:

* comprender su negocio;
* coordinar trabajo;
* mantener trazabilidad;
* anticipar riesgos;
* identificar oportunidades;
* y tomar mejores decisiones.

---

# 22. Declaración final

Zaping existe para transformar complejidad operacional en claridad y mejores decisiones.

Cada producto.

Cada vertical.

Cada módulo.

Cada servicio.

Cada API.

Cada workflow.

Cada interfaz.

Cada decisión arquitectónica.

Debe contribuir a ese propósito.
