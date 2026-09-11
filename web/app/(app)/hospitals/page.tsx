'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthenticatedSession } from '@/app/auth-session';
import {
  canEditHealthcareMasters,
  canManageHealthcareMasterLifecycle,
} from '@/app/erp-role-access';
import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import DataTable, {
  DataTableToolbar,
  type DataTableColumn,
} from '@/app/components/ui/DataTable';
import ForbiddenState from '@/app/components/ui/ForbiddenState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Modal from '@/app/components/ui/Modal';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage, isForbiddenError } from '@/services/errors';

type HealthcareMasterStatus = 'ACTIVE' | 'INACTIVE' | 'ALL';

type Hospital = {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type HospitalDetail = Hospital & {
  notes: string | null;
  affiliationSummary: {
    active: number;
    total: number;
  };
};

type HospitalForm = {
  name: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  contactName: string;
  notes: string;
};

type HospitalFormErrors = Partial<
  Record<'name' | 'city' | 'state' | 'email', string>
>;

type HospitalMutationResponse =
  | {
      outcome: 'DUPLICATE_REVIEW_REQUIRED';
      resourceType: 'HOSPITAL';
      candidates: unknown[];
    }
  | {
      outcome: 'CREATED' | 'UPDATED';
      data: HospitalDetail;
    };

type PaginatedHospitals = {
  items: Hospital[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type ModalMode = 'create' | 'view' | 'edit';

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const SEARCH_DELAY_MS = 300;
const DUPLICATE_REVIEW_MESSAGE =
  'Se encontraron posibles duplicados. No se guardaron cambios. La revisión y confirmación se completarán en el flujo correspondiente.';

const emptyHospitalForm: HospitalForm = {
  name: '',
  city: '',
  state: '',
  address: '',
  phone: '',
  email: '',
  contactName: '',
  notes: '',
};

const hospitalColumns: DataTableColumn<Hospital>[] = [
  {
    id: 'name',
    header: 'Hospital',
    cell: (hospital) => <span className="font-semibold">{hospital.name}</span>,
    priority: 'primary',
    minWidth: 220,
  },
  {
    id: 'location',
    header: 'Ubicación',
    cell: (hospital) => `${hospital.city}, ${hospital.state}`,
    priority: 'primary',
    minWidth: 190,
  },
  {
    id: 'contact',
    header: 'Contacto',
    cell: (hospital) =>
      hospital.contactName || hospital.email || hospital.phone || 'Sin contacto',
    priority: 'secondary',
    minWidth: 210,
  },
  {
    id: 'status',
    header: 'Estado',
    cell: (hospital) => (
      <StatusBadge
        label={hospital.isActive ? 'Activo' : 'Inactivo'}
        tone={hospital.isActive ? 'success' : 'neutral'}
        ariaLabel={`Estado del hospital: ${hospital.isActive ? 'Activo' : 'Inactivo'}`}
      />
    ),
    priority: 'primary',
    minWidth: 110,
  },
];

function normalizeOptionalValue(value: string): string | null {
  return value.trim() || null;
}

function validateHospitalForm(form: HospitalForm): HospitalFormErrors {
  const errors: HospitalFormErrors = {};

  if (!form.name.trim()) {
    errors.name = 'El nombre es obligatorio.';
  }
  if (!form.city.trim()) {
    errors.city = 'La ciudad es obligatoria.';
  }
  if (!form.state.trim()) {
    errors.state = 'El estado es obligatorio.';
  }
  if (
    form.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  ) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }

  return errors;
}

function buildHospitalPayload(
  form: HospitalForm,
  original: HospitalDetail | null,
): Record<string, string | null> {
  const values = {
    name: form.name.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    address: normalizeOptionalValue(form.address),
    phone: normalizeOptionalValue(form.phone),
    email: normalizeOptionalValue(form.email),
    contactName: normalizeOptionalValue(form.contactName),
    notes: normalizeOptionalValue(form.notes),
  };

  if (!original) {
    return values;
  }

  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => {
      const originalValue = original[key as keyof typeof values] ?? null;
      return value !== originalValue;
    }),
  );
}

