'use client';

import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';

import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import ForbiddenState from '@/app/components/ui/ForbiddenState';
import { getApiErrorMessage, getApiErrorStatus } from '@/services/errors';
import {
  getHealthcareCaseAvailability,
  type HealthcareCaseAvailability,
} from '@/services/healthcare-case-availability';

type BlockerCode = NonNullable<
  HealthcareCaseAvailability['preparation']['readiness']
>['blockers'][number]['code'];

const preparationMessages: Record<BlockerCode, string> = {
  CASE_KIT_CASE_CANCELLED: 'El caso está cancelado.',
  CASE_KIT_CASE_NOT_SCHEDULED: 'El caso todavía no está programado.',
  CASE_KIT_CASE_SCHEDULE_INCOMPLETE:
    'La programación del caso no tiene inicio y fin completos.',
  CASE_KIT_REQUIREMENT_NOT_ACTIVE:
    'Un requerimiento incluido ya no está activo.',
  CASE_KIT_REQUIREMENT_PRODUCT_INACTIVE:
    'El producto de un requerimiento incluido está inactivo.',
  CASE_KIT_PREPARED_QUANTITY_EXCEEDS_REQUESTED:
    'Una cantidad preparada excede la cantidad solicitada.',
  CASE_KIT_ASSIGNMENT_NOT_RESERVED:
    'Una asignación incluida ya no está reservada.',
  CASE_KIT_EQUIPMENT_NOT_ACTIVE: 'Un equipo incluido ya no está activo.',
  CASE_KIT_EQUIPMENT_NOT_GOOD:
    'Un equipo incluido ya no está en condición disponible.',
  CASE_KIT_REQUIRED_QUANTITY_NOT_COVERED:
    'Falta cubrir exactamente la cantidad de un requerimiento obligatorio.',
  CASE_KIT_REQUIRED_ASSET_NOT_COVERED:
    'Faltan equipos reservados para un requerimiento obligatorio.',
  CASE_KIT_SERIALIZED_REQUIREMENT_UNSUPPORTED:
    'Los requerimientos SERIALIZED aún no pueden confirmarse.',
};

export default function HealthcareCaseAvailabilitySummary({
  caseId,
}: {
  caseId: string;
}) {
  const [revision, setRevision] = useState(0);
  const titleId = useId();
  const refresh = () => setRevision((value) => value + 1);
  return (
    <section
      aria-labelledby={titleId}
      className="space-y-4 border-t border-gray-200 pt-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          Resumen de disponibilidad
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={refresh}>
          Actualizar resumen
        </Button>
      </div>
      {/* Each case or refresh owns its request and cannot retain another response. */}
      <AvailabilityRequest
        key={`${caseId}-${revision}`}
        caseId={caseId}
        onRetry={refresh}
      />
    </section>
  );
}

