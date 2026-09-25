'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthenticatedSession } from '@/app/auth-session';
import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import DataTable, {
  type DataTableColumn,
  type DataTableRowActions,
} from '@/app/components/ui/DataTable';
import ForbiddenState from '@/app/components/ui/ForbiddenState';
import Loading from '@/app/components/ui/Loading';
import Modal from '@/app/components/ui/Modal';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage, isForbiddenError } from '@/services/errors';
import {
  getHealthcareEquipmentAssignment,
  listHealthcareEquipmentAssignments,
  type HealthcareEquipmentAssignment,
  type HealthcareEquipmentAssignmentAvailability,
  type HealthcareEquipmentAssignmentOrigin,
  type HealthcareEquipmentAssignmentStatus,
} from '@/services/healthcare-equipment-assignments';

import type { HealthcareCase } from '../../types';

const statusDescriptors: Record<
  HealthcareEquipmentAssignmentStatus,
  { label: string; tone: 'info' | 'neutral' | 'success' }
> = {
  RESERVED: { label: 'Reservada', tone: 'info' },
  RELEASED: { label: 'Liberada', tone: 'success' },
  REPLACED: { label: 'Reemplazada', tone: 'neutral' },
};

const originLabels: Record<HealthcareEquipmentAssignmentOrigin, string> = {
  REQUIREMENT: 'Requerimiento',
  DIRECT: 'Directa',
};

