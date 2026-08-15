# BC-001: StatusBadge

**Versión:** 1.0.0  
**Estado:** Completado  
**Sprint:** Sprint 09  
**Prioridad:** Alta  
**Responsable:** Zaping Team  
**Fecha de finalización:** 2026-07-12   

---

# 1. Propósito

`StatusBadge` es un componente de negocio reutilizable para representar
visualmente el estado de una entidad o proceso dentro de Zaping.

Su objetivo es estandarizar la forma en que se muestran estados como:

- En stock.
- Bajo stock.
- Sin stock.
- Activo.
- Inactivo.
- Pendiente.
- Aprobado.
- Rechazado.
- Completado.
- Cancelado.

`StatusBadge` debe reutilizar el componente genérico `Badge` del Design System.

---

# 2. Alcance

El componente será utilizado inicialmente en el módulo de Inventario.

Posteriormente podrá integrarse en:

- Productos.
- Clientes.
- Proveedores.
- Compras.
- Cotizaciones.
- Ventas.
- Usuarios.
- Zaping Radar.

El componente no será responsable de calcular estados empresariales.

Cada módulo continuará siendo propietario de sus reglas de negocio.

---

# 3. Principio arquitectónico

La relación entre componentes será:

```text
Feature o módulo
      ↓
StatusBadge
      ↓
Badge

# 18. Resultado de implementación

BC-001 StatusBadge fue implementado e integrado correctamente en el módulo
de Inventario.

Resultados:

- Componente StatusBadge creado.
- Componente UI Badge reutilizado.
- Mapeo semántico de tones implementado.
- Regla de estado de inventario separada de la presentación.
- Integración realizada en InventoryPage.
- Accesibilidad básica implementada.
- Pruebas unitarias agregadas.
- 13 pruebas ejecutadas correctamente.
- ESLint completado sin errores.
- Build de producción completado correctamente.

## Estado final

BC-001 se considera completado.