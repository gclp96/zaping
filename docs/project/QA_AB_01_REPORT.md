# QA-AB-01 — Foundation A y Recepciones W1

Las secciones QA-AB-01 son un registro histórico de esa ejecución. El estado de entrega posterior se registra al final en **INT-AB-01**.

**Veredicto QA-AB-01:** GO para preparar PR independiente A+B. No autoriza merge, cutover, habilitación operativa ni cierre de Compras/Recepciones V1.

**Worktree:** `C:/dev/zaping-insap-ab` — `codex/insap-auto-01b-foundation-receipts`.
**HEAD/base:** `226f5af0dad9d27e0a19d080ff7b2b27c952122a`; cambios sin staging/commit. PR #119 y su worktree original no se modificaron ni se usaron para ejecutar QA.

## Matriz de resultados

| Gate                                                                                | Evidencia ejecutada                                                                                                            | Resultado                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Revisión de los 22 archivos de extracción, incluidos nuevos                         | Diff completo contra main; lectura de migración, contratos, tests, CI y ADR                                                    | PASS; sin P0/P1 ni defecto funcional identificado                           |
| Separación A+B                                                                      | Core, recepción, autorización, contratos, repositorio y lectura coinciden con los snapshots seleccionados de A/W1              | PASS; sin FEFO, autorización W2a ni Healthcare W2b                          |
| Selector histórico de Ventas                                                        | Filtro `expirationDate: null`, revalidación NULL bajo lock y writer real con siblings fechados                                 | PASS; no reparte ni consume fechas conocidas                                |
| PostgreSQL 16 y aislamiento                                                         | Contenedores nuevos con tmpfs, puerto externo loopback dinámico, identidad SQL, owner/rol no admin, marker y system_identifier | PASS; destruidos al terminar                                                |
| Upgrade histórico                                                                   | 46 migraciones anteriores a S1, fixtures v1 confirmados antes de A, nueve verificaciones                                       | 9/9 PASS                                                                    |
| Foundation                                                                          | Identidad, SQL CHECK/UNIQUE, DATE/NULL, lecturas, vencimiento, CAS, rollback y concurrencia real                               | 31/31 E2E PASS, 0 skipped                                                   |
| Recepciones W1                                                                      | Matriz descrita abajo, con Prisma/PostgreSQL reales                                                                            | 23/23 E2E PASS, 0 skipped                                                   |
| LEGACY real                                                                         | `inventory.concurrency.e2e-spec.ts`, servidor adicional independiente                                                          | 5/5 E2E PASS, 0 skipped                                                     |
| API                                                                                 | Todas las unitarias, incluidas compras/recepciones LEGACY, roles y gates Healthcare                                            | 2921/2921 PASS, 150 suites                                                  |
| Web                                                                                 | Regresión del frontend vigente, sin implementar UI opcional                                                                    | 882/882 PASS, 71 archivos                                                   |
| TypeScript                                                                          | Productivo API, focal A+B y Web                                                                                                | PASS                                                                        |
| ESLint                                                                              | API y Web, sin fixes globales                                                                                                  | PASS                                                                        |
| Build                                                                               | Nest API y Next.js 16.3.4                                                                                                      | PASS                                                                        |
| CI remoto del futuro PR                                                             | No hay commit/push autorizado                                                                                                  | BLOCKED / no ejecutado; no se reutiliza CI #424 como evidencia de esta rama |
| UI OX-PUR-05, REQUIRED sin lote para consumo, Healthcare fechado y custodia vencida | Fuera de alcance; gates conservados                                                                                            | BLOCKED por diseño; no impide preparar PR del backend A+B                   |

Los 23 E2E W1 cubren NONE/OPTIONAL/REQUIRED con NULL y varias fechas; Batch real con caducidad en las tres configuraciones; D−1 rechazado y D/D+1 admitidos por Company; parciales y recepción total con ADMIN/MANAGER/WAREHOUSE; varias recepciones de una OC; replay e intención distinta; dos clientes con PIDs distintos para misma/diferente key; rollback después de auditoría realmente escrita; Company/actor extranjeros existentes; factura/remisión; origen falsificado; un solo crédito/Effect y movimiento por recepción de una partida; y regresión de Ventas NULL con rechazo de shortfall que sólo podría cubrir stock fechado. Se prueba el bloqueo de recepción por fence exclusivo antes de crear claim.

La regresión de Ventas confirma una Venta real usando el writer histórico y hace replay: un Effect y movimiento de salida, saldo NULL reducido una sola vez, Position fechada intacta. La confirmación insuficiente revierte DRAFT/claim de negocio sin consumir el sibling fechado. No se incorpora FEFO ni cambia código productivo de Ventas durante QA.

## PostgreSQL e identidad del entorno

Corrida reforzada A+B:

