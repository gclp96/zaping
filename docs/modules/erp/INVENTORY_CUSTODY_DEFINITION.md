# HC-INVENTORY-CUSTODY-DEF — Inventory Custody & Physical Availability Definition

**COMPLETE / MERGED — PR #75 — main@51363f5 — TARGET 5 SP.**

HC-INVENTORY-CUSTODY-01E — [Technical Design APPROVED](INVENTORY_CUSTODY_01E_TECHNICAL_DESIGN.md).
IMPLEMENTATION: NOT STARTED. ASSET/EquipmentAsset únicamente; SERIALIZED material excluido.
01E-A: READY — TARGET 5 SP — inicio después del merge del Technical Design.
01E-B: BLOCKED BY 01E-A — TARGET 8 SP. TOTAL 01E TARGET: 13 SP = 5 + 8; sustituye el TARGET8SP anterior.
EquipmentAsset root físico; lifecycle/condition/location independientes; AVAILABLE derivado.
Custodia/eventos dedicados; UNVERIFIED conservador; ningún adapter Dispatch productivo.
Autoridad Equipment independiente de InventoryCutover QUANTITY: no exige activación01D.
REAL COMPANY CUTOVER: NOT EXECUTED. EXTERNAL OPERATIONAL FENCE: NOT CERTIFIED.
M-HC1 OPEN. Sin Forecast, Commitment, Actual ni fechas asignadas.

01D-C COMPLETE / MERGED — PR #84 — TARGET 8 SP. HC-INVENTORY-CUSTODY-01D IMPLEMENTATION COMPLETE / MERGED.
Full API1935/1935 (116 suites), Web106/106 (8 archivos), PostgreSQL aislado27/27 PASS.
Fence compartido/exclusivo y router único cableados; CLI interna exige adapter de evidencia.
ACTUAL CUTOVER NOT EXECUTED; 01D ACTIVATION NOT PERFORMED AGAINST REAL COMPANY.
EXTERNAL OPERATIONAL FENCE: NOT CERTIFIED. [Runbook](INVENTORY_CUSTODY_01D_CUTOVER_RUNBOOK.md).

Evidencia histórica 01D-B COMPLETE / MERGED — PR #83 — TARGET8SP.
Focal77/77, full API1918/114 suites, PostgreSQL43/43 PASS; Prisma format/validate/generate,
typecheck, lint tocado y build PASS. Aceptación sólo DB nueva efímera zaping_opening_test,
loopback/tmpfs; cleanup PASS; .env intacto. OPENING interno, manifest/review/APPLY/VERIFY;
registry CUSTODY fail-closed sin namespaces predeterminados; sin routing ni PHYSICAL_ACTIVE.
Detalle y límites en §A.2 del diseño01D.01D-C COMPLETE / MERGED — PR #84; actual cutover NOT EXECUTED.
01A/B/C DORMANT;01D ACTIVATION NOT STARTED;M-HC1 OPEN. Sin Forecast/Commitment/Actual.

Merge DEF: `51363f566c8c6656f1653f03f11d9489ab4d082b`. 01A está COMPLETE / MERGED —
PR #77 — main@47fd68a — TARGET 8 SP; [diseño técnico](INVENTORY_CUSTODY_TECHNICAL_DESIGN.md)
TD-INV-01A-01..20 APPROVED / MERGED — PR #76. Autoridad todavía dormida.
01B COMPLETE / MERGED — PR #79 — TARGET 8 SP;
[TD-INV-01B-01..30](INVENTORY_CUSTODY_01B_TECHNICAL_DESIGN.md)
APPROVED / MERGED — PR #78. Activation DORMANT UNTIL 01D.
01C COMPLETE / MERGED — PR #80 — main@c3d0824 — TARGET 8 SP;
[TD-INV-01C-01..36](INVENTORY_CUSTODY_01C_TECHNICAL_DESIGN.md): aprobadas con restricciones humanas vinculantes.
Candidate C OPTIONAL sólo unbatched; replay lógico sólo mismo actor; sin Idempotency-Key.
01D conserva gates de accesibilidad OPTIONAL, reaudit locks y manifest legacy; no bloquean implementación dormida01C.
01D TECHNICAL DESIGN: APPROVED; TD-INV-01D-01..32 = 32/32 human approved.
[Diseño01D](INVENTORY_CUSTODY_01D_TECHNICAL_DESIGN.md): control DB dedicado,
initializer/adapter opening-only, router único Company y corte coordinado.
01D-A COMPLETE / MERGED — PR #82;01D-B COMPLETE / MERGED — PR #83;01D-C COMPLETE / MERGED — PR #84.
DESIGN APPROVED no significa CUTOVER READY;01D ACTIVATION NOT STARTED.
Original TARGET8SP SUPERSEDED BY HUMAN RE-ESTIMATION:
01D-A5SP COMPLETE / MERGED — PR #82;01D-B8SP COMPLETE / MERGED — PR #83;01D-C8SP COMPLETE / MERGED — PR #84; TOTAL21SP.
Sin Forecast/Commitment/Actual ni fechas.
01E TECHNICAL DESIGN APPROVED; 01E-A READY tras merge del diseño, 01E-B BLOCKED BY 01E-A. Dispatch sigue bloqueado; 01A/01B/01C permanecen DORMANT.

