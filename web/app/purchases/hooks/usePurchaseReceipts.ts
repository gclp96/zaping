import { useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type {
  Purchase,
  PurchaseReceipt,
  PurchaseReceiptFormField,
  PurchaseReceiptFormItem,
} from '../types';

type UsePurchaseReceiptsParams = {
  purchaseReceipts: PurchaseReceipt[];
  onReceiptCreated: () => Promise<void>;
};

export function usePurchaseReceipts({
  purchaseReceipts,
  onReceiptCreated,
}: UsePurchaseReceiptsParams) {
  const [purchaseToReceive, setPurchaseToReceive] =
    useState<Purchase | null>(null);

  const [receiptFormItems, setReceiptFormItems] = useState<
    PurchaseReceiptFormItem[]
  >([]);

  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptFormError, setReceiptFormError] =
    useState('');

  function resetReceiptForm() {
    setPurchaseToReceive(null);
    setReceiptFormItems([]);
    setReceiptNotes('');
    setReceiptFormError('');
  }

  function openReceiptModal(purchase: Purchase) {
    const formItems: PurchaseReceiptFormItem[] =
      purchase.items
        .map((purchaseItem) => {
          const receivedQuantity =
            purchaseReceipts.reduce(
              (total, receipt) => {
                const receivedFromReceipt =
                  receipt.items
                    .filter(
                      (receiptItem) =>
                        receiptItem.purchaseItemId ===
                        purchaseItem.id,
                    )
                    .reduce(
                      (
                        receiptTotal,
                        receiptItem,
                      ) =>
                        receiptTotal +
                        receiptItem.quantityReceived,
                      0,
                    );

                return total + receivedFromReceipt;
              },
              0,
            );

          const pendingQuantity = Math.max(
            purchaseItem.quantity -
              receivedQuantity,
            0,
          );

          return {
            purchaseItemId: purchaseItem.id,
            productId: purchaseItem.productId,
            sku: purchaseItem.product.sku,
            name: purchaseItem.product.name,

            orderedQuantity: purchaseItem.quantity,
            receivedQuantity,
            pendingQuantity,

            quantityReceived: '',
            lotNumber: '',
            expirationDate: '',
          };
        })
        .filter(
          (item) => item.pendingQuantity > 0,
        );

    setPurchaseToReceive(purchase);
    setReceiptFormItems(formItems);
    setReceiptNotes('');
    setReceiptFormError('');
  }

  function closeReceiptModal() {
    if (receiptSaving) {
      return;
    }

    resetReceiptForm();
  }

  function handleReceiptItemChange(
    purchaseItemId: string,
    field: PurchaseReceiptFormField,
    value: string,
  ) {
    setReceiptFormItems((currentItems) =>
      currentItems.map((item) =>
        item.purchaseItemId === purchaseItemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );

    setReceiptFormError('');
  }

  function handleReceiptNotesChange(value: string) {
    setReceiptNotes(value);
    setReceiptFormError('');
  }

  async function handleCreateReceipt() {
    if (!purchaseToReceive) {
      return;
    }

    setReceiptFormError('');

    const selectedItems = receiptFormItems.filter(
      (item) =>
        item.quantityReceived.trim() !== '',
    );

    if (selectedItems.length === 0) {
      setReceiptFormError(
        'Captura la cantidad recibida de al menos un producto.',
      );
      return;
    }

    const invalidQuantityItem = selectedItems.find(
      (item) => {
        const parsedQuantity = Number(
          item.quantityReceived,
        );

        return (
          !Number.isInteger(parsedQuantity) ||
          parsedQuantity < 1 ||
          parsedQuantity > item.pendingQuantity
        );
      },
    );

    if (invalidQuantityItem) {
      setReceiptFormError(
        `La cantidad de ${invalidQuantityItem.name} debe ser un entero entre 1 y ${invalidQuantityItem.pendingQuantity}.`,
      );
      return;
    }

    const expirationWithoutLot =
      selectedItems.find(
        (item) =>
          item.expirationDate.trim() !== '' &&
          item.lotNumber.trim() === '',
      );

    if (expirationWithoutLot) {
      setReceiptFormError(
        `Captura el número de lote de ${expirationWithoutLot.name} para registrar su caducidad.`,
      );
      return;
    }

    try {
      setReceiptSaving(true);

      await api.post('/purchase-receipts', {
        purchaseId: purchaseToReceive.id,
        notes:
          receiptNotes.trim() || undefined,
        items: selectedItems.map((item) => ({
          purchaseItemId:
            item.purchaseItemId,
          quantityReceived: Number(
            item.quantityReceived,
          ),
          lotNumber:
            item.lotNumber.trim() || undefined,
          expirationDate:
            item.expirationDate.trim() ||
            undefined,
        })),
      });

      await onReceiptCreated();

      resetReceiptForm();
    } catch (error: unknown) {
      console.error(error);

      setReceiptFormError(
        getApiErrorMessage(
          error,
          'No fue posible registrar la recepción.',
        ),
      );
    } finally {
      setReceiptSaving(false);
    }
  }

  return {
    purchaseToReceive,
    receiptFormItems,
    receiptNotes,
    receiptSaving,
    receiptFormError,

    openReceiptModal,
    closeReceiptModal,
    handleReceiptItemChange,
    handleReceiptNotesChange,
    handleCreateReceipt,
  };
}