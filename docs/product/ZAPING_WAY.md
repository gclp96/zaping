# Zaping Way — Principios de Experiencia de Producto

**Producto:** Zaping
**Versión:** 1.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-19
**Responsable:** Zaping Product Team

---

# 1. Propósito

`ZAPING_WAY.md` define cómo debe sentirse y funcionar Zaping desde la perspectiva del usuario.

No describe colores, componentes técnicos ni reglas internas de implementación.

Define principios para responder preguntas como:

* ¿cómo debe organizarse una pantalla?;
* ¿qué información debe mostrarse primero?;
* ¿cómo reducimos pasos innecesarios?;
* ¿cómo presentamos procesos empresariales complejos?;
* ¿cómo ayudamos al usuario a saber qué hacer después?;
* ¿cómo mantenemos consistencia entre ERP Core y Healthcare?

La experiencia de Zaping debe diseñarse alrededor del trabajo del usuario, no alrededor de la estructura de la base de datos.

---

# 2. Principio central

> **Simple por defecto. Poderoso cuando se necesita.**

Zaping puede administrar procesos complejos.

La interfaz no necesita mostrar toda esa complejidad al mismo tiempo.

El usuario debe encontrar primero:

```text
lo importante
↓
el contexto
↓
la acción
```

La profundidad aparece progresivamente cuando la tarea lo requiere.

---

# 3. Objetivo de experiencia

Zaping debe permitir que un usuario entienda rápidamente:

```text
Dónde estoy
¿Qué está ocurriendo?
¿Qué necesita atención?
¿Qué puedo hacer?
¿Qué ocurrirá después?
```

La aplicación debe reducir:

* búsqueda manual;
* navegación innecesaria;
* duplicidad de captura;
* dependencia de memoria;
* interpretación de códigos;
* pasos repetitivos.

---

# 4. El ERP no debe sentirse como una base de datos

Un patrón tradicional de ERP suele organizarse alrededor de:

```text
Clientes
Productos
Compras
Inventario
Ventas
```

como pantallas aisladas.

Zaping debe conservar módulos claros, pero la experiencia debe conectar el trabajo entre ellos.

Ejemplo:

```text
Compra OC-000421
↓
3 productos pendientes de recibir
↓
[Registrar recepción]
```

es preferible a obligar al usuario a:

```text
abrir Compras
↓
recordar folio
↓
abrir Recepciones
↓
buscar compra
↓
capturar nuevamente contexto
```

---

# 5. Datos → Contexto → Acción

La experiencia de Zaping debe transformar datos en decisiones.

La progresión ideal es:

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

Ejemplo:

```text
Stock: 3
```

es un dato.

```text
Stock: 3
Mínimo: 10
```

proporciona contexto.

```text
Bajo stock
```

genera alerta.

```text
[Crear compra]
```

permite acción.

En etapas futuras:

```text
La demanda promedio sugiere ordenar 25 unidades.
```

podrá convertirse en recomendación.

---

# 6. Task-Oriented ERP

Zaping debe evolucionar desde una navegación exclusivamente orientada a módulos hacia una experiencia también orientada a tareas.

Ejemplos:

```text
Compras por recibir
Pedidos por entregar
Productos con bajo stock
Cases por preparar
Retornos pendientes
Facturas pendientes
```

El usuario debe poder trabajar directamente desde estas tareas.

---

# 7. Módulos siguen siendo importantes

Task-Oriented no significa eliminar módulos.

Los módulos siguen proporcionando:

* propiedad del dominio;
* navegación;
* administración;
* búsqueda;
* historial.

La experiencia orientada a tareas complementa esa estructura.

---

# 8. Action Dashboard

El Dashboard debe evolucionar desde:

```text
Customers: 40
Products: 525
Sales: 32
```

hacia una combinación de:

```text
Qué está pasando
+
Qué requiere atención
+
Qué puedo hacer
```

---

# 9. Jerarquía del Dashboard

La dirección objetivo es:

```text
1. Acciones y alertas
2. Indicadores relevantes
3. Actividad reciente
4. Tendencias
```

No todos los indicadores necesitan aparecer simultáneamente.

