import Button from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';
import Select from '@/app/components/ui/Select';

import type { EquipmentRetirementReason } from '../types';

type EquipmentRetirementModalProps = {
  isOpen: boolean;
  assetCode: string | null;
  reason: '' | EquipmentRetirementReason;
  notes: string;
  saving: boolean;
  error: string;
  onReasonChange: (reason: '' | EquipmentRetirementReason) => void;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const retirementReasonOptions = [
  { value: 'SOLD', label: 'Vendido' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'DESTROYED', label: 'Destruido' },
  { value: 'END_OF_LIFE', label: 'Fin de vida útil' },
  { value: 'REPLACED', label: 'Reemplazado' },
  { value: 'OTHER', label: 'Otro' },
];

export default function EquipmentRetirementModal({
  isOpen,
  assetCode,
  reason,
  notes,
  saving,
  error,
  onReasonChange,
  onNotesChange,
  onClose,
  onSubmit,
}: EquipmentRetirementModalProps) {
  const otherNotesRequired = reason === 'OTHER';
  const submitDisabled =
    saving || !reason || (otherNotesRequired && !notes.trim());

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title={assetCode ? `Retirar equipo ${assetCode}` : 'Retirar equipo'}
    >
      <form
        aria-label="Retirar equipo"
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        <p className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
          El equipo quedará retirado y dejará de estar disponible para nuevas
          operaciones. Su historial se conservará.
        </p>

        <Select
          label="Motivo del retiro"
          required
          value={reason}
          options={retirementReasonOptions}
          placeholder="Selecciona un motivo"
          disabled={saving}
          onChange={(event) =>
            onReasonChange(
              event.target.value as '' | EquipmentRetirementReason,
            )
          }
        />

        <div>
          <label
            htmlFor="equipment-retirement-notes"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Notas{otherNotesRequired ? '' : ' (opcional)'}
            {otherNotesRequired ? (
              <span aria-hidden="true" className="ml-1 text-red-600">
                *
              </span>
            ) : null}
          </label>
          <textarea
            id="equipment-retirement-notes"
            rows={4}
            value={notes}
            required={otherNotesRequired}
            disabled={saving}
            aria-describedby={
              otherNotesRequired
                ? 'equipment-retirement-notes-requirement'
                : undefined
            }
            placeholder="Observaciones del retiro"
            className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
            onChange={(event) => onNotesChange(event.target.value)}
          />
          {otherNotesRequired ? (
            <p
              id="equipment-retirement-notes-requirement"
              className="mt-1 text-sm text-gray-600"
            >
              Las notas son obligatorias cuando el motivo es Otro.
            </p>
          ) : null}
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
            variant="danger"
            loading={saving}
            loadingText="Retirando..."
            disabled={submitDisabled}
          >
            Retirar equipo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
