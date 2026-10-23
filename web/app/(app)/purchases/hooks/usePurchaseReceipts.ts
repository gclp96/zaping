import { useEffect, useRef, useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import { hasOptionalReceiptTraceability } from '../receipt-traceability';

import type {
  ReceiptAuthority,
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
  const [purchaseToReceive, setPurchaseToReceive] = useState<Purchase | null>(
    null,
  );

  const [receiptFormItems, setReceiptFormItems] = useState<
    PurchaseReceiptFormItem[]
  >([]);

  const [receiptAuthority, setReceiptAuthority] =
    useState<ReceiptAuthority | null>(null);
  const [receiptAuthorityError, setReceiptAuthorityError] = useState('');
  const [authorityAttempt, setAuthorityAttempt] = useState(0);

  useEffect(() => {
    if (!purchaseToReceive) return;
    let active = true;
    async function load() {
      try {
        const { data } = await api.get<{ authority: ReceiptAuthority }>(
          '/purchase-receipts/capabilities',
        );
        if (data?.authority !== 'PHYSICAL' && data?.authority !== 'LEGACY') {
          throw new Error('Invalid receipt capability');
        }
        if (active) setReceiptAuthority(data.authority);
      } catch (error: unknown) {
        if (active)
          setReceiptAuthorityError(
            getApiErrorMessage(
              error,
              'No fue posible verificar si la empresa puede recibir mercancía. Reintenta antes de registrar la recepción.',
            ),
          );
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [purchaseToReceive, authorityAttempt]);

  function retryReceiptAuthority() {
    setReceiptAuthority(null);
    setReceiptAuthorityError('');
    setAuthorityAttempt((attempt) => attempt + 1);
  }

  const [receiptNotes, setReceiptNotes] = useState('');
  const [supplierDocumentType, setSupplierDocumentType] = useState('');
  const [supplierDocumentNumber, setSupplierDocumentNumber] = useState('');
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [createdReceipt, setCreatedReceipt] =
    useState<CreatedPurchaseReceipt | null>(null);
  const [receiptIdempotencyKey, setReceiptIdempotencyKey] = useState<
    string | null
  >(null);
  const [receiptFormError, setReceiptFormError] = useState('');
  const [receiptFieldErrors, setReceiptFieldErrors] =
    useState<PurchaseReceiptFieldErrors>({});
  const receiptSubmissionInFlight = useRef(false);

  function clearReceiptAttempt() {
    setPurchaseToReceive(null);
    setReceiptAuthority(null);
    setReceiptAuthorityError('');
    setReceiptFormItems([]);
    setReceiptNotes('');
    setSupplierDocumentType('');
    setSupplierDocumentNumber('');
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

    const formItems: PurchaseReceiptFormItem[] = purchase.items
      .map((purchaseItem) => {
        const receivedQuantity = receiptsForForm.reduce((total, receipt) => {
          const receivedFromReceipt = receipt.items
            .filter(
              (receiptItem) => receiptItem.purchaseItemId === purchaseItem.id,
            )
            .reduce(
              (receiptTotal, receiptItem) =>
                receiptTotal + receiptItem.quantityReceived,
              0,
            );

          return total + receivedFromReceipt;
        }, 0);

        const pendingQuantity = Math.max(
          purchaseItem.quantity - receivedQuantity,
          0,
        );

        return {
          purchaseItemId: purchaseItem.id,
          productId: purchaseItem.productId,
          sku: purchaseItem.product.sku,
          name: purchaseItem.product.name,
          inventoryTracking: purchaseItem.product.inventoryTracking,
          lotTracking: purchaseItem.product.lotTracking,

          orderedQuantity: purchaseItem.quantity,
          receivedQuantity,
          pendingQuantity,

          quantityReceived: '',
          lotNumber: '',
          expirationDate: '',
        };
      })
      .filter((item) => item.pendingQuantity > 0);

    setCreatedReceipt(null);
    setReceiptAuthority(null);
    setReceiptAuthorityError('');
    setPurchaseToReceive(purchase);
    setReceiptFormItems(formItems);
    setReceiptNotes('');
    setSupplierDocumentType('');
    setSupplierDocumentNumber('');
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
          ? !hasOptionalReceiptTraceability(receiptAuthority, item) &&
            item.lotTracking === 'NONE' &&
            (field === 'lotNumber' || field === 'expirationDate')
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
      !receiptAuthority ||
      !receiptIdempotencyKey ||
      receiptSubmissionInFlight.current
    ) {
      return;
    }

    setReceiptFormError('');
    setReceiptFieldErrors({});

    if (
      Boolean(supplierDocumentType) !== Boolean(supplierDocumentNumber.trim())
    ) {
      setReceiptFormError(
        'Selecciona el tipo y número del documento del proveedor, o deja ambos vacíos.',
      );
      return;
    }

    const selectedItems = receiptFormItems.filter(
      (item) => item.quantityReceived.trim() !== '',
    );

    if (selectedItems.length === 0) {
      setReceiptFormError(
        'Captura la cantidad recibida de al menos un producto.',
      );
      return;
    }

    const invalidQuantityItem = selectedItems.find((item) => {
      const parsedQuantity = Number(item.quantityReceived);

      return (
        !Number.isInteger(parsedQuantity) ||
        parsedQuantity < 1 ||
        parsedQuantity > item.pendingQuantity
      );
    });

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
        !hasOptionalReceiptTraceability(receiptAuthority, item) &&
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

    const expirationWithoutLot = selectedItems.find(
      (item) =>
        !hasOptionalReceiptTraceability(receiptAuthority, item) &&
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
          notes: receiptNotes.trim() || undefined,
          supplierDocumentType: supplierDocumentType || undefined,
          supplierDocumentNumber: supplierDocumentNumber.trim() || undefined,
          items: selectedItems.map((item) => ({
            purchaseItemId: item.purchaseItemId,
            quantityReceived: Number(item.quantityReceived),
            lotNumber:
              !hasOptionalReceiptTraceability(receiptAuthority, item) &&
              item.lotTracking === 'NONE'
                ? undefined
                : item.lotNumber.trim() || undefined,
            expirationDate:
              !hasOptionalReceiptTraceability(receiptAuthority, item) &&
              item.lotTracking === 'NONE'
                ? undefined
                : item.expirationDate.trim() || undefined,
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
      setReceiptFormError(
        getApiErrorMessage(error, 'No fue posible registrar la recepción.'),
      );
    } finally {
      receiptSubmissionInFlight.current = false;
      setReceiptSaving(false);
    }
  }

  return {
    purchaseToReceive,
    receiptAuthority,
    receiptAuthorityError,
    retryReceiptAuthority,
    receiptFormItems,
    receiptNotes,
    supplierDocumentType,
    supplierDocumentNumber,
    setSupplierDocumentType,
    setSupplierDocumentNumber,
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