---

# 10. Ejemplo de Action Dashboard

```text
Requiere atención

5 productos con bajo stock
[Revisar]

3 compras pendientes de recepción
[Recibir]

2 pedidos listos para entregar
[Preparar entrega]

1 retorno Healthcare vencido
[Revisar]
```

La interfaz debe permitir pasar de información a acción sin reconstruir manualmente el contexto.

---

# 11. Una acción primaria

Cada pantalla debe intentar responder:

> ¿Cuál es la acción principal más probable en este contexto?

Ejemplo:

```text
Compras
                          [Nueva compra]
```

En el detalle:

```text
OC-000421
Proveedor: ABC Medical

                   [Registrar recepción]
```

No deben existir cinco botones con la misma jerarquía visual cuando uno es claramente más importante.

---

# 12. Acciones contextuales

La acción primaria puede cambiar según el estado.

Ejemplo:

```text
Purchase DRAFT
→ [Editar]

Purchase CONFIRMED
→ [Registrar recepción]

Purchase COMPLETED
→ [Ver historial]
```

La interfaz debe reflejar el lifecycle real.

---

# 13. Progressive Disclosure

Mostrar primero lo necesario.

Después, permitir profundizar.

Ejemplo de Product:

```text
Nombre
SKU
Precio
Stock
Estado
```

como vista principal.

Información adicional puede vivir en:

```text
General
Inventario
Lotes
Movimientos
Historial
```

La complejidad existe, pero no compite toda por atención simultáneamente.

---

# 14. No ocultar lo esencial

Progressive Disclosure no significa esconder información crítica.

Ejemplo:

Una Delivery sin stock suficiente debe mostrar claramente el problema antes de permitir confirmación.

No debe quedar escondido en una pestaña secundaria.

---

# 15. Contexto persistente

El usuario debe saber siempre qué entidad está manipulando.

Ejemplo:

```text
Compra OC-000421

Proveedor
ABC Medical

Estado
CONFIRMED

Pendiente
15 unidades
```

Si abre una recepción desde ese contexto, no debería volver a seleccionar la compra.

---

# 16. Contextual Creation

Cuando falte una entidad necesaria dentro de un workflow, Zaping debe evaluar si puede crearse sin obligar al usuario a abandonar la tarea.

Ejemplo:

```text
Nueva cotización
↓
CustomerSelector
↓
Cliente no existe
↓
[Crear cliente]
↓
cliente creado
↓
regresar a la cotización
```

---

# 17. Preservar trabajo

La creación contextual no debe provocar:

* pérdida del formulario;
* reset de productos;
* pérdida de cantidades;
* reinicio del workflow.

El usuario debe regresar al punto donde estaba.

---

# 18. Vistas 360

Las entidades importantes deben evolucionar hacia un patrón de vista contextual completa.

Ejemplos:

```text
Customer 360
Product 360
Purchase 360
SalesOrder 360
Case 360
Equipment 360
```

---

# 19. Propósito de una vista 360

Una vista 360 debe responder:

```text
¿Qué es?
¿Qué estado tiene?
¿Qué pasó?
¿Qué está relacionado?
¿Qué puedo hacer ahora?
```

sin obligar a abrir múltiples módulos para reconstruir el contexto.

---

# 20. Purchase 360

Ejemplo conceptual:

```text
OC-000421
Proveedor: ABC Medical
Estado: Parcialmente recibida
Total: $48,200 MXN

Resumen
Ordenado      100
Recibido       70
Pendiente      30

Recepciones
REC-001        40
REC-002        30

[Registrar recepción]
```

---

# 21. Product 360

Puede reunir:

```text
General
Disponibilidad
Lotes
Caducidades
Movimientos
Compras
Ventas
Historial
```

sin convertir Product en propietario de todos esos dominios.

La vista combina información.

Las reglas continúan perteneciendo a sus respectivos módulos.

---

# 22. Case 360

Healthcare requiere un contexto especialmente integrado.

Conceptualmente:

```text
Case CAS-000281

Hospital
Médico
Procedimiento
Técnico
Fecha / hora
Estado

Preparación
CaseKit
Equipo
Dispatch
Return
Reconciliation
Venta
Pagador
Historial
```

