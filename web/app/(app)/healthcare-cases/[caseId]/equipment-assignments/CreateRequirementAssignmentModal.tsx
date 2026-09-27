import Button from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';
import Select from '@/app/components/ui/Select';

import type {
  HealthcareEquipmentAssignmentAssetCandidate,
  HealthcareEquipmentAssignmentConflictReviewResponse,
} from '@/services/healthcare-equipment-assignments';
import type { HealthcareRequirement } from '@/services/healthcare-requirements';

type CreateRequirementAssignmentModalProps = {
  isOpen: boolean;
  requirements: HealthcareRequirement[];
  coverageByRequirementId: Record<string, number>;
  assets: HealthcareEquipmentAssignmentAssetCandidate[];
  assetsLoading: boolean;
  assetsError: string;
  requirementId: string;
  equipmentAssetId: string;
  saving: boolean;
  error: string;
  conflictReview: HealthcareEquipmentAssignmentConflictReviewResponse | null;
  onRequirementIdChange: (requirementId: string) => void;
  onEquipmentAssetIdChange: (equipmentAssetId: string) => void;
  onRetryAssets: () => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function CreateRequirementAssignmentModal({
  isOpen,
  requirements,
  coverageByRequirementId,
  assets,
  assetsLoading,
  assetsError,
  requirementId,
  equipmentAssetId,
  saving,
  error,
  conflictReview,
  onRequirementIdChange,
  onEquipmentAssetIdChange,
  onRetryAssets,
  onClose,
  onSubmit,
}: CreateRequirementAssignmentModalProps) {
  const selectedRequirement = requirements.find(
    (requirement) => requirement.id === requirementId,
  );
  const selectedCoverage = selectedRequirement
    ? (coverageByRequirementId[selectedRequirement.id] ?? 0)
    : 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  const submitDisabled =
    saving ||
    assetsLoading ||
    Boolean(assetsError) ||
    !selectedRequirement ||
    selectedCoverage >= selectedRequirement.requestedQty ||
    assets.length === 0 ||
    !equipmentAssetId ||
    Boolean(conflictReview);

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title="Asignar requerimiento"
      description="Reserva un equipo para un requerimiento activo del caso. La API validará cobertura, disponibilidad y concurrencia."
    >
      <form
        aria-label="Asignar requerimiento"
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        {requirements.length === 0 ? (
          <p
            role="status"
            className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
          >
            No hay requerimientos activos de equipo disponibles para asignar.
          </p>
        ) : null}

        <Select
          label="Requerimiento"
          required
          value={requirementId}
          options={requirements.map((requirement) => {
            const coverage = coverageByRequirementId[requirement.id] ?? 0;
            const complete = coverage >= requirement.requestedQty;

            return {
              value: requirement.id,
              label: `${requirement.product.sku} · ${requirement.product.name} · Cobertura ${coverage}/${requirement.requestedQty}${complete ? ' · Completa' : ''}`,
              disabled: complete,
            };
          })}
          placeholder="Selecciona un requerimiento activo"
          disabled={saving || requirements.length === 0}
          onChange={(event) => onRequirementIdChange(event.target.value)}
        />

        {selectedRequirement ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">
              {selectedRequirement.product.name}
            </p>
            <p className="mt-1 text-sm text-gray-700">
              {selectedRequirement.product.sku} · Cantidad requerida:{' '}
              {selectedRequirement.requestedQty}
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Cobertura actual: {selectedCoverage}/
              {selectedRequirement.requestedQty} · Disponible:{' '}
              {Math.max(
                selectedRequirement.requestedQty - selectedCoverage,
                0,
              )}
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
        ) : selectedRequirement && assets.length === 0 ? (
          <p
            role="status"
            className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
          >
            No hay equipos activos y en buen estado del producto requerido que
            no estén ya reservados en este caso.
          </p>
        ) : null}

        <Select
          label="Equipo para el requerimiento"
          required
          value={equipmentAssetId}
          options={assets.map((asset) => ({
            value: asset.id,
            label: `${asset.product.name} · ${asset.assetCode} · Serie ${asset.serialNumber || 'Sin serie'}`,
          }))}
          placeholder={
            selectedRequirement
              ? 'Selecciona un equipo del producto requerido'
              : 'Selecciona primero un requerimiento'
          }
          disabled={
            saving ||
            assetsLoading ||
            Boolean(assetsError) ||
            !selectedRequirement
          }
          onChange={(event) => onEquipmentAssetIdChange(event.target.value)}
        />

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
            loadingText="Asignando..."
            disabled={submitDisabled}
          >
            Asignar equipo
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
