'use client';

import { useEffect, useRef, useState } from 'react';

import {
  HealthcareDoctorSelector,
  HealthcareHospitalSelector,
  type HealthcareDoctorOption,
  type HealthcareHospitalOption,
} from '@/app/components/business/HealthcareMasterSelectors';
import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import Modal from '@/app/components/ui/Modal';
import { api } from '@/services/api';

import HealthcareQuickCreateModal from './HealthcareQuickCreateModal';
import type {
  HealthcareCase,
  HealthcareCaseFormValue,
} from '../types';

type AffiliationListResponse = {
  items: Array<{ hospitalId: string; isActive: boolean }>;
};

type HealthcareCaseFormModalProps = {
  isOpen: boolean;
  healthcareCase: HealthcareCase | null;
  sessionKey: string;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: Record<string, string | null>) => void;
};

function createInitialForm(
  healthcareCase: HealthcareCase | null,
): HealthcareCaseFormValue {
  return {
    title: healthcareCase?.title ?? '',
    procedureDescription: healthcareCase?.procedureDescription ?? '',
    doctorId: healthcareCase?.doctorId ?? null,
    hospitalId: healthcareCase?.hospitalId ?? null,
    doctor: healthcareCase?.doctor ?? null,
    hospital: healthcareCase?.hospital ?? null,
    doctorTouched: false,
    hospitalTouched: false,
  };
}

function buildCasePayload(
  form: HealthcareCaseFormValue,
  healthcareCase: HealthcareCase | null,
): Record<string, string | null> {
  const title = form.title.trim();
  const procedureDescription = form.procedureDescription.trim() || null;

  if (!healthcareCase) {
    return {
      title,
      procedureDescription,
      ...(form.doctorId ? { doctorId: form.doctorId } : {}),
      ...(form.hospitalId ? { hospitalId: form.hospitalId } : {}),
    };
  }

  const payload: Record<string, string | null> = {};
  if (title !== healthcareCase.title) payload.title = title;
  if (procedureDescription !== healthcareCase.procedureDescription) {
    payload.procedureDescription = procedureDescription;
  }
  if (form.doctorTouched && form.doctorId !== healthcareCase.doctorId) {
    payload.doctorId = form.doctorId;
  }
  if (form.hospitalTouched && form.hospitalId !== healthcareCase.hospitalId) {
    payload.hospitalId = form.hospitalId;
  }

  return payload;
}

export default function HealthcareCaseFormModal({
  isOpen,
  healthcareCase,
  sessionKey,
  saving,
  error,
  onClose,
  onSave,
}: HealthcareCaseFormModalProps) {
  const [form, setForm] = useState(() => createInitialForm(healthcareCase));
  const [formError, setFormError] = useState('');
  const [quickCreateType, setQuickCreateType] = useState<
    'DOCTOR' | 'HOSPITAL' | null
  >(null);
  const [affiliationState, setAffiliationState] = useState<
    'idle' | 'loading' | 'found' | 'missing' | 'error'
  >('idle');
  const affiliationRequestId = useRef(0);

  useEffect(() => {
    if (!form.doctorId || !form.hospitalId) {
      affiliationRequestId.current += 1;
      // This state mirrors selector choices and must clear synchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAffiliationState('idle');
      return;
    }

    const requestId = ++affiliationRequestId.current;
    setAffiliationState('loading');
    void api
      .get<AffiliationListResponse>(
        `/healthcare/doctors/${form.doctorId}/hospitals`,
        { params: { page: 1, pageSize: 100, status: 'ACTIVE' } },
      )
      .then((response) => {
        if (requestId !== affiliationRequestId.current) return;
        setAffiliationState(
          response.data.items.some(
            (affiliation) =>
              affiliation.isActive &&
              affiliation.hospitalId === form.hospitalId,
          )
            ? 'found'
            : 'missing',
        );
      })
      .catch(() => {
        if (requestId === affiliationRequestId.current) {
          setAffiliationState('error');
        }
      });

    return () => {
      affiliationRequestId.current += 1;
    };
  }, [form.doctorId, form.hospitalId]);

  function submit() {
    if (!form.title.trim()) {
      setFormError('El título es obligatorio.');
      return;
    }
    setFormError('');
    onSave(buildCasePayload(form, healthcareCase));
  }

  function handleQuickCreated(
    option: HealthcareDoctorOption | HealthcareHospitalOption,
  ) {
    if (quickCreateType === 'DOCTOR') {
      const doctor = option as HealthcareDoctorOption;
      setForm((current) => ({
        ...current,
        doctorId: doctor.id,
        doctor,
        doctorTouched: true,
      }));
    } else {
      const hospital = option as HealthcareHospitalOption;
      setForm((current) => ({
        ...current,
        hospitalId: hospital.id,
        hospital,
        hospitalTouched: true,
      }));
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        dismissible={!saving}
        title={healthcareCase ? 'Editar caso de salud' : 'Nuevo caso de salud'}
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input
            label="Título"
            required
            value={form.title}
            error={formError}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                title: event.target.value,
              }));
              setFormError('');
            }}
          />

          <label className="block font-medium text-gray-700">
            Descripción del procedimiento
            <textarea
              aria-label="Descripción del procedimiento"
              value={form.procedureDescription}
              rows={3}
              className="mt-2 w-full rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  procedureDescription: event.target.value,
                }))
              }
            />
          </label>

          <HealthcareDoctorSelector
            key={`doctor-${sessionKey}`}
            sessionKey={sessionKey}
            value={form.doctorId}
            currentValue={form.doctor}
            onQuickCreate={() => setQuickCreateType('DOCTOR')}
            onChange={(doctorId, doctor) =>
              setForm((current) => ({
                ...current,
                doctorId,
                doctor,
                doctorTouched: true,
              }))
            }
          />

          <HealthcareHospitalSelector
            key={`hospital-${sessionKey}`}
            sessionKey={sessionKey}
            value={form.hospitalId}
            currentValue={form.hospital}
            onQuickCreate={() => setQuickCreateType('HOSPITAL')}
            onChange={(hospitalId, hospital) =>
              setForm((current) => ({
                ...current,
                hospitalId,
                hospital,
                hospitalTouched: true,
              }))
            }
          />

          {affiliationState === 'loading' ? (
            <p role="status" className="text-sm text-gray-600">
              Verificando afiliación activa...
            </p>
          ) : affiliationState === 'missing' ? (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              No hay una afiliación activa entre el médico y el hospital.
              Puedes guardar el caso; no se creará ninguna afiliación
              automáticamente.
            </p>
          ) : affiliationState === 'error' ? (
            <p
              role="status"
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
            >
              No fue posible verificar la afiliación. Esto no impide guardar el
              caso.
            </p>
          ) : null}

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
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              loadingText="Guardando..."
            >
              {healthcareCase ? 'Guardar cambios' : 'Registrar caso'}
            </Button>
          </div>
        </form>
      </Modal>

      {quickCreateType ? (
        <HealthcareQuickCreateModal
          key={quickCreateType}
          isOpen
          type={quickCreateType}
          onClose={() => setQuickCreateType(null)}
          onCreated={handleQuickCreated}
        />
      ) : null}
    </>
  );
}
