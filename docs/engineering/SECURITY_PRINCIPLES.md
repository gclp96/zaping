# Principios de Seguridad — Zaping

**Producto:** Zaping
**Versión:** 2.0.0
**Estado:** Aprobado
**Última actualización:** 2026-08-19
**Responsable:** Zaping Team

---

# 1. Propósito

Este documento define los principios y requisitos de seguridad aplicables al ecosistema Zaping.

Su objetivo es proteger:

* cuentas de usuario;
* datos empresariales;
* aislamiento entre compañías;
* inventario;
* información comercial;
* operaciones financieras;
* información Healthcare;
* documentos;
* integraciones;
* y la infraestructura de la plataforma.

La seguridad debe formar parte del diseño de cada funcionalidad.

No debe tratarse como una revisión opcional al final del desarrollo.

---

# 2. Principio fundamental

Zaping utiliza:

> **Security by Design y Secure by Default.**

Toda funcionalidad debe asumir que:

* los inputs pueden ser maliciosos;
* los usuarios pueden intentar acciones no autorizadas;
* los identificadores pueden ser manipulados;
* los datos recibidos desde frontend no son confiables;
* los tenants deben permanecer completamente aislados;
* y los errores no deben exponer información interna.

---

# 3. Objetivos de seguridad

Zaping debe proteger principalmente:

## Confidencialidad

La información debe ser visible únicamente para usuarios autorizados.

## Integridad

La información no debe poder modificarse sin autorización ni trazabilidad.

## Disponibilidad

Los servicios deben mantenerse disponibles dentro de los objetivos definidos para la plataforma.

## Trazabilidad

Las acciones relevantes deben poder atribuirse a un usuario, proceso o integración.

---

# 4. Principio de mínimo privilegio

Todo usuario, servicio o integración debe recibir únicamente los permisos necesarios para realizar su función.

No se deben conceder privilegios amplios por comodidad.

Ejemplo:

Un usuario que puede consultar inventario no debería automáticamente poder:

* modificar stock;
* aprobar compras;
* administrar usuarios;
* emitir facturas;
* o acceder a información de otra empresa.

---

# 5. Autenticación

Zaping debe exigir autenticación para toda operación privada.

El sistema utiliza actualmente JWT como mecanismo principal de autenticación.

El flujo debe garantizar:

* credenciales válidas;
* usuario activo;
* token válido;
* expiración;
* firma válida;
* contexto de usuario;
* contexto de empresa.

Los endpoints públicos deben mantenerse al mínimo necesario.

---

# 6. Contraseñas

Las contraseñas deben:

* almacenarse únicamente como hash seguro;
* utilizar algoritmos adecuados como bcrypt;
* nunca almacenarse en texto plano;
* nunca registrarse en logs;
* nunca incluirse en respuestas API;
* nunca enviarse de vuelta al frontend.

La aplicación no debe exponer:

```text
password
passwordHash
```

ni campos equivalentes innecesarios.

---

# 7. Respuestas de autenticación

Los endpoints de autenticación deben devolver únicamente la información necesaria.

Ejemplo conceptual:

```json
{
  "accessToken": "...",
  "user": {
    "id": "...",
    "companyId": "...",
    "name": "...",
    "email": "...",
    "role": "..."
  }
}
```

No deben devolver automáticamente el modelo completo de persistencia.

---

# 8. Tokens JWT

Los JWT deben:

* estar firmados;
* utilizar secretos configurados mediante variables de entorno;
* tener expiración;
* validarse en cada request protegido;
* contener únicamente claims necesarios.

Nunca deben:

* almacenarse en código fuente;
* registrarse completos en logs;
* compartirse entre usuarios;
* considerarse seguros únicamente porque están codificados.

Un JWT firmado no equivale a información cifrada.

---

# 9. Secretos

Todos los secretos deben almacenarse fuera del código fuente.

Ejemplos:

```text
JWT_SECRET
DATABASE_URL
API_KEYS
SMTP_PASSWORD
THIRD_PARTY_SECRETS
```

