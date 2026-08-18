# 📋 Zaping ERP — Project Board

| Campo | Estado |
|---|---|
| Proyecto | Zaping ERP |
| Estado | 🟢 Desarrollo activo |
| Versión | v0.9.0-alpha.1 |
| Sprint actual | Sprint 09 |
| Milestone actual | Core ERP — Compras e Inventario |
| Última actualización | 2026-08-18

---

# Milestones

| ID | Milestone | Estado |
|----|-----------|--------|
| M1 | Foundation | ✅ |
| M2 | Business Components Library | ✅ |
| M3 | Purchases Module | ✅ |
| M4 | Quotes Module | 🟢 |
| M5 | Sales Module | ⏳ |
| M6 | MVP Comercial | ⏳ |

---

# Sprint 09

## Componentes de negocio

| ID | Componente | Estado | Prioridad |
|---|---|---|---|
| BC-001 | StatusBadge | ✅ Implementado | Alta |
| BC-002 | MoneyInput | ⬜ Pendiente | Alta |
| BC-003 | DateInput | ✅ Implementado | Alta |
| BC-004 | SupplierSelector | ✅ Implementado | Alta |
| BC-005 | CustomerSelector | ✅ Implementado | Alta |
| BC-006 | ProductSelector | ✅ Implementado | Alta |

---

## Compras y recepción de mercancía

| ID | Funcionalidad | Estado | Prioridad |
|---|---|---|---|
| PUR-001 | Crear compras | ✅ Completado | Crítica |
| PUR-002 | Editar compras en borrador | ✅ Completado | Alta |
| PUR-003 | Confirmar compras | ✅ Completado | Crítica |
| PUR-004 | Cancelar compras en borrador | ✅ Completado | Alta |
| PUR-005 | Generar PDF de compra | ✅ Completado | Media |
| PUR-006 | Consultar movimientos asociados | ✅ Completado | Alta |
| PUR-007 | Recepciones parciales | ✅ Completado | Crítica |
| PUR-008 | Recepciones completas | ✅ Completado | Crítica |
| PUR-009 | Historial de recepciones | ✅ Completado | Alta |
| PUR-010 | Formulario frontend de recepción | ✅ Completado | Crítica |
| PUR-011 | Usuario responsable de recepción | ✅ Completado | Alta |
| PUR-012 | Pruebas automatizadas del formulario frontend de recepción | ✅ Completado | Alta |
| PUR-013 | Refactor de PurchasesPage | ✅ Completado | Alta |
| PUR-014 | Pruebas de acciones y formulario de compras | ✅ Completado | Alta |
| PUR-015 | Pruebas unitarias de los hooks de Compras | ✅ Completado | Alta |

# Sales and Returns

| ID | Objetivo | Estado | Prioridad |
|----|----------|--------|-----------|
| SAL-001 | Auditoría del módulo de Ventas | ✅ Completado | Alta |
| SAL-002 | Conversión transaccional de cotización a venta | ✅ Completado | Crítica |
| SAL-003 | Integración frontend de conversión | ✅ Completado | Alta |
| SAL-004 | Hardening backend de Ventas | ✅ Completado | Crítica |
| SAL-005 | Pruebas y validación de Ventas | ✅ Completado | Alta |
| RET-001 | Diseño funcional del módulo de devoluciones | ⏳ Pendiente | Alta


---

## Inventario y trazabilidad

| ID | Funcionalidad | Estado | Prioridad |
|---|---|---|---|
| INV-003A | Marca del producto | ✅ Completado | Media |
| INV-003B | Lotes desde recepción de compra | ✅ Completado | Crítica |
| INV-003C | Fecha de caducidad | ✅ Completado | Crítica |
| INV-003D | Costo promedio ponderado por lote | ✅ Completado | Alta |
| INV-003E | Movimiento `IN` por recepción | ✅ Completado | Crítica |
| INV-003F | Incrementar stock únicamente al recibir | ✅ Completado | Crítica |
| INV-004 | Consumo de lotes mediante FEFO | ⬜ Pendiente | Alta |
| INV-005 | Números de serie | ⬜ Pendiente | Media |

