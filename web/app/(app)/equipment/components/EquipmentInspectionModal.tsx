import Button from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';
import Select from '@/app/components/ui/Select';

import type {
  EquipmentInspectionResult,
} from '../types';

type EquipmentInspectionModalProps = {
  isOpen: boolean;
  assetCode: string | null;
  conditionAfter: '' | EquipmentInspectionResult;
  notes: string;
  saving: boolean;
  error: string;
  onConditionAfterChange: (
    condition: '' | EquipmentInspectionResult,
  ) => void;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const inspectionResultOptions = [
  { value: 'GOOD', label: 'Bueno' },
  { value: 'DAMAGED', label: 'Dañado' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
];

export default function EquipmentInspectionModal({
  isOpen,
  assetCode,
  conditionAfter,
  notes,
  saving,
  error,
  onConditionAfterChange,
  onNotesChange,
  onClose,
  onSubmit,
}: EquipmentInspectionModalProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title={
        assetCode
          ? `Registrar inspección de ${assetCode}`
          : 'Registrar inspección'
      }
    >
      <form
        aria-label="Registrar inspección"
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        <Select
          label="Condición resultante"
          required
          value={conditionAfter}
          options={inspectionResultOptions}
          placeholder="Selecciona el resultado"
          disabled={saving}
          onChange={(event) =>
            onConditionAfterChange(
              event.target.value as '' | EquipmentInspectionResult,
            )
          }
        />

        <div>
          <label
            htmlFor="equipment-inspection-notes"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Notas (opcional)
          </label>
          <textarea
            id="equipment-inspection-notes"
            rows={4}
            value={notes}
            disabled={saving}
            placeholder="Observaciones de la inspección"
            className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
            onChange={(event) => onNotesChange(event.target.value)}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
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
            loadingText="Registrando..."
            disabled={saving || !conditionAfter}
          >
            Registrar inspección
          </Button>
        </div>
      </form>
    </Modal>
  );
}
