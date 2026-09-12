'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuthenticatedSession } from '@/app/auth-session';
import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import DataTable, {
  DataTableToolbar,
  type DataTableColumn,
  type DataTableRowActions,
} from '@/app/components/ui/DataTable';
import ForbiddenState from '@/app/components/ui/ForbiddenState';
import Modal from '@/app/components/ui/Modal';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { canEditHealthcareCases } from '@/app/erp-role-access';
import { api } from '@/services/api';
import { getApiErrorMessage, isForbiddenError } from '@/services/errors';

import HealthcareCaseFormModal from './components/HealthcareCaseFormModal';
import type { HealthcareCase, HealthcareCaseStatus } from './types';

const statusLabels: Record<HealthcareCaseStatus, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programado',
  CANCELLED: 'Cancelado',
};

const statusTones = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  CANCELLED: 'danger',
} as const;

function doctorLabel(healthcareCase: HealthcareCase) {
  if (!healthcareCase.doctor) return 'Sin médico';
  return `${healthcareCase.doctor.firstName} ${healthcareCase.doctor.lastName}`;
}

function hospitalLabel(healthcareCase: HealthcareCase) {
  return healthcareCase.hospital?.name ?? 'Sin hospital';
}

const columns: DataTableColumn<HealthcareCase>[] = [
  {
    id: 'folio',
    header: 'Folio',
    cell: (healthcareCase) => (
      <span className="font-semibold">{healthcareCase.folio}</span>
    ),
    minWidth: 140,
  },
  {
    id: 'title',
    header: 'Caso',
    cell: (healthcareCase) => healthcareCase.title,
    minWidth: 220,
  },
  {
    id: 'doctor',
    header: 'Médico',
    cell: doctorLabel,
    priority: 'secondary',
    minWidth: 190,
  },
  {
    id: 'hospital',
    header: 'Hospital',
    cell: hospitalLabel,
    priority: 'secondary',
    minWidth: 190,
  },
  {
    id: 'status',
    header: 'Estado',
    cell: (healthcareCase) => (
      <StatusBadge
        label={statusLabels[healthcareCase.status]}
        tone={statusTones[healthcareCase.status]}
      />
    ),
    minWidth: 130,
  },
];

