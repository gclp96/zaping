'use client';

import axios from 'axios';
import { ArrowLeft, Ban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuthenticatedSession } from '@/app/auth-session';
import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import ForbiddenState from '@/app/components/ui/ForbiddenState';
import Loading from '@/app/components/ui/Loading';
import Modal from '@/app/components/ui/Modal';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { hasRole, WAREHOUSE_ROLES } from '@/app/erp-role-access';
import { api } from '@/services/api';
import { getApiErrorMessage, isForbiddenError } from '@/services/errors';
import {
  addHealthcareCaseKitItem,
  createHealthcareCaseKit,
  excludeHealthcareCaseKitItem,
  getHealthcareCaseKit,
  type AddHealthcareCaseKitItemPayload,
  type HealthcareCaseKit,
  type HealthcareCaseKitItem,
} from '@/services/healthcare-case-kits';
import {
  listHealthcareEquipmentAssignments,
  type HealthcareEquipmentAssignment,
} from '@/services/healthcare-equipment-assignments';
import {
  listHealthcareRequirements,
  type HealthcareRequirement,
} from '@/services/healthcare-requirements';

import type { HealthcareCase } from '../../types';

type SourceType = AddHealthcareCaseKitItemPayload['sourceType'];

function isCaseKitMissing(error: unknown): boolean {
  return (
    axios.isAxiosError<{ code?: string }>(error) &&
    error.response?.status === 404 &&
    error.response.data?.code === 'CASE_KIT_NOT_FOUND'
  );
}

