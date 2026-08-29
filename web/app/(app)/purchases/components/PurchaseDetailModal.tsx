import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';

import {
  canRegisterPurchaseReceipt,
  getPurchaseStatusDescriptor,
} from '../purchase-status';
import type { PurchaseReceiptHistoryStatus } from '../hooks/usePurchaseDetail';

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
  receiptHistoryStatus: PurchaseReceiptHistoryStatus;

  movements: InventoryMovement[];
  movementsLoading: boolean;
  movementsError: string;

  downloading: boolean;
  actionError: string;

  formatDate: (value: string) => string;
  formatMoney: (value: number) => string;

  onClose: () => void;
  onEdit: (purchase: Purchase) => void;
  onApprove: (purchase: Purchase) => void;
  onCancel: (purchase: Purchase) => void;
  onReceive: (purchase: Purchase) => void;
  onRetryReceipts: () => void;
  onDownload: (purchase: Purchase) => void;
};

export default function PurchaseDetailModal({
  purchase,
  receipts,
  receiptsLoading,
  receiptsError,
  receiptHistoryStatus,
  movements,
  movementsLoading,
  movementsError,
  downloading,
  actionError,
  formatDate,
  formatMoney,
  onClose,
  onEdit,
  onApprove,
  onCancel,
  onReceive,
  onRetryReceipts,
  onDownload,
}: PurchaseDetailModalProps) {
  const statusDescriptor = purchase
    ? getPurchaseStatusDescriptor(purchase.status)
    : null;
  const receivedByPurchaseItem = new Map<string, number>();

  for (const receipt of receipts) {
    for (const receiptItem of receipt.items) {
      const previousQuantity =
        receivedByPurchaseItem.get(receiptItem.purchaseItemId) ?? 0;

      receivedByPurchaseItem.set(
        receiptItem.purchaseItemId,
        previousQuantity + Math.max(receiptItem.quantityReceived, 0),
      );
    }
  }

  const receiptHistoryReady = receiptHistoryStatus === 'success';

  return (
    <Modal
      isOpen={purchase !== null}
      onClose={onClose}
      title={purchase ? `Compra ${purchase.folio}` : 'Detalle de compra'}
    >
      {purchase && statusDescriptor ? (
        <div className="space-y-6 pb-24">
          <section
            aria-labelledby="purchase-summary-heading"
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <h3
              id="purchase-summary-heading"
              className="mb-4 font-semibold text-gray-900"
            >
              Resumen de compra
            </h3>

            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-sm text-gray-500">
                  Proveedor
                </dt>

                <dd className="mt-1 font-medium text-gray-900">
                  {purchase.supplier.name}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-gray-500">
                  Estado
                </dt>

                <dd className="mt-1">
                  <StatusBadge
                    label={statusDescriptor.label}
                    tone={statusDescriptor.tone}
                    ariaLabel={`Estado de la compra: ${statusDescriptor.label}`}
                  />
                </dd>
              </div>

              <div>
                <dt className="text-sm text-gray-500">
                  Fecha
                </dt>

                <dd className="mt-1 font-medium text-gray-900">
                  {formatDate(purchase.createdAt)}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-gray-500">
                  Recepción
                </dt>

                <dd className="mt-1 font-medium text-gray-900">
                  {purchase.status === 'DRAFT' ? (
                    'Pendiente de aprobación'
                  ) : purchase.status === 'CANCELLED' ? (
                    'No aplica'
                  ) : (
                    <>
                      <span className="block">
                        {purchase.receiptProgress.completedLines} /{' '}
                        {purchase.receiptProgress.orderedLines} partidas
                      </span>

                      <span className="block text-sm text-gray-600">
                        {purchase.receiptProgress.receivedUnits} /{' '}
                        {purchase.receiptProgress.orderedUnits} uds. ·{' '}
                        {purchase.receiptProgress.pendingUnits} pendientes
                      </span>
                    </>
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-gray-200 pt-4">
              <span className="text-sm font-medium text-gray-600">
                Total
              </span>

              <span className="text-xl font-semibold text-gray-900">
                {formatMoney(purchase.total)}
              </span>
            </div>
          </section>

          <section
            aria-labelledby="purchase-items-heading"
            className="space-y-3"
          >
            <h3
              id="purchase-items-heading"
              className="font-semibold text-gray-900"
            >
              Partidas de la compra
            </h3>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Partidas, cantidades y costos de la compra
                </caption>
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left">
                      Producto
                    </th>

                    <th scope="col" className="px-3 py-2 text-right">
                      Pedido
                    </th>

                    <th scope="col" className="px-3 py-2 text-right">
                      Recibido
                    </th>

                    <th scope="col" className="px-3 py-2 text-right">
                      Pendiente
                    </th>

                    <th scope="col" className="px-3 py-2 text-right">
                      Costo
                    </th>

                    <th scope="col" className="px-3 py-2 text-right">
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
                        {receiptHistoryReady
                          ? receivedByPurchaseItem.get(item.id) ?? 0
                          : '—'}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {receiptHistoryReady
                          ? Math.max(
                              item.quantity -
                                (receivedByPurchaseItem.get(item.id) ?? 0),
                              0,
                            )
                          : '—'}
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
          </section>

          <section
            aria-labelledby="purchase-financial-heading"
            className="space-y-2 rounded-lg bg-gray-50 p-4"
          >
            <h3
              id="purchase-financial-heading"
              className="font-semibold text-gray-900"
            >
              Resumen financiero
            </h3>

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
          </section>

          <section
            aria-labelledby="purchase-traceability-heading"
            className="space-y-4 border-t border-gray-200 pt-4"
          >
            <h3
              id="purchase-traceability-heading"
              className="text-sm font-semibold uppercase tracking-wide text-gray-500"
            >
              Trazabilidad
            </h3>

            <div className="space-y-4">
              <PurchaseReceiptsHistory
                receipts={receipts}
                loading={receiptsLoading}
                error={receiptsError}
                onRetry={onRetryReceipts}
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
            </div>
          </section>

          {actionError ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {actionError}
            </div>
          ) : null}

          <section
            aria-labelledby="purchase-actions-heading"
            className="sticky bottom-0 z-10 -mx-6 border-t border-gray-200 bg-white/95 px-6 py-4 backdrop-blur"
          >
            <h3 id="purchase-actions-heading" className="sr-only">
              Acciones de compra
            </h3>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
                {purchase.status === 'DRAFT' ? (
                  <>
                    <Button
                      variant="success"
                      className="w-full sm:w-auto"
                      onClick={() => onApprove(purchase)}
                    >
                      Aprobar
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => onEdit(purchase)}
                    >
                      Editar
                    </Button>

                    <Button
                      variant="danger"
                      className="w-full sm:w-auto"
                      onClick={() => onCancel(purchase)}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : null}

                {canRegisterPurchaseReceipt(purchase.status) ? (
                  <Button
                    variant="success"
                    className="w-full min-w-44 sm:w-auto"
                    disabled={receiptHistoryStatus !== 'success'}
                    onClick={() => onReceive(purchase)}
                  >
                    Registrar recepción
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="w-full min-w-36 sm:w-auto"
                  loading={downloading}
                  loadingText="Descargando..."
                  onClick={() => onDownload(purchase)}
                >
                  Descargar PDF
                </Button>

                <Button
                  variant="secondary"
                  className="w-full min-w-28 sm:w-auto"
                  onClick={onClose}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
