# 💻 Coding Standards

| Campo | Valor |
|--------|-------|
| Estado | 🟢 Activo |
| Versión | 1.0 |
| Última actualización | Sprint 09 |

---

# Objetivo

Definir los estándares de desarrollo utilizados en Zaping ERP para mantener un código consistente, legible, escalable y fácil de mantener.

Todos los nuevos módulos deberán seguir estas convenciones.

---

# Principios

Todo el código debe cumplir los siguientes principios:

- Legibilidad.
- Reutilización.
- Responsabilidad única.
- Tipado fuerte.
- Simplicidad.
- Consistencia.

---

# TypeScript

## Evitar any

❌ Incorrecto

```ts
const data: any
```

✅ Correcto

```ts
type Customer = {
    id: string;
    name: string;
}
```

Si el tipo aún no existe, deberá crearse.

---

# Componentes React

## Un componente = una responsabilidad

No crear componentes gigantes.

Si supera aproximadamente 250-300 líneas debe evaluarse dividirlo.

---

## Componentes reutilizables

Si un componente puede utilizarse en tres o más módulos deberá evaluarse moverlo a:

```
components/ui
```

o

```
components/business
```

---

# Organización

Frontend

```
app/

components/

hooks/

services/

types/

utils/
```

Backend

```
src/

auth/

customers/

suppliers/

products/

inventory/

purchases/

sales/

common/
```

---

# Convenciones

## Componentes

PascalCase

```
Button.tsx

PageHeader.tsx

Loading.tsx
```

---

## Hooks

camelCase

```
useAuth()

useProducts()
```

---

## Variables

camelCase

```ts
customerName

totalAmount

pageLoading
```

---

## Tipos

PascalCase

```ts
Customer

Supplier

PurchaseItem
```

---

## Interfaces y Types

Preferir `type` para modelos simples.

Usar `interface` cuando exista herencia o extensión clara.

---

# Páginas

Todas las páginas deben seguir la estructura:

```tsx
<PageContainer>

    <PageHeader />

    ...

</PageContainer>
```

---

# Estados

Toda página debe contemplar:

- Loading
- EmptyState
- Data

---

# Formularios

Los formularios deben:

- Validar datos.
- Mostrar estados de carga.
- Reutilizar componentes existentes.

---

# API

Nunca consumir fetch directamente.

Siempre utilizar:

```
services/api.ts
```

---

# Backend

Los Services contienen la lógica de negocio.

Los Controllers únicamente reciben la petición y responden.

---

# Prisma

Toda operación debe ejecutarse utilizando Prisma ORM.

No escribir SQL manual salvo casos excepcionales.

---

# Manejo de errores

Todos los errores deberán:

- Registrarse.
- Mostrar mensajes claros.
- Evitar exponer información sensible.

---

# Documentación

Toda funcionalidad importante deberá tener documentación antes de implementarse.

---

# Pull Request Checklist

Antes de considerar terminado un módulo verificar:

- Código limpio.
- Sin duplicación.
- Tipado correcto.
- Componentes reutilizados.
- Documentación actualizada.
- Backlog actualizado.

---

# Regla de Oro

Si una mejora beneficia a varios módulos, debe implementarse primero en el componente reutilizable y después consumirse desde cada módulo.