import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';

import { getPurchaseStatusDescriptor } from '../purchase-status';

import type {
  InventoryMovement,
  Purchase,
  PurchaseReceipt,
} from '../types';

import PurchaseInventoryMovements from './PurchaseInventoryMovements';
import PurchaseReceiptsHistory from './PurchaseReceiptsHistory';

type PurchaseDetailModalProps = {
  purchase: Purchase | null;

  receipts: PurchaseReceipt[];
  receiptsLoading: boolean;
  receiptsError: string;

  movements: InventoryMovement[];
  movementsLoading: boolean;
  movementsError: string;

  downloading: boolean;

  formatDate: (value: string) => string;
  formatMoney: (value: number) => string;

  onClose: () => void;
  onEdit: (purchase: Purchase) => void;
  onApprove: (purchase: Purchase) => void;
  onCancel: (purchase: Purchase) => void;
  onReceive: (purchase: Purchase) => void;
  onDownload: (purchase: Purchase) => void;
};

export default function PurchaseDetailModal({
  purchase,
  receipts,
  receiptsLoading,
  receiptsError,
  movements,
  movementsLoading,
  movementsError,
  downloading,
  formatDate,
  formatMoney,
  onClose,
  onEdit,
  onApprove,
  onCancel,
  onReceive,
  onDownload,
}: PurchaseDetailModalProps) {
  const statusDescriptor = purchase
    ? getPurchaseStatusDescriptor(purchase.status)
    : null;

  return (
    <Modal
      isOpen={purchase !== null}
      onClose={onClose}
      title="Detalle de compra"
    >
      {purchase && statusDescriptor ? (
        <div className="space-y-6 pb-24">
          <div className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Folio
              </p>

              <p className="text-lg font-semibold">
                {purchase.folio}
              </p>

              <p className="mt-3 text-sm text-gray-500">
                Fecha
              </p>

              <p className="font-medium">
                {formatDate(purchase.createdAt)}
              </p>
            </div>

            <div className="md:text-right">
              <StatusBadge
                label={statusDescriptor.label}
                tone={statusDescriptor.tone}
                ariaLabel={`Estado de la compra: ${statusDescriptor.label}`}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-3 font-semibold">
              Proveedor
            </h3>

            <p className="font-medium">
              {purchase.supplier.name}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">
                    Producto
                  </th>

                  <th className="px-3 py-2 text-right">
                    Cantidad
                  </th>

                  <th className="px-3 py-2 text-right">
                    Costo
                  </th>

                  <th className="px-3 py-2 text-right">
                    Subtotal
                  </th>
                </tr>
              </thead>

              <tbody>
                {purchase.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-gray-200"
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium">
                        {item.product.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {item.product.sku}
                      </p>
                    </td>

                    <td className="px-3 py-3 text-right">
                      {item.quantity}
                    </td>

                    <td className="px-3 py-3 text-right">
                      {formatMoney(item.price)}
                    </td>

                    <td className="px-3 py-3 text-right font-medium">
                      {formatMoney(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PurchaseReceiptsHistory
            receipts={receipts}
            loading={receiptsLoading}
            error={receiptsError}
            formatDate={formatDate}
            formatMoney={formatMoney}
          />

          <PurchaseInventoryMovements
            movements={movements}
            loading={movementsLoading}
            error={movementsError}
            formatDate={formatDate}
            formatMoney={formatMoney}
          />

          <div className="space-y-2 rounded-lg bg-gray-50 p-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(purchase.subtotal)}</span>
            </div>

            <div className="flex justify-between">
              <span>IVA (16%)</span>
              <span>{formatMoney(purchase.iva)}</span>
            </div>

            <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-semibold">
              <span>Total</span>
              <span>{formatMoney(purchase.total)}</span>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-3 border-t border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
            {purchase.status === 'DRAFT' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => onEdit(purchase)}
                >
                  Editar
                </Button>

                <Button
                  variant="success"
                  onClick={() => onApprove(purchase)}
                >
                  Aprobar
                </Button>

                <Button
                  variant="danger"
                  onClick={() => onCancel(purchase)}
                >
                  Cancelar
                </Button>
              </>
            ) : null}

            {purchase.status === 'CONFIRMED' ||
            purchase.status === 'PARTIALLY_RECEIVED' ? (
              <Button
                variant="success"
                className="min-w-44"
                onClick={() => onReceive(purchase)}
              >
                Registrar recepción
              </Button>
            ) : null}

            <Button
              variant="secondary"
              className="min-w-28"
              onClick={onClose}
            >
              Cerrar
            </Button>

            <Button
              variant="primary"
              className="min-w-36"
              loading={downloading}
              loadingText="Descargando..."
              onClick={() => onDownload(purchase)}
            >
              Descargar PDF
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}