No todo debe mostrarse expandido simultáneamente.

---

# 23. Workspaces

Una vista 360 está centrada en una entidad.

Un Workspace está centrado en una función.

Ejemplo:

```text
Warehouse Operations
```

está centrado en el trabajo diario del almacén.

---

# 24. Warehouse Operations

Dirección conceptual:

```text
Hoy

Por recibir            4
Por preparar           3
Listos para entregar   2
Retornos pendientes    2
Incidencias            1
```

El usuario puede entrar directamente a cada tarea.

---

# 25. Workspace no es un nuevo dominio

`Warehouse Operations` combina información de:

```text
Purchases
Inventory
Sales
Healthcare
Returns
```

pero no se convierte en propietario de sus reglas.

Es una capa de experiencia.

---

# 26. Navegación principal

La navegación debe permanecer:

* corta;
* consistente;
* reconocible;
* agrupada por intención.

No debe convertirse en una lista de todas las tablas existentes.

---

# 27. Agrupación conceptual

Una dirección posible de alto nivel es:

```text
Inicio

Comercial
├── Clientes
├── Cotizaciones
└── Ventas

Operaciones
├── Productos
├── Inventario
├── Compras
└── Almacén

Healthcare
├── Cases
├── Calendario
└── Equipo

Administración
├── Usuarios
└── Configuración
```

La estructura final debe validarse con el crecimiento real del producto.

Este ejemplo define intención, no una navegación obligatoria inmediata.

---

# 28. Evitar navegación demasiado profunda

El usuario no debería necesitar navegar:

```text
Operaciones
↓
Inventario
↓
Movimientos
↓
Recepciones
↓
Compra
↓
Detalle
```

para ejecutar una tarea frecuente.

Las tareas importantes deben tener accesos contextuales.

---

# 29. Navegación desde relaciones

Una entidad relacionada debe poder abrir su contexto cuando aporte valor.

Ejemplo:

```text
Purchase Receipt
Proveedor: ABC Medical
```

puede permitir abrir Supplier.

O:

```text
Case
Técnico: Juan Pérez
```

puede abrir su contexto correspondiente.

---

# 30. Búsqueda

La búsqueda reduce navegación.

Zaping debe evolucionar desde selectores específicos hacia una futura búsqueda global.

---

# 31. Global Search

Objetivo futuro:

```text
Buscar en Zaping...
```

podrá localizar:

```text
Customer
Supplier
Product
Purchase
SalesOrder
Case
Equipment
```

según permisos.

---

# 32. Search debe comprender identidad de negocio

El usuario puede recordar:

```text
OC-000421
```

pero no:

```text
9ea5c481-...
```

La búsqueda debe priorizar información útil como:

* folios;
* nombres;
* SKU;
* números de serie;
* códigos empresariales.

---

# 33. Command Palette

En etapas futuras puede evaluarse una paleta de comandos para usuarios avanzados.

Ejemplo:

```text
⌘ K / Ctrl K

Nueva compra
Buscar producto
Registrar recepción
Abrir Case
```

No es requisito del Core actual.

---

# 34. Tablas orientadas a decisiones

Una tabla debe permitir responder rápidamente:

```text
¿Qué registro busco?
¿Cuál es su estado?
¿Qué necesita atención?
¿Qué puedo hacer?
```

No debe utilizar columnas simplemente porque existen en la entidad.

---

# 35. Densidad útil

Zaping es software empresarial.

Una tabla puede ser densa sin ser complicada.

La meta no es minimizar información.

Es maximizar **información útil por atención requerida**.

---

# 36. Filtros frecuentes visibles

Los filtros de uso cotidiano deben ser fáciles de encontrar.

Ejemplo:

```text
Estado
Proveedor
Fecha
Buscar...
```

Filtros avanzados pueden quedar en un panel secundario.

---

# 37. Filtros persistentes

Cuando aporte valor, Zaping puede recordar temporalmente filtros y contexto de navegación para evitar repetir configuración.

Esto debe implementarse únicamente cuando exista una experiencia clara.