function AvailabilityRequest({
  caseId,
  onRetry,
}: {
  caseId: string;
  onRetry: () => void;
}) {
  const [result, setResult] = useState<
    | { status: 'loading' }
    | { status: 'success'; data: HealthcareCaseAvailability }
    | { status: 'error'; error: unknown }
  >({ status: 'loading' });
  useEffect(() => {
    let active = true;
    getHealthcareCaseAvailability(caseId).then(
      (data) => {
        if (active) setResult({ status: 'success', data });
      },
      (error: unknown) => {
        if (active) setResult({ status: 'error', error });
      },
    );
    return () => {
      active = false;
    };
  }, [caseId]);

  if (result.status === 'loading')
    return <p role="status">Cargando resumen de disponibilidad…</p>;
  if (result.status === 'error') {
    const status = getApiErrorStatus(result.error);
    return (
      <div className="space-y-3">
        {status === 403 ? (
          <ForbiddenState />
        ) : (
          <p role="alert" className="text-sm text-red-800">
            {status === 404
              ? 'No se encontró el caso para consultar su disponibilidad.'
              : status === 401
                ? 'La sesión requiere autenticación para consultar el resumen.'
                : getApiErrorMessage(
                    result.error,
                    'No fue posible cargar el resumen de disponibilidad.',
                  )}
          </p>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Reintentar resumen
        </Button>
      </div>
    );
  }
  const { schedule, requirements, coverage, equipment, preparation } =
    result.data;
  const dateLabel = (value: string | null) =>
    value
      ? new Date(value).toLocaleString('es-MX', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'Sin registrar';
  const linkClass =
    'inline-flex min-h-10 items-center text-sm font-medium text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Dimension title="Horario">
        <dl>
          <Value label="Inicio" value={dateLabel(schedule.scheduledStart)} />
          <Value label="Fin" value={dateLabel(schedule.scheduledEnd)} />
        </dl>
        <StatusBadge
          label={schedule.complete ? 'Horario completo' : 'Horario incompleto'}
          tone={schedule.complete ? 'info' : 'warning'}
        />
        <Warnings warnings={schedule.warnings} />
      </Dimension>
      <Dimension title="Requerimientos activos">
        {requirements.activeCount === 0 ? (
          <p>Sin requerimientos activos registrados</p>
        ) : null}
        <dl>
          <Value label="Total activos" value={requirements.activeCount} />
          <Value label="Obligatorios" value={requirements.requiredCount} />
          <Value label="Respaldo" value={requirements.backupCount} />
        </dl>
      </Dimension>
      <Dimension title="Cobertura de requerimientos">
        <dl>
          <Value
            label="Requerimientos evaluados"
            value={coverage.requirementCount}
          />
          <Value label="Cubiertos" value={coverage.coveredCount} />
          <Value label="Parciales" value={coverage.partialCount} />
          <Value label="Pendientes" value={coverage.pendingCount} />
          <Value label="No disponibles" value={coverage.unavailableCount} />
          <Value
            label="Notas de cobertura activas"
            value={coverage.activeNoteCount}
          />
        </dl>
      </Dimension>
      <Dimension title="Equipos reservados">
        <dl>
          <Value
            label="Asignaciones reservadas"
            value={equipment.reservedAssignmentCount}
          />
          <Value
            label="Verificación completa"
            value={equipment.fullyVerifiable ? 'Sí' : 'No'}
          />
          <Value
            label="Sin conflictos"
            value={
              equipment.conflictFree === null
                ? 'Sin determinar'
                : equipment.conflictFree
                  ? 'Sí'
                  : 'No'
            }
          />
        </dl>
        <Warnings warnings={equipment.warnings} />
        <Link
          className={linkClass}
          href={`/healthcare-cases/${caseId}/equipment-assignments`}
        >
          Ver asignaciones
        </Link>
      </Dimension>
      <Dimension title="Preparación del maletín">
        {preparation.caseKitId === null ? (
          <p>Sin maletín registrado</p>
        ) : (
          <>
            <p>Maletín registrado</p>
            <dl>
              <Value
                label="Estado del maletín"
                value={
                  preparation.status === 'PREPARED'
                    ? 'Preparado'
                    : preparation.status === 'DRAFT'
                      ? 'Borrador'
                      : 'Sin registrar'
                }
              />
            </dl>
            {preparation.readiness ? (
              <>
                <StatusBadge
                  label={
                    preparation.readiness.status === 'PASS'
                      ? 'Listo para confirmar'
                      : 'Bloqueado'
                  }
                  tone={
                    preparation.readiness.status === 'PASS' ? 'info' : 'warning'
                  }
                />
                {preparation.readiness.blockers.length ? (
                  <ul className="list-inside list-disc text-amber-900">
                    {preparation.readiness.blockers.map((blocker, index) => (
                      <li
                        key={`${blocker.code}-${blocker.requirementId ?? ''}-${index}`}
                      >
                        {preparationMessages[blocker.code]}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </>
        )}
        <Link
          className={linkClass}
          href={`/healthcare-cases/${caseId}/case-kit`}
        >
          Ver maletín
        </Link>
      </Dimension>
    </div>
  );
}

function Dimension({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800"
    >
      <h3 id={id} className="font-semibold text-gray-900">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Value({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <dt>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Warnings({
  warnings,
}: {
  warnings: { code: string; message: string }[];
}) {
  return warnings.length ? (
    <ul className="list-inside list-disc text-amber-900">
      {warnings.map((warning, index) => (
        <li key={`${warning.code}-${index}`}>{warning.message}</li>
      ))}
    </ul>
  ) : null;
}
