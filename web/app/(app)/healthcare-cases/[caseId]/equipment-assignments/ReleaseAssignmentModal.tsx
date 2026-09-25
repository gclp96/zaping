import Button from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';

import type { HealthcareEquipmentAssignment } from '@/services/healthcare-equipment-assignments';

type ReleaseAssignmentModalProps = {
  assignment: HealthcareEquipmentAssignment | null;
  reason: string;
  saving: boolean;
  error: string;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function ReleaseAssignmentModal({
  assignment,
  reason,
  saving,
  error,
  onReasonChange,
  onClose,
  onSubmit,
}: ReleaseAssignmentModalProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Modal
      isOpen={assignment !== null}
      onClose={saving ? () => undefined : onClose}
      title="Liberar asignación"
      description="Confirma la liberación lógica de la reserva. Esta acción no registra movimientos físicos."
    >
      <form
        aria-label="Liberar asignación"
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        {assignment ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">
              {assignment.equipmentAsset.product.name}
            </p>
            <p className="mt-1 text-sm text-gray-700">
              {assignment.equipmentAsset.assetCode} · Serie{' '}
              {assignment.equipmentAsset.serialNumber || 'Sin serie'}
            </p>
          </div>
        ) : null}

        <div>
          <label
            htmlFor="release-assignment-reason"
            className="mb-2 block font-medium text-gray-700"
          >
            Motivo de liberación
            <span aria-hidden="true" className="ml-1 text-red-600">
              *
            </span>
          </label>
          <textarea
            id="release-assignment-reason"
            required
            maxLength={1000}
            rows={4}
            value={reason}
            disabled={saving}
            placeholder="Describe por qué el equipo deja de estar reservado"
            className="w-full rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            onChange={(event) => onReasonChange(event.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            Máximo 1000 caracteres.
          </p>
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
            loadingText="Liberando..."
            disabled={saving || !reason.trim()}
          >
            Liberar asignación
          </Button>
        </div>
      </form>
    </Modal>
  );
}
