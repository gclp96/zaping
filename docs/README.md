# Documentación de Zaping

**Producto:** Zaping
**Versión del índice:** 2.0.0
**Última actualización:** 2026-08-19
**Estado:** En consolidación

---

# 1. Propósito

Esta carpeta contiene la documentación oficial del ecosistema Zaping.

La documentación debe permitir comprender:

* qué es Zaping;
* qué problemas resuelve;
* cómo está estructurado;
* cómo funcionan sus dominios;
* qué decisiones arquitectónicas se han tomado;
* cuáles son los estándares de ingeniería;
* cómo debe funcionar la experiencia de usuario;
* qué se está desarrollando actualmente;
* y hacia dónde evoluciona el producto.

La documentación debe representar el comportamiento real del sistema.

---

# 2. Principio documental

Zaping utiliza el principio:

> **Una verdad → una fuente responsable.**

No deben existir varios documentos activos definiendo versiones diferentes de la misma regla.

Ejemplos:

```text
Visión del producto
→ PRODUCT_VISION.md

Requerimientos
→ PRODUCT_REQUIREMENTS.md

Arquitectura
→ ARCHITECTURE.md

Decisiones arquitectónicas
→ ADR

Reglas de negocio específicas
→ documentación del módulo

Experiencia de usuario
→ ZAPING_WAY.md

Estado actual
→ PROJECT_BOARD.md

Dirección futura
→ ROADMAP.md

Cambios realizados
→ CHANGELOG.md
```

---

# 3. Idioma oficial

La documentación oficial de Zaping se mantiene en **español**.

Se conservan en inglés cuando resulte apropiado:

* nombres de clases;
* entidades de código;
* endpoints;
* nombres de tecnologías;
* patrones reconocidos;
* términos técnicos;
* y conceptos cuyo nombre oficial se utilice directamente en implementación.

Ejemplos:

```text
SalesOrder
PurchaseReceipt
Case
CaseKit
DTO
JWT
RBAC
Soft Delete
API First
```

---

# 4. Estructura documental objetivo

La estructura oficial de documentación evolucionará hacia:

```text
docs/
│
├── README.md
├── GLOSSARY.md
│
├── product/
│   ├── PRODUCT_VISION.md
│   ├── PRODUCT_REQUIREMENTS.md
│   └── ZAPING_WAY.md
│
├── architecture/
│   ├── ARCHITECTURE.md
│   │
│   ├── c4/
│   │   ├── C1-SystemContext.md
│   │   ├── C2-Containers.md
│   │   └── C3-Components.md
│   │
│   └── adr/
│       ├── README.md
│       └── ADR-XXX-...
│
├── engineering/
│   ├── ENGINEERING_GUIDE.md
│   ├── DEVELOPMENT_WORKFLOW.md
│   ├── QUALITY_STANDARDS.md
│   ├── SECURITY_PRINCIPLES.md
│   └── API_GUIDELINES.md
│
├── ux/
│   ├── DESIGN_SYSTEM.md
│   └── BUSINESS_COMPONENTS.md
│
├── modules/
│   ├── erp/
│   ├── healthcare/
│   └── radar/
│
├── project/
│   ├── ROADMAP.md
│   ├── PROJECT_BOARD.md
│   └── CHANGELOG.md
│
└── templates/
    ├── ADR_TEMPLATE.md
    ├── FEATURE_TEMPLATE.md
    ├── MODULE_TEMPLATE.md
    ├── POSTMORTEM_TEMPLATE.md
    └── RELEASE_TEMPLATE.md
```

Las carpetas deben crearse únicamente cuando exista documentación real que guardar en ellas.

No deben mantenerse estructuras vacías únicamente para anticipar funcionalidades futuras.

---

# 5. Estado de consolidación

La documentación se encuentra actualmente en proceso de depuración y consolidación.

## 5.1 Producto

### ✅ Consolidado

```text
product/
├── PRODUCT_VISION.md
└── PRODUCT_REQUIREMENTS.md
```

### ⏳ Pendiente

```text
product/
└── ZAPING_WAY.md
```

---

## 5.2 Glosario

### ✅ Consolidado

```text
GLOSSARY.md
```

Contiene la terminología oficial utilizada en:

* ERP Core;
* Healthcare;
* arquitectura;
* UX;
* seguridad;
* inventario;
* ventas;
* compras;
* y documentación.

---

## 5.3 Ingeniería

### ✅ Consolidado

