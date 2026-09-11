'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthenticatedSession } from '@/app/auth-session';
import {
  canEditHealthcareMasters,
  canManageHealthcareMasterLifecycle,
} from '@/app/erp-role-access';
import HealthcareDuplicateReviewDialog, {
  type HealthcareDoctorDuplicateCandidate,
} from '@/app/components/business/HealthcareDuplicateReviewDialog';
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

type Doctor = {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type DoctorDetail = Doctor & {
  notes: string | null;
  affiliationSummary: {
    active: number;
    total: number;
  };
};

type DoctorForm = {
  firstName: string;
  lastName: string;
  specialty: string;
  phone: string;
  email: string;
  notes: string;
};

type DoctorFormErrors = Partial<
  Record<'firstName' | 'lastName' | 'specialty' | 'email', string>
>;

type DoctorMutationResponse =
  | {
      outcome: 'DUPLICATE_REVIEW_REQUIRED';
      resourceType: 'DOCTOR';
      candidates: HealthcareDoctorDuplicateCandidate[];
    }
  | {
      outcome: 'CREATED' | 'UPDATED';
      data: DoctorDetail;
    };

type PaginatedDoctors = {
  items: Doctor[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type ModalMode = 'create' | 'view' | 'edit';

type PendingDoctorDuplicate = {
  payload: Record<string, string | null>;
  isEditing: boolean;
  candidates: HealthcareDoctorDuplicateCandidate[];
};

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const SEARCH_DELAY_MS = 300;
const emptyDoctorForm: DoctorForm = {
  firstName: '',
  lastName: '',
  specialty: '',
  phone: '',
  email: '',
  notes: '',
};

const doctorColumns: DataTableColumn<Doctor>[] = [
  {
    id: 'name',
    header: 'Médico',
    cell: (doctor) => (
      <span className="font-semibold">
        {doctor.firstName} {doctor.lastName}
      </span>
    ),
    priority: 'primary',
    minWidth: 210,
  },
  {
    id: 'specialty',
    header: 'Especialidad',
    cell: (doctor) => doctor.specialty,
    priority: 'primary',
    minWidth: 190,
  },
  {
    id: 'contact',
    header: 'Contacto',
    cell: (doctor) => doctor.email || doctor.phone || 'Sin contacto',
    priority: 'secondary',
    minWidth: 220,
  },
  {
    id: 'status',
    header: 'Estado',
    cell: (doctor) => (
      <StatusBadge
        label={doctor.isActive ? 'Activo' : 'Inactivo'}
        tone={doctor.isActive ? 'success' : 'neutral'}
        ariaLabel={`Estado del médico: ${doctor.isActive ? 'Activo' : 'Inactivo'}`}
      />
    ),
    priority: 'primary',
    minWidth: 110,
  },
];

function normalizeOptionalValue(value: string): string | null {
  return value.trim() || null;
}

function getDoctorName(doctor: Pick<Doctor, 'firstName' | 'lastName'>) {
  return `${doctor.firstName} ${doctor.lastName}`;
}

function validateDoctorForm(form: DoctorForm): DoctorFormErrors {
  const errors: DoctorFormErrors = {};

  if (!form.firstName.trim()) {
    errors.firstName = 'El nombre es obligatorio.';
  }
  if (!form.lastName.trim()) {
    errors.lastName = 'El apellido es obligatorio.';
  }
  if (!form.specialty.trim()) {
    errors.specialty = 'La especialidad es obligatoria.';
  }
  if (
    form.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  ) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }

  return errors;
}

function buildDoctorPayload(
  form: DoctorForm,
  original: DoctorDetail | null,
): Record<string, string | null> {
  const values = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    specialty: form.specialty.trim(),
    phone: normalizeOptionalValue(form.phone),
    email: normalizeOptionalValue(form.email),
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

export default function DoctorsPage() {
  const sessionState = useAuthenticatedSession();
  const currentUserRole =
    sessionState.status === 'success' ? sessionState.user.role : null;
  const canEdit = canEditHealthcareMasters(currentUserRole);
  const canManageLifecycle =
    canManageHealthcareMasterLifecycle(currentUserRole);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
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
  const [search, setSearch] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorDetail, setDoctorDetail] = useState<DoctorDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [form, setForm] = useState<DoctorForm>(emptyDoctorForm);
  const [formErrors, setFormErrors] = useState<DoctorFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] =
    useState<PendingDoctorDuplicate | null>(null);
  const [duplicateError, setDuplicateError] = useState('');
  const [lifecycleDoctor, setLifecycleDoctor] = useState<Doctor | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleError, setLifecycleError] = useState('');
  const listRequestId = useRef(0);
  const modalRequestId = useRef(0);

  const loadDoctors = useCallback(async () => {
    const requestId = ++listRequestId.current;

    try {
      setPageLoading(true);
      setPageError('');
      setForbidden(false);

      const response = await api.get<PaginatedDoctors>('/healthcare/doctors', {
        params: {
          page: pageIndex + 1,
          pageSize,
          status,
          ...(search ? { search } : {}),
        },
      });

      if (requestId !== listRequestId.current) {
        return;
      }

      setDoctors(response.data.items);
      setPagination(response.data.pagination);
    } catch (error: unknown) {
      if (requestId !== listRequestId.current) {
        return;
      }

      setDoctors([]);
      if (isForbiddenError(error)) {
        setForbidden(true);
        return;
      }
      setPageError(
        getApiErrorMessage(error, 'No fue posible cargar los médicos.'),
      );
    } finally {
      if (requestId === listRequestId.current) {
        setPageLoading(false);
      }
    }
  }, [pageIndex, pageSize, search, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPageIndex(0);
    }, SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (sessionState.status !== 'success') {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDoctors();
  }, [loadDoctors, sessionState.status]);

  function updateForm(field: keyof DoctorForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function closeModal(force = false) {
    if (saving && !force) {
      return;
    }

    modalRequestId.current += 1;
    setModalMode(null);
    setSelectedDoctor(null);
    setDoctorDetail(null);
    setModalError('');
    setFormErrors({});
    setPendingDuplicate(null);
    setDuplicateError('');
  }

  function openCreateModal() {
    if (!canEdit) {
      return;
    }

    setSelectedDoctor(null);
    setDoctorDetail(null);
    setForm(emptyDoctorForm);
    setFormErrors({});
    setModalError('');
    setModalMode('create');
  }

  async function openDoctor(doctor: Doctor, mode: 'view' | 'edit') {
    if (mode === 'edit' && !canEdit) {
      return;
    }

    const requestId = ++modalRequestId.current;
    setSelectedDoctor(doctor);
    setDoctorDetail(null);
    setModalError('');
    setModalMode(mode);
    setModalLoading(true);

    try {
      const response = await api.get<DoctorDetail>(
        `/healthcare/doctors/${doctor.id}`,
      );

      if (requestId !== modalRequestId.current) {
        return;
      }

      setDoctorDetail(response.data);
      if (mode === 'edit') {
        setForm({
          firstName: response.data.firstName,
          lastName: response.data.lastName,
          specialty: response.data.specialty,
          phone: response.data.phone ?? '',
          email: response.data.email ?? '',
          notes: response.data.notes ?? '',
        });
        setFormErrors({});
      }
    } catch (error: unknown) {
      if (requestId === modalRequestId.current) {
        setModalError(
          getApiErrorMessage(error, 'No fue posible cargar el médico.'),
        );
      }
    } finally {
      if (requestId === modalRequestId.current) {
        setModalLoading(false);
      }
    }
  }

  async function saveDoctor() {
    if (!canEdit || saving || modalMode === 'view') {
      return;
    }

    const errors = validateDoctorForm(form);
    setFormErrors(errors);
    setModalError('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    const isEditing = modalMode === 'edit';
    if (isEditing && (!selectedDoctor || !doctorDetail)) {
      return;
    }

    const payload = buildDoctorPayload(form, isEditing ? doctorDetail : null);

    try {
      setSaving(true);
      const response = isEditing
        ? await api.patch<DoctorMutationResponse>(
            `/healthcare/doctors/${selectedDoctor?.id}`,
            payload,
          )
        : await api.post<DoctorMutationResponse>(
            '/healthcare/doctors',
            payload,
          );

      if (response.data.outcome === 'DUPLICATE_REVIEW_REQUIRED') {
        setPendingDuplicate({
          payload,
          isEditing,
          candidates: response.data.candidates,
        });
        setDuplicateError('');
        return;
      }

      closeModal(true);
      setNotice(
        isEditing
          ? 'Médico actualizado correctamente.'
          : 'Médico registrado correctamente.',
      );
      await loadDoctors();
    } catch (error: unknown) {
      setModalError(
        getApiErrorMessage(
          error,
          isEditing
            ? 'No fue posible actualizar el médico.'
            : 'No fue posible registrar el médico.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDoctorDuplicate() {
    if (!canEdit || !pendingDuplicate || saving) {
      return;
    }

    const { payload, isEditing } = pendingDuplicate;

    try {
      setSaving(true);
      setDuplicateError('');
      const confirmedPayload = {
        ...payload,
        confirmPossibleDuplicate: true,
      };
      const response = isEditing
        ? await api.patch<DoctorMutationResponse>(
            `/healthcare/doctors/${selectedDoctor?.id}`,
            confirmedPayload,
          )
        : await api.post<DoctorMutationResponse>(
            '/healthcare/doctors',
            confirmedPayload,
          );

      if (response.data.outcome === 'DUPLICATE_REVIEW_REQUIRED') {
        setDuplicateError(
          'La confirmación no pudo completarse. Revisa los datos e intenta nuevamente.',
        );
        return;
      }

      closeModal(true);
      setNotice(
        isEditing
          ? 'Médico actualizado correctamente.'
          : 'Médico registrado correctamente.',
      );
      await loadDoctors();
    } catch (error: unknown) {
      setDuplicateError(
        getApiErrorMessage(
          error,
          isEditing
            ? 'No fue posible confirmar la actualización del médico.'
            : 'No fue posible confirmar el registro del médico.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  function openLifecycleDialog(doctor: Doctor) {
    if (!canManageLifecycle) {
      return;
    }

    setLifecycleDoctor(doctor);
    setLifecycleError('');
  }

  async function updateDoctorLifecycle() {
    if (!canManageLifecycle || !lifecycleDoctor || lifecycleLoading) {
      return;
    }

    const action = lifecycleDoctor.isActive ? 'deactivate' : 'reactivate';

    try {
      setLifecycleLoading(true);
      setLifecycleError('');
      await api.post(
        `/healthcare/doctors/${lifecycleDoctor.id}/${action}`,
      );
      setNotice(
        lifecycleDoctor.isActive
          ? 'Médico desactivado correctamente.'
          : 'Médico reactivado correctamente.',
      );
      setLifecycleDoctor(null);
      await loadDoctors();
    } catch (error: unknown) {
      setLifecycleError(
        getApiErrorMessage(
          error,
          lifecycleDoctor.isActive
            ? 'No fue posible desactivar el médico.'
            : 'No fue posible reactivar el médico.',
        ),
      );
    } finally {
      setLifecycleLoading(false);
    }
  }

  const isFiltered = Boolean(search || status !== 'ACTIVE');
  const modalTitle =
    modalMode === 'create'
      ? 'Nuevo médico'
      : modalMode === 'edit'
        ? 'Editar médico'
        : 'Detalle del médico';

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Médicos"
          description="Consulta y administra el catálogo de médicos de tu organización."
          action={
            canEdit ? (
              <Button type="button" onClick={openCreateModal}>
                <Plus aria-hidden="true" size={18} />
                Nuevo médico
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
              caption="Catálogo de médicos"
              rows={doctors}
              columns={doctorColumns}
              getRowId={(doctor) => doctor.id}
              toolbar={
                <DataTableToolbar
                  search={{
                    value: searchInput,
                    label: 'Buscar médicos',
                    placeholder: 'Nombre, apellido o especialidad',
                    onChange: setSearchInput,
                  }}
                  filters={[
                    {
                      id: 'status',
                      label: 'Estado',
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
                    setSearch('');
                    setStatus('ACTIVE');
                    setPageIndex(0);
                  }}
                  resetDisabled={!isFiltered && !searchInput}
                />
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
                label: (doctor) =>
                  `Acciones del médico ${getDoctorName(doctor)}`,
                actions: [
                  {
                    id: 'view',
                    label: 'Ver detalle',
                    onSelect: (doctor) => void openDoctor(doctor, 'view'),
                  },
                  ...(canEdit
                    ? [
                        {
                          id: 'edit',
                          label: 'Editar',
                          onSelect: (doctor: Doctor) =>
                            void openDoctor(doctor, 'edit'),
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
              loadingMessage="Cargando médicos..."
              error={
                pageError
                  ? {
                      message: pageError,
                      onRetry: () => void loadDoctors(),
                    }
                  : null
              }
              emptyState={{
                title:
                  status === 'ACTIVE'
                    ? 'Sin médicos activos'
                    : 'Sin médicos registrados',
                description:
                  status === 'ACTIVE'
                    ? 'Registra un médico o consulta los registros inactivos.'
                    : 'No hay médicos para el estado seleccionado.',
              }}
              filteredEmptyState={{
                title: 'Sin médicos coincidentes',
                description: 'Ajusta la búsqueda o limpia los filtros.',
              }}
              isFiltered={isFiltered}
            />
          </Section>
        )}
      </PageContainer>

      <Modal isOpen={modalMode !== null} onClose={closeModal} title={modalTitle}>
        {modalLoading ? (
          <Loading message="Cargando médico..." />
        ) : modalError && modalMode !== 'create' && !doctorDetail ? (
          <div className="space-y-4">
            <p role="alert" className="text-red-700">
              {modalError}
            </p>
            {selectedDoctor ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void openDoctor(
                    selectedDoctor,
                    modalMode === 'edit' ? 'edit' : 'view',
                  )
                }
              >
                Reintentar
              </Button>
            ) : null}
          </div>
        ) : modalMode === 'view' && doctorDetail ? (
          <DoctorDetailContent doctor={doctorDetail} />
        ) : modalMode === 'create' || (modalMode === 'edit' && doctorDetail) ? (
          <form
            aria-label={modalMode === 'edit' ? 'Editar médico' : 'Nuevo médico'}
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void saveDoctor();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nombre"
                value={form.firstName}
                required
                maxLength={100}
                disabled={saving}
                error={formErrors.firstName}
                onChange={(event) => updateForm('firstName', event.target.value)}
              />
              <Input
                label="Apellido"
                value={form.lastName}
                required
                maxLength={100}
                disabled={saving}
                error={formErrors.lastName}
                onChange={(event) => updateForm('lastName', event.target.value)}
              />
              <Input
                label="Especialidad"
                value={form.specialty}
                required
                maxLength={150}
                disabled={saving}
                error={formErrors.specialty}
                onChange={(event) => updateForm('specialty', event.target.value)}
              />
              <Input
                label="Teléfono"
                type="tel"
                value={form.phone}
                maxLength={30}
                disabled={saving}
                onChange={(event) => updateForm('phone', event.target.value)}
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
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="doctor-notes" className="text-sm font-medium text-gray-700">
                Notas
              </label>
              <textarea
                id="doctor-notes"
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
                {modalMode === 'edit' ? 'Guardar cambios' : 'Registrar médico'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <HealthcareDuplicateReviewDialog
        isOpen={pendingDuplicate !== null}
        resourceType="DOCTOR"
        candidates={pendingDuplicate?.candidates ?? []}
        loading={saving}
        actionLabel={
          pendingDuplicate?.isEditing
            ? 'Guardar de todos modos'
            : 'Crear de todos modos'
        }
        error={duplicateError}
        onCancel={() => {
          if (!saving) {
            setPendingDuplicate(null);
            setDuplicateError('');
          }
        }}
        onConfirm={() => void confirmDoctorDuplicate()}
      />

      <ConfirmDialog
        isOpen={lifecycleDoctor !== null}
        title={
          lifecycleDoctor?.isActive ? 'Desactivar médico' : 'Reactivar médico'
        }
        message={
          <div className="space-y-3">
            <p>
              ¿{lifecycleDoctor?.isActive ? 'Desactivar' : 'Reactivar'} a{' '}
              <span className="font-semibold text-gray-900">
                {lifecycleDoctor ? getDoctorName(lifecycleDoctor) : ''}
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
        confirmText={lifecycleDoctor?.isActive ? 'Desactivar' : 'Reactivar'}
        loadingText="Actualizando..."
        confirmVariant={lifecycleDoctor?.isActive ? 'danger' : 'success'}
        loading={lifecycleLoading}
        onClose={() => {
          if (!lifecycleLoading) {
            setLifecycleDoctor(null);
            setLifecycleError('');
          }
        }}
        onConfirm={() => void updateDoctorLifecycle()}
      />
    </>
  );
}

function DoctorDetailContent({ doctor }: { doctor: DoctorDetail }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold text-gray-900">
            {getDoctorName(doctor)}
          </p>
          <p className="mt-1 text-sm font-medium text-blue-700">
            {doctor.specialty}
          </p>
        </div>
        <StatusBadge
          label={doctor.isActive ? 'Activo' : 'Inactivo'}
          tone={doctor.isActive ? 'success' : 'neutral'}
        />
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailField label="Teléfono" value={doctor.phone || 'Sin teléfono'} />
        <DetailField label="Email" value={doctor.email || 'Sin email'} />
        <DetailField
          label="Afiliaciones activas"
          value={String(doctor.affiliationSummary.active)}
        />
        <DetailField
          label="Afiliaciones totales"
          value={String(doctor.affiliationSummary.total)}
        />
      </dl>

      <div>
        <p className="text-sm font-medium text-gray-600">Notas</p>
        <p className="mt-1 whitespace-pre-wrap text-gray-900">
          {doctor.notes || 'Sin notas'}
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
