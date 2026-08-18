# BC-003: DateInput

**Versión:** 1.0.0
**Estado:** Completado
**Sprint:** Sprint 09
**Prioridad:** Alta
**Responsable:** Zaping Team
**Fecha de inicio:** 2026-08-17

---

## 1. Propósito

DateInput es un componente de negocio reutilizable para capturar fechas de manera consistente, accesible y segura dentro de Zaping ERP.

El componente está orientado inicialmente a fechas de negocio que no requieren hora, como:

- Fecha de caducidad.
- Fecha de entrega.
- Fecha de recepción.
- Fecha de vigencia.
- Fechas de documentos comerciales.

DateInput debe evitar conversiones innecesarias mediante objetos `Date` que puedan introducir cambios de día por diferencias de zona horaria.

---

## 2. Arquitectura

```text
Feature o formulario
        ↓
DateInput
        ↓
Input
        ↓
string YYYY-MM-DD

## 11. Resultado de implementación

BC-003 DateInput fue implementado e integrado correctamente en el flujo de recepción de compras.

Resultados:

- Componente DateInput creado.
- Componente UI Input reutilizado.
- Manejo controlado mediante string `YYYY-MM-DD`.
- Sin conversiones automáticas mediante `Date`.
- Soporte para `min` y `max`.
- Estados `required` y `disabled` preservados.
- Estados de error y texto auxiliar accesibles.
- Integración realizada en Fecha de caducidad de recepciones.
- 9 pruebas directas de DateInput ejecutadas correctamente.
- Flujo de Purchases validado con 42 pruebas.
- Payload de recepción conserva `expirationDate` como `YYYY-MM-DD`.

## 12. Estado final

BC-003 DateInput se considera completado para la versión actual de la Business Components Library.