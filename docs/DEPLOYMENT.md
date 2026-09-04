# Zaping — Deployment and Operations Runbook

Estado: CURRENT / OPERATIONS RUNBOOK

Este documento define el procedimiento mínimo y seguro para operar Zaping en
LOCAL, STAGING y PRODUCTION. Es provider-neutral: no selecciona proveedor
cloud, no provisiona infraestructura y no declara que Zaping esté
Production Ready.

## 1. Alcance y límites

Este runbook cubre:

- separación de ambientes y secretos;
- despliegue independiente de Web, API y PostgreSQL;
- revisión y ejecución controlada de migraciones Prisma;
- health gates, smoke tests y rollback;
- onboarding inicial y registro público controlado;
- HTTPS, trust proxy, mantenimiento e incidentes.

No se realiza en este checkpoint:

- despliegue o provisión cloud;
- selección de proveedor o compra de dominio;
- configuración real de Resend;
- cambios de business logic, schema o migrations;
- upgrades de dependencias o rediseño de CI.

STAGING es obligatorio antes del piloto o de cualquier release candidate. No
se usa PRODUCTION como ambiente de pruebas.

## 2. Ambientes

### LOCAL

- Máquina del desarrollador.
- PostgreSQL local, normalmente mediante `docker-compose.yml`.
- Web en `http://localhost:3000`.
- API en `http://localhost:3001`.
- Sólo datos y secretos locales; nunca secretos de staging o producción.
- Los archivos `.env*` son locales y están ignorados por Git.

El `docker-compose.yml` existente es exclusivamente una ayuda de desarrollo.
Sus credenciales no deben reutilizarse fuera de LOCAL.

Secuencia local reproducible:

```bash
docker compose up -d postgres

cd app/api
npm ci
npx prisma generate
npm run prisma:migrate:deploy
npm run start:dev

cd ../../web
npm ci
npm run dev
```

Para autorizar una migration nueva durante desarrollo local existe el flujo
`prisma migrate dev`; no forma parte de este checkpoint y nunca se ejecuta en
STAGING o PRODUCTION. Para reproducir el estado ya versionado se prefiere
`prisma migrate deploy`.

### STAGING

- Infraestructura, PostgreSQL y secretos completamente separados de
  PRODUCTION.
- Sólo datos QA; no copiar datos reales salvo una necesidad aprobada y
  controlada.
- Una URL HTTPS generada por el proveedor es válida temporalmente aunque aún
  no exista dominio oficial.
- Debe probarse la topología real del proxy, `req.ip`, rate limiting, health
  checks, migraciones y smoke tests.
- Staging debe aproximarse a producción en TLS, secretos, proceso persistente,
  logs y conectividad, sin compartir recursos de producción.

El código actual acepta `development`, `test` y `production`; no existe un
valor `staging`. Para un staging production-like se debe usar
`NODE_ENV=production`, lo que hace obligatorios `RESEND_API_KEY` y `EMAIL_FROM`
según el contrato actual. Un staging temporal con configuración no-producción
debe ser explícitamente identificado como una brecha de paridad y no prueba la
preparación productiva.

### PRODUCTION

- Datos reales, PostgreSQL y secretos de producción separados.
- Dominio definitivo y HTTPS obligatorio.
- Acceso operativo restringido y MFA en GitHub/cloud.
- No se usa para probar features, migraciones experimentales o datos QA.
- Toda release se asocia a un commit SHA y conserva la release anterior
  conocida como buena.

Nunca se comparte una base de datos entre STAGING y PRODUCTION.

## 3. Arquitectura objetivo

```text
Browser
   │ HTTPS
   ▼
Next.js Web
   │ HTTPS
   ▼
NestJS API
   │ TLS / red privada o restringida
   ▼
PostgreSQL

NestJS API ── integración externa Resend cuando el dominio esté disponible
```

Web y API son aplicaciones independientes. La arquitectura V1 es un monolito
modular desplegable, no Kubernetes, microservicios ni un requisito de PM2.
TLS de la base de datos y las restricciones de red son responsabilidades de la
configuración del proveedor y de PostgreSQL; no se deben asumir por el código
de aplicación.

