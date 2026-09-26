import Button from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';
import Select from '@/app/components/ui/Select';

import type {
  HealthcareEquipmentAssignment,
  HealthcareEquipmentAssignmentAssetCandidate,
  HealthcareEquipmentAssignmentReplaceConflictReviewResponse,
} from '@/services/healthcare-equipment-assignments';

type ReplaceAssignmentModalProps = {
  assignment: HealthcareEquipmentAssignment | null;
  assets: HealthcareEquipmentAssignmentAssetCandidate[];
  assetsLoading: boolean;
  assetsError: string;
  equipmentAssetId: string;
  replacementReason: string;
  saving: boolean;
  error: string;
  conflictReview: HealthcareEquipmentAssignmentReplaceConflictReviewResponse | null;
  onEquipmentAssetIdChange: (equipmentAssetId: string) => void;
  onReplacementReasonChange: (reason: string) => void;
  onRetryAssets: () => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function ReplaceAssignmentModal({
  assignment,
  assets,
  assetsLoading,
  assetsError,
  equipmentAssetId,
  replacementReason,
  saving,
  error,
  conflictReview,
  onEquipmentAssetIdChange,
  onReplacementReasonChange,
  onRetryAssets,
  onClose,
  onSubmit,
}: ReplaceAssignmentModalProps) {
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
    !replacementReason.trim() ||
    Boolean(conflictReview);

  return (
    <Modal
      isOpen={assignment !== null}
      onClose={saving ? () => undefined : onClose}
      title="Reemplazar asignación"
      description="La asignación actual quedará como reemplazada y el equipo sustituto se reservará para el mismo contexto."
    >
      <form
        aria-label="Reemplazar asignación"
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        {assignment ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="font-semibold">Equipo que será reemplazado</p>
            <p className="mt-1 text-sm">
              {assignment.equipmentAsset.product.name} ·{' '}
              {assignment.equipmentAsset.assetCode} · Serie{' '}
              {assignment.equipmentAsset.serialNumber || 'Sin serie'}
            </p>
            <p className="mt-2 text-sm">
              Esta Assignment pasará a REPLACED cuando el reemplazo sea exitoso.
            </p>
          </div>
        ) : null}

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
            No hay otro equipo activo y en buen estado disponible para
            seleccionar.
          </p>
        ) : null}

        <Select
          label="Equipo sustituto"
          required
          value={equipmentAssetId}
          options={assets.map((asset) => ({
            value: asset.id,
            label: `${asset.product.name} · ${asset.assetCode} · Serie ${asset.serialNumber || 'Sin serie'}`,
          }))}
          placeholder="Selecciona el equipo sustituto"
          disabled={saving || assetsLoading || Boolean(assetsError)}
          onChange={(event) => onEquipmentAssetIdChange(event.target.value)}
        />

        <div>
          <label
            htmlFor="replacement-reason"
            className="mb-2 block font-medium text-gray-700"
          >
            Motivo del reemplazo
            <span aria-hidden="true" className="ml-1 text-red-600">
              *
            </span>
          </label>
          <textarea
            id="replacement-reason"
            required
            maxLength={1000}
            rows={4}
            value={replacementReason}
            disabled={saving}
            placeholder="Describe por qué debe sustituirse el equipo actual"
            className="w-full rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            onChange={(event) =>
              onReplacementReasonChange(event.target.value)
            }
          />
          <p className="mt-1 text-xs text-gray-500">
            Máximo 1000 caracteres.
          </p>
        </div>

        {conflictReview ? (
          <ReplaceConflictReview review={conflictReview} />
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
            loadingText="Reemplazando..."
            disabled={submitDisabled}
          >
            Reemplazar asignación
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ReplaceConflictReview({
  review,
}: {
  review: HealthcareEquipmentAssignmentReplaceConflictReviewResponse;
}) {
  return (
    <div
      role="status"
      className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <div>
        <p className="font-semibold">Revisión de conflicto requerida</p>
        <p className="mt-1">
          El reemplazo no fue realizado. Revisa el contexto o selecciona otro
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
