# ADR-003 — Estrategia Global de Soft Delete

**Estado:** SUPERSEDED
**Reemplazado por:** ADR-012 — Estrategia de Ciclo de Vida de Entidades
**Fecha original:** 2026-07-10
**Última revisión:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Nota histórica

Este ADR documenta una decisión arquitectónica tomada durante Foundation.

La decisión original establecía:

> Todas las entidades empresariales utilizarán Soft Delete mediante `deletedAt`.

Durante la evolución posterior del sistema se comprobó que una estrategia única de Soft Delete no representa correctamente todos los tipos de entidad de Zaping.

Por esta razón la decisión queda marcada como:

**DEPRECATED**

y no debe utilizarse como regla para nuevas implementaciones.

Se creará posteriormente un ADR específico de **Entity Lifecycle** que definirá cuándo utilizar:

* `isActive`;
* cancelación;
* Soft Delete;
* inmutabilidad;
* eliminación física;
* reversión.

---

# 2. Contexto original

Los sistemas empresariales contienen información con valor:

* operativo;
* histórico;
* financiero;
* comercial;
* y de auditoría.

Eliminar permanentemente registros puede provocar:

* pérdida de historia;
* referencias rotas;
* reportes inconsistentes;
* imposibilidad de recuperación.

Por esta razón se buscó evitar eliminaciones destructivas indiscriminadas.

---

# 3. Problema original

Se evaluaron dos alternativas generales:

### Hard Delete

Eliminar físicamente el registro.

### Soft Delete

Mantenerlo almacenado y marcarlo mediante:

```text
deletedAt
```

---

# 4. Decisión original

La decisión de 2026-07-10 estableció que las entidades empresariales utilizarían:

```text
deletedAt DateTime?
```

Los registros activos tendrían:

```text
deletedAt = NULL
```

y los eliminados:

```text
deletedAt != NULL
```

---

# 5. Motivos originales

La decisión buscaba:

* preservar historia;
* permitir recuperación;
* proteger auditoría;
* evitar referencias rotas;
* reducir eliminaciones accidentales.

Estos objetivos continúan siendo válidos.

La estrategia uniforme elegida para alcanzarlos es la parte que se considera obsoleta.

---

# 6. Evidencia de evolución

La implementación actual utiliza distintos mecanismos según el tipo de entidad.

## Catálogos y maestros

Existen patrones como:

```text
isActive
```

por ejemplo en entidades como:

* Product;
* Customer;
* Supplier;
* User;
* Category.

---

## Documentos transaccionales

Existen estados de negocio como:

```text
DRAFT
CONFIRMED
CANCELLED
```

Una Purchase o Sale confirmada no debe desaparecer simplemente mediante Soft Delete.

---

## Registros históricos

Entidades como:

```text
InventoryMovement
AuditLog
```

requieren principalmente preservación e inmutabilidad.

Su concepto no es “activo/inactivo”.

---

# 7. Problema de la decisión global

Aplicar `deletedAt` a todas las entidades produce semánticas incorrectas.

Ejemplos:

### Product

Puede necesitar:

```text
isActive = false
```

porque el producto dejó de comercializarse.

Eso no significa necesariamente que haya sido “eliminado”.

---

### Purchase

Puede estar:

```text
CANCELLED
```

La cancelación es un evento empresarial.

No es equivalente a borrar la compra.

---

### InventoryMovement

Debe preservarse por trazabilidad.

Normalmente no debe existir una operación de eliminación de usuario.

---

### AuditLog

Debe conservar historia.

Aplicar Soft Delete no aporta valor al flujo normal.

---

# 8. Decisión actual sobre este ADR

La decisión de aplicar Soft Delete globalmente queda retirada.

Este ADR permanece para preservar la historia arquitectónica.

No debe utilizarse para justificar la incorporación automática de:

```text
deletedAt
```

a nuevas entidades.

---

# 9. Regla temporal

Hasta que exista el nuevo ADR de Entity Lifecycle:

* no introducir Soft Delete automáticamente;
* analizar la semántica específica de cada entidad;
* preservar historia cuando sea necesaria;
* evitar Hard Delete destructivo en documentos históricos;
* utilizar estados de negocio cuando representen mejor el dominio;
* utilizar `isActive` para desactivación cuando sea adecuado.

---

# 10. Nueva decisión requerida

Debe formalizarse un ADR que defina una matriz similar a:

| Tipo de entidad           | Estrategia                   |
| ------------------------- | ---------------------------- |
| Catálogo                  | Active / Inactive            |
| Documento Draft           | Delete o Cancel según reglas |
| Documento confirmado      | Cancel / Reverse             |
| Inventory Movement        | Immutable                    |
| Audit                     | Immutable                    |
| Sesión/token temporal     | Physical expiration/delete   |
| Entidad personal sensible | Según política específica    |

Esta tabla es únicamente una dirección conceptual y no constituye todavía la decisión definitiva.

---

# 11. Consecuencias

## Positivas de retirar la regla global

* semántica más correcta;
* menor complejidad innecesaria;
* mejor alineación con el dominio;
* evita columnas `deletedAt` sin propósito;
* distingue cancelación de eliminación.

## Costos

* lifecycle debe decidirse por tipo de entidad;
* requiere documentación más precisa;
* debe formalizarse un nuevo ADR.

---

# 12. ADR relacionados

* ADR-002 — Inventory Movements.
* ADR-008 — Documentation First.
* futuro ADR — Entity Lifecycle Strategy.

---

# 13. Principio preservado

Aunque la estrategia global de Soft Delete queda obsoleta, permanece vigente el principio:

> La historia empresarial relevante no debe destruirse únicamente para que un registro deje de aparecer en la operación normal.

La forma correcta de lograrlo depende del tipo de entidad.
