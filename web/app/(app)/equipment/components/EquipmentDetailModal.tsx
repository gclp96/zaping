import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import Loading from '@/app/components/ui/Loading';
import Modal from '@/app/components/ui/Modal';

import {
  compactEquipmentReference,
  formatEquipmentDate,
  getEquipmentConditionDescriptor,
  getEquipmentLifecycleDescriptor,
  getEquipmentOriginLabel,
} from '../equipment-display';

import type { EquipmentAssetDetail } from '../types';

type EquipmentDetailModalProps = {
  isOpen: boolean;
  assetCode: string | null;
  equipment: EquipmentAssetDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
};

export default function EquipmentDetailModal({
  isOpen,
  assetCode,
  equipment,
  loading,
  error,
  onClose,
  onRetry,
}: EquipmentDetailModalProps) {
  const lifecycleDescriptor = equipment
    ? getEquipmentLifecycleDescriptor(equipment.lifecycle)
    : null;
  const conditionDescriptor = equipment
    ? getEquipmentConditionDescriptor(equipment.condition)
    : null;

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