const releaseCauseLabels = {
  MANUAL: 'Liberación manual',
  CASE_CANCELLED: 'Caso cancelado',
  REQUIREMENT_WITHDRAWN: 'Requerimiento retirado',
} as const;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function userLabel(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`;
}

function availabilityDescriptor(
  availability: HealthcareEquipmentAssignmentAvailability | null,
): {
  label: string;
  tone: 'danger' | 'neutral' | 'success' | 'warning';
} {
  if (!availability) {
    return { label: 'No aplica (histórico)', tone: 'neutral' };
  }

  if (availability.conflictFree === false) {
    return { label: 'Con conflicto', tone: 'danger' };
  }

  if (!availability.fullyVerifiable || availability.conflictFree === null) {
    return { label: 'No verificable', tone: 'warning' };
  }

  return { label: 'Sin conflictos', tone: 'success' };
}

function AvailabilitySummary({
  availability,
}: {
  availability: HealthcareEquipmentAssignmentAvailability | null;
}) {
  const descriptor = availabilityDescriptor(availability);

  return (
    <div className="space-y-2">
      <StatusBadge label={descriptor.label} tone={descriptor.tone} />
      {availability?.warnings.length ? (
        <ul className="space-y-1 text-xs text-text-muted">
          {availability.warnings.map((warning) => (
            <li key={warning.code}>{warning.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const columns: DataTableColumn<HealthcareEquipmentAssignment>[] = [
  {
    id: 'equipment',
    header: 'Equipo',
    cell: (assignment) => (
      <div>
        <p className="font-semibold">{assignment.equipmentAsset.product.name}</p>
        <p className="text-xs text-text-muted">
          {assignment.equipmentAsset.product.sku} ·{' '}
          {assignment.equipmentAsset.assetCode}
        </p>
        <p className="text-xs text-text-muted">
          Serie {assignment.equipmentAsset.serialNumber || 'Sin serie'}
        </p>
      </div>
    ),
    minWidth: 220,
  },
  {
    id: 'origin',
    header: 'Origen',
    cell: (assignment) => originLabels[assignment.origin],
    priority: 'secondary',
    minWidth: 130,
  },
  {
    id: 'status',
    header: 'Estado',
    cell: (assignment) => {
      const descriptor = statusDescriptors[assignment.status];
      return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
    },
    minWidth: 130,
  },
  {
    id: 'availability',
    header: 'Disponibilidad',
    cell: (assignment) => (
      <AvailabilitySummary availability={assignment.availability} />
    ),
    minWidth: 240,
  },
  {
    id: 'assignedAt',
    header: 'Asignada',
    cell: (assignment) => formatDateTime(assignment.assignedAt),
    priority: 'tertiary',
    minWidth: 170,
  },
];

export default function HealthcareCaseEquipmentAssignmentsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const sessionState = useAuthenticatedSession();
  const requestId = useRef(0);
  const detailRequestId = useRef(0);
  const [healthcareCase, setHealthcareCase] = useState<HealthcareCase | null>(
    null,
  );
  const [assignments, setAssignments] = useState<
    HealthcareEquipmentAssignment[]
  >([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [detailAssignmentId, setDetailAssignmentId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] =
    useState<HealthcareEquipmentAssignment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailForbidden, setDetailForbidden] = useState(false);

  const loadAssignments = useCallback(async () => {
    const currentRequestId = ++requestId.current;

    try {
      setLoading(true);
      setError('');
      setForbidden(false);
      const [caseResponse, assignmentResponse] = await Promise.all([
        api.get<HealthcareCase>(`/healthcare/cases/${caseId}`),
        listHealthcareEquipmentAssignments(
          caseId,
          pagination.page,
          pagination.pageSize,
        ),
      ]);

      if (currentRequestId !== requestId.current) return;
      setHealthcareCase(caseResponse.data);
      setAssignments(assignmentResponse.items);
      setPagination(assignmentResponse.pagination);
    } catch (requestError: unknown) {
      if (currentRequestId !== requestId.current) return;
      setHealthcareCase(null);
      setAssignments([]);
      if (isForbiddenError(requestError)) {
        setForbidden(true);
      } else {
        setError(
          getApiErrorMessage(
            requestError,
            'No fue posible cargar las asignaciones del caso.',
          ),
        );
      }
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [caseId, pagination.page, pagination.pageSize]);

  useEffect(() => {
    if (sessionState.status !== 'success') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAssignments();

    return () => {
      requestId.current += 1;
    };
  }, [loadAssignments, sessionState.status]);

  const loadDetail = useCallback(async (assignmentId: string) => {
    const currentRequestId = ++detailRequestId.current;
    setDetailAssignmentId(assignmentId);
    setDetail(null);
    setDetailLoading(true);
    setDetailError('');
    setDetailForbidden(false);

    try {
      const response = await getHealthcareEquipmentAssignment(assignmentId);
      if (currentRequestId === detailRequestId.current) setDetail(response);
    } catch (requestError: unknown) {
      if (currentRequestId !== detailRequestId.current) return;
      if (isForbiddenError(requestError)) {
        setDetailForbidden(true);
      } else {
        setDetailError(
          getApiErrorMessage(
            requestError,
            'No fue posible cargar el detalle de la asignación.',
          ),
        );
      }
    } finally {
      if (currentRequestId === detailRequestId.current) setDetailLoading(false);
    }
  }, []);

  const rowActions: DataTableRowActions<HealthcareEquipmentAssignment> = {
    label: (assignment) =>
      `Acciones de la asignación ${assignment.equipmentAsset.assetCode}`,
    actions: [
      {
        id: 'view',
        label: 'Ver detalle',
        onSelect: (assignment) => void loadDetail(assignment.id),
      },
    ],
  };

  function closeDetail() {
    detailRequestId.current += 1;
    setDetailAssignmentId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError('');
    setDetailForbidden(false);
  }

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Asignaciones de equipo"
          description={
            healthcareCase
              ? `${healthcareCase.folio} — ${healthcareCase.title}`
              : 'Consulta las reservas y el historial de equipo del caso.'
          }
          action={
            <Link
              href="/healthcare-cases"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <ArrowLeft aria-hidden="true" size={18} />
              Volver a casos
            </Link>
          }
        />

        {forbidden ? (
          <ForbiddenState />
        ) : (
          <Section
            title="Asignaciones de equipo"
            description="Reservas activas e historial del caso. Esta vista es de sólo lectura."
          >
            <DataTable
              caption="Asignaciones de equipo del caso"
              rows={assignments}
              columns={columns}
              getRowId={(assignment) => assignment.id}
              rowActions={rowActions}
              pagination={
                pagination.totalItems > 0
                  ? {
                      pageIndex: pagination.page - 1,
                      pageSize: pagination.pageSize,
                      totalRows: pagination.totalItems,
                      pageSizeOptions: [10, 25, 50],
                      onPageChange: (pageIndex) =>
                        setPagination((current) => ({
                          ...current,
                          page: pageIndex + 1,
                        })),
                      onPageSizeChange: (pageSize) =>
                        setPagination((current) => ({
                          ...current,
                          page: 1,
                          pageSize,
                        })),
                    }
                  : undefined
              }
              loading={loading}
              loadingMessage="Cargando asignaciones de equipo..."
              error={
                error
                  ? {
                      message: error,
                      onRetry: () => void loadAssignments(),
                    }
                  : null
              }
              emptyState={{
                title: 'Sin asignaciones de equipo',
                description:
                  'Este caso todavía no tiene reservas ni historial de equipo.',
              }}
            />
          </Section>
        )}
      </PageContainer>

      <Modal
        isOpen={detailAssignmentId !== null}
        title="Detalle de la asignación"
        onClose={closeDetail}
      >
        {detailLoading ? (
          <Loading message="Cargando detalle de la asignación..." />
        ) : detailForbidden ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            No tienes permisos para consultar esta asignación.
          </p>
        ) : detailError ? (
          <div
            role="alert"
            className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p>{detailError}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (detailAssignmentId) void loadDetail(detailAssignmentId);
              }}
            >
              Reintentar
            </Button>
          </div>
        ) : detail ? (
          <AssignmentDetail assignment={detail} />
        ) : null}
      </Modal>
    </>
  );
}

function AssignmentDetail({
  assignment,
}: {
  assignment: HealthcareEquipmentAssignment;
}) {
  const status = statusDescriptors[assignment.status];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={status.label} tone={status.tone} />
        <StatusBadge label={originLabels[assignment.origin]} tone="neutral" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DetailField
          label="Producto"
          value={`${assignment.equipmentAsset.product.sku} — ${assignment.equipmentAsset.product.name}`}
        />
        <DetailField
          label="Equipo"
          value={`${assignment.equipmentAsset.assetCode} · Serie ${assignment.equipmentAsset.serialNumber || 'Sin serie'}`}
        />
        <DetailField
          label="Asignada por"
          value={userLabel(assignment.assignedBy)}
        />
        <DetailField
          label="Fecha de asignación"
          value={formatDateTime(assignment.assignedAt)}
        />
      </div>

      {assignment.directAssignmentReason ? (
        <DetailField
          label="Motivo de asignación directa"
          value={assignment.directAssignmentReason}
        />
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-gray-600">
          Disponibilidad
        </p>
        <AvailabilitySummary availability={assignment.availability} />
      </div>

      {assignment.release ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="font-semibold text-gray-900">
            {releaseCauseLabels[assignment.release.cause]}
          </p>
          <p className="mt-1 text-sm text-gray-700">
            {assignment.release.reason || 'Sin motivo registrado'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {formatDateTime(assignment.release.releasedAt)} ·{' '}
            {userLabel(assignment.release.releasedBy)}
          </p>
        </div>
      ) : null}

      {assignment.replacement ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="font-semibold text-gray-900">Reemplazo</p>
          <p className="mt-1 text-sm text-gray-700">
            {assignment.replacement.reason}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {formatDateTime(assignment.replacement.replacedAt)} ·{' '}
            {userLabel(assignment.replacement.replacedBy)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-gray-900">{value}</p>
    </div>
  );
}
