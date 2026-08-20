# ADR-001 — Arquitectura Multi-Tenant

**Estado:** ACCEPTED
**Fecha original:** 2026-07-10
**Última revisión:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Contexto

Zaping es una plataforma SaaS diseñada para atender múltiples empresas independientes utilizando una misma plataforma tecnológica.

Cada empresa debe poder utilizar:

* los mismos servicios;
* la misma aplicación;
* la misma infraestructura base;
* y el mismo modelo de producto;

sin poder acceder a la información empresarial de otras compañías.

El aislamiento entre empresas constituye una propiedad fundamental de seguridad y arquitectura.

---

# 2. Problema

Se requiere decidir cómo deben coexistir múltiples empresas dentro de Zaping.

Las principales alternativas consideradas fueron:

1. un despliegue independiente por cliente;
2. una plataforma compartida con aislamiento lógico por tenant.

---

# 3. Opciones consideradas

## Opción A — Single Tenant

Cada cliente utiliza una instalación independiente de Zaping.

### Ventajas

* aislamiento físico más sencillo;
* posibilidad de personalización por instalación;
* despliegues independientes.

### Desventajas

* mayor costo de infraestructura;
* mantenimiento duplicado;
* actualizaciones más complejas;
* dificultad para escalar SaaS;
* monitoreo fragmentado;
* onboarding más costoso.

---

## Opción B — Multi-Tenant

Todas las empresas utilizan la misma plataforma.

Los datos empresariales se encuentran asociados a un tenant determinado.

### Ventajas

* infraestructura compartida;
* mantenimiento centralizado;
* despliegues simplificados;
* escalabilidad;
* menor costo operativo;
* onboarding más rápido;
* mejor base para SaaS.

### Desventajas

* mayores exigencias de seguridad;
* necesidad de aislamiento consistente;
* mayor disciplina arquitectónica;
* pruebas multi-tenant obligatorias en áreas críticas.

---

# 4. Decisión

Zaping adopta una arquitectura **Multi-Tenant**.

Cada usuario autenticado opera dentro del contexto de una `Company`.

Los recursos empresariales pertenecen a una Company directa o indirectamente.

El backend debe garantizar que una operación solamente pueda acceder a recursos pertenecientes al tenant autenticado.

El acceso entre compañías está prohibido salvo que una futura capacidad administrativa de plataforma lo permita explícitamente y cuente con controles específicos.

---

# 5. Modelo conceptual

```text
Zaping Platform
│
├── Company A
│   ├── Users
│   ├── Customers
│   ├── Products
│   ├── Purchases
│   ├── Inventory
│   └── Sales
│
├── Company B
│   ├── Users
│   ├── Customers
│   ├── Products
│   ├── Purchases
│   ├── Inventory
│   └── Sales
│
└── Company C
```

La existencia de identificadores UUID globales no elimina la necesidad de validar el tenant.

---

# 6. Regla de propiedad

Las entidades pueden pertenecer al tenant de dos maneras.

## 6.1 Propiedad directa

La entidad contiene explícitamente:

```text
companyId
```

Ejemplos:

```text
Product
Customer
Supplier
Purchase
Sale
InventoryMovement
```

---

## 6.2 Propiedad heredada

Una entidad hija puede pertenecer al tenant mediante una relación obligatoria con una entidad padre.

Ejemplo conceptual:

```text
PurchaseItem
    ↓
Purchase
    ↓
Company
```

No es obligatorio duplicar `companyId` en todas las tablas si la pertenencia puede determinarse de forma segura mediante el agregado.

Sin embargo, la operación debe continuar validando el tenant.

---

# 7. Regla de confianza

El `companyId` enviado desde frontend nunca debe considerarse por sí solo una fuente confiable.

El tenant debe derivarse principalmente de:

```text
JWT
↓
Usuario autenticado
↓
Company
↓
Contexto de la operación
```

El cliente no puede cambiar de tenant modificando un parámetro o payload.

---

# 8. Reglas de implementación

Toda operación empresarial debe garantizar aislamiento en:

* consultas;
* creación;
* actualización;
* eliminación;
* relaciones;
* búsquedas;
* reportes;
* exportaciones;
* dashboards;
* documentos;
* integraciones.

---

# 9. Relaciones entre tenants

Antes de crear una relación entre recursos empresariales debe verificarse que pertenezcan al mismo tenant.

Ejemplo:

```text
Purchase
Company A

Supplier
Company B
```

debe ser rechazado.

Conocer el UUID de un recurso no otorga autorización para utilizarlo.

---

# 10. Servicios

Los Services son responsables de garantizar que las reglas de negocio respeten el tenant.

No debe existir una ruta de negocio que permita operar un recurso sin considerar su Company.

---

# 11. Persistencia

Las consultas de persistencia deben incluir aislamiento suficiente.

Conceptualmente:

```text
resource.id
+
tenant context
```

La técnica exacta puede variar dependiendo del modelo Prisma y de la relación entre entidades.

---

# 12. APIs

Cada request autenticado debe ejecutarse dentro del contexto del usuario.

Los endpoints no deben permitir seleccionar libremente una Company diferente mediante:

* query parameters;
* body;
* headers manipulables;
* IDs de recursos.

---

# 13. Auditoría

Los eventos de auditoría relacionados con información empresarial deben permitir identificar el tenant correspondiente.

---

# 14. Pruebas obligatorias

Los módulos críticos deben incluir escenarios equivalentes a:

```text
Usuario Company A
↓
intenta consultar recurso Company B
↓
DENEGADO
```

y:

```text
Usuario Company A
↓
intenta modificar recurso Company B
↓
DENEGADO
```

También deben probarse relaciones cruzadas cuando exista riesgo.

---

# 15. Módulos afectados

La decisión aplica transversalmente a:

* Authentication;
* Users;
* Customers;
* Suppliers;
* Products;
* Inventory;
* Purchases;
* Purchase Receipts;
* Quotes;
* Sales;
* Deliveries;
* Returns;
* Dashboard;
* Audit;
* Healthcare;
* Equipment;
* Billing;
* Radar;
* futuras capacidades empresariales.

---

# 16. Consecuencias positivas

* arquitectura SaaS;
* menor costo operativo;
* mantenimiento centralizado;
* despliegues consistentes;
* mayor escalabilidad;
* onboarding simplificado;
* infraestructura compartida.

---

# 17. Consecuencias negativas

* mayor responsabilidad de seguridad;
* necesidad de pruebas específicas;
* consultas tenant-aware;
* riesgo alto ante errores de autorización;
* disciplina adicional en relaciones y APIs.

---

# 18. Evolución futura

La plataforma podrá incorporar capacidades como:

* Platform Administration;
* provisioning de tenants;
* gestión de suscripciones;
* facturación SaaS;
* métricas agregadas;
* soporte multiempresa administrativo.

Cualquier operación cross-tenant deberá diseñarse explícitamente.

No puede implementarse reutilizando endpoints normales de negocio sin controles adicionales.

---

# 19. ADR relacionados

* ADR-004 — UUID como identificador primario.
* ADR-007 — RBAC y permisos.
* ADR-009 — Modular Monolith.
* `SECURITY_PRINCIPLES.md`.

---

# 20. Decisión final

> El aislamiento entre Companies es una garantía arquitectónica de Zaping.

La arquitectura, APIs y reglas de negocio deben impedir que una operación normal atraviese los límites de un tenant.