- Imagen local `postgres:16`, ID `sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65`.
- Servidor reportado: PostgreSQL **16.15**, `server_version_num=160015`.
- Contenedor nuevo: `zaping-qa-ab-f55745824e23`, ID `0445b12d71c2da5a960e19144a51c6044843bde2aed481ebf515a47557ed8130`.
- Conexión externa verificada: `127.0.0.1:57552`; endpoint interno: `172.17.0.7:5432`.
- DB: `qa_ab_f55745824e23`; owner/rol de aplicación exclusivo: `qa_ab_user_f55745824e23`, sin SUPERUSER/CREATEDB/CREATEROLE/REPLICATION.
- `system_identifier=7699806762136526893`; autorización ligada al contenedor, puerto, marker y servidor. Cero tablas de usuario antes de migrar.
- PGDATA en tmpfs, sin mounts persistentes y con auto-remove. Credenciales/marker aleatorios mantenidos en memoria, no registrados en documentos, archivos `.env` ni URLs completas.

LEGACY se ejecutó en otro servidor nuevo: contenedor `zaping-qa-ab-ad906cc5c297`, ID `bd8790837d2f9c45722759c116cc1438e19fc0088f8484c869ff8c953f8c488c`, DB `qa_ab_ad906cc5c297`, rol `qa_ab_user_ad906cc5c297`, conexión `127.0.0.1:57748`, interno `172.17.0.7:5432`, PostgreSQL 16.15, `system_identifier=7699808177052782637`. También vacío al inicio y destruido al finalizar. No se utilizaron bases protegidas ni servidores existentes.

## Upgrade pre-S1 → A

Se aplicaron en orden las 46 migraciones reales anteriores a S1, hasta `20261023000000_purchase_receipt_supplier_document`. Se generó un cliente v1 a partir del schema de main, sin la columna nueva. Antes de aplicar S1 quedaron confirmados:

- Cuatro Positions: AVAILABLE/CUSTODY sin lote, una Position de recepción histórica y una de Batch real.
- Cantidades/revisiones no triviales: crédito, transferencia parcial, receipt y sus relaciones.
- Tres Effects y cuatro EffectLines; Product.stock, auditoría, Purchase/Receipt/items, claim y remisión persistidos.

Nueve verificaciones PASS: ausencia de DATE antes de A; igualdad de datos en 14 tablas después de A; NULL en Positions históricas y timestamp Batch preservado; funciones SQL públicas idénticas; golden v1 fijo `e5b4e36f86b37e317666f4e5a0ab0638ad6457893feb128b018cec7ab01d2450` y replay real de Effect sin escrituras; replay de recepción con documento sin otro crédito; unicidad NULL para AVAILABLE/CUSTODY; separación de fechas y rechazo de duplicados; CHECK de fuente única y rollback. No se reconstruyó evidencia histórica ni se relajaron triggers.

El fixture es evidencia v1 real de Inventory/Receipt bajo constraints vigentes, no un fixture completo de Dispatch/Reconciliation/Correction v1. No acredita coexistencia SQL v1/v2 ni habilita esos writers. Sus funciones SQL no cambian en A y sus regresiones unitarias/gates se conservan.

## Historial y conteo de ejecuciones

- Preparación: tres fallos del harness antes de S1 (formato IP CIDR, filename del módulo compilado en Node y tenant de PurchaseItem vía Purchase). Se corrigieron exclusivamente tests/helpers. El fallo nativo exigió destruir explícitamente su contenedor; los demás se destruyeron en finally. No fueron fallos funcionales de A+B ni resultados PostgreSQL PASS.
- Primera corrida completa: upgrade 9/9, Foundation 31/31 y W1 inicial 15/15 PASS.
- Corrida reforzada: upgrade 9/9, Foundation 31/31 y W1 23/23 PASS.
- Corrida adicional LEGACY: 5/5 PASS en servidor nuevo.
- Cobertura final: **59 E2E PostgreSQL distintos + 9 verificaciones de upgrade**. Se ejecutaron **105 casos E2E** contando la repetición y **18 verificaciones de upgrade** contando ambas corridas; no se suman repeticiones como cobertura nueva.
- API 2921 + Web 882 se ejecutaron una vez en QA-AB-01: **3908 ejecuciones Jest/Vitest** incluyendo los 105 E2E; las 18 verificaciones del harness se contabilizan por separado.

## Archivos y límites

No se requirió corregir código productivo, schema, migración, permisos o frontend durante QA. Cambios QA: autorización test-only `test/helpers/qa-ab-ephemeral-postgres.ts`, launcher `test/qa-ab-01.run.cjs`, adaptación del preflight de las dos suites y ampliación W1. No se falsean `GITHUB_ACTIONS`/`CI`; se conserva el gate CI anterior y se añade autorización explícita del servidor efímero creado por el launcher. El cliente v1 y builds son artefactos locales ignorados, sin datos de base.

