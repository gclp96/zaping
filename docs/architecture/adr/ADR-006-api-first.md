# ADR-006 — API First

**Estado:** ACCEPTED
**Fecha original:** 2026-07-10
**Última revisión:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Contexto

Zaping utiliza actualmente una aplicación web como principal cliente.

Sin embargo, la visión del producto contempla futuros consumidores como:

* aplicaciones móviles;
* Customer Portal;
* Public API;
* integraciones;
* automatizaciones;
* Zaping Radar;
* Zaping AI.

Si las reglas de negocio dependen directamente de la interfaz web, cada nuevo canal exigiría duplicar lógica.

---

# 2. Problema

Se necesita garantizar que las capacidades del sistema puedan ser utilizadas por diferentes clientes sin duplicar las reglas centrales.

---

# 3. Decisión

Zaping adopta el principio **API First**.

Las capacidades de negocio deben exponerse mediante contratos claros desde el backend.

La aplicación web consume esas capacidades como un cliente más.

---

# 4. Modelo conceptual

```text
                 Zaping Backend
                      │
                Application API
                      │
       ┌──────────────┼──────────────┐
       │              │              │
       ▼              ▼              ▼
     Web App       Mobile App    Customer Portal
                                     
                      │
                      ▼
                Integrations
```

---

# 5. API First no significa API pública inmediata

Existe una diferencia entre:

### Application API

API utilizada internamente por las aplicaciones oficiales de Zaping.

y:

### Public API

API formal destinada a integraciones externas.

La segunda requiere controles adicionales como:

* versionado;
* scopes;
* rate limiting;
* documentación pública;
* credenciales independientes;
* auditoría;
* lifecycle.

---

# 6. REST

La interfaz principal actual utiliza REST sobre HTTP.

Ejemplo:

```text
GET    /products
POST   /products
PATCH  /products/:id
```

REST continúa siendo adecuado para la etapa actual.

No se adopta GraphQL, gRPC u otro paradigma sin una necesidad real.

---

# 7. APIs orientadas al negocio

La API no debe limitarse artificialmente a CRUD.

Cuando una operación representa una acción empresarial debe poder expresarse explícitamente.

Ejemplo:

```text
POST /purchases/:id/receipts
```

en lugar de obligar a representar todo mediante actualización genérica de Purchase.

---

# 8. Contratos

Cada endpoint debe definir adecuadamente:

* request;
* response;
* DTO;
* validación;
* permisos;
* tenant;
* errores;
* status HTTP.

---

# 9. DTO

Los DTO constituyen una frontera entre:

```text
input externo
```

y:

```text
modelo interno
```

No deben exponerse automáticamente modelos completos de persistencia.

---

# 10. Seguridad

Toda API privada debe considerar:

* Authentication;
* Authorization;
* Multi-Tenancy;
* Validation;
* Data Exposure.

API First no implica que todas las capacidades sean accesibles públicamente.

---

# 11. Compatibilidad

Los contratos consumidos por frontend u otras aplicaciones deben modificarse con cuidado.

Un cambio en Prisma no debe provocar automáticamente un cambio público en API.

---

# 12. Paginación

Los endpoints de colecciones con potencial de crecimiento deben soportar paginación cuando sea necesario.

---

# 13. Errores

Las APIs deben proporcionar errores consistentes y comprensibles.

No deben exponer:

* stack traces;
* SQL;
* errores Prisma sin procesar;
* secretos;
* datos internos.

---

# 14. Documentación API

En la etapa actual debe mantenerse una guía común de API.

La referencia detallada de endpoints debe evolucionar hacia documentación generada desde el backend, preferentemente mediante OpenAPI/Swagger.

Esto reduce el riesgo de mantener dos especificaciones manuales contradictorias.

---

# 15. Frontend

El frontend debe utilizar una capa común de acceso a API.

No se recomienda dispersar llamadas `fetch` directamente en todas las páginas.

---

# 16. Mobile

Una futura aplicación móvil debe reutilizar los mismos casos de uso centrales cuando corresponda.

No deben crearse reglas paralelas solamente para móvil.

---

# 17. Integraciones

Las integraciones futuras deberán consumir contratos controlados.

La futura Public API puede diferir de APIs internas si existen requisitos distintos de:

* seguridad;
* lifecycle;
* estabilidad;
* rate limits.

---

# 18. Consecuencias positivas

* reutilización;
* movilidad futura;
* integración más sencilla;
* separación UI/backend;
* contratos claros;
* mayor testabilidad.

---

# 19. Consecuencias negativas

* requiere disciplina contractual;
* cambios backend deben considerar consumidores;
* necesidad futura de versionado;
* seguridad adicional para APIs externas.

---

# 20. Estado de implementación

**Decisión:** ACCEPTED

**Implementación:** PARTIAL / EN EVOLUCIÓN

Actualmente existe una API REST funcional entre frontend y backend.

Capacidades como:

* Public API formal;
* OpenAPI completo;
* versionado;
* scopes externos;

todavía no forman parte del producto terminado.

---

# 21. ADR relacionados

* ADR-001 — Multi-Tenant.
* ADR-005 — Arquitectura por capas.
* ADR-007 — RBAC.
* ADR-009 — Modular Monolith.

---

# 22. Decisión final

> Las capacidades de negocio pertenecen a la plataforma, no a una interfaz específica.

Zaping debe poder evolucionar hacia nuevos clientes e integraciones sin duplicar su lógica central.