---

# Validación técnica

## Backend

- 26 suites aprobadas.
- 51 pruebas aprobadas.
- ESLint correcto.
- Build correcto.

## Frontend

- 11 archivos de pruebas aprobados.
- 82 pruebas aprobadas.
- ESLint correcto.
- Build correcto.

---

# Reglas de negocio validadas

- Crear una compra no modifica el inventario.
- Confirmar una compra no modifica el inventario.
- El stock aumenta únicamente al registrar una recepción.
- Se permiten recepciones parciales.
- Se permiten recepciones completas.
- No se puede recibir una cantidad mayor que la pendiente.
- No se puede recibir una compra cancelada, en borrador o totalmente recibida.
- Una fecha de caducidad requiere número de lote.
- La caducidad no puede ser anterior a la recepción.
- Un lote existente se actualiza sin duplicarse.
- Cada movimiento conserva la referencia de la recepción.
- Cada operación respeta el aislamiento mediante `companyId`.
- El usuario responsable se obtiene del JWT autenticado.
- La operación completa se ejecuta dentro de una transacción Prisma.

## Regla comercial aprobada

Una cotización confirmada se convierte directamente en una venta confirmada.

La conversión descuenta inventario y crea movimientos `OUT` dentro de una sola transacción.

Las ventas confirmadas no se cancelan directamente. Cualquier reversión se gestiona mediante una devolución documentada.

---

# Documentación

| ID | Documento | Estado |
|---|---|---|
| DOC-001 | Product Vision | ✅ Aprobado |
| DOC-002 | Product Requirements | ✅ Aprobado |
| DOC-003 | Software Design | ✅ Aprobado |
| DOC-004 | Architecture | ✅ Aprobado |
| DOC-005 | Engineering Guide | ✅ Aprobado |
| DOC-006 | Recepciones de Compra | ✅ Creado |
| ADR-002 | Inventory Movements | ✅ Aceptado |
| ADR-009 | Pendiente de revisión | ⏳ Pendiente |
| ADR-010 | Pendiente de revisión | ⏳ Pendiente |

---

# Riesgos y deuda técnica

- El endpoint de restablecimiento de contraseña continúa abierto para desarrollo.
- Faltan permisos RBAC específicos para registrar recepciones.
- No existe reversión ni cancelación de recepciones.
- No existe flujo de devoluciones a proveedores.
- Los listados de recepciones todavía no tienen paginación.
- Algunas recepciones históricas no contienen usuario responsable.
- La página de compras concentra demasiada lógica y deberá dividirse en componentes y hooks.

---

## Pruebas

MoneyInput cuenta con 25 pruebas automatizadas directas.

### Componente

Se validan:

- Símbolo monetario y moneda.
- `inputMode="decimal"`.
- Normalización de coma a punto.
- Entradas inválidas.
- Estado de error accesible.
- Límite de decimales.
- Valores negativos configurables.
- Propiedades heredadas de Input.

### Normalización monetaria

Se validan:

- Componente MoneyInput creado.
- Componente UI Input ampliado y reutilizado.
- Captura monetaria controlada mediante string.
- Coma decimal normalizada a punto.
- Límite configurable de decimales.
- Valores negativos deshabilitados por defecto.
- Prefijo monetario y moneda MXN integrados.
- Estados de error y texto auxiliar accesibles.
- Integración realizada en los campos Costo y Precio.
- Cobertura automatizada ampliada.
- 25 pruebas directas de MoneyInput ejecutadas correctamente.
- Casos límite de `maxDecimals` validados para valores negativos, decimales y no finitos.
- ESLint completado sin errores.
- Build de producción completado correctamente.

## Estado final

BC-002 se considera completado.


