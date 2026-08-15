# BC-005: CustomerSelector

**Versión:** 1.0.0
**Estado:** Completado
**Sprint:** Sprint 09
**Prioridad:** Alta
**Responsable:** Zaping Team
**Fecha de finalización:** 2026-08-14

---

## 1. Propósito

CustomerSelector es un componente de negocio reutilizable para localizar y seleccionar clientes dentro de los diferentes flujos comerciales de Zaping ERP.

El componente permite reemplazar listas `<select>` tradicionales por una experiencia de búsqueda preparada para catálogos de clientes de mayor tamaño.

También permite iniciar el registro de un nuevo cliente sin abandonar el flujo operativo actual.

---

## 2. Arquitectura

```text
Feature o formulario
        ↓
CustomerSelector
        ↓
Búsqueda y selección
        ↓
CustomerFormModal
        ↓
POST /customers