---

# 38. Estados claros

Cada entidad con lifecycle debe mostrar su estado de forma visible.

Ejemplo:

```text
OC-000421    CONFIRMED
```

No debe requerirse inferir el estado a partir de botones disponibles.

---

# 39. Estado + siguiente acción

Idealmente:

```text
Estado: Pendiente de recepción

30 unidades pendientes

[Registrar recepción]
```

El estado debe ayudar al usuario a saber qué sigue.

---

# 40. Lenguaje empresarial

La interfaz debe hablar como el usuario.

Preferir:

```text
Registrar recepción
```

sobre:

```text
Crear InventoryMovement IN
```

Preferir:

```text
Cancelar compra
```

sobre:

```text
Modificar DocumentStatus
```

---

# 41. Consistencia terminológica

El mismo concepto debe utilizar el mismo nombre.

El lenguaje oficial debe alinearse con:

```text
GLOSSARY.md
```

---

# 42. Estados vacíos útiles

Un Empty State debe convertirse en orientación.

Ejemplo:

```text
No hay recepciones registradas.

Esta compra todavía tiene 30 unidades pendientes.

[Registrar primera recepción]
```

Es mejor que:

```text
Sin datos.
```

---

# 43. Errores accionables

Un error debe indicar:

```text
qué pasó
+
por qué
+
qué hacer
```

cuando sea posible.

Ejemplo:

```text
No puedes confirmar la entrega.

El producto CAT-120 solo tiene 4 unidades disponibles
y la entrega requiere 6.

[Revisar inventario]
```

---

# 44. No mostrar errores técnicos

El usuario no necesita ver:

```text
PrismaClientKnownRequestError
HTTP 409
Foreign key constraint
```

La aplicación debe traducirlos a significado empresarial.

---

# 45. Confirmaciones con consecuencias

Una confirmación debe explicar el efecto.

Ejemplo:

```text
Confirmar recepción

Se registrarán 20 unidades y el inventario aumentará
cuando la operación se complete.

[Volver] [Confirmar recepción]
```

---

# 46. Operaciones irreversibles

Las operaciones que producen historia o efectos difíciles de revertir deben diferenciar claramente:

```text
Guardar borrador
```

de:

```text
Confirmar
```

---

# 47. Borradores

Cuando el dominio soporte Draft, la interfaz puede permitir trabajar sin aplicar efectos definitivos.

Ejemplo:

```text
DRAFT
↓
editar
↓
revisar
↓
CONFIRM
```

Esto reduce errores.

---

# 48. No usar confirmaciones para todo

Preguntar:

```text
¿Estás seguro?
```

en cada pequeña acción reduce su efectividad.

ConfirmDialog debe reservarse para operaciones con consecuencias relevantes.

---

# 49. Feedback inmediato

Después de una operación el usuario debe saber que ocurrió.

Ejemplo:

```text
Recepción REC-002 registrada.
```

y, cuando sea útil:

```text
Stock actualizado.
Pendiente de compra: 0.
```

---

# 50. Mostrar consecuencias

Cuando una acción afecta otras áreas, la interfaz puede mostrar el resultado.

Ejemplo:

```text
Entrega confirmada.

Inventario
CAT-120     10 → 4

Pedido
Entregado   6
Pendiente   0
```

No es necesario mostrar cada detalle técnico.

---

# 51. Prevención antes que error

Siempre que sea posible, Zaping debe impedir o advertir problemas antes de que ocurran.

Ejemplo:

```text
Producto vencido
```

no debería aparecer como una selección normal disponible.

---

# 52. No confiar únicamente en frontend

La prevención visual mejora UX.

La validación real sigue perteneciendo al backend.

---

# 53. Flujos parciales

Zaping debe representar naturalmente operaciones parciales.

Ejemplos:

```text
Purchase
100 ordered
70 received
30 pending
```

y:

```text
SalesOrder
100 ordered
40 delivered
60 pending
```

La interfaz no debe tratar todo como:

```text
Pendiente
o
Completado
```

cuando existe progreso intermedio relevante.

---

# 54. Progreso operacional