```text
engineering/
├── ENGINEERING_GUIDE.md
├── DEVELOPMENT_WORKFLOW.md
├── QUALITY_STANDARDS.md
└── SECURITY_PRINCIPLES.md
```

### ⏳ Pendiente

```text
engineering/
└── API_GUIDELINES.md
```

`API_GUIDELINES.md` será creado después de consolidar la documentación útil existente dentro de la antigua carpeta `api/`.

---

## 5.4 Arquitectura

### 🔄 En consolidación

La documentación arquitectónica existente será revisada y reducida.

La estructura objetivo será:

```text
architecture/
├── ARCHITECTURE.md
├── c4/
└── adr/
```

Se revisarán especialmente:

* arquitectura general;
* Modular Monolith;
* multi-tenancy;
* API First;
* arquitectura por capas;
* frontend;
* backend;
* seguridad;
* C4;
* y ADR existentes.

---

## 5.5 UX y Design System

### ⏳ Pendiente

La documentación existente de:

```text
design-system/
business-components/
```

será consolidada en:

```text
ux/
├── DESIGN_SYSTEM.md
└── BUSINESS_COMPONENTS.md
```

Además se creará:

```text
product/ZAPING_WAY.md
```

para definir los principios de experiencia de producto.

---

## 5.6 Módulos

### 🔄 En consolidación

La documentación modular existente será revisada contra:

* modelo Prisma;
* backend;
* frontend;
* pruebas;
* y reglas de negocio aprobadas.

La estructura futura distinguirá:

```text
modules/
├── erp/
├── healthcare/
└── radar/
```

No se conservará documentación de features históricas individuales cuando su contenido pueda integrarse correctamente en el documento principal del módulo.

---

## 5.7 Estado del proyecto

### ⏳ Pendiente

La documentación actual de:

```text
PROJECT_BOARD
roadmap/
releases/
```

será consolidada posteriormente en:

```text
project/
├── ROADMAP.md
├── PROJECT_BOARD.md
└── CHANGELOG.md
```

---

# 6. Documentos principales

## PRODUCT_VISION.md

Responde:

> ¿Qué queremos que Zaping llegue a ser?

Contiene:

* misión;
* visión;
* filosofía;
* posicionamiento;
* ERP Core;
* Zaping Healthcare;
* Zaping Radar;
* Zaping AI;
* evolución del ecosistema.

---

## PRODUCT_REQUIREMENTS.md

Responde:

> ¿Qué debe ser capaz de hacer Zaping?

Contiene:

* requerimientos;
* actores;
* reglas transversales;
* prioridades P0/P1/P2;
* criterios de éxito;
* alcance;
* restricciones.

---

## ZAPING_WAY.md

Responde:

> ¿Cómo debe funcionar y sentirse Zaping?

Definirá:

* UX;
* navegación;
* patrones;
* formularios;
* tablas;
* acciones;
* workspaces;
* vistas 360;
* experiencia Healthcare;
* y filosofía de interacción.

---

## ARCHITECTURE.md

Responde:

> ¿Cómo está estructurado técnicamente Zaping?

Definirá:

* estilo arquitectónico;
* capas;
* dominios;
* límites;
* frontend;
* backend;
* persistencia;
* integraciones;
* multi-tenancy;
* evolución técnica.

---

## ADR

Responde:

> ¿Por qué tomamos una decisión arquitectónica determinada?

Los ADR preservan historia.

Una decisión reemplazada debe marcarse como:

```text
SUPERSEDED
```

y no eliminarse.

---

## ENGINEERING_GUIDE.md

Responde:

> ¿Cómo desarrollamos software en Zaping?

Contiene:

* principios;
* TypeScript;
* frontend;
* backend;
* Prisma;
* APIs;
* pruebas;
* mantenibilidad;
* y Definition of Done.

---

## DEVELOPMENT_WORKFLOW.md

Responde:

> ¿Qué proceso seguimos para desarrollar un cambio?

Define:

```text
Idea
↓
Análisis
↓
Diseño
↓
Implementación
↓
Pruebas
↓
Documentación
↓
Release
```

El proceso es proporcional al riesgo.

---

## QUALITY_STANDARDS.md

Responde:

> ¿Qué nivel mínimo de calidad debe cumplir un cambio?

Define Quality Gates para:

* negocio;
* arquitectura;
* backend;
* frontend;
* base de datos;
* seguridad;
* multi-tenancy;
* inventario;
* pruebas;
* documentación.

---

## SECURITY_PRINCIPLES.md

Responde:

> ¿Cómo protegemos Zaping y sus datos?

Incluye:

* autenticación;
* JWT;
* autorización;
* RBAC;
* multi-tenancy;
* secretos;
* datos sensibles;
* Healthcare;
* logging;
* auditoría;
* infraestructura;
* seguridad previa a producción.

---

## GLOSSARY.md

Responde:

> ¿Qué significa cada término dentro de Zaping?

Debe mantenerse sincronizado con el lenguaje de negocio y arquitectura.

---

## PROJECT_BOARD.md

Responderá:

> ¿En qué estamos trabajando actualmente?

No debe utilizarse como historial permanente.

---

## ROADMAP.md

Responderá:

> ¿Qué construiremos después y en qué orden?

---

## CHANGELOG.md

Responderá:

> ¿Qué cambios ya fueron completados?

---

# 7. Jerarquía de fuentes

Cuando exista una aparente contradicción, debe determinarse cuál documento es responsable del tema.

Ejemplo:

Una regla de inventario específica debe resolverse principalmente mediante:

```text
PRODUCT_REQUIREMENTS
+
Inventory.md
+
ADR aplicable
```

No mediante una nota antigua de Sprint.

El código implementado debe compararse con la documentación aprobada.

Si difieren, no debe asumirse automáticamente que uno de los dos es correcto.

Debe revisarse la decisión y sincronizar ambos.

---

# 8. Documentación histórica

Git es la principal fuente de historia técnica de archivos eliminados o modificados.

Por esta razón no es necesario conservar indefinidamente:

* documentos duplicados;
* especificaciones temporales;
* planes de sprint antiguos;
* documentación vacía;
* archivos de feature cuyo conocimiento ya fue consolidado.

Los ADR son una excepción importante porque preservan decisiones arquitectónicas y sus razones.

---

# 9. Estados documentales

Cuando sea necesario se utilizarán estados como:

## Draft

Documento en desarrollo.

## Proposed

Propuesta todavía no aprobada.

## Approved

Documento vigente y aprobado.

## Deprecated

Documento todavía disponible pero que ya no debe utilizarse para nuevas decisiones.

## Superseded

Documento o decisión reemplazada por otra.

---

# 10. Versiones

La versión de un documento representa cambios significativos de su contenido.

No es necesario incrementar la versión por:

* typos;
* formato;
* correcciones menores sin impacto conceptual.

Los cambios de reglas, estructura o alcance sí pueden justificar una nueva versión.

---

# 11. Convenciones de nombres

Los documentos principales utilizan:

```text
UPPER_SNAKE_CASE.md
```

Ejemplos:

```text
PRODUCT_VISION.md
PRODUCT_REQUIREMENTS.md
ENGINEERING_GUIDE.md
```

La documentación de módulos puede utilizar nombres de dominio legibles:

```text
Inventory.md
Purchases.md
PurchaseReceipts.md
```

Los ADR utilizan:

```text
ADR-XXX-descripcion.md
```

Ejemplo:

```text
ADR-001-multi-tenant.md
```

Evitar:

* espacios;
* nombres ambiguos;
* errores tipográficos;
* convenciones diferentes dentro de la misma carpeta.

---

# 12. Reglas de mantenimiento

Al modificar una funcionalidad relevante:

1. identificar su fuente documental;
2. actualizar esa fuente;
3. actualizar ADR si cambia una decisión;
4. actualizar PROJECT_BOARD si cambia el trabajo actual;
5. actualizar CHANGELOG cuando corresponda;
6. evitar duplicar la misma información.

---

# 13. Documentation First

Documentation First no significa:

> crear más Markdown.

Significa:

> comprender y registrar correctamente las decisiones importantes antes de implementarlas.

Un solo documento actualizado es preferible a cinco documentos contradictorios.

---

# 14. Filosofía de la nueva estructura

La documentación debe ser:

* suficiente;
* clara;
* navegable;
* mantenible;
* consistente;
* actual;
* y útil.

No se mide su calidad por la cantidad de archivos.

Se mide por la capacidad de responder correctamente preguntas sobre el producto y el sistema.

---

# 15. Regla final

La documentación de Zaping debe permitir que una persona pueda comprender:

```text
Qué es Zaping
↓
Qué debe hacer
↓
Cómo está construido
↓
Cómo funciona cada dominio
↓
Cómo se desarrolla
↓
Cómo se protege
↓
Cómo se usa
↓
Qué se está construyendo
↓
Qué viene después
```

sin depender de conversaciones antiguas ni documentos contradictorios.

Ese es el objetivo de esta estructura documental.