Baseline: `456e5a6ddbffbbb9fdc3b2be524345c57a6bf90f`. DEC-INV-CUST-01..14 aprobadas
por revisión humana de producto/arquitectura con refinamientos de §9. No
implementación, schema aprobado, migración ni lectura de datos reales.
HC-CASE-DISPATCH conserva CONTRACT APPROVED y sus slices BLOCKED. M-HC1 OPEN.

## 1. Autoridad documental y hallazgo arquitectónico

No existe carpeta Inventory específica: la documentación canónica está en ERP.
[INVENTORY](INVENTORY.md) describe CURRENT;
[ADVANCED_INVENTORY](ADVANCED_INVENTORY.md) describe DESIGNED / APPROVED, NOT IMPLEMENTED.
[ADR-002](../../architecture/adr/ADR-002-inventory-movements.md) conserva movimientos
como verdad histórica y saldo como proyección.
[ADR-013](../../architecture/adr/ADR-013-inventory-custody-case-logistics.md) separa
custodia de OUT definitivo.
[ADR-014](<../../architecture/adr/ADR-014 — Inventory Locations and Internal Transfers>)
ya acepta posiciones/ubicaciones y operaciones de transferencia como arquitectura
objetivo: entradas relacionadas OUT origen + IN destino, no un nuevo tipo gigante
de movimiento. Su existencia reduce la neutralidad entre opciones: abandonar esa
dirección exige revisión explícita de ADR, no elección silenciosa.