Deben utilizarse:

* variables de entorno;
* secret managers cuando exista infraestructura productiva;
* configuraciones separadas por entorno.

Nunca deben agregarse secretos reales al repositorio.

---

# 10. Autorización

Autenticación y autorización son responsabilidades distintas.

```text
Autenticación
→ ¿Quién eres?

Autorización
→ ¿Qué puedes hacer?
```

Estar autenticado no significa tener permiso para ejecutar cualquier operación.

---

# 11. Roles y permisos

Zaping utiliza RBAC como base de autorización.

Los roles agrupan permisos.

La arquitectura debe permitir evolucionar hacia permisos granulares.

Ejemplos:

```text
customers.read
customers.write

inventory.read
inventory.adjust

purchases.create
purchases.approve

receipts.create

sales.create

cases.view
cases.assign

caseKits.prepare
caseKits.dispatch

billing.view
```

Los permisos reales deberán definirse progresivamente por dominio.

---

# 12. Backend como autoridad

La interfaz puede ocultar acciones no autorizadas para mejorar UX.

Sin embargo:

> El backend es la autoridad final.

No debe confiarse en:

* botones ocultos;
* rutas frontend;
* campos deshabilitados;
* navegación condicionada.

Todo endpoint protegido debe validar autorización en servidor.

---

# 13. Multi-tenancy

El aislamiento multiempresa es una propiedad de seguridad crítica.

Toda entidad empresarial debe estar asociada a su `companyId` cuando corresponda.

Un usuario de una empresa nunca debe poder:

* consultar;
* modificar;
* eliminar;
* relacionar;
* exportar;
* o inferir

información perteneciente a otra empresa.

---

# 14. CompanyId confiable

El sistema no debe asumir que un `companyId` recibido desde frontend es verdadero.

La empresa debe derivarse principalmente del contexto autenticado.

Conceptualmente:

```text
JWT
↓
Authenticated User
↓
companyId confiable
↓
Query aislada
```

No:

```text
Frontend envía companyId
↓
Backend confía directamente
```

---

# 15. Queries multi-tenant

Todas las operaciones empresariales deben aplicar aislamiento.

Esto incluye:

* `find`;
* `findMany`;
* `update`;
* `delete`;
* relaciones;
* búsquedas;
* reportes;
* exportaciones.

No basta con aplicar `companyId` únicamente al listado principal.

---

# 16. Relaciones entre entidades

Antes de crear una relación entre dos entidades empresariales se debe comprobar que ambas pertenecen al mismo tenant.

Ejemplo:

Una compra de Empresa A no debe poder relacionarse con un proveedor de Empresa B.

El simple hecho de conocer el UUID de otra entidad no debe permitir utilizarla.

---

# 17. UUID no es autorización

Zaping utiliza UUID como estrategia de identificación.

Sin embargo:

> Un UUID difícil de adivinar no sustituye la autorización.

Todos los recursos deben continuar verificando permisos y pertenencia al tenant.

---

# 18. Validación de entrada

Toda entrada externa debe considerarse no confiable.

Validar:

* tipos;
* formatos;
* valores permitidos;
* longitud;
* campos obligatorios;
* enumeraciones;
* relaciones;
* límites.

El backend utiliza DTOs y `ValidationPipe` como primera capa de validación.

Las reglas de negocio adicionales deben validarse posteriormente en el dominio correspondiente.

---

# 19. Mass Assignment

No debe permitirse que el cliente modifique campos internos simplemente enviándolos en el request.

Ejemplos sensibles:

```text
companyId
role
permissions
createdBy
approvedBy
status interno
passwordHash
```

Los DTOs deben aceptar únicamente los campos permitidos para esa operación.

---

# 20. Whitelisting

La configuración de validación debe continuar utilizando enfoques equivalentes a:

* whitelist;
* rechazo de propiedades no permitidas;
* transformación controlada.

Esto reduce el riesgo de campos inesperados.

---

# 21. Manejo de errores

Los errores enviados al usuario deben ser útiles pero no revelar detalles internos.

