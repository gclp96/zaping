# Zaping — Backup y Restore Operacional

Estado: CURRENT / OPERATIONS RUNBOOK

Este documento define el contrato mínimo para proteger y recuperar la base de
datos de Zaping. Es provider-neutral: no selecciona un proveedor cloud, no
provisiona infraestructura y no autoriza por sí mismo un despliegue productivo.

## 1. Alcance y reglas de seguridad

El backup y el restore deben ejecutarse con una identidad operativa individual,
acceso restringido y MFA. Las credenciales se obtienen del secret manager del
ambiente y nunca se escriben en comandos, tickets, logs, documentación o
artefactos del repositorio.

Reglas obligatorias:

- No usar una base de datos de PRODUCTION como fuente de una prueba local.
- No restaurar sobre la base original: primero restaurar en una base nueva y
  aislada.
- No usar datos reales para una prueba local o de STAGING; usar datos
  sintéticos y mínimos.
- No ejecutar `prisma migrate dev`, `prisma db push` ni `prisma migrate reset`
  en STAGING o PRODUCTION.
- Toda operación debe registrar el commit, ambiente, operador, hora, resultado
  y evidencia segura, sin IDs sensibles ni secretos.
- Un backup sólo se considera recuperable después de un restore controlado y
  verificable.

La base de datos local `zaping-postgres` pertenece al entorno de desarrollo y no
debe detenerse, reutilizarse como fuente ni recibir un restore de esta prueba.

## 2. Contrato de backup de producción

PRODUCTION debe usar backups administrados y automatizados por el proveedor,
con estas propiedades mínimas:

- cifrado en reposo;
- retención inicial de 14 días;
- snapshot adicional antes de cada migration o cambio de alto riesgo;
- acceso restringido a los operadores autorizados;
- capacidad documentada de restore en una base o instancia separada;
- monitoreo del resultado de los backups y alertas ante fallas.

PITR (Point-in-Time Recovery) es la opción preferida y probablemente necesaria
para sostener el objetivo provisional de RPO de hasta una hora. La retención,
la granularidad y la ventana real dependen del proveedor y deben verificarse
en STAGING antes del piloto.

Un `pg_dump` en formato custom es un backup complementario, útil para una copia
portable, validación y recuperación puntual. No reemplaza los backups
administrados, los snapshots previos a migrations ni PITR.

## 3. Validación local OPS-RC-B4

La validación local se ejecutó desde un estado limpio del branch de trabajo con
dos recursos independientes `postgres:16`: uno para `source` y otro para
`restore`. No se utilizó ni se modificó `zaping-postgres`.

Resultado observado:

- PostgreSQL tools: `pg_dump` y `pg_restore` 16.14.
- 25 migrations actuales aplicadas con `prisma migrate deploy`.
- Se insertaron únicamente una Company y un Product sintéticos.
- Fingerprint source: `companies=1`, `products=1`.
- Dump custom creado con `--no-owner --no-privileges` y validado con
  `pg_restore --list`.
- Fingerprint restore: `companies=1`, `products=1`; comparación igual.
- Tamaño del dump: 89,906 bytes.
- Duración observada de backup: 0.74 s; restore: 0.92 s.
- `npm run build` y `npm run start:prod` se validaron contra la base restaurada.
- `/health/live` y `/health/ready` respondieron HTTP 200 con estado `ok`.
- El proceso terminó limpiamente y se eliminaron backup, source y restore
  temporales.

Estas duraciones son mediciones de una prueba local pequeña. No son RPO ni RTO,
no representan producción y no constituyen un SLA.

## 4. Backup portable con `pg_dump`

El archivo debe guardarse fuera del repositorio, en almacenamiento protegido y
con permisos restringidos. Usar PostgreSQL client tools de la misma versión
mayor que el servidor siempre que sea posible.

Forma segura y genérica del comando, sin incluir una URL ni una contraseña:

```text
pg_dump --format=custom --no-owner --no-privileges --file=<ruta-fuera-del-repo>/<backup>.dump <base-de-datos>
```

Antes de transferir o archivar el archivo, validar que sea legible:

```text
pg_restore --list <ruta-fuera-del-repo>/<backup>.dump
```

El operador debe confirmar antes de iniciar:

```text
[ ] ambiente y base de datos correctos
[ ] snapshot/provider backup disponible cuando aplique
[ ] migration o cambio asociado identificado por SHA
[ ] destino de backup fuera del repositorio
[ ] permisos del archivo restringidos
[ ] no se imprimen DATABASE_URL, contraseñas o tokens
```

No añadir `--clean` a una restauración de recuperación inicial. No borrar el
backup original hasta completar la validación, la retención acordada y la
aprobación operativa.

## 5. Restore seguro

El flujo recomendado es:

1. Detener el deployment o migration que originó el incidente y conservar
   evidencia segura.
2. Crear una base o instancia de recuperación nueva, con nombre y permisos
   explícitos. Nunca reutilizar la base fuente como destino.