## 4. Contrato de runtime y paquetes

El release debe ser reproducible desde un SHA, los lockfiles npm y el contrato
de runtime:

```text
Node 24.20.0
npm 11.19.0
package manager canónico: npm
```

En API y Web se usa:

```bash
npm ci
```

No usar `npm install`, pnpm ni yarn para un deployment. Los comandos de API se
ejecutan desde `app/api`; los de Web, desde `web`; no desde el scaffold raíz.

El gate previo es GitHub Actions API ✅ y Web ✅. No desplegar un SHA con CI
rojo. Se recomienda branch protection para exigir ese gate, pero no se
configura GitHub en este checkpoint.

## 5. Variables y secretos de API

La matriz refleja `validateEnvironment` actual. `REQUIRED` significa que la
aplicación debe recibir el valor; `OPTIONAL` significa que el código aplica el
default indicado; `DEFERRED` significa que la capacidad no forma parte del
staging temporal y requiere una decisión antes de producción.

| Variable | LOCAL | STAGING | PRODUCTION | Contrato actual |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | REQUIRED: `development` o `test` | REQUIRED: preferir `production`; no existe `staging` | REQUIRED: `production` | Sólo acepta `development`, `test`, `production` |
| `DATABASE_URL` | REQUIRED | REQUIRED | REQUIRED | Secret backend; DB separada por ambiente |
| `JWT_SECRET` | REQUIRED | REQUIRED | REQUIRED | Mínimo 32 caracteres; generado independientemente |
| `FRONTEND_ORIGIN` | OPTIONAL: default `http://localhost:3000` | REQUIRED: URL HTTPS del Web | REQUIRED: URL HTTPS del Web | Origin concreto, no `*` |
| `FRONTEND_BASE_URL` | OPTIONAL: default `http://localhost:3000` | REQUIRED: URL HTTPS del Web | REQUIRED: URL HTTPS del Web | HTTPS obligatorio en `production` |
| `RESEND_API_KEY` | OPTIONAL | REQUIRED si `NODE_ENV=production`; DEFERRED sólo para staging no-production explícitamente aceptado | REQUIRED | No guardar en Git ni logs |
| `EMAIL_FROM` | OPTIONAL | REQUIRED si `NODE_ENV=production`; DEFERRED sólo para staging no-production explícitamente aceptado | REQUIRED | Sender verificado cuando B3B5 se reactive |
| `PORT` | OPTIONAL: default `3001` | OPTIONAL por código; el proveedor debe inyectarlo | OPTIONAL por código; el proveedor debe inyectarlo | Entero entre 1 y 65535 |
| `TRUST_PROXY_HOPS` | OPTIONAL: default `0` | OPTIONAL, pero topología debe aprobarlo | OPTIONAL, pero topología debe aprobarlo | Entero entre 0 y 10; default seguro `0` |

En PRODUCTION la configuración inválida debe impedir el arranque. No se debe
debilitar la validación para hacer que una release arranque.

`DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY` y cualquier credencial son
secretos backend-only. Nunca deben aparecer en `NEXT_PUBLIC_*`, Git,
documentación con valores reales, screenshots o logs.

### Gestión y rotación de secretos

STAGING y PRODUCTION deben usar el secret manager del proveedor o un mecanismo
seguro de variables de entorno. No se versionan `.env`.

- `JWT_SECRET` comprometido: generar uno nuevo, actualizar el secret manager,
  redeploy/restart e invalidar todas las sesiones JWT existentes.
- Credencial DB comprometida: rotar credencial en PostgreSQL, actualizar el
  secreto, redeploy/restart e inspeccionar logs.
- API key Resend comprometida: revocar, emitir una nueva, actualizar el
  secreto y redeploy/restart.

No incluir valores en tickets, comandos copiados a logs o este documento.

## 6. Variables de Web

`NEXT_PUBLIC_API_URL` es configuración pública de build-time. No contiene ni
debe sustituir secretos.

| Ambiente | Valor esperado |
| --- | --- |
| LOCAL | `http://localhost:3001` |
| STAGING | `https://<provider-api-url>` |
| PRODUCTION | `https://api.<future-domain>` |

Build y start:

