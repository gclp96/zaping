import DateInput from '@/app/components/business/DateInput';
import { CircleCheck } from 'lucide-react';

import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import Modal from '@/app/components/ui/Modal';

import type {
  CreatedPurchaseReceipt,
  PurchaseReceiptFormField,
  PurchaseReceiptFormItem,
} from '../types';

type PurchaseReceiptModalProps = {
  isOpen: boolean;

  purchase: {
    folio: string;
    supplier: {
      name: string;
    };
  } | null;

  items: PurchaseReceiptFormItem[];
  notes: string;
  saving: boolean;
  error: string;
  createdReceipt: CreatedPurchaseReceipt | null;

  onClose: () => void;

  onItemChange: (
    purchaseItemId: string,
    field: PurchaseReceiptFormField,
    value: string,
  ) => void;

  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  onViewReceipt: (receiptId: string) => void;
};

export default function PurchaseReceiptModal({
  isOpen,
  purchase,
  items,
  notes,
  saving,
  error,
  createdReceipt,
  onClose,
  onItemChange,
  onNotesChange,
  onSubmit,
  onViewReceipt,
}: PurchaseReceiptModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        createdReceipt
          ? 'Recepción registrada correctamente'
          : purchase
          ? `Registrar recepción · ${purchase.folio}`
          : 'Registrar recepción'
      }
    >
      {createdReceipt ? (
        <div className="space-y-6 py-2">
          <div className="flex items-start gap-3">
            <CircleCheck
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-green-600"
              size={28}
            />

            <div>
              <p className="text-sm text-gray-500">
                Folio de recepción
              </p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {createdReceipt.folio}
              </p>
              <p className="mt-3 text-gray-600">
                La recepción quedó registrada y ya puedes consultar su
                trazabilidad.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onClose}
            >
              Cerrar
            </Button>

            <Button
              className="w-full sm:w-auto"
              onClick={() => onViewReceipt(createdReceipt.id)}
            >
              Ver recepción
            </Button>
          </div>
        </div>
      ) : purchase ? (
        <div className="space-y-6">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">
              Proveedor
            </p>

            <p className="font-semibold">
              {purchase.supplier.name}
            </p>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">
                Esta compra ya fue recibida completamente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-237.5 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left">
                      Producto
                    </th>

                    <th className="px-3 py-3 text-right">
                      Comprado
                    </th>

                    <th className="px-3 py-3 text-right">
                      Recibido
                    </th>

                    <th className="px-3 py-3 text-right">
                      Pendiente
                    </th>

                    <th className="px-3 py-3 text-left">
                      Recibir ahora
                    </th>

                    <th className="px-3 py-3 text-left">
                      Lote
                    </th>

                    <th className="px-3 py-3 text-left">
                      Caducidad
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.purchaseItemId}
                      className="border-t border-gray-200 align-top"
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium">
                          {item.name}
                        </p>

                        <p className="text-xs text-gray-500">
                          {item.sku}
                        </p>
                      </td>

                      <td className="px-3 py-3 text-right">
                        {item.orderedQuantity}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {item.receivedQuantity}
                      </td>

                      <td className="px-3 py-3 text-right font-semibold">
                        {item.pendingQuantity}
                      </td>

                      <td className="w-36 px-3 py-3">
                        <Input
                          aria-label={`Cantidad recibida de ${item.name}`}
                          type="number"
                          min={1}
                          max={item.pendingQuantity}
                          step={1}
                          value={item.quantityReceived}
                          onChange={(event) =>
                            onItemChange(
                              item.purchaseItemId,
                              'quantityReceived',
                              event.target.value,
                            )
                          }
                        />
                      </td>

                      <td className="w-48 px-3 py-3">
                        <Input
                          aria-label={`Lote de ${item.name}`}
                          placeholder="Ej. LOTE-001"
                          value={item.lotNumber}
                          onChange={(event) =>
                            onItemChange(
                              item.purchaseItemId,
                              'lotNumber',
                              event.target.value,
                            )
                          }
                        />
                      </td>

                      <td className="w-44 px-3 py-3">
                        <DateInput
                          aria-label={`Caducidad de ${item.name}`}
                          value={item.expirationDate}
                          onValueChange={(value) =>
                            onItemChange(
                              item.purchaseItemId,
                              'expirationDate',
                              value,
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label
              htmlFor="receipt-notes"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Notas
            </label>

            <textarea
              id="receipt-notes"
              rows={3}
              maxLength={1000}
              value={notes}
              placeholder="Observaciones de la recepción..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) =>
                onNotesChange(event.target.value)
              }
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}

          <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={onClose}
            >
              Cancelar
            </Button>

            <Button
              variant="success"
              loading={saving}
              loadingText="Registrando..."
              disabled={saving || items.length === 0}
              onClick={onSubmit}
            >
              Registrar recepción
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
