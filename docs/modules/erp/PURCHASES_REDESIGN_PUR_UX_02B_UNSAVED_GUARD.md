# PUR-UX-02B — Protección de captura sin guardar

## Objetivo
Impedir el descarte accidental de datos capturados en el **workspace de Nueva compra** sin alterar la creación, edición, permisos, endpoints o movimientos de inventario.

## Contrato de interacción
- Solo si `NEXT_PUBLIC_ZAPING_PURCHASES_WORKSPACE=true` y el modo es **Nueva compra** (`editing=false`).
- Si el usuario intenta salir mediante **Cancelar**, **X** o **Escape**, detectar valores actuales: proveedor elegido, producto elegido pero no agregado, cantidad inicial distinta de «1» o al menos una partida agregada.
- Cuando hay captura pendiente, abrir `ConfirmDialog` con **Continuar captura** (regresa a formulario con datos intactos) y **Descartar cambios** (ejecuta cierre y reset ya existentes en `usePurchaseForm`).
- Sin captura pendiente, cerrar directamente.
- Durante `saving`, bloquear cierre y confirmación; no interrumpir un POST/PATCH en curso.
- `Editar compra` y el formulario legado con bandera OFF conservan sus cierres actuales.
- No interceptar recargas o navegación fuera del modal en esta entrega. **No implica persistencia temporal ni guardado automático**.

## Implementación
- Reusar `ConfirmDialog` y la infraestructura existente de `Modal`; **no crear un segundo sistema de manejo de foco/diálogos**.
- Reusar `onClose` del padre y `usePurchaseForm.resetForm` como única autoridad de borrado.
- Mantener todos los cálculos, datos y callbacks existentes.
- Confirmación local en `PurchaseFormModal`, no introducir estado en la API ni en Prisma.

## Criterios de aceptación
- [x] Pruebas nuevas: cuatro clases de captura pendiente.
- [x] Continuar captura cierra solo la confirmación, sin invocar `onClose`.
- [x] Confirmar descarte invoca `onClose` una sola vez.
- [x] Cancelar y X comparten la protección.
- [x] Formulario vacío cierra directamente.
- [x] Guardando no se abre confirmación y se bloquean los controles de cierre.
- [x] Editar y bandera OFF no reciben el nuevo guard.
- [ ] CI final del PR apilado.
- [ ] QA de navegador: Escape, devolución de foco, dos diálogos, scroll del footer, 390/820/1024 y prueba real de proveedor/producto/partidas. Suspendido por decisión actual del usuario de pausar el QA visual.

## Release gates
PR Draft **stacked** sobre PUR-UX-02A #182 → #181 → #180 → #179. No fusionar ni activar flag por defecto hasta validar integración. La CI verde no equivale a aprobación visual ni funcional en navegador.