No exponer:

* stack traces;
* SQL;
* consultas Prisma completas;
* rutas internas;
* secretos;
* tokens;
* variables de entorno;
* infraestructura;
* información de otros usuarios.

---

# 22. Logging seguro

Los logs deben ayudar a diagnosticar incidentes sin convertirse en una fuente de exposición.

No registrar:

* contraseñas;
* JWT completos;
* secretos;
* claves API;
* datos sensibles innecesarios.

Cuando sea necesario identificar una operación, utilizar identificadores y contexto seguro.

---

# 23. Auditoría

Las acciones críticas deben generar trazabilidad de negocio independiente de los logs técnicos.

Ejemplos:

* login;
* creación de usuarios;
* cambios de permisos;
* aprobaciones;
* ajustes de inventario;
* recepciones;
* entregas;
* devoluciones;
* salidas Healthcare;
* retornos;
* conciliaciones;
* cambios de estado críticos.

Idealmente debe conocerse:

```text
Quién
Qué
Cuándo
Dónde
Entidad
Acción
Resultado
```

---

# 24. Inventario

Inventario es un dominio de alta sensibilidad.

No debe permitirse:

* modificación directa arbitraria de stock;
* movimientos sin origen;
* eliminación silenciosa de movimientos;
* reescritura de historia confirmada.

Las correcciones deben preservar trazabilidad.

---

# 25. Operaciones financieras

Operaciones relacionadas con:

* precios;
* ventas;
* facturación;
* pagos;
* impuestos;
* descuentos;

deben requerir permisos apropiados.

Los cambios posteriores a una operación confirmada deben preservar historial cuando corresponda.

---

# 26. Zaping Healthcare

Healthcare introduce información operacional que puede tener mayor sensibilidad.

El alcance inicial de Zaping Healthcare debe mantenerse en:

* hospitales;
* médicos;
* procedimientos;
* técnicos;
* logística;
* material;
* equipo;
* casos;
* aseguradoras;
* y facturación relacionada.

---

# 27. No convertirse en expediente clínico

Zaping Healthcare no debe almacenar información clínica innecesaria.

No incorporar de forma predeterminada:

* diagnósticos clínicos;
* expedientes médicos completos;
* estudios;
* tratamientos;
* notas médicas;
* historia clínica.

Si una funcionalidad futura requiere este tipo de información deberá realizarse una evaluación formal de:

* necesidad;
* regulación;
* privacidad;
* seguridad;
* acceso;
* cifrado;
* retención;
* auditoría.

---

# 28. Minimización de datos

Guardar únicamente la información necesaria para cumplir la función empresarial.

Antes de agregar un nuevo campo sensible preguntar:

1. ¿Realmente es necesario?
2. ¿Quién necesita verlo?
3. ¿Por cuánto tiempo?
4. ¿Qué ocurre si se filtra?
5. ¿Existe una alternativa menos sensible?

---

# 29. Datos personales

La información personal debe limitarse a lo necesario.

Ejemplos:

* nombres;
* correos;
* teléfonos;
* contactos;
* responsables.

El acceso debe estar alineado con las responsabilidades del usuario.

---

# 30. Aseguradoras y pagadores

Información relacionada con:

* aseguradora;
* autorización;
* número de referencia;
* responsable de pago;

puede ser sensible.

Debe exponerse únicamente a roles que realmente la necesiten.

---

# 31. Segregación de responsabilidades

Algunas operaciones pueden requerir separar responsabilidades.

Ejemplos futuros:

```text
Usuario A
→ prepara compra

Usuario B
→ aprueba compra
```

o:

```text
Almacén
→ entrega material

Administración
→ factura
```

No debe implementarse separación artificial en todos los workflows, pero la arquitectura debe permitirla donde exista riesgo financiero u operacional.

---

# 32. Acciones destructivas

Las acciones destructivas deben minimizarse.

Preferir:

* Soft Delete;
* desactivación;
* cancelación;
* reversión;
* movimientos compensatorios.