Cuando exista un proceso compuesto, la interfaz puede mostrar progreso.

Ejemplo:

```text
Case

Programado      ✓
Preparación     ✓
Kit listo       ✓
Dispatch        ✓
Retorno         Pendiente
Conciliación    Pendiente
```

Esto permite comprender rápidamente el estado completo.

---

# 55. Healthcare no debe parecer otro ERP genérico

Healthcare es una oportunidad para diferenciar la experiencia.

El usuario no debe sentir que está rellenando tablas desconectadas llamadas:

```text
CaseDispatch
CaseReturn
Reconciliation
```

Debe percibir un workflow coherente alrededor de un Case.

---

# 56. Case como centro de contexto

Para Healthcare:

```text
Case
```

debe funcionar como eje principal.

Desde Case debe ser posible comprender:

```text
Quién
Dónde
Cuándo
Qué necesita
Qué está listo
Qué salió
Qué regresó
Qué se utilizó
Qué falta resolver
```

---

# 57. Case Calendar

El Calendar es una vista operacional.

Debe permitir:

* día;
* semana;
* mes;
* agenda;
* filtros;
* apertura rápida de Case.

---

# 58. Calendar como herramienta de trabajo

No debe limitarse a mostrar eventos.

Puede comunicar estados como:

```text
08:00
Hospital A
Dr. Pérez

Case CAS-281
⚠ Kit pendiente
```

o:

```text
12:00
Hospital B

✓ Material listo
```

---

# 59. Conflictos

Cuando Zaping detecte conflictos, debe mostrarlos dentro del workflow.

Ejemplos:

```text
El técnico ya tiene otro Case a esta hora.
```

```text
El equipo E-014 está asignado a otro procedimiento.
```

La alerta debe permitir entender y resolver el conflicto.

---

# 60. Preparación de Case

Warehouse no debería reconstruir manualmente información desde llamadas, mensajes o papeles.

La vista debe presentar:

```text
Case
Hospital
Procedimiento
Fecha
Técnico

Material solicitado
Disponibilidad
Lote sugerido
Equipo requerido

[Preparar]
```

---

# 61. CaseKit

El usuario debe poder distinguir claramente:

```text
Plantilla esperada
```

de:

```text
Maletín real preparado
```

La interfaz no debe confundir `KitTemplate` con `CaseKit`.

---

# 62. Custodia visible

Una vez realizado el Dispatch, Zaping debe permitir responder:

```text
¿Dónde está este equipo?
```

Ejemplo:

```text
Equipo E-014

Estado
Asignado

Custodio
Carlos López

Case
CAS-281

Hospital
Hospital A
```

---

# 63. Retorno basado en lo que salió

Al registrar retorno, Zaping debe mostrar automáticamente:

```text
Qué se entregó
```

para que el usuario indique:

```text
Usado
Retornado
Faltante
Dañado
```

No debe exigir capturar nuevamente todo desde cero.

---

# 64. Conciliación visual

Ejemplo:

```text
Producto       Salió   Usado   Regresó   Pendiente
CAT-100          5       2        3          0
CAT-200          3       1        1          1 ⚠
```

Las diferencias deben ser visibles inmediatamente.

---

# 65. Incidencias

Una diferencia no debe desaparecer dentro de una nota.

Debe presentarse como una tarea pendiente cuando requiera resolución.

Ejemplo:

```text
1 incidencia pendiente

CAT-200
1 unidad sin conciliar

[Resolver]
```

---

# 66. Equipo reutilizable

Los activos deben mostrar claramente:

```text
Disponibilidad
Ubicación
Custodio
Condición
Próximo Case
```

El usuario no debería necesitar consultar múltiples pantallas para determinar si un equipo puede utilizarse.

---

# 67. ERP Core no depende de Healthcare

La experiencia especializada no debe contaminar workflows generales.

Una venta directa debe poder continuar como:

```text
Nueva venta
↓
Entrega
```

sin pedir:

* médico;
* hospital;
* Case;
* técnico.

---

# 68. Progressive Specialization

Healthcare debe añadir contexto únicamente cuando el proceso lo requiere.

