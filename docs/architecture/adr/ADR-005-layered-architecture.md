# ADR-005 — Arquitectura por Capas

**Estado:** ACCEPTED
**Fecha original de la decisión:** 2026-07-10
**Documento:** Reconstruido durante la consolidación documental
**Última revisión:** 2026-08-19
**Responsable:** Zaping Architecture Team

---

# 1. Nota de reconstrucción

El archivo original de ADR-005 fue sobrescrito accidentalmente y actualmente contiene una copia de ADR-004.

Este documento reconstruye la decisión arquitectónica utilizando como fuentes:

* documentación de arquitectura existente;
* `SOFTWARE DESIGN`;
* principios de ingeniería;
* estructura actual del backend;
* estructura actual del frontend.

La intención histórica de la decisión se preserva:

> Zaping utiliza separación de responsabilidades mediante capas.

---

# 2. Contexto

Zaping contiene múltiples dominios empresariales y continuará creciendo.

Sin una separación clara de responsabilidades, el sistema corre el riesgo de acumular:

* reglas de negocio dentro de Controllers;
* consultas de base de datos dispersas;
* lógica duplicada;
* componentes frontend demasiado grandes;
* dependencias entre dominios;
* dificultad de pruebas;
* alto acoplamiento.

---

# 3. Problema

Se requiere una estructura que permita separar:

* presentación;
* aplicación;
* reglas de negocio;
* infraestructura;
* persistencia.

La arquitectura debe ser suficientemente clara sin introducir capas artificiales que no aporten valor.

---

# 4. Decisión

Zaping adopta una **arquitectura por capas pragmática**.

Modelo conceptual:

```text
Presentation
      ↓
Application
      ↓
Domain
      ↓
Infrastructure
      ↓
Persistence
```

No significa que cada funcionalidad deba contener obligatoriamente una carpeta física para cada capa.

La separación se aplica por **responsabilidad**, no por burocracia estructural.

---

# 5. Backend

La dirección general del backend es:

```text
Controller
   ↓
Service
   ↓
Repository / Prisma
   ↓
PostgreSQL
```

---

# 6. Controller

Responsable principalmente de:

* recibir requests;
* resolver parámetros;
* aplicar Guards;
* aplicar decoradores;
* delegar;
* devolver respuestas.

No debe contener reglas complejas de negocio.

---

# 7. Service

Responsable de:

* casos de uso;
* reglas de negocio;
* coordinación;
* validaciones de dominio;
* transacciones;
* interacción permitida con otros dominios.

El Service constituye actualmente una parte importante de la capa de aplicación.

---

# 8. Domain

Las reglas centrales deben permanecer conceptualmente dentro del dominio propietario.

Ejemplo:

```text
Inventory
```

es propietario de las reglas de existencias.

Aunque todavía no exista una capa física `domain/` completa, la separación conceptual debe mantenerse.

---

# 9. Repository

Repository es una capa opcional.

Debe introducirse cuando aporte:

* aislamiento de persistencia;
* testabilidad;
* reducción de consultas duplicadas;
* claridad.

No todos los módulos deben tener obligatoriamente:

```text
*.repository.ts
```

si Prisma puede utilizarse correctamente desde el Service sin romper responsabilidades.

---

# 10. Persistencia

Prisma y PostgreSQL pertenecen a la infraestructura/persistencia.

Las reglas centrales del negocio no deben depender innecesariamente de detalles específicos de Prisma.

---

# 11. Frontend

La dirección general es:

```text
Pages
  ↓
Features
  ↓
Business Components
  ↓
UI Components
```

---

# 12. Pages

Responsables de:

* composición;
* routing;
* contexto;
* organización de la experiencia.

No deben convertirse en grandes contenedores de reglas.

---

# 13. Features

Representan workflows funcionales.

Pueden contener:

* hooks;
* formularios;
* lógica de interacción;
* componentes específicos;
* tipos relacionados.

---

# 14. Business Components

Representan componentes reutilizables con significado de negocio.

Ejemplos:

```text
ProductSelector
CustomerSelector
StatusBadge
```

---

# 15. UI Components

Deben permanecer genéricos.

Ejemplos:

```text
Button
Modal
Input
Table
Badge
```

No deben conocer reglas específicas de Purchases, Inventory, Healthcare u otros dominios.

---

# 16. Límites entre módulos

La arquitectura por capas no reemplaza los límites modulares.

Ejemplo incorrecto:

```text
HealthcareService
↓
prisma.inventoryMovement.create()
```

si con ello evita las reglas de Inventory.

Preferido:

```text
Healthcare
↓
contrato público de Inventory
↓
Inventory
↓
Persistence
```

---

# 17. Dependencias

Las dependencias deben dirigirse hacia responsabilidades más estables.

La lógica empresarial no debe depender de:

* UI;
* rutas HTTP;
* detalles de presentación.

---

# 18. Testing

La separación por capas debe facilitar pruebas de:

* Services;
* reglas de negocio;
* Controllers;
* componentes;
* integraciones.

La arquitectura no debe introducir mocks excesivos únicamente porque existan demasiadas capas artificiales.

---

# 19. Pragmatismo

Esta decisión no adopta Clean Architecture de forma dogmática.

Zaping debe evitar:

```text
Controller
→ UseCase
→ ApplicationService
→ DomainService
→ RepositoryInterface
→ RepositoryImplementation
→ PrismaAdapter
```

cuando el problema pueda resolverse correctamente con una estructura más simple.

La complejidad arquitectónica debe justificarse.

---

# 20. Consecuencias positivas

* responsabilidades claras;
* mejor testabilidad;
* menor acoplamiento;
* mayor mantenibilidad;
* mejor crecimiento modular;
* menor duplicación.

---

# 21. Consecuencias negativas

* disciplina adicional;
* posible aumento de archivos;
* riesgo de sobrearquitectura si se aplica rígidamente.

---

# 22. ADR relacionados

* ADR-006 — API First.
* ADR-009 — Modular Monolith.
* `ENGINEERING_GUIDE.md`.

---

# 23. Decisión final

> Zaping utiliza capas para separar responsabilidades, no para multiplicar abstracciones.

La arquitectura debe permanecer clara, modular y proporcional a la complejidad real del negocio.