Una entidad con historia relevante no debe eliminarse físicamente sin evaluar las consecuencias.

---

# 33. Confirmaciones

Las acciones críticas deben solicitar confirmación cuando exista riesgo significativo.

La confirmación debe explicar la consecuencia.

Preferir:

> Confirmar recepción. Esta operación aumentará inventario.

sobre:

> ¿Estás seguro?

---

# 34. Base de datos

El acceso a PostgreSQL debe realizarse mediante credenciales protegidas.

La base de datos no debe exponerse públicamente sin necesidad.

Los usuarios de base de datos deben tener privilegios adecuados al entorno.

---

# 35. Prisma

Prisma debe utilizarse mediante consultas parametrizadas y contratos controlados.

SQL manual debe evitarse salvo necesidad específica.

Cuando exista SQL manual debe revisarse:

* inyección;
* multi-tenancy;
* permisos;
* performance;
* compatibilidad.

---

# 36. Migraciones

Las migraciones deben proteger la integridad de los datos.

Antes de una migración crítica:

* evaluar impacto;
* revisar datos;
* crear respaldo cuando corresponda;
* evitar operaciones destructivas no necesarias.

Nunca realizar resets de datos productivos como solución rutinaria.

---

# 37. Backups

Cuando exista entorno productivo deben existir respaldos periódicos de información crítica.

La estrategia deberá definir:

* frecuencia;
* retención;
* ubicación;
* restauración;
* pruebas de recuperación.

Un backup que nunca se ha probado restaurar no debe considerarse suficiente.

---

# 38. HTTPS

Todo tráfico productivo debe utilizar HTTPS.

Las credenciales y tokens no deben transmitirse mediante conexiones inseguras.

---

# 39. CORS

La configuración CORS debe permitir únicamente los orígenes requeridos por cada entorno.

No utilizar configuraciones excesivamente abiertas en producción sin justificación.

---

# 40. Rate Limiting

Endpoints expuestos públicamente deben evaluar rate limiting.

Especial atención futura a:

* login;
* reset password;
* API pública;
* búsquedas costosas;
* integraciones.

La implementación se priorizará según exposición real.

---

# 41. Protección contra ataques de autenticación

El sistema deberá evolucionar para reducir:

* brute force;
* credential stuffing;
* abuso de recuperación de contraseña.

Posibles mecanismos futuros:

* rate limits;
* bloqueo temporal;
* alertas;
* MFA;
* detección de comportamiento anómalo.

---

# 42. Recuperación de contraseña

Los tokens de recuperación deben:

* ser temporales;
* tener expiración;
* ser de un solo uso cuando sea posible;
* no revelar si una cuenta existe de forma innecesaria;
* invalidarse después de utilizarse.

---

# 43. MFA

La autenticación multifactor no es requisito inmediato del MVP.

Debe considerarse para:

* administradores;
* clientes enterprise;
* acciones sensibles;
* cuentas de alto privilegio.

---

# 44. Sesiones y revocación

La arquitectura debe permitir evolucionar hacia mecanismos de revocación de sesiones o tokens cuando sea necesario.

Casos futuros:

* usuario deshabilitado;
* contraseña cambiada;
* sospecha de compromiso;
* cierre remoto de sesión.

---

# 45. Dependencias

Las dependencias externas deben mantenerse actualizadas razonablemente.

Antes de incorporar una nueva librería evaluar:

* necesidad;
* mantenimiento;
* reputación;
* vulnerabilidades conocidas;
* licencia;
* tamaño;
* alternativas.

No agregar dependencias únicamente para resolver problemas triviales.

---

# 46. Vulnerabilidades de dependencias

Deben realizarse revisiones periódicas mediante herramientas como las disponibles en el ecosistema npm.

Ejemplo:

```bash
npm audit
```

Los hallazgos deben evaluarse según:

* explotabilidad;
* contexto;
* severidad;
* dependencia directa o indirecta.

No actualizar versiones mayores ciegamente únicamente para eliminar una alerta sin revisar compatibilidad.

