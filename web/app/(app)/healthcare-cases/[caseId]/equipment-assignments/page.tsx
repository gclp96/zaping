'use client';

import { ArrowLeft, Plus } from 'lucide-react';
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
import { hasRole, WAREHOUSE_ROLES } from '@/app/erp-role-access';
import { api } from '@/services/api';
import {
  getApiErrorMessage,
  getApiErrorStatus,
  isForbiddenError,
} from '@/services/errors';
import {
  createDirectHealthcareEquipmentAssignment,
  getHealthcareEquipmentAssignment,
  listEligibleEquipmentAssignmentAssets,
  listHealthcareEquipmentAssignments,
  releaseHealthcareEquipmentAssignment,
  replaceHealthcareEquipmentAssignment,
  type HealthcareEquipmentAssignment,
  type HealthcareEquipmentAssignmentAssetCandidate,
  type HealthcareEquipmentAssignmentAvailability,
  type HealthcareEquipmentAssignmentConflictReviewResponse,
  type HealthcareEquipmentAssignmentOrigin,
  type HealthcareEquipmentAssignmentReplaceConflictReviewResponse,
  type HealthcareEquipmentAssignmentStatus,
} from '@/services/healthcare-equipment-assignments';

import type { HealthcareCase } from '../../types';
import CreateDirectAssignmentModal from './CreateDirectAssignmentModal';
import ReleaseAssignmentModal from './ReleaseAssignmentModal';
import ReplaceAssignmentModal from './ReplaceAssignmentModal';

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

function createAssignmentErrorFallback(error: unknown): string {
  switch (getApiErrorStatus(error)) {
    case 400:
      return 'Revisa el equipo y el motivo antes de crear la asignación.';
    case 403:
      return 'No tienes permisos para crear asignaciones de equipo.';
    case 409:
      return 'El caso o el equipo cambió. Actualiza la información e inténtalo de nuevo.';
    case 500:
      return 'No fue posible crear la asignación por un error de persistencia.';
    default:
      return 'No fue posible crear la asignación.';
  }
}

function createAssignmentErrorMessage(error: unknown): string {
  const fallback = createAssignmentErrorFallback(error);
  const message = getApiErrorMessage(error, fallback);

  return /^Request failed with status code \d+$/i.test(message)
    ? fallback
    : message;
}

function releaseAssignmentErrorFallback(error: unknown): string {
  switch (getApiErrorStatus(error)) {
    case 400:
      return 'Revisa el motivo antes de liberar la asignación.';
    case 403:
      return 'No tienes permisos para liberar asignaciones de equipo.';
    case 409:
      return 'La asignación cambió y ya no puede liberarse. Actualiza la información.';
    case 500:
      return 'No fue posible liberar la asignación por un error de persistencia.';
    default:
      return 'No fue posible liberar la asignación.';
  }
}

function releaseAssignmentErrorMessage(error: unknown): string {
  const fallback = releaseAssignmentErrorFallback(error);
  const message = getApiErrorMessage(error, fallback);

  return /^Request failed with status code \d+$/i.test(message)
    ? fallback
    : message;
}

function replaceAssignmentErrorFallback(error: unknown): string {
  switch (getApiErrorStatus(error)) {
    case 400:
      return 'Revisa el equipo sustituto y el motivo del reemplazo.';
    case 403:
      return 'No tienes permisos para reemplazar asignaciones de equipo.';
    case 409:
      return 'La asignación o el equipo cambió. Actualiza la información e inténtalo de nuevo.';
    case 500:
      return 'No fue posible reemplazar la asignación por un error de persistencia.';
    default:
      return 'No fue posible reemplazar la asignación.';
  }
}

