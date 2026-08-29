import { useRef, useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import type {
  CreatedPurchaseReceipt,
  Purchase,
  PurchaseReceipt,
  PurchaseReceiptFieldErrors,
  PurchaseReceiptFormField,
  PurchaseReceiptFormItem,
} from '../types';

type UsePurchaseReceiptsParams = {
  purchaseReceipts: PurchaseReceipt[];
  receiptHistoryReady: boolean;
  onReceiptCreated: () => Promise<void>;
};

export function usePurchaseReceipts({
  purchaseReceipts,
  receiptHistoryReady,
  onReceiptCreated,
}: UsePurchaseReceiptsParams) {
  const [purchaseToReceive, setPurchaseToReceive] =
    useState<Purchase | null>(null);

  const [receiptFormItems, setReceiptFormItems] = useState<
    PurchaseReceiptFormItem[]
  >([]);

  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [createdReceipt, setCreatedReceipt] =
    useState<CreatedPurchaseReceipt | null>(null);
  const [receiptIdempotencyKey, setReceiptIdempotencyKey] =
    useState<string | null>(null);
  const [receiptFormError, setReceiptFormError] =
    useState('');
  const [receiptFieldErrors, setReceiptFieldErrors] =
    useState<PurchaseReceiptFieldErrors>({});
  const receiptSubmissionInFlight = useRef(false);

  function clearReceiptAttempt() {
    setPurchaseToReceive(null);
    setReceiptFormItems([]);
    setReceiptNotes('');
    setReceiptFormError('');
    setReceiptFieldErrors({});
    setReceiptIdempotencyKey(null);
    receiptSubmissionInFlight.current = false;
  }

  function resetReceiptState() {
    clearReceiptAttempt();
    setCreatedReceipt(null);
  }

  function openReceiptModal(
    purchase: Purchase,
    options?: {
      verifiedPurchaseReceipts?: PurchaseReceipt[];
    },
  ): boolean {
    if (!receiptHistoryReady && !options?.verifiedPurchaseReceipts) {
      return false;
    }

    const receiptsForForm =
      options?.verifiedPurchaseReceipts ?? purchaseReceipts;

    const formItems: PurchaseReceiptFormItem[] =
      purchase.items
        .map((purchaseItem) => {
          const receivedQuantity =
            receiptsForForm.reduce(
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
            inventoryTracking:
              purchaseItem.product.inventoryTracking,
            lotTracking: purchaseItem.product.lotTracking,

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

    setCreatedReceipt(null);
    setPurchaseToReceive(purchase);
    setReceiptFormItems(formItems);
    setReceiptNotes('');
    setReceiptFormError('');
    setReceiptFieldErrors({});
    setReceiptIdempotencyKey(crypto.randomUUID());

    return true;
  }

  function closeReceiptModal() {
    if (receiptSaving) {
      return;
    }

    resetReceiptState();
  }

  function handleReceiptItemChange(
    purchaseItemId: string,
    field: PurchaseReceiptFormField,
    value: string,
  ) {
    setReceiptFormItems((currentItems) =>
      currentItems.map((item) =>
        item.purchaseItemId === purchaseItemId
          ? item.lotTracking === 'NONE' &&
            (field === 'lotNumber' ||
              field === 'expirationDate')
            ? {
                ...item,
                lotNumber: '',
                expirationDate: '',
              }
            : {
                ...item,
                [field]: value,
              }
          : item,
      ),
    );

    setReceiptFormError('');
    setReceiptFieldErrors((currentErrors) => {
      const itemErrors = currentErrors[purchaseItemId];

      if (!itemErrors) {
        return currentErrors;
      }

      const nextItemErrors = { ...itemErrors };
      delete nextItemErrors[field];

      if (field === 'lotNumber') {
        delete nextItemErrors.expirationDate;
      }

      if (Object.keys(nextItemErrors).length === 0) {
        const remainingErrors = { ...currentErrors };
        delete remainingErrors[purchaseItemId];

        return remainingErrors;
      }

      return {
        ...currentErrors,
        [purchaseItemId]: nextItemErrors,
      };
    });
  }

  function handleReceiptNotesChange(value: string) {
    setReceiptNotes(value);
    setReceiptFormError('');
  }

  function setReceiptFieldError(
    purchaseItemId: string,
    field: PurchaseReceiptFormField,
    message: string,
  ) {
    setReceiptFieldErrors((currentErrors) => ({
      ...currentErrors,
      [purchaseItemId]: {
        ...currentErrors[purchaseItemId],
        [field]: message,
      },
    }));
  }

  async function handleCreateReceipt() {
    if (
      !purchaseToReceive ||
      !receiptIdempotencyKey ||
      receiptSubmissionInFlight.current
    ) {
      return;
    }

    setReceiptFormError('');
    setReceiptFieldErrors({});

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
      const message = `La cantidad de ${invalidQuantityItem.name} debe ser un entero entre 1 y ${invalidQuantityItem.pendingQuantity}.`;

      setReceiptFormError(message);
      setReceiptFieldError(
        invalidQuantityItem.purchaseItemId,
        'quantityReceived',
        message,
      );
      return;
    }

    const missingRequiredLot = selectedItems.find(
      (item) =>
        item.lotTracking === 'REQUIRED' &&
        item.lotNumber.trim() === '',
    );

    if (missingRequiredLot) {
      const message = `El producto ${missingRequiredLot.sku} requiere número de lote.`;

      setReceiptFormError(message);
      setReceiptFieldError(
        missingRequiredLot.purchaseItemId,
        'lotNumber',
        message,
      );
      return;
    }

    const expirationWithoutLot =
      selectedItems.find(
        (item) =>
          item.lotTracking !== 'NONE' &&
          item.expirationDate.trim() !== '' &&
          item.lotNumber.trim() === '',
      );

    if (expirationWithoutLot) {
      const message = `Captura el número de lote de ${expirationWithoutLot.name} para registrar su caducidad.`;

      setReceiptFormError(message);
      setReceiptFieldError(
        expirationWithoutLot.purchaseItemId,
        'expirationDate',
        message,
      );
      return;
    }

    try {
      receiptSubmissionInFlight.current = true;
      setReceiptSaving(true);

      const response = await api.post<PurchaseReceipt>(
        '/purchase-receipts',
        {
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
              item.lotTracking === 'NONE'
                ? undefined
                : item.lotNumber.trim() || undefined,
            expirationDate:
              item.lotTracking === 'NONE'
                ? undefined
                : item.expirationDate.trim() ||
                  undefined,
          })),
        },
        {
          headers: {
            'Idempotency-Key': receiptIdempotencyKey,
          },
        },
      );

      await onReceiptCreated();

      clearReceiptAttempt();
      setCreatedReceipt({
        id: response.data.id,
        folio: response.data.folio,
      });
    } catch (error: unknown) {
      console.error(error);

      setReceiptFormError(
        getApiErrorMessage(
          error,
          'No fue posible registrar la recepción.',
        ),
      );
    } finally {
      receiptSubmissionInFlight.current = false;
      setReceiptSaving(false);
    }
  }

  return {
    purchaseToReceive,
    receiptFormItems,
    receiptNotes,
    receiptSaving,
    receiptFormError,
    receiptFieldErrors,
    createdReceipt,

    openReceiptModal,
    closeReceiptModal,
    handleReceiptItemChange,
    handleReceiptNotesChange,
    handleCreateReceipt,
  };
}