---

# 47. Archivos y documentos

Cuando Zaping permita subir archivos deben aplicarse controles como:

* tamaño máximo;
* tipos permitidos;
* nombres seguros;
* autorización;
* tenant;
* almacenamiento controlado.

No confiar únicamente en la extensión enviada por el usuario.

---

# 48. Integraciones externas

Toda integración debe tratarse como un límite de confianza.

Debe evaluarse:

* autenticación;
* secretos;
* permisos;
* datos enviados;
* datos recibidos;
* reintentos;
* logs;
* disponibilidad;
* errores.

Nunca permitir que una integración externa pueda operar fuera del tenant autorizado.

---

# 49. API pública

La futura Public API deberá incorporar:

* autenticación propia;
* scopes;
* rate limiting;
* versionado;
* auditoría;
* revocación;
* documentación.

Una API key no debe otorgar acceso ilimitado por defecto.

---

# 50. Separación por ambientes

Los ambientes deben permanecer separados.

Ejemplos:

```text
development
test
staging
production
```

No reutilizar:

* bases de datos productivas;
* secretos productivos;
* credenciales;
* tokens;

en desarrollo local sin necesidad y controles específicos.

---

# 51. Datos de prueba

Los entornos no productivos deben utilizar preferentemente datos ficticios o sanitizados.

No copiar datos sensibles reales a desarrollo únicamente por comodidad.

---

# 52. Seguridad frontend

El frontend no debe almacenar información sensible innecesariamente.

Evitar:

* secretos;
* credenciales;
* información privada en variables públicas;
* logs de tokens.

Toda variable expuesta al navegador debe considerarse públicamente visible.

---

# 53. XSS

Los valores externos deben tratarse como datos, no como HTML ejecutable.

Evitar renderizar HTML sin sanitización.

No utilizar mecanismos equivalentes a:

```text
dangerouslySetInnerHTML
```

salvo necesidad explícita y sanitización adecuada.

---

# 54. CSRF

La estrategia CSRF debe evaluarse según el mecanismo final de almacenamiento y transmisión de autenticación.

Si en el futuro se utilizan cookies de sesión para autenticación, deberán incorporarse las protecciones correspondientes.

---

# 55. Redirects y URLs

No confiar en URLs externas proporcionadas por usuario sin validación.

Evitar open redirects.

Las URLs almacenadas o abiertas por el sistema deben validarse cuando representen un riesgo.

---

# 56. Seguridad de exportaciones

Las exportaciones deben respetar:

* tenant;
* permisos;
* filtros;
* datos sensibles.

Un usuario no debe poder exportar información que no puede consultar normalmente.

---

# 57. Reportes

Los reportes deben aplicar exactamente las mismas reglas de autorización que las pantallas operativas.

Un reporte no debe convertirse en una ruta alternativa para obtener información restringida.

---

# 58. Dashboard

Los indicadores agregados también deben respetar tenant y permisos.

La agregación no elimina la sensibilidad de los datos.

---

# 59. Auditoría de permisos

Los cambios de:

* rol;
* permisos;
* acceso administrativo;

deben registrarse.

Idealmente se debe conocer:

* quién realizó el cambio;
* usuario afectado;
* permisos anteriores;
* permisos nuevos;
* fecha.

---

# 60. Cuentas administrativas

Las cuentas administrativas deben protegerse especialmente.

Evitar:

* compartir cuentas;
* usuarios genéricos;
* contraseñas comunes;
* privilegios administrativos innecesarios.

Cada persona debe utilizar su propia identidad.

---

# 61. Seguridad de infraestructura

Cuando exista infraestructura productiva deben evaluarse:

* firewall;
* redes privadas;
* acceso a base de datos;
* secretos;
* TLS;
* backups;
* logging;
* monitoreo;
* actualizaciones;
* acceso administrativo.

La infraestructura deberá documentarse cuando se formalice el entorno productivo.

---

# 62. Observabilidad de seguridad

La plataforma debe evolucionar para detectar eventos como:

