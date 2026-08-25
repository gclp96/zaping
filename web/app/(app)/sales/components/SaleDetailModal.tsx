import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import Loading from '@/app/components/ui/Loading';
import Modal from '@/app/components/ui/Modal';

import { getSaleStatusDescriptor } from '../sale-status';

import type { Sale } from '../types';

type SaleDetailModalProps = {
  isOpen: boolean;
  sale: Sale | null;
  loading: boolean;
  error: string;
  actionError: string;
  downloading: boolean;
  actionInProgress: boolean;
  formatDate: (value: string) => string;
  formatMoney: (value: number) => string;
  onClose: () => void;
  onRetry: () => void;
  onApprove: (sale: Sale) => void;
  onCancel: (sale: Sale) => void;
  onDownload: (sale: Sale) => void;
};

export default function SaleDetailModal({
  isOpen,
  sale,
  loading,
  error,
  actionError,
  downloading,
  actionInProgress,
  formatDate,
  formatMoney,
  onClose,
  onRetry,
  onApprove,
  onCancel,
  onDownload,
}: SaleDetailModalProps) {
  const statusDescriptor = sale
    ? getSaleStatusDescriptor(sale.status)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de venta"
    >
      {loading ? (
        <Loading message="Cargando detalle de venta..." />
      ) : error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
          <p>{error}</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={onRetry}>
              Reintentar
            </Button>

            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : sale && statusDescriptor ? (
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Folio
                </p>

                <p className="font-semibold text-gray-900">
                  {sale.folio}
                </p>
              </div>

              <StatusBadge
                label={statusDescriptor.label}
                tone={statusDescriptor.tone}
                ariaLabel={`Estado de la venta: ${statusDescriptor.label}`}
              />
            </div>

            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-gray-500">
                  Fecha de creación
                </dt>

                <dd className="font-medium text-gray-900">
                  {formatDate(sale.createdAt)}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-gray-500">
                  Partidas
                </dt>

                <dd className="font-medium text-gray-900">
                  {sale.items.length}
                </dd>
              </div>

              {sale.quoteId ? (
                <div>
                  <dt className="text-sm text-gray-500">
                    Origen
                  </dt>

                  <dd className="font-medium text-gray-900">
                    Cotización
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900">
              Cliente
            </h3>

            <p className="mt-3 font-medium text-gray-900">
              {sale.customer?.name ?? 'Cliente no disponible'}
            </p>
          </section>

          <section>
            <h3 className="mb-3 font-semibold text-gray-900">
              Productos
            </h3>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      SKU
                    </th>
                    <th className="px-3 py-2 text-left">
                      Producto
                    </th>
                    <th className="px-3 py-2 text-right">
                      Cantidad
                    </th>
                    <th className="px-3 py-2 text-right">
                      Precio unitario
                    </th>
                    <th className="px-3 py-2 text-right">
                      Subtotal
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sale.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-gray-200"
                    >
                      <td className="px-3 py-3">
                        {item.product?.sku ?? 'Sin SKU'}
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-900">
                        {item.product?.name ?? 'Producto no disponible'}
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
          </section>

          <section className="space-y-2 rounded-lg bg-gray-50 p-4">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">
                Subtotal
              </span>

              <span className="font-medium text-gray-900">
                {formatMoney(sale.subtotal)}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-600">
                IVA
              </span>

              <span className="font-medium text-gray-900">
                {formatMoney(sale.iva)}
              </span>
            </div>

            <div className="flex justify-between gap-4 border-t border-gray-200 pt-2 text-lg font-semibold">
              <span>Total</span>

              <span>{formatMoney(sale.total)}</span>
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

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              variant="outline"
              disabled={actionInProgress}
              onClick={onClose}
            >
              Cerrar
            </Button>

            {sale.status === 'DRAFT' ? (
              <>
                <Button
                  variant="danger"
                  disabled={actionInProgress}
                  onClick={() => onCancel(sale)}
                >
                  Cancelar
                </Button>

                <Button
                  variant="success"
                  disabled={actionInProgress}
                  onClick={() => onApprove(sale)}
                >
                  Aprobar
                </Button>
              </>
            ) : null}

            <Button
              variant="primary"
              loading={downloading}
              loadingText="Descargando..."
              disabled={actionInProgress && !downloading}
              onClick={() => onDownload(sale)}
            >
              Descargar PDF
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
