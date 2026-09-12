'use client';

import { useState } from 'react';

import HealthcareDuplicateReviewDialog, {
  type HealthcareDoctorDuplicateCandidate,
  type HealthcareHospitalDuplicateCandidate,
} from '@/app/components/business/HealthcareDuplicateReviewDialog';
import type {
  HealthcareDoctorOption,
  HealthcareHospitalOption,
} from '@/app/components/business/HealthcareMasterSelectors';
import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import Modal from '@/app/components/ui/Modal';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

type QuickCreateType = 'DOCTOR' | 'HOSPITAL';

type DoctorDetail = HealthcareDoctorOption & {
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type HospitalDetail = HealthcareHospitalOption & {
  address: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  notes: string | null;
};

type MutationResponse<T, C> =
  | {
      outcome: 'DUPLICATE_REVIEW_REQUIRED';
      resourceType: QuickCreateType;
      candidates: C[];
    }
  | { outcome: 'CREATED'; data: T };

type PendingDuplicate = {
  payload: Record<string, string | null>;
  candidates:
    | HealthcareDoctorDuplicateCandidate[]
    | HealthcareHospitalDuplicateCandidate[];
};

type HealthcareQuickCreateModalProps = {
  isOpen: boolean;
  type: QuickCreateType;
  onClose: () => void;
  onCreated: (
    option: HealthcareDoctorOption | HealthcareHospitalOption,
  ) => void;
};

const emptyDoctorForm = {
  firstName: '',
  lastName: '',
  specialty: '',
};

const emptyHospitalForm = {
  name: '',
  city: '',
  state: '',
};

export default function HealthcareQuickCreateModal({
  isOpen,
  type,
  onClose,
  onCreated,
}: HealthcareQuickCreateModalProps) {
  const [doctorForm, setDoctorForm] = useState(emptyDoctorForm);
  const [hospitalForm, setHospitalForm] = useState(emptyHospitalForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] =
    useState<PendingDuplicate | null>(null);

  function resetAndClose() {
    if (saving) return;
    setDoctorForm(emptyDoctorForm);
    setHospitalForm(emptyHospitalForm);
    setError('');
    setPendingDuplicate(null);
    onClose();
  }

  function buildPayload(): Record<string, string | null> | null {
    if (type === 'DOCTOR') {
      const firstName = doctorForm.firstName.trim();
      const lastName = doctorForm.lastName.trim();
      const specialty = doctorForm.specialty.trim();
      if (!firstName || !lastName || !specialty) {
        setError('Nombre, apellido y especialidad son obligatorios.');
        return null;
      }
      return {
        firstName,
        lastName,
        specialty,
        phone: null,
        email: null,
        notes: null,
      };
    }

    const name = hospitalForm.name.trim();
    const city = hospitalForm.city.trim();
    const state = hospitalForm.state.trim();
    if (!name || !city || !state) {
      setError('Nombre, ciudad y estado son obligatorios.');
      return null;
    }
    return {
      name,
      city,
      state,
      address: null,
      phone: null,
      email: null,
      contactName: null,
      notes: null,
    };
  }

  async function requestCreate(
    payload: Record<string, string | boolean | null>,
    isConfirmation: boolean,
  ) {
    if (type === 'DOCTOR') {
      const response = await api.post<
        MutationResponse<DoctorDetail, HealthcareDoctorDuplicateCandidate>
      >('/healthcare/doctors', payload);
      if (response.data.outcome === 'DUPLICATE_REVIEW_REQUIRED') {
        if (isConfirmation) {
          throw new Error('La confirmación del médico no pudo completarse.');
        }
        setPendingDuplicate({
          payload: payload as Record<string, string | null>,
          candidates: response.data.candidates,
        });
        return;
      }
      onCreated(response.data.data);
    } else {
      const response = await api.post<
        MutationResponse<HospitalDetail, HealthcareHospitalDuplicateCandidate>
      >('/healthcare/hospitals', payload);
      if (response.data.outcome === 'DUPLICATE_REVIEW_REQUIRED') {
        if (isConfirmation) {
          throw new Error('La confirmación del hospital no pudo completarse.');
        }
        setPendingDuplicate({
          payload: payload as Record<string, string | null>,
          candidates: response.data.candidates,
        });
        return;
      }
      onCreated(response.data.data);
    }

    setDoctorForm(emptyDoctorForm);
    setHospitalForm(emptyHospitalForm);
    setPendingDuplicate(null);
    onClose();
  }

  async function submit() {
    if (saving) return;
    const payload = buildPayload();
    if (!payload) return;

    try {
      setSaving(true);
      setError('');
      await requestCreate(payload, false);
    } catch (requestError: unknown) {
      setError(
        getApiErrorMessage(
          requestError,
          type === 'DOCTOR'
            ? 'No fue posible crear el médico.'
            : 'No fue posible crear el hospital.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDuplicate() {
    if (!pendingDuplicate || saving) return;

    try {
      setSaving(true);
      setError('');
      await requestCreate(
        { ...pendingDuplicate.payload, confirmPossibleDuplicate: true },
        true,
      );
    } catch (requestError: unknown) {
      setError(
        getApiErrorMessage(
          requestError,
          'No fue posible confirmar la creación.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={resetAndClose}
        dismissible={!saving}
        title={type === 'DOCTOR' ? 'Crear médico' : 'Crear hospital'}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {type === 'DOCTOR' ? (
            <>
              <Input
                label="Nombre del médico"
                required
                value={doctorForm.firstName}
                onChange={(event) =>
                  setDoctorForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
              />
              <Input
                label="Apellido del médico"
                required
                value={doctorForm.lastName}
                onChange={(event) =>
                  setDoctorForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
              />
              <Input
                label="Especialidad del médico"
                required
                value={doctorForm.specialty}
                onChange={(event) =>
                  setDoctorForm((current) => ({
                    ...current,
                    specialty: event.target.value,
                  }))
                }
              />
            </>
          ) : (
            <>
              <Input
                label="Nombre del hospital"
                required
                value={hospitalForm.name}
                onChange={(event) =>
                  setHospitalForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
              <Input
                label="Ciudad del hospital"
                required
                value={hospitalForm.city}
                onChange={(event) =>
                  setHospitalForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
              />
              <Input
                label="Estado del hospital"
                required
                value={hospitalForm.state}
                onChange={(event) =>
                  setHospitalForm((current) => ({
                    ...current,
                    state: event.target.value,
                  }))
                }
              />
            </>
          )}

          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={resetAndClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              loadingText="Creando..."
            >
              Crear y seleccionar
            </Button>
          </div>
        </form>
      </Modal>

      <HealthcareDuplicateReviewDialog
        isOpen={pendingDuplicate !== null}
        resourceType={type}
        candidates={pendingDuplicate?.candidates ?? []}
        loading={saving}
        error={error}
        onCancel={() => {
          if (!saving) {
            setPendingDuplicate(null);
            setError('');
          }
        }}
        onConfirm={() => void confirmDuplicate()}
      />
    </>
  );
}
