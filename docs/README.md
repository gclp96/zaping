# Zaping ERP

> ERP SaaS multiempresa especializado inicialmente en distribuidoras de
> insumos médicos.

---

## Descripción

Zaping ERP es una plataforma web para administrar la operación diaria de
pequeñas y medianas empresas.

Su primera vertical comercial está enfocada en distribuidoras de suministros
médicos, con capacidades de trazabilidad de inventario y una arquitectura
preparada para crecer como parte del ecosistema Zaping.

La plataforma integra:

- Clientes.
- Proveedores.
- Productos.
- Inventario.
- Compras.
- Cotizaciones.
- Ventas.
- Dashboard administrativo.
- Usuarios, roles y permisos.

Zaping se desarrolla bajo un enfoque Documentation First, arquitectura de
monolito modular, APIs reutilizables y componentes visuales consistentes.

---

## Ecosistema Zaping

El ecosistema está compuesto inicialmente por:

### Zaping ERP

Administración de operaciones internas.

### Zaping Radar

Localización, clasificación y seguimiento de licitaciones públicas y otras
oportunidades externas.

### Zaping AI

Análisis, automatización y recomendaciones empresariales futuras.

---

## Características principales

- Arquitectura SaaS multiempresa.
- Aislamiento de datos mediante `companyId`.
- Autenticación con JWT.
- Autorización mediante roles y permisos.
- Gestión de empresas.
- Gestión de clientes.
- Gestión de proveedores.
- Catálogo de productos.
- Inventario basado en movimientos.
- Registro de compras.
- Generación de cotizaciones.
- Registro de ventas.
- Dashboard administrativo.
- Eliminación lógica.
- Identificadores UUID.
- API REST.
- Design System propio.
- Business Components Library en desarrollo.

---

## Flujo operativo implementado

```text
Compra
  ↓
Entrada de inventario
  ↓
Cotización
  ↓
Venta
  ↓
Salida de inventarios