```bash
cd web
npm ci
npm run typecheck
$env:NEXT_PUBLIC_API_URL = 'https://<staging-or-production-api>'
npm run build
npm run start
```

En shells POSIX, usar `NEXT_PUBLIC_API_URL=https://<staging-or-production-api> npm run build`.
La URL queda incorporada al artefacto público; cambiarla requiere rebuild.

## 7. `.env.example` y seguridad de configuración

No existen actualmente `app/api/.env.example` ni `web/.env.example`. No se
crean en este checkpoint porque este runbook ya contiene la matriz y sólo
placeholders; además, los patrones `.env*` están ignorados por Git. Si se
añaden ejemplos versionados posteriormente, deben estar explícitamente
permitidos por `.gitignore` y contener únicamente placeholders:

```dotenv
NODE_ENV=development
PORT=3001
TRUST_PROXY_HOPS=0
DATABASE_URL=
JWT_SECRET=
FRONTEND_ORIGIN=http://localhost:3000
FRONTEND_BASE_URL=http://localhost:3000
RESEND_API_KEY=
EMAIL_FROM=
```

Web sólo documentaría `NEXT_PUBLIC_API_URL`. Nunca incluir ejemplos de una
`DATABASE_URL` real, JWT real, API key Resend real o credenciales de email.

## 8. Release y orden de deployment

Cada deployment debe señalar:

- commit SHA exacto;
- resultado de CI;
- ambiente destino;
- release anterior conocida como buena;
- migration diff revisado;
- ventana de mantenimiento y plan de rollback.

### Pre-deploy

1. Confirmar CI green para API y Web.
2. Seleccionar el release SHA revisado.
3. Revisar el diff de migrations desde la release anterior.
4. Validar todas las variables y secretos del ambiente.
5. Confirmar backup/snapshot recuperable.
6. Decidir si la migration requiere ventana de mantenimiento.

### Database release step

La migración es un release step único y separado del proceso de la aplicación.
No debe ejecutarse automáticamente en cada réplica cuando la plataforma
escala múltiples instancias.

Desde `app/api`:

```bash
npm ci
npx prisma generate
npm run prisma:migrate:deploy
npx prisma migrate status
```

Comprobar que el status coincide con el SHA seleccionado antes de arrancar
réplicas.

### API deployment step

Desde `app/api`, después de que la DB esté en el estado esperado:

```bash
npm ci
npx prisma generate
npm run build
npm run start:prod
```

En la práctica, `npm ci` y `prisma generate` pueden formar parte del artefacto
de release; la regla importante es separar y observar el paso de migración del
arranque de la API.

### Web deployment step

Después de que la API compatible pase sus health gates, desde `web`:

```bash
npm ci
npm run typecheck
npm run build
npm run start
```

El build debe recibir `NEXT_PUBLIC_API_URL` del ambiente destino y no una URL
local o un secreto.

### Post-deploy

1. Verificar logs de API y Web sin secretos.
2. Confirmar `/health/live` y `/health/ready`.
3. Ejecutar smoke tests.
4. Ejecutar la operación QA controlada apropiada al ambiente.
5. Mantener disponible la release anterior.

## 9. Política de migrations

En STAGING y PRODUCTION está prohibido ejecutar:

```text
prisma migrate dev
prisma db push
prisma migrate reset
```

Está permitido:

```text
prisma migrate deploy
prisma migrate status
prisma validate
```

Las migrations históricas no se reescriben. Existen actualmente 25 migrations.
La auditoría de OPS-RC-A registró seis migrations históricas con
`DROP COLUMN`/riesgo potencial de pérdida de datos. Antes de la primera
producción se requiere backup válido, revisión explícita y una ejecución sobre
STAGING o una copia de la base.

No se crean nuevas migrations en OPS-RC-B3.

### Requisitos de PostgreSQL

STAGING y PRODUCTION deben preferir PostgreSQL administrado con:

- TLS;
- acceso privado o restringido, nunca público sin restricciones;
- cifrado en reposo;
- backups y, preferiblemente, PITR;
- monitoreo del proveedor;
- credenciales separadas por ambiente.

No copiar directamente la DB local. La restauración y su prueba real quedan
como dependencia de OPS-RC-B4.