* fallos repetidos de login;
* acciones administrativas;
* accesos anómalos;
* errores de autorización;
* operaciones críticas;
* cambios de configuración.

No es necesario construir un SIEM durante el MVP.

Sí debemos generar información que permita investigar incidentes.

---

# 63. Incidentes de seguridad

Cuando exista sospecha de incidente:

```text
Detectar
↓
Contener
↓
Investigar
↓
Corregir
↓
Recuperar
↓
Documentar
↓
Prevenir recurrencia
```

Un incidente crítico puede requerir:

* revocar accesos;
* rotar secretos;
* aislar servicios;
* restaurar datos;
* revisar logs.

---

# 64. Vulnerabilidades

Una vulnerabilidad encontrada no debe ocultarse.

Debe registrarse y priorizarse según riesgo.

Clasificación orientativa:

```text
Critical
High
Medium
Low
```

Critical y High deben recibir atención prioritaria.

---

# 65. Testing de seguridad

Las áreas críticas deben incluir pruebas específicas cuando corresponda.

Ejemplos:

* endpoint sin token;
* token inválido;
* usuario sin rol;
* usuario de otra empresa;
* manipulación de UUID;
* campos no permitidos;
* acceso a recurso inexistente;
* datos sensibles en respuesta.

---

# 66. Pruebas multi-tenant

Los módulos críticos deben validar explícitamente escenarios como:

```text
Company A
↓
intenta leer recurso de Company B
↓
DENEGADO
```

y:

```text
Company A
↓
intenta modificar recurso de Company B
↓
DENEGADO
```

Estas pruebas tienen prioridad alta.

---

# 67. Revisión de seguridad antes de release

Una release relevante debe revisar:

* autenticación;
* autorización;
* multi-tenancy;
* secretos;
* migraciones;
* dependencias;
* exposición de endpoints;
* datos sensibles.

No todas las releases necesitan pentesting formal.

La profundidad debe ser proporcional al riesgo.

---

# 68. Seguridad en el Definition of Done

Una funcionalidad no puede considerarse terminada si deja una vulnerabilidad conocida crítica dentro de su propio alcance.

El Definition of Done debe incluir, cuando corresponda:

* autorización;
* tenant;
* validación;
* datos sensibles;
* logs;
* auditoría.

---

# 69. Deuda de seguridad

Cuando una mejora de seguridad no pueda implementarse inmediatamente debe registrarse explícitamente.

Debe conocerse:

* riesgo;
* impacto;
* workaround;
* prioridad.

La deuda de seguridad no debe esconderse dentro de comentarios o conversaciones.

---

# 70. Prioridades actuales de seguridad

Para la etapa actual del proyecto, las prioridades principales son:

1. aislamiento multi-tenant;
2. autenticación JWT correcta;
3. RBAC;
4. protección de endpoints;
5. no exposición de información sensible;
6. validación de DTOs;
7. protección de secretos;
8. auditoría;
9. pruebas de autorización;
10. endurecimiento progresivo previo a producción.

---

# 71. Seguridad antes de producción

Antes del primer entorno productivo deben revisarse como mínimo:

* secretos;
* JWT;
* contraseñas;
* permisos;
* multi-tenancy;
* CORS;
* HTTPS;
* base de datos;
* backups;
* logs;
* dependencias;
* manejo de errores;
* endpoints públicos;
* rate limiting de autenticación;
* auditoría;
* recuperación de contraseña;
* datos sensibles;
* configuraciones de producción.

---

# 72. Principio final

La seguridad de Zaping depende de múltiples capas.

```text
Usuario
↓
Autenticación
↓
Autorización
↓
Tenant
↓
Validación
↓
Reglas de negocio
↓
Persistencia
↓
Auditoría
```

Ninguna capa individual es suficiente por sí sola.

El objetivo es construir una plataforma en la que cada usuario pueda confiar en que:

> su información pertenece a su empresa, solo las personas correctas pueden acceder a ella y las operaciones críticas permanecen protegidas y trazables.
