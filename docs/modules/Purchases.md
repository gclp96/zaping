# 📦 Módulo de Compras

| Campo | Valor |
|--------|-------|
| Estado | 🟢 Diseño |
| Versión | 1.0 |
| Sprint | 09 |
| Prioridad | Alta |

---

# Objetivo

Permitir registrar compras realizadas a proveedores para aumentar el inventario, mantener el historial de adquisiciones y controlar los costos de compra.

---

# Problema que resuelve

Actualmente las compras suelen registrarse manualmente o en múltiples herramientas, dificultando:

- El control del inventario.
- El seguimiento de proveedores.
- El cálculo de costos.
- La trazabilidad de las compras.

Este módulo centraliza todo el proceso en una única plataforma.

---

# Alcance del MVP

El módulo permitirá:

- Crear compras.
- Consultar compras.
- Editar compras pendientes.
- Cancelar compras.
- Agregar múltiples productos.
- Calcular subtotales.
- Calcular total.
- Actualizar inventario automáticamente.

---

# Fuera del alcance

No forman parte del MVP:

- CFDI
- XML
- Facturación
- Recepción parcial
- Compras internacionales
- Múltiples almacenes
- Costeo promedio

---

# Historias de Usuario

## HU-001

Como comprador

Quiero registrar una compra

Para aumentar el inventario.

---

## HU-002

Como administrador

Quiero consultar el historial de compras

Para conocer las adquisiciones realizadas.

---

## HU-003

Como administrador

Quiero editar una compra pendiente

Para corregir errores antes de recibirla.

---

## HU-004

Como administrador

Quiero cancelar una compra

Para mantener información consistente.

---

# Flujo de Negocio

Proveedor

↓

Nueva Compra

↓

Agregar Productos

↓

Calcular Totales

↓

Guardar Compra

↓

Actualizar Inventario

↓

Registrar Movimiento

↓

Actualizar Dashboard

---

# Estados

Pendiente

Recibida

Cancelada

---

# Modelo de Datos

## Purchase

- id
- folio
- supplierId
- purchaseDate
- notes
- subtotal
- taxes
- total
- status
- createdBy
- createdAt
- updatedAt

---

## PurchaseItem

- id
- purchaseId
- productId
- quantity
- cost
- subtotal

---

# Componentes Frontend

## Página

/purchases

Lista de compras.

---

## Página

/purchases/new

Registro de compra.

---

## Página

/purchases/[id]

Detalle y edición.

---

# Componentes

PageContainer

PageHeader

PurchaseForm

SupplierSelector

ProductSelector

PurchaseItemsTable

PurchaseTotals

Button

Loading

EmptyState

---

# Componentes Backend

PurchasesController

PurchasesService

PurchaseItemsService

InventoryService

---

# API

GET /purchases

POST /purchases

PATCH /purchases/:id

DELETE /purchases/:id

---

# Wireframe

┌─────────────────────────────────────────────┐

Nueva Compra

─────────────────────────────────────────────

Información General

Proveedor

Fecha

Notas

─────────────────────────────────────────────

Productos

+ Agregar Producto

--------------------------------------------------

Producto

Cantidad

Costo

Subtotal

--------------------------------------------------

TOTAL

─────────────────────────────────────────────

Cancelar

Guardar Compra

└─────────────────────────────────────────────┘

---

# Reglas de Negocio

- Toda compra debe pertenecer a un proveedor.
- Una compra debe contener al menos un producto.
- El subtotal se calcula automáticamente.
- El total se calcula automáticamente.
- Al guardar una compra se incrementa el inventario.
- Solo las compras pendientes pueden editarse.
- Las compras canceladas no modifican el inventario.

---

# Casos Límite

- Proveedor inexistente.
- Producto inexistente.
- Cantidad menor o igual a cero.
- Costo menor que cero.
- Compra sin productos.
- Error al actualizar inventario.

---

# Backlog

- Recepción parcial.
- Adjuntar factura PDF.
- CFDI.
- Importar compra desde Excel.
- Historial de cambios.
- Aprobación de compras.