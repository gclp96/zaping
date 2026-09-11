'use client';

import ConfirmDialog from '@/app/components/ui/ConfirmDialog';

export type HealthcareDoctorDuplicateCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};

export type HealthcareHospitalDuplicateCandidate = {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  isActive: boolean;
};

type HealthcareDuplicateReviewDialogProps = {
  isOpen: boolean;
  resourceType: 'DOCTOR' | 'HOSPITAL';
  candidates:
    | HealthcareDoctorDuplicateCandidate[]
    | HealthcareHospitalDuplicateCandidate[];
  loading?: boolean;
  actionLabel?: string;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function DoctorCandidate({
  candidate,
}: {
  candidate: HealthcareDoctorDuplicateCandidate;
}) {
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="font-semibold text-gray-900">
        {candidate.firstName} {candidate.lastName}
      </p>
      <p className="text-sm text-gray-700">{candidate.specialty}</p>
      <p className="text-sm text-gray-600">
        {[candidate.email, candidate.phone].filter(Boolean).join(' · ') ||
          'Sin datos de contacto'}
      </p>
      <p className="mt-1 text-xs font-medium text-gray-600">
        {candidate.isActive ? 'Activo' : 'Inactivo'}
      </p>
    </li>
  );
}

function HospitalCandidate({
  candidate,
}: {
  candidate: HealthcareHospitalDuplicateCandidate;
}) {
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="font-semibold text-gray-900">{candidate.name}</p>
      <p className="text-sm text-gray-700">
        {candidate.city}, {candidate.state}
      </p>
      <p className="text-sm text-gray-600">
        {candidate.address || 'Sin dirección'}
      </p>
      <p className="mt-1 text-xs font-medium text-gray-600">
        {candidate.isActive ? 'Activo' : 'Inactivo'}
      </p>
    </li>
  );
}

export default function HealthcareDuplicateReviewDialog({
  isOpen,
  resourceType,
  candidates,
  loading = false,
  actionLabel = 'Crear de todos modos',
  error = '',
  onCancel,
  onConfirm,
}: HealthcareDuplicateReviewDialogProps) {
  const resourceLabel = resourceType === 'DOCTOR' ? 'médico' : 'hospital';

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Revisar posible duplicado"
      message={
        <div className="space-y-4">
          <p>
            Se encontraron registros similares. Aún no se ha creado ni
            actualizado ningún {resourceLabel}.
          </p>
          <ul aria-label="Posibles duplicados" className="space-y-2">
            {resourceType === 'DOCTOR'
              ? (candidates as HealthcareDoctorDuplicateCandidate[]).map(
                  (candidate) => (
                    <DoctorCandidate
                      key={candidate.id}
                      candidate={candidate}
                    />
                  ),
                )
              : (candidates as HealthcareHospitalDuplicateCandidate[]).map(
                  (candidate) => (
                    <HospitalCandidate
                      key={candidate.id}
                      candidate={candidate}
                    />
                  ),
                )}
          </ul>
          <p className="text-sm text-gray-600">
            Revisa las coincidencias antes de confirmar explícitamente.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      }
      confirmText={actionLabel}
      loadingText="Confirmando..."
      confirmVariant="primary"
      loading={loading}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  );
}
