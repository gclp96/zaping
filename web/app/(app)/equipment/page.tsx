'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';

import { useAuthenticatedSession } from '@/app/auth-session';
import {
  canManageEquipment,
  hasRole,
  WAREHOUSE_ROLES,
} from '@/app/erp-role-access';
import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import DataTable, {
  DataTableToolbar,
  type DataTableColumn,
  type DataTableSelectFilter,
  type SortState,
} from '@/app/components/ui/DataTable';
import Loading from '@/app/components/ui/Loading';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import ForbiddenState from '@/app/components/ui/ForbiddenState';
import { paginateRows, stableSort } from '@/app/client-table.utils';
import { api } from '@/services/api';
import { getApiErrorMessage, isForbiddenError } from '@/services/errors';

import EquipmentCreateModal from './components/EquipmentCreateModal';
import EquipmentDetailModal from './components/EquipmentDetailModal';
import EquipmentInspectionModal from './components/EquipmentInspectionModal';
import EquipmentRetirementModal from './components/EquipmentRetirementModal';
import {
  equipmentMatchesSearch,
  getEquipmentConditionDescriptor,
  getEquipmentLifecycleDescriptor,
  getEquipmentOriginLabel,
  isEquipmentProductEligible,
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
  EquipmentProduct,
  EquipmentRetirementReason,
  CreateEquipmentPayload,
  CreateEquipmentInspectionPayload,
  CreateEquipmentRetirementPayload,
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

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const equipmentCollator = new Intl.Collator('es-MX', {
  numeric: true,
  sensitivity: 'base',
});

function compareEquipment(
  first: EquipmentAsset,
  second: EquipmentAsset,
  columnId: string,
) {
  const firstValue =
    columnId === 'assetCode'
      ? first.assetCode
      : columnId === 'product'
        ? `${first.product.name} ${first.product.sku}`
        : columnId === 'serialNumber'
          ? first.serialNumber || ''
          : columnId === 'lifecycle'
            ? getEquipmentLifecycleDescriptor(first.lifecycle).label
            : columnId === 'condition'
              ? getEquipmentConditionDescriptor(first.condition).label
              : '';
  const secondValue =
    columnId === 'assetCode'
      ? second.assetCode
      : columnId === 'product'
        ? `${second.product.name} ${second.product.sku}`
        : columnId === 'serialNumber'
          ? second.serialNumber || ''
          : columnId === 'lifecycle'
            ? getEquipmentLifecycleDescriptor(second.lifecycle).label
            : columnId === 'condition'
              ? getEquipmentConditionDescriptor(second.condition).label
              : '';

  return equipmentCollator.compare(firstValue, secondValue);
}

export default function EquipmentPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <h1 className="sr-only">Equipos</h1>
          <Loading message="Cargando equipos..." />
        </PageContainer>
      }
    >
      <EquipmentPageContent />
    </Suspense>
  );
}

function EquipmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionState = useAuthenticatedSession();
  const currentUserRole =
    sessionState.status === 'success'
      ? sessionState.user?.role ?? null
      : null;
  const canWrite = canManageEquipment(currentUserRole);
  const sessionForbidsAccess = Boolean(
    sessionState.status === 'success' &&
      currentUserRole &&
      !hasRole(currentUserRole, WAREHOUSE_ROLES),
  );
  const assetId = searchParams.get('assetId')?.trim() || null;
  const openedAssetId = useRef<string | null>(null);
  const [equipment, setEquipment] = useState<EquipmentAsset[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [lifecycleFilter, setLifecycleFilter] =
    useState<LifecycleFilter>('');
  const [conditionFilter, setConditionFilter] =
    useState<ConditionFilter>('');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('');
  const [sorting, setSorting] = useState<SortState>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createProducts, setCreateProducts] = useState<EquipmentProduct[]>([]);
  const [createProductsLoading, setCreateProductsLoading] = useState(false);
  const [createProductsError, setCreateProductsError] = useState('');
  const [createProductId, setCreateProductId] = useState('');
  const [createCondition, setCreateCondition] =
    useState<'' | EquipmentCondition>('');
  const [createSerialNumber, setCreateSerialNumber] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const createSubmissionInFlight = useRef(false);
  const [retirementModalOpen, setRetirementModalOpen] = useState(false);
  const [retirementReason, setRetirementReason] =
    useState<'' | EquipmentRetirementReason>('');
  const [retirementNotes, setRetirementNotes] = useState('');
  const [retirementSaving, setRetirementSaving] = useState(false);
  const [retirementError, setRetirementError] = useState('');
  const retirementSubmissionInFlight = useRef(false);

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

  const sortedEquipment = useMemo(() => {
    if (!sorting) {
      return filteredEquipment;
    }

    return stableSort(
      filteredEquipment,
      (first, second) =>
        compareEquipment(first, second, sorting.columnId),
      sorting.direction,
    );
  }, [filteredEquipment, sorting]);

  const paginatedEquipment = useMemo(() => {
    return paginateRows(sortedEquipment, pageIndex, pageSize);
  }, [pageIndex, pageSize, sortedEquipment]);

  async function loadEquipment(showLoading = true) {
    try {
      if (showLoading) {
        setPageLoading(true);
      }
      setPageError('');

      const response = await api.get<EquipmentAsset[]>('/equipment');

      setEquipment(response.data);
      setPageIndex(0);
    } catch (error: unknown) {
      if (isForbiddenError(error)) {
        setForbidden(true);
        setEquipment([]);
        return;
      }
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

  async function loadCreateProducts() {
    try {
      setCreateProductsLoading(true);
      setCreateProductsError('');
      setCreateProducts([]);

      const response = await api.get<EquipmentProduct[]>('/products');

      setCreateProducts(
        response.data.filter(isEquipmentProductEligible),
      );
    } catch (error: unknown) {
      setCreateProductsError(
        getApiErrorMessage(
          error,
          'No fue posible cargar los productos para equipo.',
        ),
      );
    } finally {
      setCreateProductsLoading(false);
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
    closeRetirementModal();
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

  function closeEquipmentDetailWithUrlCleanup() {
    closeEquipmentDetail();

    if (assetId) {
      router.replace('/equipment');
    }
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

  function resetCreateForm() {
    setCreateProductId('');
    setCreateCondition('');
    setCreateSerialNumber('');
    setCreateError('');
  }

  function openCreateModal() {
    resetCreateForm();
    setCreateModalOpen(true);
    void loadCreateProducts();
  }

  function closeCreateModal() {
    if (createSubmissionInFlight.current) {
      return;
    }

    setCreateModalOpen(false);
    setCreateProducts([]);
    setCreateProductsError('');
    setCreateProductsLoading(false);
    resetCreateForm();
  }

  async function submitEquipment() {
    if (
      !createProductId ||
      !createCondition ||
      createSubmissionInFlight.current
    ) {
      return;
    }

    createSubmissionInFlight.current = true;
    setCreateSaving(true);
    setCreateError('');

    const normalizedSerialNumber = createSerialNumber.trim();
    const payload: CreateEquipmentPayload = {
      productId: createProductId,
      condition: createCondition,
      ...(normalizedSerialNumber
        ? { serialNumber: normalizedSerialNumber }
        : {}),
    };

    try {
      await api.post('/equipment', payload);

      setCreateModalOpen(false);
      setCreateProducts([]);
      resetCreateForm();

      await loadEquipment(false);
    } catch (error: unknown) {
      setCreateError(
        getApiErrorMessage(
          error,
          'No fue posible registrar el equipo.',
        ),
      );
    } finally {
      createSubmissionInFlight.current = false;
      setCreateSaving(false);
    }
  }

  function resetRetirementForm() {
    setRetirementReason('');
    setRetirementNotes('');
    setRetirementError('');
  }

  function openRetirementModal() {
    resetRetirementForm();
    setRetirementModalOpen(true);
  }

  function closeRetirementModal() {
    if (retirementSubmissionInFlight.current) {
      return;
    }

    setRetirementModalOpen(false);
    resetRetirementForm();
  }

  async function submitRetirement() {
    if (
      !selectedEquipment ||
      !retirementReason ||
      (retirementReason === 'OTHER' && !retirementNotes.trim()) ||
      retirementSubmissionInFlight.current
    ) {
      return;
    }

    retirementSubmissionInFlight.current = true;
    setRetirementSaving(true);
    setRetirementError('');

    const normalizedNotes = retirementNotes.trim();
    const payload: CreateEquipmentRetirementPayload = {
      retiredReason: retirementReason,
      ...(normalizedNotes ? { retirementNotes: normalizedNotes } : {}),
    };

    try {
      await api.post(
        `/equipment/${selectedEquipment.id}/retirement`,
        payload,
      );

      setRetirementModalOpen(false);
      resetRetirementForm();

      await Promise.all([
        loadEquipmentDetail(selectedEquipment.id),
        loadEquipmentAvailability(selectedEquipment.id),
        loadEquipmentInspections(selectedEquipment.id),
        loadEquipment(false),
      ]);
    } catch (error: unknown) {
      setRetirementError(
        getApiErrorMessage(
          error,
          'No fue posible retirar el equipo.',
        ),
      );
    } finally {
      retirementSubmissionInFlight.current = false;
      setRetirementSaving(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setLifecycleFilter('');
    setConditionFilter('');
    setOriginFilter('');
    setPageIndex(0);
  }

  const equipmentTableFilters: DataTableSelectFilter[] = [
    {
      id: 'lifecycle',
      label: 'Estado',
      value: lifecycleFilter,
      options: lifecycleOptions,
      placeholder: 'Todos los estados',
      onChange: (value) => {
        setLifecycleFilter(value as LifecycleFilter);
        setPageIndex(0);
      },
    },
    {
      id: 'condition',
      label: 'Condición',
      value: conditionFilter,
      options: conditionOptions,
      placeholder: 'Todas las condiciones',
      onChange: (value) => {
        setConditionFilter(value as ConditionFilter);
        setPageIndex(0);
      },
    },
    {
      id: 'origin',
      label: 'Origen',
      value: originFilter,
      options: originOptions,
      placeholder: 'Todos los orígenes',
      onChange: (value) => {
        setOriginFilter(value as OriginFilter);
        setPageIndex(0);
      },
    },
  ];

  useEffect(() => {
    if (sessionState.status === 'loading') {
      return;
    }

    if (
      sessionState.status === 'success' &&
      currentUserRole &&
      !hasRole(currentUserRole, WAREHOUSE_ROLES)
    ) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEquipment();
  }, [currentUserRole, sessionState.status]);

  useEffect(() => {
    if (!assetId) {
      openedAssetId.current = null;
      return;
    }

    if (
      pageLoading ||
      pageError ||
      openedAssetId.current === assetId
    ) {
      return;
    }

    const item = equipment.find((candidate) => candidate.id === assetId);
    openedAssetId.current = assetId;

    if (item) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openEquipmentDetail(item);
    }
    // The asset-id guard makes this one-shot despite the local modal handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, equipment, pageError, pageLoading]);

  const equipmentDeepLinkMissing = Boolean(
    assetId &&
    !pageLoading &&
    !pageError &&
    !equipment.some((item) => item.id === assetId),
  );

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Equipos"
          description="Consulta las unidades físicas identificables del catálogo."
          action={canWrite ? (
            <Button type="button" onClick={openCreateModal}>
              <Plus aria-hidden="true" size={18} />
              Nuevo equipo
            </Button>
          ) : undefined}
        />

        {forbidden || sessionForbidsAccess ? (
          <ForbiddenState />
        ) : equipmentDeepLinkMissing ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>No se encontró el equipo solicitado.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeEquipmentDetailWithUrlCleanup}
            >
              Volver a equipos
            </Button>
          </div>
        ) : null}

        {!forbidden && !sessionForbidsAccess ? (pageLoading ? (
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
        ) : (
          <Section>
            <DataTable
              caption="Catálogo de equipos"
              rows={paginatedEquipment}
              columns={[
                {
                  id: 'assetCode',
                  header: 'Código',
                  cell: (item) => (
                    <span className="font-semibold text-gray-900">
                      {item.assetCode}
                    </span>
                  ),
                  sortable: true,
                  priority: 'primary',
                  minWidth: 150,
                },
                {
                  id: 'product',
                  header: 'Producto',
                  cell: (item) => (
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.product.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.product.sku}
                      </p>
                    </div>
                  ),
                  sortable: true,
                  priority: 'secondary',
                  minWidth: 210,
                },
                {
                  id: 'serialNumber',
                  header: 'Serie',
                  cell: (item) => item.serialNumber || 'Sin serie',
                  sortable: true,
                  priority: 'secondary',
                  minWidth: 150,
                },
                {
                  id: 'lifecycle',
                  header: 'Estado',
                  cell: (item) => {
                    const descriptor = getEquipmentLifecycleDescriptor(
                      item.lifecycle,
                    );

                    return (
                      <StatusBadge
                        label={descriptor.label}
                        tone={descriptor.tone}
                        ariaLabel={`Estado del equipo ${item.assetCode}: ${descriptor.label}`}
                      />
                    );
                  },
                  sortable: true,
                  priority: 'secondary',
                  minWidth: 125,
                },
                {
                  id: 'condition',
                  header: 'Condición',
                  cell: (item) => {
                    const descriptor = getEquipmentConditionDescriptor(
                      item.condition,
                    );

                    return (
                      <StatusBadge
                        label={descriptor.label}
                        tone={descriptor.tone}
                        ariaLabel={`Condición del equipo ${item.assetCode}: ${descriptor.label}`}
                      />
                    );
                  },
                  sortable: true,
                  priority: 'primary',
                  minWidth: 145,
                },
                {
                  id: 'origin',
                  header: 'Origen',
                  cell: (item) => getEquipmentOriginLabel(item.origin),
                  priority: 'tertiary',
                  minWidth: 170,
                },
                {
                  id: 'batch',
                  header: 'Lote',
                  cell: (item) => item.batch?.lotNumber || 'Sin lote',
                  priority: 'tertiary',
                  minWidth: 140,
                },
                {
                  id: 'actions',
                  header: 'Acciones',
                  cell: (item) => (
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
                  priority: 'primary',
                  minWidth: 90,
                },
              ] satisfies DataTableColumn<EquipmentAsset>[]}
              getRowId={(item) => item.id}
              sorting={{
                state: sorting,
                onChange: setSorting,
              }}
              toolbar={
                equipment.length > 0 ? (
                  <DataTableToolbar
                    search={{
                      value: search,
                      label: 'Buscar equipos',
                      placeholder: 'Código, serie, producto o SKU',
                      onChange: (value) => {
                        setSearch(value);
                        setPageIndex(0);
                      },
                    }}
                    filters={equipmentTableFilters}
                    onReset={clearFilters}
                    resetDisabled={!filtersActive}
                  />
                ) : undefined
              }
              pagination={
                equipment.length > 0
                  ? {
                      pageIndex,
                      pageSize,
                      totalRows: sortedEquipment.length,
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                      onPageChange: setPageIndex,
                      onPageSizeChange: (nextPageSize) => {
                        setPageSize(nextPageSize);
                        setPageIndex(0);
                      },
                    }
                  : undefined
              }
              emptyState={{
                title: 'Sin equipos registrados',
                description: 'Todavía no existen unidades físicas identificables.',
              }}
              filteredEmptyState={{
                title: 'Sin equipos coincidentes',
                description: 'Ningún equipo coincide con los filtros actuales.',
              }}
              isFiltered={filtersActive}
            />
          </Section>
        )) : null}
      </PageContainer>

      <EquipmentCreateModal
        isOpen={createModalOpen}
        products={createProducts}
        productsLoading={createProductsLoading}
        productsError={createProductsError}
        productId={createProductId}
        condition={createCondition}
        serialNumber={createSerialNumber}
        saving={createSaving}
        error={createError}
        onProductIdChange={setCreateProductId}
        onConditionChange={setCreateCondition}
        onSerialNumberChange={setCreateSerialNumber}
        onRetryProducts={() => void loadCreateProducts()}
        onClose={closeCreateModal}
        onSubmit={() => void submitEquipment()}
      />

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
        onClose={closeEquipmentDetailWithUrlCleanup}
        onRetry={retryEquipmentDetail}
        onRetryAvailability={retryEquipmentAvailability}
        onRetryInspections={retryEquipmentInspections}
        onOpenInspection={openInspectionModal}
        onOpenRetirement={openRetirementModal}
      />

      <EquipmentRetirementModal
        isOpen={retirementModalOpen}
        assetCode={selectedEquipment?.assetCode ?? null}
        reason={retirementReason}
        notes={retirementNotes}
        saving={retirementSaving}
        error={retirementError}
        onReasonChange={setRetirementReason}
        onNotesChange={setRetirementNotes}
        onClose={closeRetirementModal}
        onSubmit={() => void submitRetirement()}
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