```text
ERP Core
↓
Healthcare context
```

No convertir todos los formularios genéricos en formularios médicos.

---

# 69. Personalización sin fragmentación

Zaping puede evolucionar hacia configuraciones por empresa.

Pero debe evitar convertirse en:

```text
una UI diferente
para cada cliente
```

La preferencia es:

```text
producto estándar
+
configuración
```

antes que customizaciones permanentes.

---

# 70. Defaults inteligentes

Los valores predecibles deben completarse automáticamente cuando sea seguro.

Ejemplos:

* Company del usuario;
* fecha actual;
* usuario responsable;
* moneda configurada;
* contexto de Purchase al abrir Receipt.

El usuario no debe capturar información que el sistema ya conoce.

---

# 71. No adivinar información crítica

Un default no debe ocultar una decisión importante.

Ejemplo:

No seleccionar automáticamente un pagador cuando existen varias posibilidades relevantes.

---

# 72. Autocompletado contextual

Zaping debe reutilizar datos existentes.

Ejemplo:

```text
Purchase
↓
Register Receipt
```

puede precargar:

* proveedor;
* productos;
* cantidades pendientes;
* costo esperado.

El usuario confirma lo que realmente recibió.

---

# 73. Automatización con control

La automatización debe reducir trabajo, no eliminar controles necesarios.

Ejemplo Healthcare:

```text
Reconciliation
↓
Used Material
↓
Create Sales Draft
```

es preferible inicialmente a:

```text
Reconciliation
↓
Automatic invoice without review
```

---

# 74. IA futura

Zaping AI deberá seguir la misma filosofía.

La IA debe:

```text
explicar
sugerir
priorizar
ayudar
```

antes que ejecutar silenciosamente operaciones críticas.

---

# 75. Recomendaciones explicables

Ejemplo futuro:

```text
Recomendamos comprar 30 unidades.

Motivo:
• stock actual: 8
• mínimo: 15
• consumo promedio: 12/semana
• entrega proveedor: 7 días
```

La recomendación debe tener contexto.

---

# 76. Notificaciones

Las alertas deben representar algo accionable.

Evitar generar notificaciones por cada evento del sistema.

Priorizar:

```text
requiere acción
riesgo
deadline
error
cambio importante
```

---

# 77. Urgencia

La interfaz debe distinguir entre:

```text
Información
Atención
Urgente
```

No utilizar rojo para cualquier estado que no sea perfecto.

---

# 78. Estados semánticos

Los colores apoyan categorías como:

```text
Neutral
Info
Success
Warning
Danger
```

El texto continúa siendo obligatorio para significado relevante.

---

# 79. Mobile Friendly

La aplicación web debe continuar siendo usable desde dispositivos pequeños para tareas razonables.

Sin embargo:

> Responsive Web no sustituye necesariamente una futura Mobile App.

Los técnicos de campo pueden necesitar posteriormente:

* cámara;
* QR;
* offline;
* notificaciones;
* UX especializada.

---

# 80. Prioridad responsive

Inicialmente:

```text
Desktop
↓
Tablet
↓
Mobile-compatible
```

sin sacrificar el diseño de escritorio empresarial.

---

# 81. Accesibilidad

La experiencia debe considerar:

* navegación por teclado;
* foco;
* contraste;
* labels;
* semántica;
* lectores de pantalla;
* mensajes claros.

La accesibilidad debe ser una propiedad de los patrones compartidos.

---

# 82. Performance como UX

Una interfaz conceptualmente buena pero lenta sigue siendo una mala experiencia.

El usuario debe recibir feedback inmediato mientras una operación continúa.

---

# 83. Optimistic UI

Puede utilizarse únicamente cuando:

* el riesgo es bajo;
* el rollback es claro;
* no oculta una operación crítica.

No debe utilizarse de forma que una Delivery parezca confirmada antes de que el backend haya aplicado correctamente Inventory.

---

# 84. Loading localizado

Preferir actualizar solamente la parte necesaria.

Ejemplo:

```text
[Confirmando entrega...]
```

en lugar de bloquear completamente la aplicación cuando no sea necesario.

