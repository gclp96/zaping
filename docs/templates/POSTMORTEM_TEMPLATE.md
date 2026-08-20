# Postmortem — [Título del incidente]

**ID:** INC-XXX
**Estado:** CLOSED / FOLLOW-UP
**Severidad:** SEV-1 / SEV-2 / SEV-3 / SEV-4
**Fecha del incidente:** YYYY-MM-DD
**Fecha del postmortem:** YYYY-MM-DD
**Responsable:** Zaping Team

---

# 1. Resumen

Explicar brevemente:

```text
¿Qué ocurrió?
¿Cuál fue el impacto?
¿Cuánto duró?
¿Cómo se resolvió?
```

---

# 2. Impacto

Describir el impacto real.

Ejemplos:

* usuarios afectados;
* Companies afectadas;
* operaciones bloqueadas;
* datos inconsistentes;
* pérdida de disponibilidad;
* riesgo de seguridad.

No exagerar ni minimizar.

---

# 3. Timeline

| Hora  | Evento        |
| ----- | ------------- |
| HH:MM | Inicio        |
| HH:MM | Detección     |
| HH:MM | Investigación |
| HH:MM | Mitigación    |
| HH:MM | Resolución    |

Utilizar timezone explícito cuando sea relevante.

---

# 4. Detección

¿Cómo se descubrió?

```text
User report
Monitoring
Test
Developer
Support
Security alert
```

---

# 5. Causa raíz

Describir la causa técnica y/o de proceso que produjo el incidente.

No limitarse al síntoma.

---

# 6. Factores contribuyentes

Ejemplos:

* falta de test;
* validación incompleta;
* documentación incorrecta;
* observabilidad insuficiente;
* migración;
* dependencia externa;
* revisión incompleta.

---

# 7. Resolución

¿Qué se hizo para restaurar el comportamiento correcto?

---

# 8. Datos e integridad

Indicar explícitamente:

```text
¿Hubo pérdida de datos?
¿Hubo duplicados?
¿Hubo corrupción?
¿Hubo movimientos incorrectos?
¿Fue necesaria reparación?
```

---

# 9. Seguridad

Indicar:

```text
¿Hubo exposición de datos?
¿Hubo acceso no autorizado?
¿Hubo impacto cross-tenant?
¿Se expusieron secretos?
```

Si no aplica:

```text
No se identificó impacto de seguridad.
```

solo después de revisarlo.

---

# 10. Qué funcionó bien

Registrar aspectos que ayudaron a resolver el incidente.

---

# 11. Qué debe mejorar

Registrar fallos de:

* tecnología;
* proceso;
* testing;
* documentación;
* observabilidad;
* comunicación.

Evitar convertir esta sección en una asignación de culpa personal.

---

# 12. Acciones correctivas

| Acción | Prioridad | Responsable | Estado  |
| ------ | --------- | ----------- | ------- |
| ...    | P0/P1/P2  | ...         | Pending |

---

# 13. Prevención de regresión

Indicar qué se añadirá:

```text
Test
Validation
Monitoring
Documentation
Guard
Migration check
```

para reducir la probabilidad de repetición.

---

# 14. Documentación afectada

Actualizar cuando corresponda:

```text
MODULE
ADR
SECURITY_PRINCIPLES
ENGINEERING_GUIDE
PROJECT_BOARD
CHANGELOG
```

---

# 15. Aprendizaje

Registrar el aprendizaje técnico o de producto generalizable.

---

# 16. Cierre

El incidente puede cerrarse cuando:

* [ ] servicio/comportamiento restaurado;
* [ ] datos validados;
* [ ] seguridad evaluada;
* [ ] causa raíz entendida;
* [ ] acciones críticas registradas;
* [ ] regression test añadido cuando aplique;
* [ ] documentación actualizada.