function replaceAssignmentErrorMessage(error: unknown): string {
  const fallback = replaceAssignmentErrorFallback(error);
  const message = getApiErrorMessage(error, fallback);

  return /^Request failed with status code \d+$/i.test(message)
    ? fallback
    : message;
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
  const currentUserRole =
    sessionState.status === 'success'
      ? sessionState.user?.role ?? null
      : null;
  const canCreateAssignment = hasRole(currentUserRole, WAREHOUSE_ROLES);
  const canReleaseAssignment = hasRole(currentUserRole, WAREHOUSE_ROLES);
  const canReplaceAssignment = hasRole(currentUserRole, WAREHOUSE_ROLES);
  const requestId = useRef(0);
  const detailRequestId = useRef(0);
  const assetRequestId = useRef(0);
  const createSubmissionInFlight = useRef(false);
  const releaseSubmissionInFlight = useRef(false);
  const replaceSubmissionInFlight = useRef(false);
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
  const [notice, setNotice] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [eligibleAssets, setEligibleAssets] = useState<
    HealthcareEquipmentAssignmentAssetCandidate[]
  >([]);
  const [eligibleAssetsLoading, setEligibleAssetsLoading] = useState(false);
  const [eligibleAssetsError, setEligibleAssetsError] = useState('');
  const [createEquipmentAssetId, setCreateEquipmentAssetId] = useState('');
  const [directAssignmentReason, setDirectAssignmentReason] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [conflictReview, setConflictReview] =
    useState<HealthcareEquipmentAssignmentConflictReviewResponse | null>(null);
  const [releaseAssignment, setReleaseAssignment] =
    useState<HealthcareEquipmentAssignment | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseSaving, setReleaseSaving] = useState(false);
  const [releaseError, setReleaseError] = useState('');
  const [replaceAssignment, setReplaceAssignment] =
    useState<HealthcareEquipmentAssignment | null>(null);
  const [replacementEquipmentAssetId, setReplacementEquipmentAssetId] =
    useState('');
  const [replacementReason, setReplacementReason] = useState('');
  const [replaceSaving, setReplaceSaving] = useState(false);
  const [replaceError, setReplaceError] = useState('');
  const [replaceConflictReview, setReplaceConflictReview] =
    useState<HealthcareEquipmentAssignmentReplaceConflictReviewResponse | null>(
      null,
    );
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

  const loadEligibleAssets = useCallback(async () => {
    const currentRequestId = ++assetRequestId.current;
    setEligibleAssetsLoading(true);
    setEligibleAssetsError('');
    setEligibleAssets([]);

    try {
      const assets = await listEligibleEquipmentAssignmentAssets();
      if (currentRequestId === assetRequestId.current) {
        setEligibleAssets(assets);
      }
    } catch (requestError: unknown) {
      if (currentRequestId !== assetRequestId.current) return;
      setEligibleAssetsError(
        getApiErrorMessage(
          requestError,
          isForbiddenError(requestError)
            ? 'No tienes permisos para consultar los equipos.'
            : 'No fue posible cargar los equipos elegibles.',
        ),
      );
    } finally {
      if (currentRequestId === assetRequestId.current) {
        setEligibleAssetsLoading(false);
      }
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

  const assignmentColumns: DataTableColumn<HealthcareEquipmentAssignment>[] =
    canReleaseAssignment || canReplaceAssignment
      ? [
          ...columns,
          {
            id: 'mutations',
            header: 'Acción',
            cell: (assignment) =>
              assignment.status === 'RESERVED' ? (
                <div className="flex flex-wrap gap-2">
                  {canReplaceAssignment ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Reemplazar ${assignment.equipmentAsset.assetCode}`}
                      onClick={() => openReplaceModal(assignment)}
                    >
                      Reemplazar
                    </Button>
                  ) : null}
                  {canReleaseAssignment ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Liberar ${assignment.equipmentAsset.assetCode}`}
                      onClick={() => openReleaseModal(assignment)}
                    >
                      Liberar
                    </Button>
                  ) : null}
                </div>
              ) : null,
            minWidth: 230,
          },
        ]
      : columns;

  function closeDetail() {
    detailRequestId.current += 1;
    setDetailAssignmentId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError('');
    setDetailForbidden(false);
  }

  function resetCreateForm() {
    setCreateEquipmentAssetId('');
    setDirectAssignmentReason('');
    setCreateError('');
    setConflictReview(null);
  }

  function openCreateModal() {
    if (!canCreateAssignment) return;
    resetCreateForm();
    setNotice('');
    setCreateModalOpen(true);
    void loadEligibleAssets();
  }

  function closeCreateModal(force = false) {
    if (createSubmissionInFlight.current && !force) return;
    assetRequestId.current += 1;
    setCreateModalOpen(false);
    setEligibleAssets([]);
    setEligibleAssetsLoading(false);
    setEligibleAssetsError('');
    resetCreateForm();
  }

  function updateCreateEquipmentAssetId(equipmentAssetId: string) {
    setCreateEquipmentAssetId(equipmentAssetId);
    setCreateError('');
    setConflictReview(null);
  }

  function updateDirectAssignmentReason(reason: string) {
    setDirectAssignmentReason(reason);
    setCreateError('');
    setConflictReview(null);
  }

  async function submitDirectAssignment() {
    const normalizedReason = directAssignmentReason.trim();
    if (
      !canCreateAssignment ||
      !createEquipmentAssetId ||
      !normalizedReason ||
      createSubmissionInFlight.current
    ) {
      return;
    }

    createSubmissionInFlight.current = true;
    setCreateSaving(true);
    setCreateError('');
    setConflictReview(null);

    try {
      const response = await createDirectHealthcareEquipmentAssignment({
        caseId,
        equipmentAssetId: createEquipmentAssetId,
        directAssignmentReason: normalizedReason,
      });

      if (response.outcome === 'CONFLICT_REVIEW_REQUIRED') {
        setConflictReview(response);
        return;
      }

      closeCreateModal(true);
      setNotice('Asignación creada correctamente.');

      if (pagination.page === 1) {
        await loadAssignments();
      } else {
        setPagination((current) => ({ ...current, page: 1 }));
      }
    } catch (requestError: unknown) {
      setCreateError(createAssignmentErrorMessage(requestError));
    } finally {
      createSubmissionInFlight.current = false;
      setCreateSaving(false);
    }
  }

  function openReleaseModal(assignment: HealthcareEquipmentAssignment) {
    if (!canReleaseAssignment || assignment.status !== 'RESERVED') return;
    setNotice('');
    setReleaseAssignment(assignment);
    setReleaseReason('');
    setReleaseError('');
  }

  function closeReleaseModal(force = false) {
    if (releaseSubmissionInFlight.current && !force) return;
    setReleaseAssignment(null);
    setReleaseReason('');
    setReleaseError('');
  }

  function updateReleaseReason(reason: string) {
    setReleaseReason(reason);
    setReleaseError('');
  }

  async function submitReleaseAssignment() {
    const normalizedReason = releaseReason.trim();
    const assignmentId = releaseAssignment?.id;

    if (
      !canReleaseAssignment ||
      !assignmentId ||
      releaseAssignment.status !== 'RESERVED' ||
      !normalizedReason ||
      releaseSubmissionInFlight.current
    ) {
      return;
    }

    releaseSubmissionInFlight.current = true;
    setReleaseSaving(true);
    setReleaseError('');

    try {
      await releaseHealthcareEquipmentAssignment(assignmentId, {
        reason: normalizedReason,
      });
      closeReleaseModal(true);
      setNotice('Asignación liberada correctamente.');
      await loadAssignments();
    } catch (requestError: unknown) {
      setReleaseError(releaseAssignmentErrorMessage(requestError));
    } finally {
      releaseSubmissionInFlight.current = false;
      setReleaseSaving(false);
    }
  }

  function resetReplaceForm() {
    setReplacementEquipmentAssetId('');
    setReplacementReason('');
    setReplaceError('');
    setReplaceConflictReview(null);
  }

  function openReplaceModal(assignment: HealthcareEquipmentAssignment) {
    if (!canReplaceAssignment || assignment.status !== 'RESERVED') return;
    resetReplaceForm();
    setNotice('');
    setReplaceAssignment(assignment);
    void loadEligibleAssets();
  }

  function closeReplaceModal(force = false) {
    if (replaceSubmissionInFlight.current && !force) return;
    assetRequestId.current += 1;
    setReplaceAssignment(null);
    setEligibleAssets([]);
    setEligibleAssetsLoading(false);
    setEligibleAssetsError('');
    resetReplaceForm();
  }

  function updateReplacementEquipmentAssetId(equipmentAssetId: string) {
    setReplacementEquipmentAssetId(equipmentAssetId);
    setReplaceError('');
    setReplaceConflictReview(null);
  }

  function updateReplacementReason(reason: string) {
    setReplacementReason(reason);
    setReplaceError('');
    setReplaceConflictReview(null);
  }

  async function submitReplaceAssignment() {
    const normalizedReason = replacementReason.trim();
    const sourceAssignment = replaceAssignment;

    if (
      !canReplaceAssignment ||
      !sourceAssignment ||
      sourceAssignment.status !== 'RESERVED' ||
      !replacementEquipmentAssetId ||
      replacementEquipmentAssetId === sourceAssignment.equipmentAsset.id ||
      !normalizedReason ||
      replaceSubmissionInFlight.current
    ) {
      return;
    }

    replaceSubmissionInFlight.current = true;
    setReplaceSaving(true);
    setReplaceError('');
    setReplaceConflictReview(null);

    try {
      const response = await replaceHealthcareEquipmentAssignment(
        sourceAssignment.id,
        {
          equipmentAssetId: replacementEquipmentAssetId,
          replacementReason: normalizedReason,
        },
      );

      if (response.outcome === 'CONFLICT_REVIEW_REQUIRED') {
        setReplaceConflictReview(response);
        return;
      }

      closeReplaceModal(true);
      setNotice('Asignación reemplazada correctamente.');
      await loadAssignments();
    } catch (requestError: unknown) {
      setReplaceError(replaceAssignmentErrorMessage(requestError));
    } finally {
      replaceSubmissionInFlight.current = false;
      setReplaceSaving(false);
    }
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
            <div className="flex flex-wrap items-center gap-3">
              {canCreateAssignment && !forbidden ? (
                <Button type="button" onClick={openCreateModal}>
                  <Plus aria-hidden="true" size={18} />
                  Nueva asignación
                </Button>
              ) : null}
              <Link
                href="/healthcare-cases"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <ArrowLeft aria-hidden="true" size={18} />
                Volver a casos
              </Link>
            </div>
          }
        />

        {notice ? (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
          >
            {notice}
          </div>
        ) : null}

        {forbidden ? (
          <ForbiddenState />
        ) : (
          <Section
            title="Asignaciones de equipo"
            description="Reservas activas e historial del caso. Los roles autorizados pueden crear, reemplazar y liberar reservas."
          >
            <DataTable
              caption="Asignaciones de equipo del caso"
              rows={assignments}
              columns={assignmentColumns}
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

      <CreateDirectAssignmentModal
        isOpen={createModalOpen}
        assets={eligibleAssets}
        assetsLoading={eligibleAssetsLoading}
        assetsError={eligibleAssetsError}
        equipmentAssetId={createEquipmentAssetId}
        directAssignmentReason={directAssignmentReason}
        saving={createSaving}
        error={createError}
        conflictReview={conflictReview}
        onEquipmentAssetIdChange={updateCreateEquipmentAssetId}
        onDirectAssignmentReasonChange={updateDirectAssignmentReason}
        onRetryAssets={() => void loadEligibleAssets()}
        onClose={closeCreateModal}
        onSubmit={() => void submitDirectAssignment()}
      />

      <ReleaseAssignmentModal
        assignment={releaseAssignment}
        reason={releaseReason}
        saving={releaseSaving}
        error={releaseError}
        onReasonChange={updateReleaseReason}
        onClose={closeReleaseModal}
        onSubmit={() => void submitReleaseAssignment()}
      />

      <ReplaceAssignmentModal
        assignment={replaceAssignment}
        assets={eligibleAssets.filter(
          (asset) => asset.id !== replaceAssignment?.equipmentAsset.id,
        )}
        assetsLoading={eligibleAssetsLoading}
        assetsError={eligibleAssetsError}
        equipmentAssetId={replacementEquipmentAssetId}
        replacementReason={replacementReason}
        saving={replaceSaving}
        error={replaceError}
        conflictReview={replaceConflictReview}
        onEquipmentAssetIdChange={updateReplacementEquipmentAssetId}
        onReplacementReasonChange={updateReplacementReason}
        onRetryAssets={() => void loadEligibleAssets()}
        onClose={closeReplaceModal}
        onSubmit={() => void submitReplaceAssignment()}
      />

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
