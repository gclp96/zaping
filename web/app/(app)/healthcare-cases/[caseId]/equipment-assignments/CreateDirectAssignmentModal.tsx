import Button from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';
import Select from '@/app/components/ui/Select';

import type {
  HealthcareEquipmentAssignmentAssetCandidate,
  HealthcareEquipmentAssignmentConflictReviewResponse,
} from '@/services/healthcare-equipment-assignments';

type CreateDirectAssignmentModalProps = {
  isOpen: boolean;
  assets: HealthcareEquipmentAssignmentAssetCandidate[];
  assetsLoading: boolean;
  assetsError: string;
  equipmentAssetId: string;
  directAssignmentReason: string;
  saving: boolean;
  error: string;
  conflictReview: HealthcareEquipmentAssignmentConflictReviewResponse | null;
  onEquipmentAssetIdChange: (equipmentAssetId: string) => void;
  onDirectAssignmentReasonChange: (reason: string) => void;
  onRetryAssets: () => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function CreateDirectAssignmentModal({
  isOpen,
  assets,
  assetsLoading,
  assetsError,
  equipmentAssetId,
  directAssignmentReason,
  saving,
  error,
  conflictReview,
  onEquipmentAssetIdChange,
  onDirectAssignmentReasonChange,
  onRetryAssets,
  onClose,
  onSubmit,
}: CreateDirectAssignmentModalProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  const submitDisabled =
    saving ||
    assetsLoading ||
    Boolean(assetsError) ||
    assets.length === 0 ||
    !equipmentAssetId ||
    !directAssignmentReason.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title="Nueva asignación directa"
      description="Reserva un equipo para este caso. La API validará disponibilidad, conflictos y estado actual."
    >
      <form
        aria-label="Nueva asignación directa"
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        {assetsLoading ? (
          <p role="status" className="text-sm text-gray-600">
            Cargando equipos elegibles...
          </p>
        ) : assetsError ? (
          <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm text-red-700">
              {assetsError}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetryAssets}
            >
              Reintentar equipos
            </Button>
          </div>
        ) : assets.length === 0 ? (
          <p
            role="status"
            className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
          >
            No hay equipos activos y en buen estado disponibles para seleccionar.
          </p>
        ) : null}

        <Select
          label="Equipo"
          required
          value={equipmentAssetId}
          options={assets.map((asset) => ({
            value: asset.id,
            label: `${asset.product.name} · ${asset.assetCode} · Serie ${asset.serialNumber || 'Sin serie'}`,
          }))}
          placeholder="Selecciona un equipo"
          disabled={saving || assetsLoading || Boolean(assetsError)}
          onChange={(event) => onEquipmentAssetIdChange(event.target.value)}
        />

        <div>
          <label
            htmlFor="direct-assignment-reason"
            className="mb-2 block font-medium text-gray-700"
          >
            Motivo de asignación directa
            <span aria-hidden="true" className="ml-1 text-red-600">
              *
            </span>
          </label>
          <textarea
            id="direct-assignment-reason"
            required
            maxLength={1000}
            rows={4}
            value={directAssignmentReason}
            disabled={saving}
            placeholder="Describe la necesidad operativa de esta asignación"
            className="w-full rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            onChange={(event) =>
              onDirectAssignmentReasonChange(event.target.value)
            }
          />
          <p className="mt-1 text-xs text-gray-500">
            Máximo 1000 caracteres.
          </p>
        </div>

        {conflictReview ? (
          <ConflictReview review={conflictReview} />
        ) : null}

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
            loadingText="Creando..."
            disabled={submitDisabled}
          >
            Crear asignación
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ConflictReview({
  review,
}: {
  review: HealthcareEquipmentAssignmentConflictReviewResponse;
}) {
  return (
    <div
      role="status"
      className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <div>
        <p className="font-semibold">Revisión de conflicto requerida</p>
        <p className="mt-1">
          La asignación no fue creada. Revisa el contexto o selecciona otro
          equipo.
        </p>
      </div>

      {review.conflicts.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5">
          {review.conflicts.map((conflict) => (
            <li key={conflict.assignmentId}>
              Conflicto con {conflict.caseFolio}
            </li>
          ))}
        </ul>
      ) : null}

      {review.unresolvedReservations.length > 0 ? (
        <p>
          Hay {review.unresolvedReservations.length} reserva(s) cuyo horario no
          permite verificar completamente la disponibilidad.
        </p>
      ) : null}

      {review.availability.warnings.length > 0 ? (
        <ul className="space-y-1">
          {review.availability.warnings.map((warning) => (
            <li key={warning.code}>{warning.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