Esto no aprueba el slice concreto, sus tablas, el backfill o una implementación
InventoryPosition: DEC-DSP-08 sigue vigente. [CASE_LOGISTICS §258](../healthcare/CASE_LOGISTICS.md#258-hc-case-dispatch--v1-approved-contract)
aprueba autoridad compartida y batch exacto para todo material Dispatch; custodian
INTERNAL_USER/EXTERNAL_PERSON y snapshots siguen perteneciendo a Dispatch.
[CASE_KITS §205](../healthcare/CASE_KITS.md#205-current) y
[DOMAIN_MODEL](../healthcare/DOMAIN_MODEL.md) separan preparación lógica de custodia.
PROJECT_BOARD y ROADMAP mantienen el gate de arquitectura previo a logística física.

## 2. Inventory fact map del baseline de discovery

Esta tabla conserva evidencia histórica previa al wiring01D-C. Estado actual: los cuatro
writers usan fence Company compartido, runtime/resolver y una rama LEGACY o PHYSICAL en
READ COMMITTED; CUTOVER/recovery rechazan. El helper registerPurchaseEntry fue retirado.
Manual físico usa fuentes/revisiones explícitas; Receipt/Sales reutilizan01B/01C.
Product.stock conserva owned; no se redefine lowStock ni valoración. Ver §A.3 del diseño01D.

| Hecho              | Persistencia y comportamiento real                                                                                                                                                                                                            | Autoridad / concurrencia / tenant                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product.stock      | Int default 0; Product create no recibe stock. Inventory createMovement IN suma, OUT resta, ADJUSTMENT fija saldo absoluto. Receipts incrementa; Sales approve y convertFromQuote decrementan.                                                | Saldo operativo leído para gastar y para dashboard/low stock; no se recalcula del ledger en cada request. Writes acompañados de movimientos en transacción en esos caminos. Lookup Company y update compuesto/filtrado por tenant. |
| InventoryBatch     | Company/Product, lotNumber, expirationDate?, initialQuantity, availableQuantity, isActive, unitCost. Receipt crea ambos contadores o los incrementa; initialQuantity es acumulado recibido, no saldo actual.                                  | Único Company/Product/lotNumber; FKs Company y Product separadas, no garantizan por sí solas coincidencia tenant. Servicios validan relaciones. Sin decremento de batch en los caminos OUT examinados.                             |
| Batch vs Product   | Receipt con lote incrementa batch y Product; Receipt sin lote, movimiento manual y Sales pueden operar sólo agregado.                                                                                                                         | No igualdad garantizada entre suma availableQuantity y stock. Sales no conserva qué lote salió: distribución histórica no reconstruible por esos registros. No se afirma que datos reales sean inconsistentes; no se consultó DB.  |
| InventoryMovement  | IN/OUT/ADJUSTMENT, quantity, balance?, Product, batch opcional, referenceType/Id, createdBy opcional, costo/notas. Sin source/target location ni transferencia.                                                                               | Evidencia histórica por ADR; ejecución usa saldo persistido, no replay del historial. ADJUSTMENT quantity es saldo final, no delta. FK simples no aseguran todo el matching Company/Product/Batch.                                 |
| Manual Inventory   | createMovement relee Product por intento; movimiento + stock en Serializable, hasta tres intentos ante conflicto.                                                                                                                             | Evita reutilizar saldo de transacción abortada. Sin IdempotencyRecord en ese comando: retry HTTP de IN/OUT tras respuesta perdida no es replay seguro. Actor no se llena en ese write actual.                                      |
| Sales              | approve DRAFT→CONFIRMED y conversión Quote→Sale CONFIRMED consumen stock dentro de transacción; decremento condicional stock>=quantity.                                                                                                       | Estado condicional evita doble aprobación; conversión protege origen Quote/relación única. No Idempotency-Key físico común; repetir no garantiza respuesta de replay. Product tenant/activo validado.                              |
| Elegibilidad Sales | Generic Sales sólo QUANTITY; rechaza lotTracking REQUIRED y ASSET/SERIALIZED. NONE/OPTIONAL no seleccionan batch.                                                                                                                             | No afirmar que Sales ya vende REQUIRED por lote. OPTIONAL puede tener receipts con lote pero su OUT sigue agregado. No puede excluir custodia inexistente.                                                                         |
| Purchase           | Confirmar orden cambia estado; no ingresa stock.                                                                                                                                                                                              | Transición condicional en transacción, evita confundir compra con recepción física.                                                                                                                                                |
| PurchaseReceipt    | Recepción parcial valida pendientes y lotTracking; REQUIRED exige lote, NONE rechaza datos de lote, OPTIONAL permite ambos. Crea receipt/items, batch opcional, incrementa stock, crea IN PURCHASE_RECEIPT; puede provisionar EquipmentAsset. | Transacción Serializable; key/hash PURCHASE_RECEIPT_CREATE, claim/completion y efectos atómicos. Misma key/payload replay, mismatch rechazado.                                                                                     |
| Helper legacy      | Inventory.registerPurchaseEntry incrementa Product + IN en transacción recibida.                                                                                                                                                              | No se encontró caller productivo en búsqueda de src; no confundir existencia de helper con efecto actual de Purchase.approve. Debe migrarse o retirarse antes de cutover.                                                          |
| Equipment          | Asset individual, lifecycle/condition/serial; Assignment RESERVED lógico por Case.                                                                                                                                                            | No custodia física ni posición material. Receipt ASSET también incrementa saldo agregado hoy: no sumarlo de nuevo como material más Asset.                                                                                         |
| CaseKit            | DRAFT/PREPARED, preparedQuantity, auditoría y referencias actuales.                                                                                                                                                                           | No modifica stock, batch ni movimiento. Assignment release no puede convertirse en liberación física futura.                                                                                                                       |
| IdempotencyRecord  | Company/scope/key único, hash, resourceId.                                                                                                                                                                                                    | Receipt y Healthcare lo usan; no scopes de shared physical effect actuales.                                                                                                                                                        |

Evidencia inspeccionada: [schema](../../../app/api/prisma/schema.prisma),
[Inventory service](../../../app/api/src/inventory/inventory.service.ts),
[Products](../../../app/api/src/products/products.service.ts),
[Purchases](../../../app/api/src/purchases/purchases.service.ts),
[Receipts](../../../app/api/src/purchases-receipts/purchases-receipts.service.ts),
[Sales](../../../app/api/src/sales/sales.service.ts),
[Dashboard](../../../app/api/src/dashboard/dashboard.service.ts).
Migraciones revisadas: inventory_movements (20260527190544), purchase_receipts
(20260718005142), normalización batch/receipt (20260720172022), idempotency_records
(20260825231000). La normalización hace nullable lotNumber en receipt y elimina
relaciones batch-purchase directas; no introduce posiciones ni reconciliación.

## 3. Arquitectura aprobada y opciones evaluadas

DEC-INV-CUST-01..14 están APPROVED por revisión humana. La arquitectura elegida
combina posiciones como autoridad del estado físico actual, ledger/efectos
transaccionales inmutables como evidencia histórica y proyecciones compatibles.
Posiciones y evidencia se actualizan atómicamente. Leer disponibilidad normal no
requiere reproducir el historial completo. Nombres concretos de entidades Prisma,
campos y mecanismos de locks siguen siendo diseño técnico, no decisiones de schema.

| Familia evaluada en discovery      | Resultado                                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Posiciones                         | Base aprobada para autoridad física actual; disponibilidad compartida por Inventory/Sales/Healthcare.                   |
| Owned + allocations/holds          | No seleccionada como autoridad alternativa; no introducir ledger paralelo que pueda gastar las mismas unidades.         |
| Ledger puro con replay por request | No seleccionado; evidencia histórica con posiciones transaccionales evita replay completo en consultas normales.        |
| Posiciones + ledger transaccional  | Arquitectura aprobada, con Product.stock y balances batch compatibles como proyecciones, no autoridades independientes. |

ADR-014 describe entradas relacionadas OUT origen + IN destino. El refinamiento
DEC-INV-CUST-04 distingue dirección contable de semántica empresarial: TRANSFER es
UN evento físico atómico, débito origen + crédito destino bajo identidad común.
Su débito no constituye OUT definitivo. OUT queda reservado a disposición definitiva
fuera de la propiedad/inventario de Company. No dos movimientos independientes.

Material CUSTODY reside en la autoridad de posiciones compartida. El contexto
preserva vínculo durable CaseDispatch/CaseDispatchItem para Return/Reconciliation;
Inventory no duplica el aggregate Dispatch, sus datos de personas ni snapshots.
Dispatch sigue siendo verdad empresarial del handoff; Inventory, verdad de balances.
Custodian híbrido aprobado de Dispatch permanece intacto.

EquipmentAsset queda fuera de posiciones de cantidad. Custodia física basada en
Asset exige a lo sumo una cadena activa por Company/Asset. Confirm futuro coordina
atómicamente transferencias de material, hechos de custodia Asset y Dispatch.
Release/replace de Assignment no libera físicamente una custodia confirmada.
Persistencia exacta de custodia Equipment corresponde a diseño técnico/01E.

## 4. Product.stock, batch y ecuaciones aprobadas

Después del cutover coordinado:

```text
Product.stock = Company-owned material quantity (compatibility projection)
owned = sum(company-owned non-terminal physical positions)
available = sum(positions currently eligible for physical consumption/dispatch)
inCustody = sum(company-owned custody positions)
```

Ejemplo: Warehouse disponible 6 + Custody 4 → stock/owned 10, available 6.
TRANSFER Warehouse→Custody y Custody→Inspection preservan owned.
OUT definitivo desde Custody de 2 → owned 8, available 6, custody 2.
La misma unidad no se descuenta otra vez por Sales/Invoice u otro evento downstream.
IN receipt aumenta owned y posición AVAILABLE. Expiración/inactividad puede reducir
eligibilidad sin borrar existencia. Estados propios son disjuntos; no sumar una
unidad tanto como material como Asset. Compatibilidad histórica ASSET se resuelve
técnicamente sin convertir Equipment en posiciones cuantitativas.

Product.stock es proyección, nunca autoridad de disponibilidad Sales. Ningún módulo
puede escribirlo independientemente después de cutover. Todos los writers físicos
operan mediante Inventory compartido y actualizan proyecciones transaccionalmente.
CURRENT permanece intacto hasta ese corte: está prohibido el híbrido donde
Healthcare gasta posiciones y Sales sigue gastando Product.stock por separado.
Dashboard/reporte de existencia puede conservar owned; low stock/surtido/validación
Sales deben distinguir available. Adaptar contratos y tests sin cambio semántico
silencioso del campo público.

Stock físico loteado usa posiciones respaldadas por InventoryBatch exacto.
Material QUANTITY verdaderamente sin lote admite batchId null. Esto no relaja
DEC-DSP-05: material Dispatch V1 requiere batch físico exacto soportado.
initialQuantity y otros campos históricos/acumulados recibidos no se reinterpretan
como saldo físico actual. available/remaining legacy aplicable puede permanecer
como proyección derivada; diseño técnico debe preservar y documentar semántica
exacta de cada campo. owned/available/custody por batch provienen de posiciones.
OUT acumulado proviene de efectos definitivos, no de restar owned a receipts.

## 5. Contratos de integración aprobados

**Sales:** consume únicamente shared AVAILABLE; nunca custodia. Todo outbound
resuelve posiciones origen concretas. REQUIRED exige selección exacta de batch.
OPTIONAL con stock loteado permite resolución backend determinista, por ejemplo
FEFO, sin requerir elección UI manual; siempre persiste la fuente exacta. QUANTITY
sin lote usa posición sin lote. No implementar FEFO aquí. Approve y convertFromQuote
siguen siendo caminos que deben migrarse; CURRENT no cambia en este cierre.
OUT definitivo reduce existencia una vez; la disposición ya consumida de Custody
se referencia desde un evento comercial posterior, no vuelve a descontarse.

**PurchaseReceipt:** un efecto inbound atómico establece/aumenta posición AVAILABLE,
escribe evidencia inmutable, actualiza Product.stock owned y proyecciones batch
aplicables y completa idempotencia. No ejecutar incrementos legacy además del nuevo
servicio. Purchase.approve continúa sin efecto físico. Provisioning ASSET requiere
adaptación que preserve identidad sin doble conteo material.

**COUNT_CORRECTION:** posición/contexto batch específico, expected revision/version,
actor, razón y delta/evidencia. Cambia owned sólo para reflejar realidad física
contada. Después de cutover se prohíbe Product.stock=X genérico. Reclassification
entre ubicación/estado es TRANSFER y conserva owned, no Adjustment. Autorizaciones
y comandos concretos son diseño técnico; no implementar ajustes aquí ni usar un
ajuste genérico para borrar el hecho empresarial de custodia.

## 6. Protocolo V1 de concurrencia e idempotencia

Todos los escritores de cantidad comparten la misma autoridad y protocolo:

1. Iniciar transacción.
2. Adquirir raíces Product afectadas en orden determinista.
3. Adquirir/validar posiciones y batches en orden determinista.
4. Comprobar invariantes condicionales de cantidad.
5. Cambiar balances de posiciones.
6. Escribir ledger/efecto.
7. Actualizar proyecciones compatibles.
8. Completar idempotencia.
9. Commit.

Baseline correctness-first, no aprobación automática de advisory locks. Mecanismo
exacto es diseño técnico. Healthcare Company-first debe coordinarse con locks de
padres empresariales y orden Inventory, sin inversión entre dominios. Validar el
orden total antes de implementar; retries acotados releen fuentes actuales.
Cantidad no negativa, débito condicional suficiente, tenant/product/batch coherentes,
fuentes agrupadas y targets únicos protegen saldos. No basta SUM sin serialización.

Un evento de negocio idempotente produce un efecto físico con origen/identidad
única durable; campos exactos pendientes. Business mutation, posición, ledger,
proyecciones y completion comparten transacción. Retry no duplica receipt, transfer,
OUT definitivo, custodia, count correction, evidencia ni delta de proyección.
Misma identidad con payload incompatible se rechaza. Receipt conserva su patrón;
Sales y writers manuales deben integrarse, no confiar en una nueva key por retry.
No llamadas externas dentro de la sección transaccional física.

| Caso de aceptación requerido                         | Invariante                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Sale vs Sale, Sale vs Dispatch, Dispatch vs Dispatch | Compiten por la misma disponibilidad batch/posición; no overdraw.                                   |
| Receipt vs consumo                                   | Orden serial coherente, no incremento perdido ni gasto de ingreso no confirmado.                    |
| Count correction vs consumo                          | Revisión/saldo actual; conteo viejo no sobrescribe gasto concurrente.                               |
| Dos handoffs del mismo Asset                         | Una única cadena activa de custodia.                                                                |
| Respuesta perdida/retry                              | Un efecto, una auditoría y un delta de proyección.                                                  |
| Fallo tras débito antes de crédito                   | Rollback de todo el handoff, posiciones, evidencia y claim.                                         |
| Return futuro vs otra operación                      | Contexto/version residual común; no doble retorno ni disponibilidad automática antes de inspección. |

No se escriben pruebas ni se ejecutan DB aquí.

## 7. Migración aprobada: opening baseline conciliado

1. Inventariar datos y escritores en trabajo posterior: stock, batches, receipts,
   movimientos y ajustes por tenant/Product. Este cierre no consultó DB.
2. No deducir lotes históricos por FEFO supuesto ni tomar availableQuantity legacy
   como prueba de existencia actual. ADJUSTMENT legacy es saldo final, no delta.
3. Conciliar y auditar baseline físico/propiedad, ubicación y custodia existentes.
   Para QUANTITY sin lote, Product.stock conciliado puede sembrar AVAILABLE inicial.
   Para stock loteado, cantidades iniciales se establecen por batch físico real.
4. Si Product.stock != suma de cantidades físicas batch conciliadas, registrar
   discrepancia y exigir resolución explícita. Nunca repartir arbitrariamente el
   residual entre lotes ni inventar lotes/linaje que no fueron registrados.
5. Manifest determinista, timestamp de cutover claro, IDs estables y opening effects
   auditados. No son nuevas compras ni un segundo incremento de owned. Historial
   InventoryMovement anterior queda como legacy pre-cutover, inalterado; no fingir
   que tenía hechos suficientes para reconstruir posiciones nuevas.
6. Expandir estructuras pasivas y preparar todos los writers/readers. Corte
   coordinado: bloquear writers legacy, cargar baseline validado, reconciliar,
   activar autoridad única y consumidores compatibles. Discrepancia sin resolver
   impide activación. Nunca dos autoridades independientes gastando a la vez.
7. Proyecciones compatibles se escriben sólo con posición/efecto en la misma
   transacción. Reversión de despliegue tras nuevos efectos requiere procedimiento
   compatible y conciliación; no volver al writer agregado sin control.

Aprobación de esta estrategia no acredita backfill ya ejecutable sobre datos reales.
Tooling, conciliación operacional y aceptación corresponden a 01D.

## 8. Lectura, seguridad y rendimiento

Read model objetivo separa al menos owned, available e inCustody. Soporta evolución
a inspection/quarantine; reserved/staged no se exponen como implementados sólo por
ser conceptos futuros. Product/batch usan sumas de posiciones elegibles, índices
por tenant/Product/Batch/contexto y consultas acotadas; no replay completo por query.
Ledger explica/reconcilia balances transaccionales; inconsistencia exige revisión,
no reparación silenciosa. Asset tiene lectura propia, no se agrega como material.

Company autenticada y FKs compuestas que impiden referencias cross-company y batch
de otro Product. Audit actor/tiempo/origen retenido, incluidos ajustes, aun si actor
se desactiva. Foreign como missing. Exponer sólo identidades públicas necesarias,
no claims, SQL o locks. Snapshot de custodian híbrido permanece en Dispatch.

## 9. DEC-INV-CUST-01..14 — APPROVED con refinamientos

| ID              | Estado                             | Decisión vinculante                                                                                                                                                                                                                                 |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-INV-CUST-01 | APPROVED                           | Posiciones = autoridad física actual; ledger/efectos inmutables = evidencia histórica; Product.stock/batch legacy = proyecciones. Actualización atómica, sin replay completo normal; nombres Prisma no aprobados.                                   |
| DEC-INV-CUST-02 | APPROVED WITH WRITE DEPRECATION    | Product.stock = Company-owned material quantity. Tras cutover sólo proyección transaccional; ningún writer independiente ni uso Sales como available. CURRENT intacto hasta corte.                                                                  |
| DEC-INV-CUST-03 | APPROVED                           | Posiciones loteadas InventoryBatch-backed; batchId null para QUANTITY realmente sin lote. Históricos recibidos no son saldos actuales; preservar semántica exacta de campos compatibles.                                                            |
| DEC-INV-CUST-04 | APPROVED WITH SEMANTIC REFINEMENT  | TRANSFER es un evento atómico debit+credit, preserva owned; origen no es OUT definitivo ni movimiento empresarial independiente. OUT sólo disposición definitiva.                                                                                   |
| DEC-INV-CUST-05 | APPROVED                           | Material en custodia dentro de posiciones compartidas con linkage durable Dispatch/Item. No duplicar Dispatch; handoff empresarial vs balance físico separados.                                                                                     |
| DEC-INV-CUST-06 | APPROVED                           | OUT consume posición propia real y reduce owned una vez. Transfers a Custody/Inspection no reducen owned; downstream nunca repite descuento.                                                                                                        |
| DEC-INV-CUST-07 | APPROVED                           | Sales consume shared AVAILABLE, nunca custody. Fuente concreta obligatoria; REQUIRED selección batch exacta; OPTIONAL puede resolución backend determinista (FEFO candidato); unbatched usa posición sin lote.                                      |
| DEC-INV-CUST-08 | APPROVED                           | Receipt atómico: AVAILABLE + evidencia + proyecciones owned/batch + idempotencia, sin incrementos de autoridades competidoras.                                                                                                                      |
| DEC-INV-CUST-09 | APPROVED WITH ADJUSTMENT SPLIT     | COUNT_CORRECTION por posición/batch, expected version, actor, razón y delta; owned refleja conteo. Reclassification es TRANSFER, no ajuste. No Product.stock=X después del corte.                                                                   |
| DEC-INV-CUST-10 | APPROVED V1 SERIALIZATION PROTOCOL | Transacción → Product roots ordenados → posiciones/batches ordenados → invariantes → balances → efecto → proyecciones → idempotencia → commit. Todos los writers; mecanismo técnico pendiente, sin advisory lock aprobado.                          |
| DEC-INV-CUST-11 | APPROVED                           | Origen físico único durable: un evento idempotente, un efecto. Mutación empresarial, balances, ledger y completion atómicos; sin duplicados por retry.                                                                                              |
| DEC-INV-CUST-12 | APPROVED                           | Opening baseline conciliado/auditado; sin inventar linaje. Unbatched stock conciliado puede sembrar AVAILABLE; loteado por batch real; discrepancia exige resolución, nunca distribución arbitraria. Timestamp/manifest y autoridad única al corte. |
| DEC-INV-CUST-13 | APPROVED                           | owned=sum posiciones propias no terminales; available=sum elegibles; inCustody=sum propias en custodia. Futuro inspection/quarantine; no afirmar reserved/staged implementados.                                                                     |
| DEC-INV-CUST-14 | APPROVED                           | EquipmentAsset fuera de posiciones cuantitativas; una custodia activa por Asset. Handoff coordina material, Asset y Dispatch atómicamente; persistencia Equipment técnica posterior.                                                                |

## 10. Slices definidos y estado posterior al merge DEF

| ID                         | Alcance                                                                           | TARGET            | Estado                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| HC-INVENTORY-CUSTODY-01A   | Core physical authority: posiciones + ledger/efectos transaccionales + read model | 8 SP              | COMPLETE / MERGED — PR #77 — main@47fd68a                                                                                            |
| HC-INVENTORY-CUSTODY-01B   | Purchase Receipts + writers Inventory manual + proyecciones compatibles           | 8 SP              | COMPLETE / MERGED — PR #79 — DORMANT UNTIL 01D                                                                                       |
| HC-INVENTORY-CUSTODY-01C   | Sales shared availability + resolución outbound + concurrencia                    | 8 SP              | COMPLETE / MERGED — PR #80 — main@c3d0824 — DORMANT UNTIL 01D                                                                        |
| HC-INVENTORY-CUSTODY-01D   | Reconciliation + opening baseline + coordinated cutover umbrella                  | 21 SP = 5 + 8 + 8 | IMPLEMENTATION COMPLETE / MERGED — 01D-A PR #82; 01D-B PR #83; 01D-C PR #84; original8SP SUPERSEDED |
| HC-INVENTORY-CUSTODY-01D-A | Durable Cutover Control & Legacy Classification Foundation                        | 5 SP              | COMPLETE / MERGED — PR #82 — NON-ACTIVATING                                                                                          |
| HC-INVENTORY-CUSTODY-01D-B | Reconciliation, Opening Baseline & Verification                                   | 8 SP              | COMPLETE / MERGED — PR #83 — NO PRODUCTIVE ACTIVATION                                                                                |
| HC-INVENTORY-CUSTODY-01D-C | Authority Cutover, Writer Wiring & Operational Activation                         | 8 SP              | COMPLETE / MERGED — PR #84 — ACTUAL CUTOVER NOT EXECUTED                                                                                   |
| HC-INVENTORY-CUSTODY-01E | EquipmentAsset custody foundation | 13 SP = 5 + 8 | TECHNICAL DESIGN: APPROVED — IMPLEMENTATION: NOT STARTED |
| HC-INVENTORY-CUSTODY-01E-A | Persistence, invariants, baseline & physical history | 5 SP | READY — inicio después del merge del Technical Design |
| HC-INVENTORY-CUSTODY-01E-B | Physical primitives, Equipment/Assignment/readers & cross-domain acceptance | 8 SP | BLOCKED BY HC-INVENTORY-CUSTODY-01E-A |

La división histórica01A..01E sustituyó el slice integrado de 13 SP del discovery; el TARGET propio01E ahora se revisa a13 SP según su aprobación humana. Sin fechas,
Forecast, Commitment ni Actual. 01D-A merged PR #82;01D-B merged PR #83; 01D-C merged PR #84; no hay activación. DEF fue merged
mediante PR #75; 01A COMPLETE / MERGED mediante PR #77 sobre
`47fd68a409906b3a5981bd7f7cd30a48e08714b0`, con TD-INV-01A-01..20 APPROVED / MERGED
mediante PR #76 tras las sustituciones humanas 10/14/19. 01B COMPLETE / MERGED — PR #79;
01C COMPLETE / MERGED — PR #80 — main@c3d0824, DORMANT UNTIL 01D.
01D diseño aprobado32/32;01D-A COMPLETE / MERGED — PR #82;
01D-B COMPLETE / MERGED — PR #83;01D-C COMPLETE / MERGED — PR #84; actual cutover NOT EXECUTED. Activación depende de gates
reales de cutover, no de decisiones TD pendientes. 01E-A READY tras merge del diseño; 01E-B BLOCKED BY 01E-A. TD-INV-01B-01..30 APPROVED;
TARGET 8 SP con alcance backend QUANTITY dormido, sin frontend/cutover.
COUNT_CORRECTION cero conserva Effect/Line sin revision bump; Receipt mixto separa
QUANTITY/ASSET/SERIALIZED. SERIALIZED físico queda deferred a decisión/slice futuro;
ASSET pertenece Equipment/01E.

HC-DSP-01A/B/C/D permanecen **DEFINED / BLOCKED BY INVENTORY CUSTODY FOUNDATION**.
El refinamiento técnico de schema/API puede continuar posteriormente, pero la
implementación productiva no precede al fundamento físico. Aprobación de DEF no
acredita disponibilidad, atomicidad ni cutover implementados. Preservar gates
Dispatch de correction/reversal auditado y recovery PREPARED antes de uso amplio;
selector Assignment >100 sigue P1. M-HC1 OPEN.

**Resultado: COMPLETE / MERGED — PR #75 — main@51363f5 — HC-INVENTORY-CUSTODY-DEF.**
Siguiente acción: revisión documental01E → staging selectivo → commit → PR de diseño; después del merge, implementación01E-A.
Evidencia01D-A: full API1896/113 suites, PostgreSQL16/16 en DB nueva efímera
(loopback/tmpfs, cleanup PASS), Prisma validate/typecheck/lint/build PASS; detalle
y limitaciones (generate DLL ocupada y70 diagnósticos noEmit preexistentes) en §A.1 del diseño01D.
01A permanece dormido; 01B merged permanece dormido hasta
01D, sin consumidores productivos nuevos ni backfill/cutover en este diseño.
Sin staging ni commit. Implementación01C validada con133 pruebas focales y12 escenarios
PostgreSQL aislados; detalle en §F del diseño01C. Sin migraciones ni activación productiva.
