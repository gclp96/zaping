import StatusBadge from '@/app/components/business/StatusBadge';

import Button from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';

import { getQuoteStatusDescriptor } from '../quote-status';

import type { Quote } from '../types';

type QuoteDetailModalProps = {
  quote: Quote | null;
  downloading: boolean;

  formatDate: (value: string) => string;
  formatMoney: (value: number) => string;

  onClose: () => void;
  onApprove: (quote: Quote) => void;
  onCancel: (quote: Quote) => void;
  onDownload: (quote: Quote) => void;
};

export default function QuoteDetailModal({
  quote,
  downloading,

  formatDate,
  formatMoney,

  onClose,
  onApprove,
  onCancel,
  onDownload,
}: QuoteDetailModalProps) {
  if (!quote) {
    return null;
  }

  const statusDescriptor =
    getQuoteStatusDescriptor(quote.status);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Cotización ${quote.folio}`}
    >
      <div className="space-y-6">
        <section className="rounded-lg border border-gray-200 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Folio
              </p>

              <p className="font-semibold text-gray-900">
                {quote.folio}
              </p>
            </div>

            <StatusBadge
              label={statusDescriptor.label}
              tone={statusDescriptor.tone}
              ariaLabel={`Estado de la cotización: ${statusDescriptor.label}`}
            />
          </div>

          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500">
                Fecha
              </dt>

              <dd className="font-medium text-gray-900">
                {formatDate(quote.createdAt)}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">
                Partidas
              </dt>

              <dd className="font-medium text-gray-900">
                {quote.items.length}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">
                Conversión a venta
              </dt>

              <dd className="font-medium text-gray-900">
                {quote.convertedToSale
                  ? 'Convertida'
                  : 'No convertida'}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">
                Última actualización
              </dt>

              <dd className="font-medium text-gray-900">
                {formatDate(quote.updatedAt)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900">
            Cliente
          </h3>

          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500">
                Nombre
              </dt>

              <dd className="font-medium text-gray-900">
                {quote.customer.name}
              </dd>
            </div>

            {quote.customer.contactName ? (
              <div>
                <dt className="text-sm text-gray-500">
                  Contacto
                </dt>

                <dd className="font-medium text-gray-900">
                  {quote.customer.contactName}
                </dd>
              </div>
            ) : null}

            {quote.customer.email ? (
              <div>
                <dt className="text-sm text-gray-500">
                  Correo
                </dt>

                <dd className="break-all font-medium text-gray-900">
                  {quote.customer.email}
                </dd>
              </div>
            ) : null}

            {quote.customer.phone ? (
              <div>
                <dt className="text-sm text-gray-500">
                  Teléfono
                </dt>

                <dd className="font-medium text-gray-900">
                  {quote.customer.phone}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section>
          <h3 className="mb-3 font-semibold text-gray-900">
            Productos
          </h3>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-180 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">
                    Producto
                  </th>

                  <th className="px-3 py-2 text-right">
                    Cantidad
                  </th>

                  <th className="px-3 py-2 text-right">
                    Precio
                  </th>

                  <th className="px-3 py-2 text-right">
                    Subtotal
                  </th>
                </tr>
              </thead>

              <tbody>
                {quote.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-gray-200"
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">
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
        </section>

        <section className="space-y-2 rounded-lg bg-gray-50 p-4">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">
              Subtotal
            </span>

            <span className="font-medium text-gray-900">
              {formatMoney(quote.subtotal)}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-gray-600">
              IVA
            </span>

            <span className="font-medium text-gray-900">
              {formatMoney(quote.iva)}
            </span>
          </div>

          <div className="flex justify-between gap-4 border-t border-gray-200 pt-2 text-lg font-semibold">
            <span>Total</span>
            <span>{formatMoney(quote.total)}</span>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            variant="outline"
            disabled={downloading}
            onClick={onClose}
          >
            Cerrar
          </Button>

          {quote.status === 'DRAFT' ? (
            <>
              <Button
                variant="danger"
                disabled={downloading}
                onClick={() => onCancel(quote)}
              >
                Cancelar cotización
              </Button>

              <Button
                variant="success"
                disabled={downloading}
                onClick={() => onApprove(quote)}
              >
                Aprobar cotización
              </Button>
            </>
          ) : null}

          <Button
            variant="primary"
            loading={downloading}
            loadingText="Descargando..."
            onClick={() => onDownload(quote)}
          >
            Descargar PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}