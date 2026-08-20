# ADR-007 — RBAC y Autorización por Permisos

**Estado:** ACCEPTED
**Estado de implementación:** PARTIAL
**Fecha original:** 2026-07-10
**Última revisión:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Contexto

Zaping será utilizado por personas con responsabilidades diferentes.

Ejemplos:

* administradores;
* vendedores;
* responsables de compras;
* almacén;
* técnicos Healthcare;
* dirección.

No todos deben poder realizar las mismas operaciones.

---

# 2. Problema

La autenticación responde:

> ¿Quién es el usuario?

pero se requiere además responder:

> ¿Qué puede hacer?

Utilizar únicamente condiciones dispersas como:

```ts
if (user.role === "ADMIN")
```

en múltiples partes del código genera:

* duplicación;
* dificultad de mantenimiento;
* permisos poco flexibles;
* alto acoplamiento entre rol y comportamiento.

---

# 3. Opciones consideradas

## Opción A — Sin roles

Todo usuario autenticado puede realizar todas las operaciones.

Rechazado por motivos evidentes de seguridad.

---

## Opción B — Roles rígidos

Cada endpoint verifica directamente un nombre de rol.

Ejemplo:

```text
ADMIN
WAREHOUSE
SALES
```

Es sencillo pero poco flexible.

---

## Opción C — RBAC con permisos

Los usuarios reciben roles.

Los roles agrupan permisos.

```text
User
 ↓
Role
 ↓
Permissions
```

Esta opción proporciona una base más flexible.

---

# 4. Decisión

Zaping utiliza **Role-Based Access Control (RBAC)**.

La arquitectura debe evolucionar hacia:

```text
User
↓
Role
↓
Permissions
```

Los roles representan conjuntos administrativos de permisos.

Las operaciones sensibles deben autorizarse en backend.

---

# 5. Implementación actual

Actualmente existe soporte de roles y `RolesGuard`.

La implementación todavía es más simple que el modelo objetivo de permisos granulares.

Por esta razón:

```text
Estado de decisión:
ACCEPTED

Estado de implementación:
PARTIAL
```

---

# 6. Permisos

Ejemplos conceptuales:

```text
customers.read
customers.write

inventory.read
inventory.adjust

purchases.create
purchases.approve

receipts.create

sales.create
deliveries.confirm

cases.view
cases.assign

caseKits.prepare
caseKits.dispatch

billing.view
```

La nomenclatura definitiva se formalizará al implementar la matriz completa.

---

# 7. Roles

Un rol puede agrupar permisos.

Ejemplo:

```text
WAREHOUSE
├── inventory.read
├── receipts.create
├── caseKits.prepare
├── caseKits.dispatch
└── caseKits.return
```

No todos los roles futuros deben existir desde el MVP.

---

# 8. Backend como autoridad

La interfaz puede ocultar opciones no autorizadas.

Sin embargo:

> La autorización real debe realizarse en backend.

Un usuario nunca debe poder ejecutar una acción simplemente llamando directamente al endpoint que la UI ocultó.

---

# 9. Multi-Tenancy

RBAC no sustituye Multi-Tenancy.

Un usuario puede tener permiso:

```text
customers.read
```

y aun así únicamente puede consultar Customers pertenecientes a su Company.

La autorización completa requiere:

```text
Authenticated
+
Permission
+
Tenant
```

---

# 10. Ownership

En fases futuras pueden aparecer reglas como:

> usuario puede editar únicamente sus propias oportunidades.

Estas reglas de ownership no deben forzarse artificialmente dentro de RBAC.

Pueden requerir políticas adicionales.

---

# 11. Principio de mínimo privilegio

Los roles deben conceder únicamente los permisos necesarios.

No deben utilizarse roles administrativos amplios como solución rápida para resolver un problema de permisos.

---

# 12. Cambios de permisos

Los cambios relevantes en:

* roles;
* permisos;
* acceso administrativo;

deben ser auditables.

---

# 13. Healthcare

Healthcare refuerza la necesidad de permisos granulares.

Ejemplos:

Un técnico puede:

* consultar sus Cases;
* ver material asignado;
* confirmar ciertos eventos.

pero no necesariamente:

* ajustar inventario;
* editar precios;
* aprobar compras;
* administrar usuarios.

---

# 14. UX

La interfaz debe adaptarse a permisos.

No tiene sentido mostrar permanentemente acciones que el usuario nunca puede ejecutar.

Esto mejora experiencia, pero no sustituye la protección backend.

---

# 15. Consecuencias positivas

* seguridad;
* flexibilidad;
* menor duplicación;
* soporte de diferentes perfiles;
* crecimiento organizacional;
* base para Healthcare.

---

# 16. Consecuencias negativas

* mayor complejidad;
* matriz de permisos;
* necesidad de administración;
* más escenarios de testing.

---

# 17. Pruebas

Las operaciones críticas deben probar:

```text
usuario autorizado
→ permitido
```

y:

```text
usuario no autorizado
→ denegado
```

También deben combinarse con escenarios multi-tenant cuando corresponda.

---

# 18. Evolución futura

Posibles capacidades:

* múltiples roles por usuario;
* permisos personalizados;
* scopes;
* policies;
* ownership;
* permisos administrativos de plataforma.

No deben implementarse antes de existir una necesidad validada.

---

# 19. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-006 — API First.
* `SECURITY_PRINCIPLES.md`.

---

# 20. Decisión final

> Identidad, permiso y tenant son controles diferentes.

Zaping debe verificar los tres cuando corresponda.

RBAC proporciona la base para que cada usuario pueda realizar únicamente las operaciones necesarias para su responsabilidad.