El runtime DB user debe ser non-superuser. Un migration user separado es
`SHOULD`, pero no se declara P0 si la plataforma o Prisma complica el piloto.
El código actual sólo define `DATABASE_URL`; no se inventa aquí una variable
de migration user. Si inicialmente se usa un solo usuario, registrar el riesgo
y limitar sus permisos tanto como permita la operación.

## 10. Health gates y startup

La API expone:

```text
GET /health/live   → 200: el proceso está vivo
GET /health/ready  → 200: PostgreSQL responde
                    503: la API no está lista para tráfico
```

Una release no se considera healthy hasta que ambos endpoints devuelvan 200.
Un `503` en readiness significa no enviar tráfico, detener el rollout e
investigar DB/configuración. La API no debe considerarse disponible antes de
readiness 200. Web se despliega después de que la API compatible pase el gate.

No usar un endpoint genérico `GET /` o “Hello World” como sustituto.

Ejemplos sin tokens:

```bash
curl https://<api-host>/health/live
curl https://<api-host>/health/ready
```

## 11. Proxy, rate limiting y HTTPS

### Trust proxy

El contrato actual es:

```text
TRUST_PROXY_HOPS=0
```

Es el default seguro. Sólo se configura un valor mayor después de confirmar
la topología real, por ejemplo `client → provider proxy → API`. `1` no es un
valor universal.

La configuración afecta `req.ip` y por tanto el rate limiting de autenticación.
Una configuración incorrecta puede agrupar todos los clientes detrás de una
IP o confiar en un `X-Forwarded-For` no confiable. Validar en STAGING con la
topología real, headers observados y pruebas de login/forgot/reset/change
password. No registrar tokens ni headers sensibles para realizar esta prueba.

### HTTPS

TLS termina en la cloud platform, reverse proxy o CDN/edge. No se termina
dentro de Nest en este contrato.

- PRODUCTION: HTTPS obligatorio.
- STAGING público: usar URL HTTPS generada por el proveedor; no HTTP público.
- HTTP→HTTPS redirect: responsabilidad del edge/platform.
- LOCAL: HTTP localhost permitido.

No activar HSTS prematuramente. Es una tarea P1 de hardening posterior al
dominio productivo definitivo, HTTPS confirmado y estrategia de subdominios
confirmada. CSP también es P1/SHOULD antes del lanzamiento público; no se
implementa aquí.

## 12. Onboarding y datos

### Primera Company y ADMIN

El primer onboarding de producción debe ser controlado:

1. aprobar release después de STAGING smoke;
2. desplegar y pasar migrations/health gates;
3. crear conscientemente la Company de INSAP;
4. crear conscientemente el usuario `ADMIN` inicial;
5. registrar quién aprobó y cuándo;
6. introducir datos iniciales de forma explícita.

No usar seed de desarrollo, importar automáticamente la DB local, hardcodear
un admin ni dejar cuentas compartidas.

### Registro público

Para el piloto la política es `PILOT-CONTROLLED`. La creación de Companies no
debe quedar como flujo público irrestricto. Este checkpoint sólo documenta el
control operativo; no modifica el endpoint. Antes de exposición pública debe
existir un mecanismo aprobado para controlar onboarding.

### Datos de STAGING

Sólo datos QA, por ejemplo:

- QA Company;
- QA Product;
- QA Supplier;
- QA Customer;
- QA Purchase.

No usar datos reales de clientes si no son estrictamente necesarios. No se
crean scripts nuevos de datos en este checkpoint.

### Datos de PRODUCTION

1. Completar STAGING smoke y aprobación.
2. Preparar environment y secretos de producción.
3. Ejecutar migration release step.
4. Pasar health gates.
5. Hacer Company/admin onboarding controlado.
6. Importar o registrar datos iniciales explícitamente.
7. Ejecutar QA operacional controlado y limitado.

No copiar automáticamente la DB de desarrollo.

## 13. Checklist de smoke tests

Mínimo para STAGING y PRODUCTION, adaptando datos y permisos al ambiente:

```text
[ ] GET /health/live = 200
[ ] GET /health/ready = 200
[ ] POST /auth/login con cuenta QA/operativa autorizada
[ ] GET /auth/me
[ ] Web Home
[ ] Products
[ ] Purchases
[ ] Inventory
[ ] Una escritura controlada y no destructiva del flujo QA aprobado
[ ] Logs revisados sin secretos
```

No usar escrituras destructivas como smoke test. Validar que un error de
configuración crítica detiene el release y que no se envía tráfico mientras
readiness sea 503.

### Smoke por rol

En el piloto validar al menos:

- `ADMIN`;
- `WAREHOUSE`;
- `SALES`.

Validar también `MANAGER` antes del cierre final. No repetir toda la matriz B2C
en cada deployment; la regresión completa permanece en el E2E controlado.

### Password recovery

B3B5 permanece pausado. Antes de contar con dominio y configuración real de
email, el smoke operacional de recovery puede omitirse sólo si el ambiente no
declara esa capacidad como operativa. Esto no permite declarar RC o PRODUCTION
ready.

Cuando B3B5 se reactive, el release checklist debe cubrir:

```text
forgot → email real → reset → login
token reuse rechazado
JWT anterior invalidado según contrato
```

La validación real de sender/domain y entrega de Resend es un gate separado.

## 14. Rollback

### Aplicación

Ante una release defectuosa:

1. detener el rollout;
2. conservar logs y evidencia;
3. volver al release SHA anterior conocido como bueno;
4. verificar `/health/live` y `/health/ready`;
5. ejecutar smoke tests;
6. registrar la causa raíz y el SHA afectado.

No hacer hotfix directo en el servidor. Todo cambio debe volver al flujo
revisado y al CI.

### Base de datos

Prisma no ofrece rollback automático de migrations. Elegir según impacto:

- forward-fix mediante una migration nueva, revisada y compatible; o
- restaurar backup/snapshot validado.

No ejecutar SQL improvisado ni reescribir migrations aplicadas sin registro y
revisión.

### Migration incompatible o fallida

Detener deployment si una migration destruye datos, rompe compatibilidad o
falla parcialmente. Requiere:

- backup validado;
- ventana de mantenimiento;
- plan de restore;
- decisión explícita entre forward-fix y restore.

Abortar también si CI está rojo, `live` no devuelve 200, `ready` no devuelve
200, smoke crítico falla, aparece un error DB inesperado o la configuración de
seguridad es crítica/inválida.

## 15. Mantenimiento, backups y objetivos

Para V1 controlada se aceptan ventanas cortas de mantenimiento. No prometer
zero downtime. Comunicar previamente cualquier ventana que afecte usuarios.

Antes de cada migration o release de producción debe existir backup/snapshot
disponible y verificarse su recuperabilidad según las capacidades del
proveedor. El procedimiento y la evidencia local de OPS-RC-B4 están en
[BACKUP_RESTORE.md](BACKUP_RESTORE.md); el restore respaldado por el proveedor
en STAGING sigue siendo requisito antes del piloto.

Objetivos provisionales, no SLA contractual:

```text
RPO target: hasta 1 hora
RTO target: hasta 4 horas
```

## 16. Incident mini-runbooks

### Bad deploy

```text
síntoma → alcance → health/live+ready → logs seguros
→ detener rollout → rollback SHA → verificar health → smoke
→ documentar causa raíz y acciones preventivas
```

### Database outage

Comportamiento esperado: `live=200`, `ready=503`.

Respuesta:

1. detener routing de tráfico y nuevos deploys;
2. inspeccionar el proveedor y conectividad DB;
3. evitar mutaciones operativas;
4. recuperar o restaurar según el plan aprobado;
5. confirmar `ready=200`;
6. ejecutar smoke tests.

### Logging y acceso

Después del deploy verificar ausencia de `Authorization`, passwords, JWT,
`DATABASE_URL`, reset tokens y objetos de error crudos en logs. OPS-SEC-01 ya
mitigó el logging sensible; el runbook exige comprobarlo operativamente.

El acceso de producción debe limitarse a los maintainers mínimos, con MFA,
cuentas individuales y secretos separados de STAGING. No se implementa IAM en
OPS-RC-B3.

## 17. Requisitos del proveedor

