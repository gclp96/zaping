# ADR-004 — UUID como Identificador Primario

**Estado:** ACCEPTED
**Fecha original:** 2026-07-10
**Última revisión:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Contexto

Zaping es una plataforma SaaS cloud-native diseñada para operar múltiples empresas y evolucionar hacia diferentes clientes y canales.

Las entidades podrán ser utilizadas desde:

* aplicación web;
* aplicaciones móviles;
* Customer Portal;
* Public API;
* integraciones;
* procesos internos;
* y potencialmente clientes con sincronización futura.

La estrategia de identificadores debe ser consistente y suficientemente flexible para este entorno.

---

# 2. Problema

Se debe decidir entre identificadores primarios como:

### Integer secuencial

```text
1
2
3
4
```

o:

### UUID

```text
550e8400-e29b-41d4-a716-446655440000
```

---

# 3. Opción A — Integer autoincremental

### Ventajas

* compacto;
* índices pequeños;
* fácil lectura;
* implementación sencilla.

### Desventajas

* dependencia mayor del generador central;
* colisiones potenciales al combinar fuentes;
* enumeración sencilla;
* menor flexibilidad en escenarios distribuidos;
* dificultad adicional para generación offline.

---

# 4. Opción B — UUID

### Ventajas

* unicidad práctica global;
* generación distribuida;
* menor riesgo de colisiones entre sistemas;
* adecuado para APIs;
* facilita sincronización futura;
* generación independiente de una secuencia central.

### Desventajas

* índices mayores;
* menor legibilidad humana;
* mayor uso de almacenamiento;
* debugging manual menos cómodo.

---

# 5. Decisión

Las entidades principales de Zaping utilizan UUID como identificador técnico.

Ejemplo Prisma:

```prisma
id String @id @default(uuid())
```

Los IDs técnicos no deben cambiar durante la vida de la entidad.

---

# 6. UUID no es un identificador de negocio

Los usuarios no deben necesitar trabajar normalmente con UUID.

Los documentos empresariales pueden utilizar identificadores legibles.

Ejemplo:

```text
Identificador técnico:
9ea5c481-...

Folio:
OC-000421
```

Ambos conceptos cumplen funciones diferentes.

---

# 7. Identificador técnico

El UUID se utiliza para:

* relaciones;
* persistencia;
* APIs;
* referencias internas;
* integraciones.

---

# 8. Identificador empresarial

Los documentos pueden utilizar:

* folio;
* código;
* número;
* referencia.

Ejemplos:

```text
CUS-000123
OC-000421
CAS-000281
MAL-000128
```

Estos identificadores deben seguir reglas propias del negocio.

Nunca deben sustituir automáticamente la primary key técnica.

---

# 9. Seguridad

Los UUID reducen la facilidad de enumerar recursos de forma secuencial.

Sin embargo:

> UUID no es un mecanismo de autorización.

Un usuario que conoce el UUID de otro recurso no debe poder acceder a él si:

* pertenece a otra Company;
* no tiene permisos;
* el recurso está restringido.

El backend debe continuar aplicando:

* Authentication;
* Authorization;
* Multi-Tenancy;
* RBAC.

---

# 10. Multi-tenancy

UUID y `companyId` cumplen responsabilidades distintas.

```text
UUID
→ identifica el recurso

companyId
→ establece pertenencia al tenant
```

Un UUID globalmente único no elimina la validación de Company.

---

# 11. APIs

Las APIs pueden utilizar UUID para identificar recursos.

Ejemplo:

```text
GET /products/:id
```

El endpoint debe continuar validando tenant y permisos.

---

# 12. Integraciones

Las integraciones deben preferir identificadores técnicos estables cuando sea apropiado.

Los identificadores de negocio también pueden exponerse cuando exista una necesidad empresarial.

No debe asumirse que un folio externo sea globalmente único.

---

# 13. Generación distribuida

UUID permite que distintas partes de la plataforma generen identificadores sin depender de una secuencia única central.

Esto facilita escenarios futuros como:

* sincronización;
* mobile;
* importaciones;
* integraciones;
* procesos distribuidos.

---

# 14. Rendimiento

UUID implica costos de almacenamiento e índices mayores que un entero pequeño.

Este costo se acepta debido a:

* flexibilidad;
* consistencia;
* generación distribuida;
* estrategia uniforme.

Los índices deberán diseñarse correctamente según las consultas reales.

---

# 15. Reglas

* UUID es el identificador técnico principal.
* El UUID es inmutable.
* Los folios empresariales son independientes.
* Un folio no reemplaza al UUID.
* UUID no sustituye autorización.
* Las relaciones deben mantener integridad referencial.
* El tenant continúa siendo validado independientemente.

---

# 16. Consecuencias positivas

* estrategia consistente;
* generación distribuida;
* integraciones más simples;
* menor dependencia de secuencias;
* soporte de sincronización futura;
* menor enumeración trivial.

---

# 17. Consecuencias negativas

* menor legibilidad;
* índices mayores;
* mayor almacenamiento;
* logs más difíciles de revisar manualmente.

---

# 18. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-009 — Modular Monolith.
* `SECURITY_PRINCIPLES.md`.

---

# 19. Decisión final

> Los identificadores del negocio pertenecen al negocio.

> Los identificadores técnicos pertenecen a la arquitectura.

Zaping utiliza UUID para la identidad técnica y folios/códigos independientes cuando el usuario necesita una referencia empresarial legible.
