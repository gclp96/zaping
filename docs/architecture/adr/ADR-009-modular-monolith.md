# ADR-009 — Modular Monolith

**Estado:** ACCEPTED
**Estado de implementación:** ACTIVE
**Origen:** Propuesta fundacional de julio de 2026
**Fecha de aceptación:** 2026-08-19
**Última revisión:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Nota de consolidación

El ADR original quedó documentalmente inconsistente durante Foundation y permaneció marcado como propuesta.

La documentación arquitectónica existente, sin embargo, ya establecía a Modular Monolith como la arquitectura actual de Zaping.

Esta revisión formaliza finalmente la decisión.

---

# 2. Contexto

Zaping contiene múltiples capacidades empresariales:

* Authentication;
* Companies;
* Customers;
* Suppliers;
* Products;
* Inventory;
* Purchases;
* Quotes;
* Sales;
* Returns;
* Dashboard;
* Healthcare;
* futuras capacidades de Billing, Radar y AI.

Estos dominios necesitan límites claros.

Al mismo tiempo, el producto todavía se encuentra en una etapa donde dividir prematuramente el sistema en múltiples servicios independientes aumentaría considerablemente:

* infraestructura;
* despliegues;
* observabilidad;
* comunicación distribuida;
* testing;
* manejo de errores;
* consistencia;
* costos operativos.

---

# 3. Problema

Se necesita una arquitectura que permita:

* modularidad;
* límites de dominio;
* crecimiento;
* mantenibilidad;
* pruebas;
* despliegue sencillo;
* consistencia transaccional;

sin asumir prematuramente el costo de microservicios.

---

# 4. Opciones consideradas

## Opción A — Monolito sin límites

Una sola aplicación donde cualquier módulo puede utilizar directamente cualquier dato o lógica.

### Ventajas

* implementación inicial rápida;
* despliegue sencillo.

### Desventajas

* alto acoplamiento;
* reglas duplicadas;
* límites ambiguos;
* dificultad de evolución;
* mayor deuda técnica.

---

## Opción B — Microservicios

Cada dominio se despliega como servicio independiente.

### Ventajas

* aislamiento de despliegue;
* escalamiento independiente;
* equipos independientes;
* autonomía tecnológica.

### Desventajas

* complejidad distribuida;
* consistencia eventual;
* observabilidad avanzada;
* más infraestructura;
* más DevOps;
* fallos de red;
* contratos distribuidos;
* mayor costo operacional.

Para la etapa actual de Zaping esta complejidad no está justificada.

---

## Opción C — Modular Monolith

Una aplicación desplegable con módulos internos claramente delimitados.

### Ventajas

* simplicidad operacional;
* transacciones locales;
* debugging sencillo;
* límites de dominio;
* menor infraestructura;
* capacidad de evolución posterior.

### Desventajas

* requiere disciplina;
* una mala implementación puede degenerar en monolito acoplado;
* no proporciona escalamiento independiente por módulo.

---

# 5. Decisión

Zaping adopta un **Modular Monolith** como arquitectura principal.

Conceptualmente:

```text
Zaping Backend
│
├── Auth
├── Companies
├── Users
├── Customers
├── Suppliers
├── Products
├── Inventory
├── Purchases
├── Sales
├── Returns
├── Healthcare
└── ...
```

Todos forman parte inicialmente de una misma aplicación backend, pero cada módulo conserva responsabilidades propias.

---

# 6. Un despliegue no significa un dominio

Aunque varios módulos compartan:

* proceso;
* repositorio;
* base de datos;
* infraestructura;

no significa que puedan ignorar sus fronteras.

```text
Mismo deployment
≠
Mismo dominio
```

---

# 7. Propiedad del dominio

Cada módulo debe ser propietario de sus reglas.

Ejemplos:

```text
Inventory
→ stock
→ movimientos
→ lotes
→ disponibilidad

Purchases
→ ciclo de compra
→ cantidades ordenadas
→ proveedor

Sales
→ compromiso comercial
→ precios
→ cliente
→ ciclo comercial

Healthcare
→ Cases
→ preparación
→ custodia
→ conciliación clínica-operacional
```

---

# 8. Comunicación entre módulos

Los módulos deben comunicarse mediante contratos explícitos.

Preferir:

```text
Purchases
↓
Inventory public service
↓
Inventory
```

sobre:

```text
Purchases
↓
acceso directo a tablas internas de Inventory
```

---

# 9. Base de datos compartida

El Modular Monolith puede utilizar una misma instancia PostgreSQL.

Esto no significa que todos los módulos sean propietarios de todas las tablas.

La propiedad lógica continúa existiendo.

---

# 10. Prisma

Prisma proporciona acceso técnico a la base de datos.

Tener acceso a:

```text
PrismaService
```

no concede automáticamente permiso arquitectónico para modificar cualquier entidad.

La frontera de dominio tiene prioridad sobre la posibilidad técnica.

---

# 11. Transacciones

