# 🎨 Design System Overview

| Campo | Valor |
|--------|-------|
| Estado | 🟢 Activo |
| Versión | 1.0 |
| Última actualización | Sprint 09 |

---

# Objetivo

Definir los principios visuales y arquitectónicos utilizados para construir la interfaz de usuario de Zaping ERP.

El Design System busca mantener consistencia visual, reutilización de componentes y facilidad de mantenimiento conforme el sistema evoluciona.

---

# Filosofía

Todo componente debe cumplir al menos uno de los siguientes objetivos:

- Reutilización
- Consistencia
- Escalabilidad
- Accesibilidad
- Simplicidad

No se crearán componentes duplicados con la misma responsabilidad.

---

# Capas del Frontend

El frontend se divide en tres niveles.

## UI Components

Componentes completamente visuales.

No conocen reglas de negocio.

Ejemplos:

- Button
- Input
- Card
- Table
- Modal
- Loading
- Badge
- EmptyState
- Section
- PageHeader
- PageContainer

Ubicación:

```
components/ui
```

---

## Business Components

Componentes reutilizables que conocen el dominio del negocio.

Ejemplos:

- ProductSelector
- SupplierSelector
- CustomerSelector
- PurchaseTotals
- MoneyInput
- StatusBadge

Ubicación:

```
components/business
```

---

## Feature Components

Componentes exclusivos de un módulo.

Ejemplos:

- PurchaseForm
- PurchaseItemsTable
- SalesItemsTable
- QuotePreview

Ubicación:

```
features/
```

---

# Principios

## Single Responsibility

Cada componente debe tener una única responsabilidad.

---

## Composition over Configuration

Se favorecerá la composición de componentes antes que crear componentes gigantes con múltiples opciones.

---

## Reutilización

Si un componente puede utilizarse en tres o más módulos, deberá evaluarse moverlo a:

```
components/business
```

o

```
components/ui
```

---

## Consistencia

Todos los módulos deben compartir:

- Espaciados
- Tipografía
- Botones
- Tablas
- Formularios
- Estados vacíos
- Loading

---

# Convenciones

## Páginas

Todas las páginas seguirán esta estructura:

```tsx
<PageContainer>

    <PageHeader />

    ...

</PageContainer>
```

---

## Estados

Toda página debe contemplar:

- Loading
- Empty State
- Data

---

## Formularios

Los formularios deben utilizar componentes reutilizables siempre que existan.

---

## Tablas

Todas las tablas utilizarán el componente Table.

---

# Roadmap del Design System

## Sprint 09

- ProductSelector
- SupplierSelector
- CustomerSelector
- MoneyInput

## Sprint 10

- DatePicker
- SearchInput
- DataState

## Sprint 11

- Dashboard Cards v2
- Charts
- Filters

---

# Objetivo Final

Construir un Design System que permita desarrollar nuevos módulos manteniendo una experiencia de usuario consistente y reduciendo la duplicación de código.