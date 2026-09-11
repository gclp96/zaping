'use client';

import HealthcareMasterSelector from './HealthcareMasterSelector';

export type HealthcareHospitalOption = {
  id: string;
  name: string;
  city: string;
  state: string;
  isActive: boolean;
};

type HealthcareHospitalSelectorProps = {
  value: string | null;
  currentValue?: HealthcareHospitalOption | null;
  disabled?: boolean;
  sessionKey: string;
  onQuickCreate?: () => void;
  onChange: (
    id: string | null,
    option: HealthcareHospitalOption | null,
  ) => void;
};

export default function HealthcareHospitalSelector({
  value,
  currentValue,
  disabled,
  sessionKey,
  onQuickCreate,
  onChange,
}: HealthcareHospitalSelectorProps) {
  return (
    <HealthcareMasterSelector<HealthcareHospitalOption>
      label="Hospital"
      searchLabel="Buscar hospitales activos"
      searchPlaceholder="Nombre, ciudad o estado"
      emptyMessage="No se encontraron hospitales activos."
      endpoint="/healthcare/hospitals"
      value={value}
      currentValue={currentValue}
      disabled={disabled}
      sessionKey={sessionKey}
      quickCreateLabel="Crear hospital"
      onQuickCreate={onQuickCreate}
      formatOption={(hospital) =>
        `${hospital.name} — ${hospital.city}, ${hospital.state}`
      }
      onChange={onChange}
    />
  );
}