Una ventaja importante del Modular Monolith es la capacidad de mantener operaciones transaccionales locales.

Ejemplo:

```text
PurchaseReceipt
+
ReceiptItems
+
InventoryBatch
+
InventoryMovement
+
Stock
```

pueden coordinarse dentro de una transacción cuando sea necesario.

---

# 12. Dependencias

Las dependencias entre módulos deben mantenerse controladas.

Evitar ciclos como:

```text
Sales
→ Inventory
→ Sales
```

Cuando aparezca una dependencia circular debe revisarse:

* responsabilidad;
* contrato;
* dominio propietario;
* posibilidad de evento.

---

# 13. Eventos de dominio

Los Domain Events pueden utilizarse dentro del Modular Monolith cuando aporten desacoplamiento real.

Ejemplos conceptuales:

```text
PurchaseReceived
DeliveryConfirmed
CaseReconciled
```

Sin embargo:

> utilizar eventos no implica convertir automáticamente Zaping en una arquitectura distribuida.

Pueden existir eventos in-process.

---

# 14. Event Ready

La arquitectura debe permitir evolucionar hacia comunicación por eventos donde tenga sentido.

Esto no significa implementar desde ahora:

* Kafka;
* RabbitMQ;
* event bus distribuido;
* message brokers;

sin una necesidad validada.

---

# 15. Frontend

El frontend también debe mantener modularidad por dominio y feature.

La existencia de una sola aplicación Next.js no justifica mezclar todos los workflows dentro de componentes globales.

---

# 16. Multi-tenancy

Todos los módulos continúan sujetos a ADR-001.

El Modular Monolith no modifica las reglas de aislamiento.

---

# 17. Seguridad

Cada módulo debe aplicar:

* Authentication;
* Authorization;
* Tenant Isolation;
* Validation;
* Audit;

según corresponda.

No debe asumir que otro módulo ya realizó todas las verificaciones.

---

# 18. Escalamiento

La primera estrategia de escalamiento debe ser escalar la aplicación como unidad cuando sea suficiente.

Ejemplo:

```text
Load Balancer
│
├── Zaping Instance 1
├── Zaping Instance 2
└── Zaping Instance 3
```

No se deben extraer microservicios únicamente para obtener escalamiento horizontal.

---

# 19. Extracción futura de servicios

Un módulo podrá considerarse candidato a servicio independiente cuando exista evidencia como:

* necesidad de escalamiento diferente;
* alta carga aislada;
* boundary de dominio estable;
* lifecycle independiente;
* necesidades operativas distintas;
* equipo independiente;
* resiliencia específica;
* integración externa especializada.

---

# 20. Regla de extracción

No se crea un microservicio porque:

> “algún día podríamos necesitarlo”.

Debe existir una necesidad medible.

---

# 21. Evolución posible

La evolución arquitectónica puede ser:

```text
Modular Monolith
        ↓
Domain Events
        ↓
Extracción selectiva de servicios
        ↓
Arquitectura distribuida
solo donde esté justificado
```

No existe obligación de llegar a microservicios.

Un Modular Monolith correctamente diseñado puede continuar siendo la arquitectura adecuada durante muchos años.

---

# 22. Zaping Radar

Radar puede evolucionar con mayor independencia que algunos módulos ERP debido a que:

* obtiene información externa;
* puede tener ciclos de ejecución diferentes;
* puede requerir jobs;
* crawling/conectores;
* procesamiento asíncrono.

Su separación física debe decidirse cuando la implementación real lo justifique.

---

# 23. Zaping AI

AI también puede requerir infraestructura independiente en etapas posteriores.

Eso no obliga a descomponer ERP Core.

---

# 24. Consecuencias positivas

* menor complejidad operacional;
* desarrollo rápido;
* transacciones locales;
* debugging sencillo;
* límites de dominio;
* testabilidad;
* menor costo de infraestructura;
* posibilidad de evolución posterior.

---

# 25. Consecuencias negativas

* requiere disciplina arquitectónica;
* módulos pueden acoplarse si se accede directamente a persistencia;
* despliegue conjunto;
* escalamiento inicialmente conjunto.

---

# 26. Señales de deterioro

El Modular Monolith debe revisarse si aparecen patrones como:

* módulos modificando directamente datos ajenos;
* dependencias circulares;
* servicios gigantes;
* reglas duplicadas;
* cambios pequeños afectando todo el sistema;
* límites imposibles de identificar.

Estos problemas no significan automáticamente que se necesiten microservicios.

Primero debe corregirse la modularidad.

---

# 27. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-005 — Arquitectura por capas.
* ADR-006 — API First.
* ADR-007 — RBAC.
* ADR-008 — Documentation First.

---

# 28. Decisión final

> Zaping será modular antes de ser distribuido.

La prioridad es construir límites correctos de negocio dentro de una arquitectura operativamente simple.

Los servicios independientes aparecerán únicamente cuando exista una razón demostrable.