function personLabel(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`;
}

function KitItemCard({
  item,
  onExclude,
}: {
  item: HealthcareCaseKitItem;
  onExclude?: (item: HealthcareCaseKitItem) => void;
}) {
  const title = item.requirement
    ? `${item.requirement.product.sku} — ${item.requirement.product.name}`
    : item.equipmentAssignment
      ? `${item.equipmentAssignment.equipmentAsset.assetCode} — ${item.equipmentAssignment.equipmentAsset.product.name}`
      : 'Fuente no disponible';

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">{title}</p>
          {item.requirement ? (
            <p className="text-sm text-text-muted">
              Cantidad preparada: {item.preparedQuantity} de{' '}
              {item.requirement.requestedQty}
            </p>
          ) : (
            <p className="text-sm text-text-muted">
              Serie{' '}
              {item.equipmentAssignment?.equipmentAsset.serialNumber ||
                'Sin serie'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            label={
              item.lifecycle === 'EXCLUDED'
                ? 'Excluido'
                : item.stale
                  ? 'Requiere revisión'
                  : 'Vigente'
            }
            tone={
              item.lifecycle === 'EXCLUDED'
                ? 'neutral'
                : item.stale
                  ? 'warning'
                  : 'success'
            }
          />
          {onExclude ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onExclude(item)}
            >
              <Ban aria-hidden="true" size={16} /> Excluir
            </Button>
          ) : null}
        </div>
      </div>
      {item.warnings.length ? (
        <ul className="mt-3 space-y-1 text-sm text-amber-900" role="alert">
          {item.warnings.map((warning) => (
            <li key={warning.code}>{warning.message}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs text-text-muted">
        Agregado por {personLabel(item.addedBy)}
      </p>
      {item.lifecycle === 'EXCLUDED' && item.excludedBy && item.excludedAt ? (
        <div className="mt-3 border-t border-gray-200 pt-3 text-sm text-text-muted">
          <p>
            Excluido por {personLabel(item.excludedBy)} el{' '}
            {new Date(item.excludedAt).toLocaleString('es-MX')}.
          </p>
          <p>Motivo: {item.exclusionReason}</p>
        </div>
      ) : null}
    </article>
  );
}

export default function HealthcareCaseKitPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const session = useAuthenticatedSession();
  const role = session.status === 'success' ? session.user.role : null;
  const canMutate = hasRole(role, WAREHOUSE_ROLES);
  const requestId = useRef(0);
  const submitInFlight = useRef(false);
  const [healthcareCase, setHealthcareCase] = useState<HealthcareCase | null>(
    null,
  );
  const [kit, setKit] = useState<HealthcareCaseKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>('REQUIREMENT');
  const [requirements, setRequirements] = useState<HealthcareRequirement[]>([]);
  const [assignments, setAssignments] = useState<
    HealthcareEquipmentAssignment[]
  >([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [preparedQuantity, setPreparedQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [exclusionItem, setExclusionItem] =
    useState<HealthcareCaseKitItem | null>(null);
  const [exclusionReason, setExclusionReason] = useState('');
  const [exclusionSaving, setExclusionSaving] = useState(false);
  const [exclusionError, setExclusionError] = useState('');

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError('');
    setForbidden(false);
    try {
      const caseResponse = await api.get<HealthcareCase>(
        `/healthcare/cases/${caseId}`,
      );
      let caseKit: HealthcareCaseKit | null = null;
      try {
        caseKit = await getHealthcareCaseKit(caseId);
      } catch (requestError) {
        if (!isCaseKitMissing(requestError)) throw requestError;
      }
      if (current !== requestId.current) return;
      setHealthcareCase(caseResponse.data);
      setKit(caseKit);
    } catch (requestError) {
      if (current !== requestId.current) return;
      if (isForbiddenError(requestError)) setForbidden(true);
      else
        setError(
          getApiErrorMessage(requestError, 'No fue posible cargar el maletín.'),
        );
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (session.status !== 'success') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load, session.status]);

  const materialItems = useMemo(
    () =>
      kit?.items.filter(
        (item) =>
          item.lifecycle === 'ACTIVE' && item.sourceType === 'REQUIREMENT',
      ) ?? [],
    [kit],
  );
  const equipmentItems = useMemo(
    () =>
      kit?.items.filter((item) => item.sourceType === 'EQUIPMENT_ASSIGNMENT') ??
      [],
    [kit],
  );
  const activeEquipmentItems = useMemo(
    () => equipmentItems.filter((item) => item.lifecycle === 'ACTIVE'),
    [equipmentItems],
  );
  const excludedItems = useMemo(
    () => kit?.items.filter((item) => item.lifecycle === 'EXCLUDED') ?? [],
    [kit],
  );
  const existingRequirementIds = useMemo(
    () =>
      new Set(
        materialItems.map((item) => item.requirement?.id).filter(Boolean),
      ),
    [materialItems],
  );
  const existingAssignmentIds = useMemo(
    () =>
      new Set(
        activeEquipmentItems
          .map((item) => item.equipmentAssignment?.id)
          .filter(Boolean),
      ),
    [activeEquipmentItems],
  );
  const materialCandidates = requirements.filter(
    (item) =>
      item.lifecycle === 'ACTIVE' &&
      item.product.isActive &&
      item.product.inventoryTracking === 'QUANTITY' &&
      !existingRequirementIds.has(item.id),
  );
  const equipmentCandidates = assignments.filter(
    (item) => item.status === 'RESERVED' && !existingAssignmentIds.has(item.id),
  );

  async function createKit() {
    if (!canMutate || creating || healthcareCase?.status === 'CANCELLED')
      return;
    setCreating(true);
    setError('');
    try {
      setKit(await createHealthcareCaseKit(caseId));
      setNotice('Maletín creado correctamente.');
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, 'No fue posible crear el maletín.'),
      );
    } finally {
      setCreating(false);
    }
  }

  async function openAddModal() {
    if (!canMutate || !kit) return;
    setModalOpen(true);
    setCandidatesLoading(true);
    setFormError('');
    setSelectedSourceId('');
    try {
      const [requirementItems, assignmentResponse] = await Promise.all([
        listHealthcareRequirements(caseId, 'ALL'),
        listHealthcareEquipmentAssignments(caseId, 1, 100),
      ]);
      setRequirements(requirementItems);
      setAssignments(assignmentResponse.items);
    } catch (requestError) {
      setFormError(
        getApiErrorMessage(
          requestError,
          'No fue posible cargar el contenido elegible.',
        ),
      );
    } finally {
      setCandidatesLoading(false);
    }
  }

  async function addItem() {
    if (!kit || !selectedSourceId || saving || submitInFlight.current) return;
    const quantity = Number(preparedQuantity);
    if (
      sourceType === 'REQUIREMENT' &&
      (!Number.isInteger(quantity) || quantity < 1)
    ) {
      setFormError('Captura una cantidad preparada válida.');
      return;
    }
    submitInFlight.current = true;
    setSaving(true);
    setFormError('');
    try {
      await addHealthcareCaseKitItem(
        kit.id,
        sourceType === 'REQUIREMENT'
          ? {
              sourceType,
              requirementId: selectedSourceId,
              preparedQuantity: quantity,
            }
          : { sourceType, equipmentAssignmentId: selectedSourceId },
      );
      setModalOpen(false);
      setNotice('Contenido agregado al maletín.');
      await load();
    } catch (requestError) {
      setFormError(
        getApiErrorMessage(
          requestError,
          'No fue posible agregar el contenido.',
        ),
      );
    } finally {
      submitInFlight.current = false;
      setSaving(false);
    }
  }

  function openExclusionModal(item: HealthcareCaseKitItem) {
    setExclusionItem(item);
    setExclusionReason('');
    setExclusionError('');
  }

  async function excludeItem() {
    const reason = exclusionReason.trim();
    if (!kit || !exclusionItem || !reason || exclusionSaving) return;
    setExclusionSaving(true);
    setExclusionError('');
    try {
      await excludeHealthcareCaseKitItem(kit.id, exclusionItem.id, reason);
      setExclusionItem(null);
      setExclusionReason('');
      setNotice('Contenido excluido; el historial se conservó.');
      await load();
    } catch (requestError) {
      setExclusionError(
        getApiErrorMessage(
          requestError,
          'No fue posible excluir el contenido.',
        ),
      );
    } finally {
      setExclusionSaving(false);
    }
  }

  const candidates =
    sourceType === 'REQUIREMENT' ? materialCandidates : equipmentCandidates;

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Maletín del caso"
          description={
            healthcareCase
              ? `${healthcareCase.folio} — ${healthcareCase.title}`
              : 'Preparación lógica de materiales y equipos.'
          }
          action={
            <div className="flex flex-wrap gap-3">
              {canMutate && kit && healthcareCase?.status !== 'CANCELLED' ? (
                <Button type="button" onClick={() => void openAddModal()}>
                  <Plus aria-hidden="true" size={18} /> Agregar contenido
                </Button>
              ) : null}
              <Link
                href="/healthcare-cases"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-100"
              >
                <ArrowLeft aria-hidden="true" size={18} /> Volver a casos
              </Link>
            </div>
          }
        />

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Preparación lógica no reservante.</strong> Las cantidades no
          descuentan stock ni lotes, no crean movimientos de inventario y no
          garantizan disponibilidad física.
        </div>
        {notice ? (
          <p
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-900"
          >
            {notice}
          </p>
        ) : null}
        {loading ? (
          <Loading message="Cargando maletín..." />
        ) : forbidden ? (
          <ForbiddenState />
        ) : error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          >
            <p>{error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load()}
            >
              Reintentar
            </Button>
          </div>
        ) : !kit ? (
          <Section
            title="Sin maletín"
            description="Este caso todavía no tiene un borrador de preparación."
          >
            {canMutate && healthcareCase?.status !== 'CANCELLED' ? (
              <Button
                type="button"
                loading={creating}
                onClick={() => void createKit()}
              >
                Crear maletín
              </Button>
            ) : (
              <p className="text-sm text-text-muted">Vista de sólo lectura.</p>
            )}
          </Section>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <StatusBadge label="Borrador" tone="neutral" />
              <span className="text-sm text-text-muted">
                Creado por {personLabel(kit.createdBy)}
              </span>
            </div>
            <Section
              title="Materiales"
              description="Cantidades planeadas de requerimientos QUANTITY."
            >
              <div className="space-y-3">
                {materialItems.length ? (
                  materialItems.map((item) => (
                    <KitItemCard
                      key={item.id}
                      item={item}
                      onExclude={
                        canMutate &&
                        kit.status === 'DRAFT' &&
                        healthcareCase?.status !== 'CANCELLED'
                          ? openExclusionModal
                          : undefined
                      }
                    />
                  ))
                ) : (
                  <p className="text-sm text-text-muted">
                    Sin materiales agregados.
                  </p>
                )}
              </div>
            </Section>
            <Section
              title="Equipos"
              description="Asignaciones RESERVED ya vinculadas al caso."
            >
              <div className="space-y-3">
                {activeEquipmentItems.length ? (
                  activeEquipmentItems.map((item) => (
                    <KitItemCard
                      key={item.id}
                      item={item}
                      onExclude={
                        canMutate &&
                        kit.status === 'DRAFT' &&
                        healthcareCase?.status !== 'CANCELLED'
                          ? openExclusionModal
                          : undefined
                      }
                    />
                  ))
                ) : (
                  <p className="text-sm text-text-muted">
                    Sin equipos agregados.
                  </p>
                )}
              </div>
            </Section>
            {excludedItems.length ? (
              <Section
                title="Historial excluido"
                description="Estos elementos se conservan para trazabilidad y no forman parte del contenido activo."
              >
                <div className="space-y-3">
                  {excludedItems.map((item) => (
                    <KitItemCard key={item.id} item={item} />
                  ))}
                </div>
              </Section>
            ) : null}
          </div>
        )}
      </PageContainer>

      <Modal
        isOpen={modalOpen}
        title="Agregar contenido"
        onClose={() => !saving && setModalOpen(false)}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void addItem();
          }}
        >
          <label className="block text-sm font-medium text-gray-700">
            Tipo de contenido
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={sourceType}
              onChange={(event) => {
                setSourceType(event.target.value as SourceType);
                setSelectedSourceId('');
                setFormError('');
              }}
            >
              <option value="REQUIREMENT">Material</option>
              <option value="EQUIPMENT_ASSIGNMENT">Equipo asignado</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Fuente
            <select
              required
              disabled={candidatesLoading}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={selectedSourceId}
              onChange={(event) => setSelectedSourceId(event.target.value)}
            >
              <option value="">Selecciona una opción</option>
              {candidates.map((candidate) =>
                sourceType === 'REQUIREMENT' ? (
                  <option key={candidate.id} value={candidate.id}>
                    {(candidate as HealthcareRequirement).product.sku} —{' '}
                    {(candidate as HealthcareRequirement).product.name}
                  </option>
                ) : (
                  <option key={candidate.id} value={candidate.id}>
                    {
                      (candidate as HealthcareEquipmentAssignment)
                        .equipmentAsset.assetCode
                    }{' '}
                    —{' '}
                    {
                      (candidate as HealthcareEquipmentAssignment)
                        .equipmentAsset.product.name
                    }
                  </option>
                ),
              )}
            </select>
          </label>
          {sourceType === 'REQUIREMENT' ? (
            <label className="block text-sm font-medium text-gray-700">
              Cantidad preparada
              <input
                required
                min={1}
                type="number"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={preparedQuantity}
                onChange={(event) => setPreparedQuantity(event.target.value)}
              />
            </label>
          ) : null}
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Agregar contenido no reserva ni descuenta inventario.
          </p>
          {formError ? (
            <p role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving} disabled={!selectedSourceId}>
              Agregar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(exclusionItem)}
        title="Excluir contenido"
        onClose={() => !exclusionSaving && setExclusionItem(null)}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void excludeItem();
          }}
        >
          <p className="text-sm text-gray-700">
            El contenido dejará de formar parte del maletín activo, pero su
            historial, actor, fecha y motivo permanecerán visibles.
          </p>
          <label className="block text-sm font-medium text-gray-700">
            Motivo
            <textarea
              required
              maxLength={1000}
              className="mt-1 min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={exclusionReason}
              onChange={(event) => setExclusionReason(event.target.value)}
            />
          </label>
          {exclusionError ? (
            <p role="alert" className="text-sm text-red-700">
              {exclusionError}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={exclusionSaving}
              onClick={() => setExclusionItem(null)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={exclusionSaving}
              disabled={!exclusionReason.trim()}
            >
              Excluir
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
