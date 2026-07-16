# FEAT-PUR-001: Crear compra

**Versión:** 1.0.0  
**Estado:** Completado  
**Fecha de finalización:** 2026-07-14   
**Módulo:** Compras  
**Sprint:** Sprint 09  
**Prioridad:** Alta  
**Responsable:** Zaping Team  

---

## 1. Propósito

Permitir que un usuario autorizado registre una orden de compra asociada
a un proveedor y a una o más partidas de productos.

La compra se crea inicialmente en estado `DRAFT`.

La creación de la compra no modifica el inventario.

El inventario se incrementa únicamente cuando la compra es aprobada.

---

## 2. Alcance

La primera versión incluirá:

- Listado de compras.
- Creación de una compra.
- Selección de proveedor.
- Selección de productos.
- Captura de cantidades.
- Visualización del costo unitario.
- Cálculo de subtotal por partida.
- Cálculo de subtotal general.
- Cálculo de IVA del 16%.
- Cálculo del total.
- Aprobación de compras en borrador.
- Descarga del PDF.
- Estados de carga, vacío y error.

---

## 3. Fuera de alcance

Esta versión no incluirá:

- Edición de compras existentes.
- Cancelación de compras.
- Eliminación de compras.
- Recepciones parciales.
- Impuestos configurables.
- Descuentos.
- Monedas diferentes a MXN.
- Fechas estimadas de entrega.
- Adjuntos.
- Lotes, series o caducidades.
- Pagos a proveedores.
- Numeración empresarial secuencial.

---

## 4. Actores

### Administrador

Puede:

- Consultar compras.
- Crear compras.
- Aprobar compras.
- Descargar PDF.

### Responsable de compras

Podrá realizar las mismas operaciones cuando RBAC se encuentre integrado
formalmente en el módulo.

---

## 5. Flujo principal

```text
Usuario abre Compras
        ↓
Consulta compras existentes
        ↓
Selecciona Nueva compra
        ↓
Selecciona proveedor
        ↓
Agrega uno o más productos
        ↓
Define cantidades
        ↓
El sistema calcula importes
        ↓
Usuario confirma
        ↓
POST /purchases
        ↓
Compra creada en DRAFT

----------

## 19. Resultado de implementación

FEAT-PUR-001 fue implementada y validada correctamente.

Resultados:

- Se implementó listado de compras.
- Se implementó modal de creación de compra.
- Se integró SupplierSelector.
- Se integró ProductSelector.
- Se implementó captura de partidas y cantidades.
- Se calcularon subtotal, IVA y total en frontend.
- Se validó creación mediante POST /purchases.
- Se validó aprobación mediante PATCH /purchases/:id/approve.
- Se validó cancelación mediante PATCH /purchases/:id/cancel.
- Se validó descarga de PDF.
- Se confirmó que aprobar incrementa inventario una sola vez.
- Se confirmó que cancelar no modifica inventario.
- Se confirmó que una compra confirmada no puede cancelarse.
- Se confirmó que una compra cancelada no puede aprobarse.
- Frontend tests aprobados.
- Frontend build aprobado.
- Backend build aprobado.
- ESLint del módulo Purchases aprobado.

## Estado final

FEAT-PUR-001 se considera completada.