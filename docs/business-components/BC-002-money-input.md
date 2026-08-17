# BC-002: MoneyInput

**Versión:** 1.0.0  
**Estado:** Completado  
**Sprint:** Sprint 09  
**Prioridad:** Alta  
**Responsable:** Zaping Team  
**Fecha de finalización:** 2026-07-13    

---

## 1. Propósito

MoneyInput es un componente de negocio reutilizable para capturar importes
monetarios de manera consistente, accesible y validada.

La primera versión estará orientada a importes en pesos mexicanos.

---

## 2. Arquitectura

```text
Feature o formulario
        ↓
MoneyInput
        ↓
Input

----

## 11. Resultado de implementación

BC-002 MoneyInput fue implementado e integrado correctamente en el módulo
de Productos.

Resultados:

- Componente MoneyInput creado.
- Componente UI Input ampliado y reutilizado.
- Captura monetaria controlada mediante string.
- Coma decimal normalizada a punto.
- Límite configurable de decimales.
- Valores negativos deshabilitados por defecto.
- Prefijo monetario y moneda MXN integrados.
- Estados de error y texto auxiliar accesibles.
- Integración realizada en los campos Costo y Precio.
- Pruebas unitarias agregadas.
- 26 pruebas ejecutadas correctamente.
- ESLint completado sin errores.
- Build de producción completado correctamente.
- Cobertura automatizada ampliada.
- 25 pruebas directas de MoneyInput ejecutadas correctamente.
- Casos límite de `maxDecimals` validados para valores negativos, decimales y no finitos.

## Estado final

BC-002 se considera completado.