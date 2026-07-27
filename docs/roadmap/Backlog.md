# 📋 Product Backlog

| Estado | 🟢 Activo |
|---------|-----------|
| Versión | 1.0 |
| Última actualización | Sprint 09 |

---

# Objetivo

Centralizar todas las mejoras, funcionalidades, optimizaciones y refactorizaciones planeadas para Zaping ERP.

---

# Prioridades

Las tareas se clasifican utilizando la siguiente prioridad:

🔴 Alta

🟡 Media

🟢 Baja

---

# Frontend

## Design System

### Alta

- [ ] ProductSelector reutilizable
- [ ] SupplierSelector reutilizable
- [ ] CustomerSelector reutilizable
- [ ] MoneyInput
- [ ] DatePicker
- [ ] StatusBadge

### Media

- [ ] EmptyState con botón de acción
- [ ] EmptyState con variantes
- [ ] EmptyState con tamaños
- [ ] InventoryStatusBadge
- [ ] DataState Component
- [ ] TextArea Component
- [ ] SearchInput Component

### Baja

- [ ] Skeleton Loading
- [ ] Dark Mode
- [ ] Toast Notifications
- [ ] Breadcrumb Component

---

## Dashboard

### Media

- [ ] Tarjetas con iconos
- [ ] Colores según módulo
- [ ] Gráficas estadísticas
- [ ] Actividad reciente

---

## Table

### Alta

- [ ] Tipado genérico (eliminar any)

### Media

- [ ] Ordenamiento por columnas
- [ ] Paginación
- [ ] Búsqueda integrada
- [ ] Columnas configurables

---

## Card

### Media

- [ ] Variantes
- [ ] Header
- [ ] Footer

---

# Backend

### Alta

- [ ] Eliminar passwordHash del login
- [ ] Tipar req.user
- [ ] Optimizar PurchasesService

### Media

- [ ] Centralizar manejo de errores
- [ ] Logging
- [ ] Auditoría avanzada

---

# Módulos

## Compras

- [ ] Página Nueva Compra
- [ ] Purchase Items
- [ ] Cálculo de totales
- [ ] Actualización de inventario

## Cotizaciones

- [ ] CRUD
- [ ] PDF
- [ ] Conversión a Venta

## Ventas

- [ ] CRUD
- [ ] Descuento automático
- [ ] Actualización de inventario

---

# SaaS

- [ ] Portal de clientes
- [ ] App móvil para vendedores
- [ ] Importación de datos CSV/XLSX
- [ ] Escáner de códigos QR
- [ ] Notificaciones

# Ideas

- IA para sugerir compras según inventario.
- Dashboard con indicadores financieros.
- Integración con WhatsApp.
- Integración con correo electrónico.
- Pronóstico de inventario.
- Reportes inteligentes.