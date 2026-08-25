'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import EmptyState from '@/app/components/ui/EmptyState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Select from '@/app/components/ui/Select';
import Table from '@/app/components/ui/Table';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import EquipmentDetailModal from './components/EquipmentDetailModal';
import EquipmentInspectionModal from './components/EquipmentInspectionModal';
import {
  equipmentMatchesSearch,
  getEquipmentConditionDescriptor,
  getEquipmentLifecycleDescriptor,
  getEquipmentOriginLabel,
} from './equipment-display';

import type {
  EquipmentAsset,
  EquipmentAssetDetail,
  EquipmentAvailability,
  EquipmentCondition,
  EquipmentInspection,
  EquipmentInspectionResult,
  EquipmentLifecycle,
  EquipmentOrigin,
  CreateEquipmentInspectionPayload,
} from './types';

type LifecycleFilter = '' | EquipmentLifecycle;
type ConditionFilter = '' | EquipmentCondition;
type OriginFilter = '' | EquipmentOrigin;

const lifecycleOptions = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'RETIRED', label: 'Retirado' },
];

const conditionOptions = [
  { value: 'GOOD', label: 'Bueno' },
  { value: 'INSPECTION_PENDING', label: 'Inspección pendiente' },
  { value: 'DAMAGED', label: 'Dañado' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
];

const originOptions = [
  { value: 'MANUAL', label: 'Registro manual' },
  { value: 'PURCHASE_RECEIPT', label: 'Recepción de compra' },
  { value: 'IMPORT', label: 'Importación' },
  { value: 'INITIAL_MIGRATION', label: 'Migración inicial' },
];

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<EquipmentAsset[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [lifecycleFilter, setLifecycleFilter] =
    useState<LifecycleFilter>('');
  const [conditionFilter, setConditionFilter] =
    useState<ConditionFilter>('');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('');
  const [selectedEquipment, setSelectedEquipment] =
    useState<EquipmentAsset | null>(null);
  const [equipmentDetail, setEquipmentDetail] =
    useState<EquipmentAssetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [availability, setAvailability] =
    useState<EquipmentAvailability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [inspections, setInspections] = useState<EquipmentInspection[]>([]);
  const [inspectionsLoading, setInspectionsLoading] = useState(false);
  const [inspectionsError, setInspectionsError] = useState('');
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [inspectionConditionAfter, setInspectionConditionAfter] =
    useState<'' | EquipmentInspectionResult>('');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [inspectionSaving, setInspectionSaving] = useState(false);
  const [inspectionError, setInspectionError] = useState('');
  const inspectionSubmissionInFlight = useRef(false);

  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      const matchesLifecycle =
        !lifecycleFilter || item.lifecycle === lifecycleFilter;
      const matchesCondition =
        !conditionFilter || item.condition === conditionFilter;
      const matchesOrigin = !originFilter || item.origin === originFilter;

      return (
        matchesLifecycle &&
        matchesCondition &&
        matchesOrigin &&
        equipmentMatchesSearch(item, search)
      );
    });
  }, [conditionFilter, equipment, lifecycleFilter, originFilter, search]);

  const filtersActive = Boolean(
    search.trim() || lifecycleFilter || conditionFilter || originFilter,
  );

  async function loadEquipment(showLoading = true) {
    try {
      if (showLoading) {
        setPageLoading(true);
      }
      setPageError('');

      const response = await api.get<EquipmentAsset[]>('/equipment');

      setEquipment(response.data);
    } catch (error: unknown) {
      console.error(error);
      setPageError(
        getApiErrorMessage(
          error,
          'No fue posible cargar los equipos.',
        ),
      );
    } finally {
      if (showLoading) {
        setPageLoading(false);
      }
    }
  }

  async function loadEquipmentDetail(equipmentId: string) {
    try {
      setDetailLoading(true);
      setDetailError('');
      setEquipmentDetail(null);

      const response = await api.get<EquipmentAssetDetail>(
        `/equipment/${equipmentId}`,
      );

      setEquipmentDetail(response.data);
    } catch (error: unknown) {
      console.error(error);
      setDetailError(
        getApiErrorMessage(
          error,
          'No fue posible cargar el detalle del equipo.',
        ),
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadEquipmentAvailability(equipmentId: string) {
    try {
      setAvailabilityLoading(true);
      setAvailabilityError('');
      setAvailability(null);

      const response = await api.get<EquipmentAvailability>(
        `/equipment/${equipmentId}/availability`,
      );

      setAvailability(response.data);
    } catch (error: unknown) {
      console.error(error);
      setAvailabilityError(
        getApiErrorMessage(
          error,
          'No fue posible consultar la disponibilidad.',
        ),
      );
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function loadEquipmentInspections(equipmentId: string) {
    try {
      setInspectionsLoading(true);
      setInspectionsError('');
      setInspections([]);

      const response = await api.get<EquipmentInspection[]>(
        `/equipment/${equipmentId}/inspections`,
      );

      setInspections(response.data);
    } catch (error: unknown) {
      console.error(error);
      setInspectionsError(
        getApiErrorMessage(
          error,
          'No fue posible cargar las inspecciones.',
        ),
      );
    } finally {
      setInspectionsLoading(false);
    }
  }

  function openEquipmentDetail(item: EquipmentAsset) {
    setSelectedEquipment(item);
    void Promise.all([
      loadEquipmentDetail(item.id),
      loadEquipmentAvailability(item.id),
      loadEquipmentInspections(item.id),
    ]);
  }

  function closeEquipmentDetail() {
    closeInspectionModal();
    setSelectedEquipment(null);
    setEquipmentDetail(null);
    setDetailError('');
    setDetailLoading(false);
    setAvailability(null);
    setAvailabilityError('');
    setAvailabilityLoading(false);
    setInspections([]);
    setInspectionsError('');
    setInspectionsLoading(false);
  }

  function retryEquipmentDetail() {
    if (!selectedEquipment) {
      return;
    }

    void loadEquipmentDetail(selectedEquipment.id);
  }

  function retryEquipmentAvailability() {
    if (!selectedEquipment) {
      return;
    }

    void loadEquipmentAvailability(selectedEquipment.id);
  }

  function retryEquipmentInspections() {
    if (!selectedEquipment) {
      return;
    }

    void loadEquipmentInspections(selectedEquipment.id);
  }

  function openInspectionModal() {
    setInspectionConditionAfter('');
    setInspectionNotes('');
    setInspectionError('');
    setInspectionModalOpen(true);
  }

  function closeInspectionModal() {
    if (inspectionSubmissionInFlight.current) {
      return;
    }

    setInspectionModalOpen(false);
    setInspectionConditionAfter('');
    setInspectionNotes('');
    setInspectionError('');
  }

  async function submitInspection() {
    if (
      !selectedEquipment ||
      !inspectionConditionAfter ||
      inspectionSubmissionInFlight.current
    ) {
      return;
    }

    inspectionSubmissionInFlight.current = true;
    setInspectionSaving(true);
    setInspectionError('');

    const normalizedNotes = inspectionNotes.trim();
    const payload: CreateEquipmentInspectionPayload = {
      conditionAfter: inspectionConditionAfter,
      ...(normalizedNotes ? { notes: normalizedNotes } : {}),
    };

    try {
      await api.post(
        `/equipment/${selectedEquipment.id}/inspections`,
        payload,
      );

      setInspectionModalOpen(false);
      setInspectionConditionAfter('');
      setInspectionNotes('');

      await Promise.all([
        loadEquipmentDetail(selectedEquipment.id),
        loadEquipmentAvailability(selectedEquipment.id),
        loadEquipmentInspections(selectedEquipment.id),
        loadEquipment(false),
      ]);
    } catch (error: unknown) {
      console.error(error);
      setInspectionError(
        getApiErrorMessage(
          error,
          'No fue posible registrar la inspección.',
        ),
      );
    } finally {
      inspectionSubmissionInFlight.current = false;
      setInspectionSaving(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setLifecycleFilter('');
    setConditionFilter('');
    setOriginFilter('');
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEquipment();
  }, []);

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Equipos"
          description="Consulta las unidades físicas identificables del catálogo."
        />

        {pageLoading ? (
          <Loading message="Cargando equipos..." />
        ) : pageError ? (
          <Section>
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{pageError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadEquipment()}
              >
                Reintentar
              </Button>
            </div>
          </Section>
        ) : equipment.length === 0 ? (
          <EmptyState
            title="Sin equipos registrados"
            description="Todavía no existen unidades físicas identificables."
          />
        ) : (
          <Section>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Input
                label="Buscar equipos"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Código, serie, producto o SKU"
              />
              <Select
                label="Estado"
                value={lifecycleFilter}
                onChange={(event) =>
                  setLifecycleFilter(event.target.value as LifecycleFilter)
                }
                options={lifecycleOptions}
                placeholder="Todos los estados"
              />
              <Select
                label="Condición"
                value={conditionFilter}
                onChange={(event) =>
                  setConditionFilter(event.target.value as ConditionFilter)
                }
                options={conditionOptions}
                placeholder="Todas las condiciones"
              />
              <Select
                label="Origen"
                value={originFilter}
                onChange={(event) =>
                  setOriginFilter(event.target.value as OriginFilter)
                }
                options={originOptions}
                placeholder="Todos los orígenes"
              />
            </div>

            {filtersActive ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : null}

            {filteredEquipment.length === 0 ? (
              <EmptyState
                title="Sin equipos coincidentes"
                description="Ningún equipo coincide con los filtros actuales."
              />
            ) : (
              <Table
                headers={[
                  'Código',
                  'Producto',
                  'Serie',
                  'Estado',
                  'Condición',
                  'Origen',
                  'Lote',
                  'Acciones',
                ]}
                data={filteredEquipment.map((item) => {
                  const lifecycleDescriptor =
                    getEquipmentLifecycleDescriptor(item.lifecycle);
                  const conditionDescriptor =
                    getEquipmentConditionDescriptor(item.condition);

                  return {
                    assetCode: (
                      <span className="font-semibold text-gray-900">
                        {item.assetCode}
                      </span>
                    ),
                    product: (
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.product.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {item.product.sku}
                        </p>
                      </div>
                    ),
                    serialNumber: item.serialNumber || 'Sin serie',
                    lifecycle: (
                      <StatusBadge
                        label={lifecycleDescriptor.label}
                        tone={lifecycleDescriptor.tone}
                        ariaLabel={`Estado del equipo ${item.assetCode}: ${lifecycleDescriptor.label}`}
                      />
                    ),
                    condition: (
                      <StatusBadge
                        label={conditionDescriptor.label}
                        tone={conditionDescriptor.tone}
                        ariaLabel={`Condición del equipo ${item.assetCode}: ${conditionDescriptor.label}`}
                      />
                    ),
                    origin: getEquipmentOriginLabel(item.origin),
                    batch: item.batch?.lotNumber || 'Sin lote',
                    actions: (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Ver equipo ${item.assetCode}`}
                        onClick={() => openEquipmentDetail(item)}
                      >
                        Ver
                      </Button>
                    ),
                  };
                })}
              />
            )}
          </Section>
        )}
      </PageContainer>

      <EquipmentDetailModal
        isOpen={Boolean(selectedEquipment)}
        assetCode={selectedEquipment?.assetCode ?? null}
        equipment={equipmentDetail}
        loading={detailLoading}
        error={detailError}
        availability={availability}
        availabilityLoading={availabilityLoading}
        availabilityError={availabilityError}
        inspections={inspections}
        inspectionsLoading={inspectionsLoading}
        inspectionsError={inspectionsError}
        onClose={closeEquipmentDetail}
        onRetry={retryEquipmentDetail}
        onRetryAvailability={retryEquipmentAvailability}
        onRetryInspections={retryEquipmentInspections}
        onOpenInspection={openInspectionModal}
      />

      <EquipmentInspectionModal
        isOpen={inspectionModalOpen}
        assetCode={selectedEquipment?.assetCode ?? null}
        conditionAfter={inspectionConditionAfter}
        notes={inspectionNotes}
        saving={inspectionSaving}
        error={inspectionError}
        onConditionAfterChange={setInspectionConditionAfter}
        onNotesChange={setInspectionNotes}
        onClose={closeInspectionModal}
        onSubmit={() => void submitInspection()}
      />
    </>
  );
}
