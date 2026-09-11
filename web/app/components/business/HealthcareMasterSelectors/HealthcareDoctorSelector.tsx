'use client';

import HealthcareMasterSelector from './HealthcareMasterSelector';

export type HealthcareDoctorOption = {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  isActive: boolean;
};

type HealthcareDoctorSelectorProps = {
  value: string | null;
  currentValue?: HealthcareDoctorOption | null;
  disabled?: boolean;
  sessionKey: string;
  onQuickCreate?: () => void;
  onChange: (
    id: string | null,
    option: HealthcareDoctorOption | null,
  ) => void;
};

export default function HealthcareDoctorSelector({
  value,
  currentValue,
  disabled,
  sessionKey,
  onQuickCreate,
  onChange,
}: HealthcareDoctorSelectorProps) {
  return (
    <HealthcareMasterSelector<HealthcareDoctorOption>
      label="Médico"
      searchLabel="Buscar médicos activos"
      searchPlaceholder="Nombre, apellido o especialidad"
      emptyMessage="No se encontraron médicos activos."
      endpoint="/healthcare/doctors"
      value={value}
      currentValue={currentValue}
      disabled={disabled}
      sessionKey={sessionKey}
      quickCreateLabel="Crear médico"
      onQuickCreate={onQuickCreate}
      formatOption={(doctor) =>
        `${doctor.firstName} ${doctor.lastName} — ${doctor.specialty}`
      }
      onChange={onChange}
    />
  );
}