export default function HealthcareCasesPage() {
  const sessionState = useAuthenticatedSession();
  const canEdit = canEditHealthcareCases(
    sessionState.status === 'success' ? sessionState.user.role : null,
  );
  const [cases, setCases] = useState<HealthcareCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [viewCase, setViewCase] = useState<HealthcareCase | null>(null);
  const [formCase, setFormCase] = useState<HealthcareCase | null | undefined>(
    undefined,
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setForbidden(false);
      const response = await api.get<HealthcareCase[]>('/healthcare/cases');
      setCases(response.data);
    } catch (requestError: unknown) {
      setCases([]);
      if (isForbiddenError(requestError)) {
        setForbidden(true);
      } else {
        setError(
          getApiErrorMessage(
            requestError,
            'No fue posible cargar los casos de salud.',
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionState.status !== 'success') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCases();
  }, [loadCases, sessionState.status]);

  const filteredCases = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-MX');
    if (!term) return cases;
    return cases.filter((healthcareCase) =>
      [
        healthcareCase.folio,
        healthcareCase.title,
        doctorLabel(healthcareCase),
        hospitalLabel(healthcareCase),
      ].some((value) => value.toLocaleLowerCase('es-MX').includes(term)),
    );
  }, [cases, search]);

  const rowActions: DataTableRowActions<HealthcareCase> = {
    label: (healthcareCase) =>
      `Acciones del caso ${healthcareCase.folio}`,
    actions: [
      {
        id: 'view',
        label: 'Ver detalle',
        onSelect: setViewCase,
      },
      ...(canEdit
        ? [
            {
              id: 'edit',
              label: 'Editar',
              onSelect: (healthcareCase: HealthcareCase) => {
                setFormError('');
                setFormCase(healthcareCase);
              },
            },
          ]
        : []),
    ],
  };

  async function saveCase(payload: Record<string, string | null>) {
    if (!canEdit || saving || formCase === undefined) return;

    const isEditing = formCase !== null;
    try {
      setSaving(true);
      setFormError('');
      if (isEditing) {
        await api.patch(`/healthcare/cases/${formCase.id}`, payload);
      } else {
        await api.post('/healthcare/cases', payload);
      }
      setFormCase(undefined);
      setNotice(
        isEditing
          ? 'Caso actualizado correctamente.'
          : 'Caso registrado correctamente.',
      );
      await loadCases();
    } catch (requestError: unknown) {
      setFormError(
        getApiErrorMessage(
          requestError,
          isEditing
            ? 'No fue posible actualizar el caso.'
            : 'No fue posible registrar el caso.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const sessionKey =
    sessionState.status === 'success'
      ? `${sessionState.user.id}:${sessionState.user.companyId}`
      : 'loading';

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Casos de salud"
          description="Consulta los casos y administra sus relaciones con médicos y hospitales."
          action={
            canEdit ? (
              <Button
                type="button"
                onClick={() => {
                  setFormError('');
                  setFormCase(null);
                }}
              >
                <Plus aria-hidden="true" size={18} />
                Nuevo caso
              </Button>
            ) : undefined
          }
        />

        {notice ? (
          <p
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-900"
          >
            {notice}
          </p>
        ) : null}

        {forbidden ? (
          <ForbiddenState />
        ) : (
          <Section title="Casos">
            <DataTable
              caption="Listado de casos de salud"
              rows={filteredCases}
              columns={columns}
              getRowId={(healthcareCase) => healthcareCase.id}
              rowActions={rowActions}
              toolbar={
                <DataTableToolbar
                  search={{
                    value: search,
                    onChange: setSearch,
                    label: 'Buscar casos',
                    placeholder: 'Folio, título, médico u hospital',
                  }}
                />
              }
              loading={loading}
              loadingMessage="Cargando casos de salud..."
              error={
                error ? { message: error, onRetry: () => void loadCases() } : null
              }
              emptyState={{
                title: 'Sin casos de salud',
                description: 'No hay casos registrados todavía.',
              }}
              filteredEmptyState={{
                title: 'Sin coincidencias',
                description: 'Ajusta la búsqueda para encontrar casos.',
              }}
              isFiltered={Boolean(search.trim())}
            />
          </Section>
        )}
      </PageContainer>

      <Modal
        isOpen={viewCase !== null}
        title="Detalle del caso"
        onClose={() => setViewCase(null)}
      >
        {viewCase ? <HealthcareCaseDetail healthcareCase={viewCase} /> : null}
      </Modal>

      {formCase !== undefined ? (
        <HealthcareCaseFormModal
          key={`${formCase?.id ?? 'new'}-${sessionKey}`}
          isOpen
          healthcareCase={formCase}
          sessionKey={sessionKey}
          saving={saving}
          error={formError}
          onClose={() => {
            if (!saving) setFormCase(undefined);
          }}
          onSave={(payload) => void saveCase(payload)}
        />
      ) : null}
    </>
  );
}

function HealthcareCaseDetail({
  healthcareCase,
}: {
  healthcareCase: HealthcareCase;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-gray-600">Folio</p>
        <p className="font-semibold text-gray-900">{healthcareCase.folio}</p>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600">Título</p>
        <p className="text-gray-900">{healthcareCase.title}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RelationDetail
          label="Médico"
          value={
            healthcareCase.doctor
              ? `${doctorLabel(healthcareCase)} — ${healthcareCase.doctor.specialty}`
              : 'Sin médico'
          }
          inactive={healthcareCase.doctor?.isActive === false}
        />
        <RelationDetail
          label="Hospital"
          value={
            healthcareCase.hospital
              ? `${hospitalLabel(healthcareCase)} — ${healthcareCase.hospital.city}, ${healthcareCase.hospital.state}`
              : 'Sin hospital'
          }
          inactive={healthcareCase.hospital?.isActive === false}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600">
          Descripción del procedimiento
        </p>
        <p className="whitespace-pre-wrap text-gray-900">
          {healthcareCase.procedureDescription || 'Sin descripción'}
        </p>
      </div>
    </div>
  );
}

function RelationDetail({
  label,
  value,
  inactive,
}: {
  label: string;
  value: string;
  inactive: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-gray-900">{value}</p>
      {inactive ? (
        <p className="text-xs font-medium text-amber-800">
          Inactivo (histórico)
        </p>
      ) : null}
    </div>
  );
}