### Web provider

```text
[ ] Node 24.20.0 soportado
[ ] HTTPS y URL generada para staging
[ ] Inyección de variables de build/runtime
[ ] Logs accesibles
[ ] Dominio custom disponible posteriormente
[ ] Proceso reproducible desde SHA + package-lock
```

### API provider

```text
[ ] Node 24.20.0 soportado
[ ] Proceso Node persistente
[ ] Health checks configurables
[ ] Inyección segura de env/secrets
[ ] PORT inyectable
[ ] Topología de proxy documentada
[ ] Conectividad PostgreSQL TLS/restringida
[ ] Logs accesibles sin secretos
```

### PostgreSQL provider

```text
[ ] PostgreSQL administrado
[ ] TLS
[ ] Red restringida
[ ] Backups y soporte de restore
[ ] Idealmente PITR
[ ] Cifrado en reposo
[ ] Monitoreo
[ ] Credenciales por ambiente
```

No se selecciona AWS, Vercel, Render, Railway, Fly, Azure, GCP ni otro
proveedor en este checkpoint. La selección se hará después con criterios de
costo, operación, soporte de Node 24, DB, logs, TLS y rollback.

## 18. Dominios y artefactos

STAGING puede operar inicialmente con URLs HTTPS generadas por el proveedor:

```text
https://<web-provider-url>
https://<api-provider-url>
```

No se afirma que exista un dominio activo de Zaping.

Placeholders de PRODUCTION:

```text
https://app.<zaping-domain>
https://api.<zaping-domain>
```

El artefacto puede construirse desde source o desde container según el futuro
proveedor. La obligación común es reproducibilidad desde SHA, lockfiles y
Node/npm contract. No se implementa semantic-release.

## 19. Checklist ejecutable de deployment

```text
PRE
[ ] CI API green
[ ] CI Web green
[ ] Release SHA seleccionado
[ ] Migration diff revisado
[ ] Environment y secrets verificados
[ ] Backup/snapshot disponible
[ ] Decisión de ventana de mantenimiento
[ ] Topología proxy / TRUST_PROXY_HOPS confirmada

DB
[ ] PostgreSQL del ambiente correcto
[ ] npx prisma generate
[ ] npm run prisma:migrate:deploy
[ ] npx prisma migrate status
[ ] Resultado registrado

API
[ ] API desplegada desde el SHA seleccionado
[ ] GET /health/live = 200
[ ] GET /health/ready = 200

WEB
[ ] NEXT_PUBLIC_API_URL corresponde al ambiente
[ ] Web desplegada
[ ] Smoke Web ejecutado

POST
[ ] Roles QA/operativos validados
[ ] Escritura QA controlada validada
[ ] Logs revisados sin secretos
[ ] Release anterior retenida
[ ] Resultado y evidencia registrados
```

## 20. Checklist corto de rollback

```text
[ ] Detener rollout y nuevos deploys
[ ] Conservar evidencia y logs seguros
[ ] Identificar SHA anterior conocido como bueno
[ ] Decidir rollback de aplicación o recuperación DB
[ ] No reescribir migrations ni ejecutar SQL improvisado
[ ] Aplicación: volver al SHA anterior
[ ] DB: forward-fix o restore validado
[ ] live = 200
[ ] ready = 200
[ ] Smoke tests
[ ] Documentar causa raíz y follow-up
```

## 21. Limitaciones actuales

Antes de afirmar cualquier estado RC/Production Ready deben resolverse o
validarse explícitamente:

- no se ha seleccionado cloud provider;
- no existe deployment productivo;
- no existe dominio oficial;
- B3B5 de email real de Resend está pendiente;
- backup/restore real queda pendiente de OPS-RC-B4;
- el control/enforcement de public-register requiere decisión e implementación
  antes de exposición pública;
- observability avanzada (Sentry/error monitoring y uptime monitoring) es P1;
- HSTS y CSP son hardening posterior, no parte de este runbook;
- la topología definitiva de proxy aún debe confirmarse por ambiente;
- la validación de recovery con email real no está cubierta por este checkpoint.

Por estas limitaciones, este documento define el procedimiento operativo y no
constituye una autorización de producción.
