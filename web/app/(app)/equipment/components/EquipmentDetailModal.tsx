import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import Loading from '@/app/components/ui/Loading';
import Modal from '@/app/components/ui/Modal';

import {
  compactEquipmentReference,
  formatEquipmentDate,
  getEquipmentAvailabilityReasonLabel,
  getEquipmentConditionDescriptor,
  getEquipmentLifecycleDescriptor,
  getEquipmentOriginLabel,
} from '../equipment-display';

import type {
  EquipmentAssetDetail,
  EquipmentAvailability,
  EquipmentInspection,
} from '../types';

type EquipmentDetailModalProps = {
  isOpen: boolean;
  assetCode: string | null;
  equipment: EquipmentAssetDetail | null;
  loading: boolean;
  error: string;
  availability: EquipmentAvailability | null;
  availabilityLoading: boolean;
  availabilityError: string;
  inspections: EquipmentInspection[];
  inspectionsLoading: boolean;
  inspectionsError: string;
  onClose: () => void;
  onRetry: () => void;
  onRetryAvailability: () => void;
  onRetryInspections: () => void;
  onOpenInspection: () => void;
};

export default function EquipmentDetailModal({
  isOpen,
  assetCode,
  equipment,
  loading,
  error,
  availability,
  availabilityLoading,
  availabilityError,
  inspections,
  inspectionsLoading,
  inspectionsError,
  onClose,
  onRetry,
  onRetryAvailability,
  onRetryInspections,
  onOpenInspection,
}: EquipmentDetailModalProps) {
  const lifecycleDescriptor = equipment
    ? getEquipmentLifecycleDescriptor(equipment.lifecycle)
    : null;
  const conditionDescriptor = equipment
    ? getEquipmentConditionDescriptor(equipment.condition)
    : null;
  const availabilityReasons = availability
    ? [
        ...(availability.primaryReason &&
        !availability.reasons.includes(availability.primaryReason)
          ? [availability.primaryReason]
          : []),
        ...availability.reasons,
      ]
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={assetCode ? `Detalle del equipo ${assetCode}` : 'Detalle del equipo'}
    >
      {loading ? (
        <Loading message="Cargando detalle del equipo..." />
      ) : error ? (
        <div className="space-y-4">
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          >
            {error}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button type="button" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        </div>
      ) : equipment && lifecycleDescriptor && conditionDescriptor ? (
        <div
          role="region"
          aria-label="Información del equipo"
          className="space-y-6"
        >
          <section className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-gray-500">Código de equipo</p>
                <p className="text-xl font-semibold text-gray-900">
                  {equipment.assetCode}
                </p>
              </div>

              <StatusBadge
                label={lifecycleDescriptor.label}
                tone={lifecycleDescriptor.tone}
                ariaLabel={`Estado del equipo: ${lifecycleDescriptor.label}`}
              />
            </div>
          </section>

          <section
            aria-label="Disponibilidad actual"
            className="rounded-lg border border-gray-200 p-4"
          >
            <h3 className="font-semibold text-gray-900">
              Disponibilidad actual
            </h3>

            {availabilityLoading ? (
              <p role="status" className="mt-3 text-sm text-gray-600">
                Consultando disponibilidad...
              </p>
            ) : availabilityError ? (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p role="alert" className="text-sm text-red-700">
                  {availabilityError}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetryAvailability}
                >
                  Reintentar disponibilidad
                </Button>
              </div>
            ) : availability ? (
              <div className="mt-3 space-y-3">
                <StatusBadge
                  label={
                    availability.available
                      ? 'Disponible'
                      : 'No disponible'
                  }
                  tone={availability.available ? 'success' : 'danger'}
                  ariaLabel={`Disponibilidad del equipo: ${
                    availability.available
                      ? 'Disponible'
                      : 'No disponible'
                  }`}
                />

                {availabilityReasons.length > 0 ? (
                  <div>
                    <p className="text-sm text-gray-500">Motivos</p>
                    <ul className="mt-1 space-y-1 text-sm text-gray-900">
                      {availabilityReasons.map((reason, index) => (
                        <li
                          key={`${reason}-${index}`}
                          className={
                            reason === availability.primaryReason
                              ? 'font-semibold'
                              : undefined
                          }
                        >
                          {getEquipmentAvailabilityReasonLabel(reason)}
                          {reason === availability.primaryReason
                            ? ' (principal)'
                            : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="text-xs text-gray-500">
                  Evaluado: {formatEquipmentDate(availability.evaluatedAt)}
                </p>
              </div>
            ) : null}
          </section>

          <section>
            <h3 className="mb-3 font-semibold text-gray-900">
              Identificación
            </h3>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-gray-500">
                  Producto del catálogo
                </dt>
                <dd className="font-medium text-gray-900">
                  {equipment.product.name}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">SKU</dt>
                <dd className="font-medium text-gray-900">
                  {equipment.product.sku}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Número de serie</dt>
                <dd className="font-medium text-gray-900">
                  {equipment.serialNumber || 'Sin número de serie'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Condición</dt>
                <dd className="mt-1">
                  <StatusBadge
                    label={conditionDescriptor.label}
                    tone={conditionDescriptor.tone}
                    ariaLabel={`Condición del equipo: ${conditionDescriptor.label}`}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Origen</dt>
                <dd className="font-medium text-gray-900">
                  {getEquipmentOriginLabel(equipment.origin)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Lote</dt>
                <dd className="font-medium text-gray-900">
                  {equipment.batch?.lotNumber || 'Sin lote'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Fecha de registro</dt>
                <dd className="font-medium text-gray-900">
                  {formatEquipmentDate(equipment.createdAt)}
                </dd>
              </div>
            </dl>
          </section>

          {equipment.purchaseReceiptItemId ? (
            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">Trazabilidad</h3>
              <p className="mt-3 text-sm text-gray-500">
                Partida de recepción de compra
              </p>
              <p
                className="font-medium text-gray-900"
                aria-label={`Identificador de partida de recepción: ${equipment.purchaseReceiptItemId}`}
              >
                ID {compactEquipmentReference(equipment.purchaseReceiptItemId)}
              </p>
            </section>
          ) : null}

          <section aria-label="Inspecciones">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-gray-900">Inspecciones</h3>
              {equipment.lifecycle === 'ACTIVE' ? (
                <Button
                  type="button"
                  size="sm"
                  aria-label={`Registrar inspección de ${equipment.assetCode}`}
                  onClick={onOpenInspection}
                >
                  Registrar inspección
                </Button>
              ) : null}
            </div>

            {inspectionsLoading ? (
              <p role="status" className="mt-3 text-sm text-gray-600">
                Cargando inspecciones...
              </p>
            ) : inspectionsError ? (
              <div className="mt-3 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p role="alert" className="text-sm text-red-700">
                  {inspectionsError}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetryInspections}
                >
                  Reintentar inspecciones
                </Button>
              </div>
            ) : inspections.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                Aún no hay inspecciones registradas.
              </p>
            ) : (
              <ol className="mt-3 divide-y divide-gray-200 border-y border-gray-200">
                {inspections.map((inspection) => {
                  const conditionBefore =
                    getEquipmentConditionDescriptor(
                      inspection.conditionBefore,
                    );
                  const conditionAfter =
                    getEquipmentConditionDescriptor(
                      inspection.conditionAfter,
                    );
                  const inspectorName = [
                    inspection.inspectedBy.firstName,
                    inspection.inspectedBy.lastName,
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <li
                      key={inspection.id}
                      className="grid gap-3 py-4 sm:grid-cols-2"
                    >
                      <div>
                        <p className="text-xs text-gray-500">Fecha</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatEquipmentDate(inspection.inspectedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Inspector</p>
                        <p className="text-sm font-medium text-gray-900">
                          {inspectorName || inspection.inspectedBy.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">
                          Condición anterior
                        </p>
                        <StatusBadge
                          label={conditionBefore.label}
                          tone={conditionBefore.tone}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">
                          Condición resultante
                        </p>
                        <StatusBadge
                          label={conditionAfter.label}
                          tone={conditionAfter.tone}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-gray-500">Notas</p>
                        <p className="whitespace-pre-wrap text-sm text-gray-900">
                          {inspection.notes || 'Sin notas'}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