---

# 85. Historial

Las entidades importantes deben permitir comprender qué ocurrió.

Ejemplo:

```text
18 Ago 10:30
Compra confirmada
por Ana

19 Ago 09:20
Recepción REC-001
40 unidades
por Juan
```

La complejidad de una auditoría completa puede vivir en una vista secundaria.

---

# 86. Timeline

Un patrón Timeline puede ser útil para entidades con lifecycle significativo.

Ejemplos:

```text
Purchase
SalesOrder
Case
Equipment
```

Su adopción debe validarse antes de convertirlo en componente universal.

---

# 87. Permisos y UX

La interfaz debe esconder o deshabilitar acciones que el usuario no puede ejecutar.

Pero el backend continúa siendo la autoridad.

---

# 88. No mostrar caminos muertos

Un usuario de almacén no necesita ver permanentemente:

```text
Administración de usuarios
```

si nunca podrá acceder.

La navegación puede adaptarse a permisos.

---

# 89. Deshabilitado vs oculto

Ocultar es adecuado cuando la acción nunca pertenece al usuario.

Deshabilitar puede ser mejor cuando la acción sí pertenece al usuario, pero el estado actual impide realizarla.

Ejemplo:

```text
[Confirmar entrega]
disabled

No hay inventario suficiente.
```

---

# 90. Onboarding

La experiencia futura de onboarding debe minimizar configuración innecesaria.

Conceptualmente:

```text
Crear empresa
↓
Configurar información esencial
↓
Importar datos
↓
Comenzar operación
```

No debe exigir completar todas las configuraciones futuras antes de poder utilizar el Core.

---

# 91. Importación como UX de adopción

La importación de datos no es únicamente una capacidad técnica.

Es parte de la experiencia de migrar hacia Zaping.

Debe ofrecer:

```text
Subir archivo
↓
Mapear columnas
↓
Validar
↓
Corregir
↓
Importar
↓
Resultado
```

sin requerir manipulación directa de base de datos.

---

# 92. Consistencia entre módulos

El usuario debe aprender una interacción una vez y reutilizar ese conocimiento.

Ejemplo:

```text
Loading
Empty State
Table
Status
Actions
ConfirmDialog
```

deben comportarse de manera coherente entre módulos.

---

# 93. Innovación consistente

Consistencia no significa impedir mejorar un patrón.

Cuando encontremos una solución mejor:

```text
validar
↓
adoptar
↓
actualizar componente compartido
↓
migrar consumidores progresivamente
```

No crear una segunda experiencia permanente para evitar actualizar la primera.

---

# 94. Current vs Target

Este documento define principalmente la **experiencia objetivo**.

No todas sus capacidades están implementadas actualmente.

Ejemplos TARGET:

```text
Action Dashboard
360 Views completas
Warehouse Operations
Global Search
Healthcare Calendar
```

Su existencia aquí significa:

> la experiencia futura debe evolucionar en esta dirección.

No:

> ya está implementado.

---

# 95. Orden de implementación UX

La dirección general debe priorizar:

```text
1. Consistencia de Core
2. Flujos críticos
3. Contexto y acciones
4. 360 Views
5. Workspaces
6. Search
7. Healthcare specialization
8. Automation
9. Intelligence
```

El roadmap puede ajustar el orden según necesidades comerciales.

---

# 96. Métricas futuras de UX

Cuando Zaping tenga usuarios productivos podrá medir:

* tiempo para completar tareas;
* errores;
* abandono de formularios;
* pasos por workflow;
* búsquedas;
* acciones frecuentes;
* uso de features;
* soporte requerido.

Las métricas deben utilizarse para mejorar la experiencia, no para justificar complejidad innecesaria.

---

# 97. Preguntas para nuevas pantallas

Antes de diseñar una pantalla debe responderse:

1. ¿Quién la usa?
2. ¿Qué tarea intenta completar?
3. ¿Qué necesita saber primero?
4. ¿Cuál es la acción principal?
5. ¿Qué puede salir mal?
6. ¿Qué información ya conoce Zaping?
7. ¿Qué podemos precargar?
8. ¿Qué puede quedar oculto hasta ser necesario?
9. ¿Qué ocurre después?
10. ¿Existe un patrón existente que podamos reutilizar?

