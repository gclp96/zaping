import Link from 'next/link';

import type { PurchaseReceipt } from '../types';

type PurchaseReceiptsHistoryProps = {
  receipts: PurchaseReceipt[];
  loading: boolean;
  error: string;
  formatDate: (value: string) => string;
  formatMoney: (value: number) => string;
};

export default function PurchaseReceiptsHistory({
  receipts,
  loading,
  error,
  formatDate,
  formatMoney,
}: PurchaseReceiptsHistoryProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 font-semibold">
        Recepciones de mercancía
      </h3>

      {loading ? (
        <p className="text-sm text-gray-500">
          Cargando recepciones...
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : receipts.length === 0 ? (
        <p className="text-sm text-gray-500">
          Esta compra todavía no tiene recepciones registradas.
        </p>
      ) : (
        <div className="space-y-4">
          {receipts.map((receipt) => (
            <article
              key={receipt.id}
              className="rounded-lg border border-gray-200"
            >
              <div className="flex flex-col gap-3 bg-gray-50 p-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">
                    {receipt.folio}
                  </p>

                  <p className="text-sm text-gray-500">
                    Recibida el {formatDate(receipt.receivedAt)}
                  </p>

                  <Link
                    href={`/purchase-receipts/${encodeURIComponent(receipt.id)}`}
                    className="mt-2 inline-flex text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                  >
                    Ver recepción
                  </Link>

                  {receipt.notes ? (
                    <p className="mt-2 text-sm text-gray-600">
                      {receipt.notes}
                    </p>
                  ) : null}
                </div>

                <div className="text-sm md:text-right">
                  <p className="text-gray-500">
                    Usuario responsable
                  </p>

                  {receipt.receivedByUser ? (
                    <>
                      <p className="font-medium">
                        {receipt.receivedByUser.firstName}{' '}
                        {receipt.receivedByUser.lastName}
                      </p>

                      <p className="text-xs text-gray-500">
                        {receipt.receivedByUser.email}
                      </p>
                    </>
                  ) : (
                    <p className="font-medium">
                      No disponible
                    </p>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-gray-200 bg-white">
                      <th className="px-3 py-2 text-left">
                        Producto
                      </th>

                      <th className="px-3 py-2 text-right">
                        Recibido
                      </th>

                      <th className="px-3 py-2 text-left">
                        Lote
                      </th>

                      <th className="px-3 py-2 text-left">
                        Caducidad
                      </th>

                      <th className="px-3 py-2 text-right">
                        Costo
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {receipt.items.map((item) => (
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

                        <td className="px-3 py-3 text-right font-medium">
                          {item.quantityReceived}
                        </td>

                        <td className="px-3 py-3">
                          {item.lotNumber ??
                            item.batch?.lotNumber ??
                            '—'}
                        </td>

                        <td className="px-3 py-3">
                          {item.expirationDate
                            ? formatDate(item.expirationDate)
                            : '—'}
                        </td>

                        <td className="px-3 py-3 text-right">
                          {formatMoney(item.unitCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
