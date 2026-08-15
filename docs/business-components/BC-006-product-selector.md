# BC-006: ProductSelector

**Versión:** 1.0.0
**Estado:** Completado
**Sprint:** Sprint 09
**Prioridad:** Alta
**Responsable:** Zaping Team
**Fecha de finalización:** 2026-08-14

---

## 1. Propósito

ProductSelector es un componente de negocio reutilizable para buscar y seleccionar productos dentro de los diferentes flujos operativos de Zaping ERP.

Reemplaza el uso de listas `<select>` tradicionales y está diseñado para funcionar correctamente a medida que el catálogo de productos crece.

---

## 2. Arquitectura

```text
Feature o formulario
        ↓
ProductSelector
        ↓
Búsqueda / filtros
        ↓
Producto seleccionado