El selector de autoridad de los fixtures W1 sigue fijado a PHYSICAL; ahora adquiere el shared fence real. Esto no prueba un cutover completo ni que una Company real esté habilitada. LEGACY usa su writer/resolver histórico real en sus cinco regresiones. Los replays históricos del upgrade no generan nuevas mutaciones.

`owned` conserva todo el saldo físico y `available` conserva su contrato temporal/físico. REQUIRED sin lote puede aparecer en available aunque el consumo esté bloqueado: se verifica en PostgreSQL. No se implementó una semántica pública de utilizabilidad por operación.

## Riesgos y siguiente gate

Sin hallazgos P0/P1 ni defecto funcional confirmado. Los huecos de recepción total/tenant/Ventas/fence se cerraron con tests, sin debilitar aserciones. Aviso no bloqueante de Web: `vite-tsconfig-paths` detecta soporte nativo equivalente; no se modificó frontend para atenderlo.

Antes de merge: CI API/Web sobre el commit exacto; reproducir el upgrade en CI efímero (el workflow actual ejecuta E2E pero todavía no automatiza este launcher de upgrade); revisión de despliegue de S1 antes del binario nuevo, con PostgreSQL 16. `QA_AB_EXPECTED_HEAD` permite fijar explícitamente el SHA autorizado al repetir el launcher después de crear un commit. No conectar ni adaptar el launcher a una base existente.

Comandos reproducibles, exclusivamente para contenedores nuevos creados/destruidos por el launcher:

```powershell
node app/api/test/qa-ab-01.run.cjs
node app/api/test/qa-ab-01.run.cjs --legacy-only
```

Preparar PR A+B es GO. Merge, V1, UI, FEFO, REQUIRED sin lote para salida, W2b y custodia vencida siguen sin autorización. M-HC1 OPEN, RISK-006 OPEN / NOT REPRODUCED y la intermitencia EQUIPMENT sin causa confirmada no cambian; tampoco se declara resuelto el historial de 70 errores globales de specs por pasar el typecheck productivo/focal.

## INT-AB-01 — preparación local de entrega y CI histórico

Autorización vigente: staging selectivo y commits locales únicamente en el worktree A+B; sin push, PR remoto, merge, despliegue o cambios en main. La referencia remota main sigue en `226f5af0dad9d27e0a19d080ff7b2b27c952122a`, comprobada por lectura sin rebase. Los estados anteriores de ausencia de commits/autorización describen QA-AB-01, no esta autorización posterior.

- Se revisaron los 12 modificados y 13 nuevos de entrada; no hubo cambios productivos durante INT. Sólo se adaptó el launcher/CI, se añadieron controles de runner y se preparó documentación de entrega.
- Job independiente `historical-upgrade`: checkout con `fetch-depth: 0`, instalación desde lockfile, build del candidato y PostgreSQL 16 tmpfs creado/destruido por el launcher; no comparte el servicio API. Usa el SHA exacto de Actions y admite checkout desacoplado sin depender de la rama local. Verifica las 46 migraciones contra la historia Git fija antes de ejecutarlas y exige 9 checks de upgrade.
- Modo dedicado `--upgrade-only`: 9/9 PASS localmente. Revalidación del launcher completo: upgrade 9/9, Foundation 31/31 y W1 23/23 PASS; LEGACY 5/5 PASS en otro servidor nuevo. Roles, credenciales y base exclusivos, sin usar una base persistente; todos los contenedores fueron destruidos.
- Controles del runner: 9/9 PASS con Node test, incluidos SHA de PR desacoplado, SHA stale rechazado y exit code 1 sin crear PostgreSQL ante una aserción fallida. YAML y aislamiento estructural del job: PASS. Esto no equivale a ejecutar GitHub Actions remoto.
- API: 2921/2921 PASS, 150 suites; typecheck productivo/focal, ESLint y build PASS.
- Web: primera corrida 881 PASS / 1 FAIL (exit 1) en `web/app/(app)/inventory/page.test.tsx:860`; esperaba la fila mediante getByText después de esperar un encabezado derivado de query, mientras el DOM aún mostraba carga. Frontend no modificado. Suite focal 21/21 PASS y revalidación completa con la misma configuración 882/882 PASS. Typecheck/lint/build Web: PASS.
- La incidencia Web se mantiene como riesgo de sincronización del test, no se declara corregida. Si reaparece en CI debe revisarse antes de merge; no se altera la aserción dentro de A+B.

Descripción lista para publicación posterior como DRAFT: [INT_AB_01_PR_DESCRIPTION.md](INT_AB_01_PR_DESCRIPTION.md). CI remoto del commit final permanece PENDING por restricción de publicación. La automatización histórica ya está implementada; ya no es trabajo pendiente de diseño, pero su resultado remoto sí lo es. GO para preparar publicación DRAFT tras completar los checks y commits locales; no merge/V1.