---

# 98. Preguntas para nuevos workflows

Antes de agregar un paso:

> ¿Este paso existe porque el negocio lo necesita o porque nuestra implementación técnica lo necesita?

Si únicamente existe por la arquitectura interna, debe evaluarse si puede ocultarse al usuario.

---

# 99. Regla de pasos

Menos pasos no siempre significa mejor UX.

La meta es:

> **menos pasos innecesarios.**

Una confirmación adicional es correcta cuando evita una operación irreversible.

Es incorrecta cuando solo agrega fricción sin reducir riesgo.

---

# 100. Anti-patrones

Zaping debe evitar:

## Database UI

Una pantalla por tabla sin contexto operacional.

## Button Wall

Muchas acciones con la misma jerarquía.

## Navigation Maze

Necesidad de recorrer varios módulos para completar una sola tarea.

## Repeated Capture

Solicitar información que Zaping ya conoce.

## Technical Language

Mostrar conceptos internos en lugar de lenguaje del negocio.

## Silent Failure

Una operación falla sin explicar qué ocurrió.

## Hidden Consequence

Una acción modifica inventario o estado sin comunicarlo.

## Giant Form

Mostrar todos los campos posibles desde el principio.

## Module Isolation

Diseñar cada módulo como si el resto de Zaping no existiera.

---

# 101. Relación con Design System

```text
ZAPING_WAY.md
→ experiencia y comportamiento

DESIGN_SYSTEM.md
→ construcción visual
```

Ejemplo:

`ZAPING_WAY` decide que una pantalla debe tener una acción principal.

`DESIGN_SYSTEM` define cómo se representa visualmente un botón `Primary`.

---

# 102. Relación con Business Components

```text
ZAPING_WAY.md
→ define el patrón de experiencia

BUSINESS_COMPONENTS.md
→ proporciona herramientas reutilizables
```

Ejemplo:

Zaping Way dice:

> permitir seleccionar rápidamente un cliente dentro de la cotización.

Business Components proporciona:

```text
CustomerSelector
```

---

# 103. Relación con arquitectura

UX no debe romper reglas del dominio para simplificar una pantalla.

Ejemplo:

La interfaz puede presentar:

```text
Venta inmediata
```

como una sola experiencia.

Internamente pueden continuar existiendo:

```text
SalesOrder
+
Delivery
```

si esa separación es necesaria para mantener el dominio correcto.

---

# 104. UX simplifica, no falsifica

La interfaz puede ocultar complejidad técnica.

No debe ocultar hechos empresariales relevantes.

Ejemplo:

Una salida temporal Healthcare no puede presentarse como:

```text
Venta completada
```

si el material todavía está bajo custodia.

---

# 105. Relación con Product Vision

La experiencia debe apoyar el posicionamiento de Zaping:

* moderno;
* especializado;
* simple;
* trazable;
* orientado a operaciones reales;
* preparado para inteligencia futura.

La UX no es una capa decorativa del producto.

Es parte de su propuesta de valor.

---

# 106. Principios resumidos

Zaping debe ser:

```text
Simple por defecto
Contextual
Orientado a tareas
Consistente
Trazable
Progresivo
Accionable
Accesible
Rápido
Especializable
```

---

# 107. Regla de oro

Cuando exista duda entre:

```text
mostrar cómo funciona internamente el sistema
```

y:

```text
mostrar cómo piensa el usuario sobre su trabajo
```

debemos preferir el modelo mental del usuario siempre que podamos mantener correctamente las reglas del dominio.

---

# 108. Declaración final

Zaping no debe aspirar solamente a ser un ERP con una interfaz moderna.

Debe aspirar a que el trabajo empresarial se sienta más claro.

La experiencia ideal es:

```text
Sé qué está pasando.
↓
Sé qué necesita atención.
↓
Tengo el contexto necesario.
↓
Puedo actuar sin perderme.
↓
Zaping mantiene la trazabilidad por mí.
```

Ese es **The Zaping Way**.