export default function HospitalsPage() {
  const sessionState = useAuthenticatedSession();
  const currentUserRole =
    sessionState.status === 'success' ? sessionState.user.role : null;
  const canEdit = canEditHealthcareMasters(currentUserRole);
  const canManageLifecycle =
    canManageHealthcareMasterLifecycle(currentUserRole);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState<HealthcareMasterStatus>('ACTIVE');
  const [searchInput, setSearchInput] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [hospitalDetail, setHospitalDetail] = useState<HospitalDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [form, setForm] = useState<HospitalForm>(emptyHospitalForm);
  const [formErrors, setFormErrors] = useState<HospitalFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [lifecycleHospital, setLifecycleHospital] = useState<Hospital | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleError, setLifecycleError] = useState('');
  const listRequestId = useRef(0);
  const modalRequestId = useRef(0);

  const loadHospitals = useCallback(async () => {
    const requestId = ++listRequestId.current;

    try {
      setPageLoading(true);
      setPageError('');
      setForbidden(false);

      const response = await api.get<PaginatedHospitals>(
        '/healthcare/hospitals',
        {
          params: {
            page: pageIndex + 1,
            pageSize,
            status,
            ...(search ? { search } : {}),
            ...(city ? { city } : {}),
            ...(stateFilter ? { state: stateFilter } : {}),
          },
        },
      );

      if (requestId !== listRequestId.current) {
        return;
      }

      setHospitals(response.data.items);
      setPagination(response.data.pagination);
    } catch (error: unknown) {
      if (requestId !== listRequestId.current) {
        return;
      }

      setHospitals([]);
      if (isForbiddenError(error)) {
        setForbidden(true);
        return;
      }
      setPageError(
        getApiErrorMessage(error, 'No fue posible cargar los hospitales.'),
      );
    } finally {
      if (requestId === listRequestId.current) {
        setPageLoading(false);
      }
    }
  }, [city, pageIndex, pageSize, search, stateFilter, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCity(cityInput.trim());
      setStateFilter(stateInput.trim());
      setPageIndex(0);
    }, SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [cityInput, searchInput, stateInput]);

  useEffect(() => {
    if (sessionState.status !== 'success') {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHospitals();
  }, [loadHospitals, sessionState.status]);

  function updateForm(field: keyof HospitalForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function closeModal(force = false) {
    if (saving && !force) {
      return;
    }

    modalRequestId.current += 1;
    setModalMode(null);
    setSelectedHospital(null);
    setHospitalDetail(null);
    setModalError('');
    setFormErrors({});
  }

  function openCreateModal() {
    if (!canEdit) {
      return;
    }

    setSelectedHospital(null);
    setHospitalDetail(null);
    setForm(emptyHospitalForm);
    setFormErrors({});
    setModalError('');
    setModalMode('create');
  }

  async function openHospital(hospital: Hospital, mode: 'view' | 'edit') {
    if (mode === 'edit' && !canEdit) {
      return;
    }

    const requestId = ++modalRequestId.current;
    setSelectedHospital(hospital);
    setHospitalDetail(null);
    setModalError('');
    setModalMode(mode);
    setModalLoading(true);

    try {
      const response = await api.get<HospitalDetail>(
        `/healthcare/hospitals/${hospital.id}`,
      );

      if (requestId !== modalRequestId.current) {
        return;
      }

      setHospitalDetail(response.data);
      if (mode === 'edit') {
        setForm({
          name: response.data.name,
          city: response.data.city,
          state: response.data.state,
          address: response.data.address ?? '',
          phone: response.data.phone ?? '',
          email: response.data.email ?? '',
          contactName: response.data.contactName ?? '',
          notes: response.data.notes ?? '',
        });
        setFormErrors({});
      }
    } catch (error: unknown) {
      if (requestId === modalRequestId.current) {
        setModalError(
          getApiErrorMessage(error, 'No fue posible cargar el hospital.'),
        );
      }
    } finally {
      if (requestId === modalRequestId.current) {
        setModalLoading(false);
      }
    }
  }

  async function saveHospital() {
    if (!canEdit || saving || modalMode === 'view') {
      return;
    }

    const errors = validateHospitalForm(form);
    setFormErrors(errors);
    setModalError('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    const isEditing = modalMode === 'edit';
    if (isEditing && (!selectedHospital || !hospitalDetail)) {
      return;
    }

    const payload = buildHospitalPayload(
      form,
      isEditing ? hospitalDetail : null,
    );

    try {
      setSaving(true);
      const response = isEditing
        ? await api.patch<HospitalMutationResponse>(
            `/healthcare/hospitals/${selectedHospital?.id}`,
            payload,
          )
        : await api.post<HospitalMutationResponse>(
            '/healthcare/hospitals',
            payload,
          );

      if (response.data.outcome === 'DUPLICATE_REVIEW_REQUIRED') {
        setModalError(DUPLICATE_REVIEW_MESSAGE);
        return;
      }

      closeModal(true);
      setNotice(
        isEditing
          ? 'Hospital actualizado correctamente.'
          : 'Hospital registrado correctamente.',
      );
      await loadHospitals();
    } catch (error: unknown) {
      setModalError(
        getApiErrorMessage(
          error,
          isEditing
            ? 'No fue posible actualizar el hospital.'
            : 'No fue posible registrar el hospital.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  function openLifecycleDialog(hospital: Hospital) {
    if (!canManageLifecycle) {
      return;
    }

    setLifecycleHospital(hospital);
    setLifecycleError('');
  }

  async function updateHospitalLifecycle() {
    if (!canManageLifecycle || !lifecycleHospital || lifecycleLoading) {
      return;
    }

    const action = lifecycleHospital.isActive ? 'deactivate' : 'reactivate';

    try {
      setLifecycleLoading(true);
      setLifecycleError('');
      await api.post(
        `/healthcare/hospitals/${lifecycleHospital.id}/${action}`,
      );
      setNotice(
        lifecycleHospital.isActive
          ? 'Hospital desactivado correctamente.'
          : 'Hospital reactivado correctamente.',
      );
      setLifecycleHospital(null);
      await loadHospitals();
    } catch (error: unknown) {
      setLifecycleError(
        getApiErrorMessage(
          error,
          lifecycleHospital.isActive
            ? 'No fue posible desactivar el hospital.'
            : 'No fue posible reactivar el hospital.',
        ),
      );
    } finally {
      setLifecycleLoading(false);
    }
  }

  const isFiltered = Boolean(
    search || city || stateFilter || status !== 'ACTIVE',
  );
  const modalTitle =
    modalMode === 'create'
      ? 'Nuevo hospital'
      : modalMode === 'edit'
        ? 'Editar hospital'
        : 'Detalle del hospital';

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Hospitales"
          description="Consulta y administra el catálogo de hospitales de tu organización."
          action={
            canEdit ? (
              <Button type="button" onClick={openCreateModal}>
                <Plus aria-hidden="true" size={18} />
                Nuevo hospital
              </Button>
            ) : undefined
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
          <Section>
            <DataTable
              caption="Catálogo de hospitales"
              rows={hospitals}
              columns={hospitalColumns}
              getRowId={(hospital) => hospital.id}
              toolbar={
                <div className="space-y-4">
                  <DataTableToolbar
                    search={{
                      value: searchInput,
                      label: 'Buscar hospitales',
                      placeholder: 'Nombre, ciudad o estado',
                      onChange: setSearchInput,
                    }}
                    filters={[
                      {
                        id: 'status',
                        label: 'Estado del registro',
                        value: status,
                        placeholder: 'Selecciona un estado',
                        options: [
                          { value: 'ACTIVE', label: 'Activos' },
                          { value: 'INACTIVE', label: 'Inactivos' },
                          { value: 'ALL', label: 'Todos' },
                        ],
                        onChange: (value) => {
                          setStatus(value as HealthcareMasterStatus);
                          setPageIndex(0);
                        },
                      },
                    ]}
                    onReset={() => {
                      setSearchInput('');
                      setCityInput('');
                      setStateInput('');
                      setSearch('');
                      setCity('');
                      setStateFilter('');
                      setStatus('ACTIVE');
                      setPageIndex(0);
                    }}
                    resetDisabled={
                      !isFiltered && !searchInput && !cityInput && !stateInput
                    }
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Ciudad exacta"
                      value={cityInput}
                      maxLength={100}
                      onChange={(event) => setCityInput(event.target.value)}
                    />
                    <Input
                      label="Estado exacto"
                      value={stateInput}
                      maxLength={100}
                      onChange={(event) => setStateInput(event.target.value)}
                    />
                  </div>
                </div>
              }
              pagination={{
                pageIndex: pagination.page - 1,
                pageSize: pagination.pageSize,
                totalRows: pagination.totalItems,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                onPageChange: setPageIndex,
                onPageSizeChange: (nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPageIndex(0);
                },
              }}
              rowActions={{
                label: (hospital) =>
                  `Acciones del hospital ${hospital.name}`,
                actions: [
                  {
                    id: 'view',
                    label: 'Ver detalle',
                    onSelect: (hospital) =>
                      void openHospital(hospital, 'view'),
                  },
                  ...(canEdit
                    ? [
                        {
                          id: 'edit',
                          label: 'Editar',
                          onSelect: (hospital: Hospital) =>
                            void openHospital(hospital, 'edit'),
                        },
                      ]
                    : []),
                  ...(canManageLifecycle
                    ? [
                        {
                          id: 'lifecycle',
                          label: 'Cambiar estado',
                          onSelect: openLifecycleDialog,
                        },
                      ]
                    : []),
                ],
              }}
              loading={pageLoading}
              loadingMessage="Cargando hospitales..."
              error={
                pageError
                  ? {
                      message: pageError,
                      onRetry: () => void loadHospitals(),
                    }
                  : null
              }
              emptyState={{
                title:
                  status === 'ACTIVE'
                    ? 'Sin hospitales activos'
                    : 'Sin hospitales registrados',
                description:
                  status === 'ACTIVE'
                    ? 'Registra un hospital o consulta los registros inactivos.'
                    : 'No hay hospitales para el estado seleccionado.',
              }}
              filteredEmptyState={{
                title: 'Sin hospitales coincidentes',
                description: 'Ajusta la búsqueda o limpia los filtros.',
              }}
              isFiltered={isFiltered}
            />
          </Section>
        )}
      </PageContainer>

      <Modal isOpen={modalMode !== null} onClose={closeModal} title={modalTitle}>
        {modalLoading ? (
          <Loading message="Cargando hospital..." />
        ) : modalError && modalMode !== 'create' && !hospitalDetail ? (
          <div className="space-y-4">
            <p role="alert" className="text-red-700">
              {modalError}
            </p>
            {selectedHospital ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void openHospital(
                    selectedHospital,
                    modalMode === 'edit' ? 'edit' : 'view',
                  )
                }
              >
                Reintentar
              </Button>
            ) : null}
          </div>
        ) : modalMode === 'view' && hospitalDetail ? (
          <HospitalDetailContent hospital={hospitalDetail} />
        ) : modalMode === 'create' ||
          (modalMode === 'edit' && hospitalDetail) ? (
          <form
            aria-label={
              modalMode === 'edit' ? 'Editar hospital' : 'Nuevo hospital'
            }
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void saveHospital();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nombre"
                value={form.name}
                required
                maxLength={150}
                disabled={saving}
                error={formErrors.name}
                onChange={(event) => updateForm('name', event.target.value)}
              />
              <Input
                label="Nombre de contacto"
                value={form.contactName}
                maxLength={150}
                disabled={saving}
                onChange={(event) =>
                  updateForm('contactName', event.target.value)
                }
              />
              <Input
                label="Ciudad"
                value={form.city}
                required
                maxLength={100}
                disabled={saving}
                error={formErrors.city}
                onChange={(event) => updateForm('city', event.target.value)}
              />
              <Input
                label="Estado"
                value={form.state}
                required
                maxLength={100}
                disabled={saving}
                error={formErrors.state}
                onChange={(event) => updateForm('state', event.target.value)}
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                maxLength={254}
                disabled={saving}
                error={formErrors.email}
                onChange={(event) => updateForm('email', event.target.value)}
              />
              <Input
                label="Teléfono"
                type="tel"
                value={form.phone}
                maxLength={30}
                disabled={saving}
                onChange={(event) => updateForm('phone', event.target.value)}
              />
            </div>

            <Input
              label="Dirección"
              value={form.address}
              maxLength={250}
              disabled={saving}
              onChange={(event) => updateForm('address', event.target.value)}
            />

            <div className="flex flex-col gap-2">
              <label htmlFor="hospital-notes" className="text-sm font-medium text-gray-700">
                Notas
              </label>
              <textarea
                id="hospital-notes"
                value={form.notes}
                rows={4}
                maxLength={1000}
                disabled={saving}
                className="w-full resize-y rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                onChange={(event) => updateForm('notes', event.target.value)}
              />
            </div>

            {modalError ? (
              <div
                role="alert"
                className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900"
              >
                {modalError}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => closeModal()}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={saving}
                loadingText="Guardando..."
                disabled={saving}
              >
                {modalMode === 'edit'
                  ? 'Guardar cambios'
                  : 'Registrar hospital'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={lifecycleHospital !== null}
        title={
          lifecycleHospital?.isActive
            ? 'Desactivar hospital'
            : 'Reactivar hospital'
        }
        message={
          <div className="space-y-3">
            <p>
              ¿{lifecycleHospital?.isActive ? 'Desactivar' : 'Reactivar'} a{' '}
              <span className="font-semibold text-gray-900">
                {lifecycleHospital?.name}
              </span>
              ?
            </p>
            <p className="text-sm text-gray-600">
              El historial y las relaciones existentes se conservarán.
            </p>
            {lifecycleError ? (
              <p role="alert" className="text-sm text-red-700">
                {lifecycleError}
              </p>
            ) : null}
          </div>
        }
        confirmText={
          lifecycleHospital?.isActive ? 'Desactivar' : 'Reactivar'
        }
        loadingText="Actualizando..."
        confirmVariant={lifecycleHospital?.isActive ? 'danger' : 'success'}
        loading={lifecycleLoading}
        onClose={() => {
          if (!lifecycleLoading) {
            setLifecycleHospital(null);
            setLifecycleError('');
          }
        }}
        onConfirm={() => void updateHospitalLifecycle()}
      />
    </>
  );
}

function HospitalDetailContent({ hospital }: { hospital: HospitalDetail }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold text-gray-900">{hospital.name}</p>
          <p className="mt-1 text-sm font-medium text-blue-700">
            {hospital.city}, {hospital.state}
          </p>
        </div>
        <StatusBadge
          label={hospital.isActive ? 'Activo' : 'Inactivo'}
          tone={hospital.isActive ? 'success' : 'neutral'}
        />
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailField
          label="Contacto"
          value={hospital.contactName || 'Sin contacto'}
        />
        <DetailField label="Teléfono" value={hospital.phone || 'Sin teléfono'} />
        <DetailField label="Email" value={hospital.email || 'Sin email'} />
        <DetailField
          label="Dirección"
          value={hospital.address || 'Sin dirección'}
        />
        <DetailField
          label="Afiliaciones activas"
          value={String(hospital.affiliationSummary.active)}
        />
        <DetailField
          label="Afiliaciones totales"
          value={String(hospital.affiliationSummary.total)}
        />
      </dl>

      <div>
        <p className="text-sm font-medium text-gray-600">Notas</p>
        <p className="mt-1 whitespace-pre-wrap text-gray-900">
          {hospital.notes || 'Sin notas'}
        </p>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-600">{label}</dt>
      <dd className="mt-1 text-gray-900">{value}</dd>
    </div>
  );
}