3. Transferir el archivo por un canal controlado, sin copiarlo al repositorio.
4. Inspeccionar el contenido con `pg_restore --list`.
5. Restaurar con `--exit-on-error`, `--no-owner` y `--no-privileges`:

   ```text
   pg_restore --exit-on-error --no-owner --no-privileges --dbname=<base-de-recuperacion> <ruta-fuera-del-repo>/<backup>.dump
   ```

6. Ejecutar `npx prisma migrate status` y confirmar que el estado es compatible
   con el SHA que se va a ejecutar. No aplicar migrations nuevas como parte de
   una prueba de restore sin aprobación explícita.
7. Comparar fingerprints o conteos de entidades de prueba y ejecutar smoke
   tests no destructivos. No registrar IDs, tokens ni datos sensibles.
8. Validar `/health/live` y `/health/ready` antes de enviar tráfico.
9. Mantener la base restaurada aislada hasta que el responsable apruebe el
   cutover o la extracción de datos necesaria.

Para una recuperación productiva, el proveedor debe confirmar además el punto
temporal restaurado, consistencia, cifrado, permisos, logs y capacidad de
volver al recurso anterior.

## 6. Migration defectuosa o pérdida de datos

Ante una migration incompatible, parcialmente fallida o destructiva:

1. detener rollout, nuevas migrations y tráfico de escritura;
2. marcar el incidente y conservar logs sin secretos;
3. confirmar el último snapshot/backup/PITR utilizable;
4. restaurar primero en una base de recuperación nueva;
5. comparar el estado restaurado con el release y migration esperados;
6. elegir explícitamente entre forward-fix compatible o restore;
7. verificar health, permisos y smoke tests antes de cualquier cutover;
8. registrar causa raíz, impacto, punto de recuperación y acciones preventivas.

No reescribir migrations ya aplicadas, no ejecutar SQL improvisado y no
eliminar la base fallida antes de preservar la evidencia y confirmar el plan.

## 7. Objetivos operativos y límites

Los objetivos provisionales de V1 son:

```text
RPO target: hasta 1 hora
RTO target: hasta 4 horas
```

Son objetivos de planificación, no SLA contractual. El RPO de una hora
requiere confirmar backups/PITR del proveedor, frecuencia, retención y alertas.
El RTO de hasta cuatro horas requiere confirmar capacidad, permisos, tamaño de
base, procedimiento de cutover y personal disponible.

La prueba local OPS-RC-B4 demuestra que el procedimiento técnico básico es
reproducible con una base pequeña. No demuestra que producción pueda cumplir
esos objetivos ni sustituye una restauración respaldada por el proveedor en
STAGING.

## 8. Limpieza y control de artefactos

Al finalizar una prueba local:

- detener y eliminar el proceso API temporal;
- eliminar las bases source y restore sólo después de registrar el resultado;
- eliminar los contenedores o recursos con prefijo explícito de la prueba;
- eliminar el dump fuera del repositorio cuando ya no sea necesario;
- verificar que el recurso operativo `zaping-postgres` sigue arriba y sin cambios;
- ejecutar `git status --short` y `git diff --check`;
- confirmar que no aparecieron `.dump`, `.backup`, `.sql`, `.env` ni credenciales
  nuevas en el repositorio.

Los nombres temporales deben permitir una comprobación exacta por prefijo antes
de borrar. No usar comandos de limpieza contra un nombre calculado sin validar
el destino.

## 9. Checklists operativos

### Antes del backup

```text
[ ] operador autorizado y MFA
[ ] ambiente confirmado
[ ] SHA y migration identificados
[ ] backup administrado/snapshot verificable
[ ] ventana de mantenimiento comunicada si aplica
[ ] destino protegido y fuera del repositorio
```

### Después del backup

```text
[ ] formato custom confirmado
[ ] pg_restore --list = PASS
[ ] tamaño y duración registrados
[ ] ubicación y retención registradas sin secretos
[ ] restore de prueba programado o ejecutado
```

### Restore

```text
[ ] base nueva y aislada
[ ] source no es el destino
[ ] pg_restore --exit-on-error = PASS
[ ] no-owner y no-privileges aplicados
[ ] prisma migrate status compatible
[ ] fingerprint/conteos comparados
[ ] health live/ready = 200
[ ] smoke no destructivo = PASS
[ ] aprobación antes de cutover
```

## 10. Frecuencia y dependencias pendientes

Antes del piloto es obligatorio realizar un restore respaldado por el
proveedor en STAGING. Durante el piloto temprano, repetirlo al menos
mensualmente y también después de cambiar proveedor, configuración de backup,
retención, migrations de alto riesgo o permisos operativos. Ajustar la
frecuencia cuando el proveedor y el riesgo de negocio estén aprobados.

OPS-RC-B4 no crea scripts automáticos de backup, cron jobs ni workflows de
producción. La configuración real de backups administrados, PITR, alertas y
retención queda como trabajo del proveedor y de operaciones. La evidencia local
no cierra esa dependencia.
