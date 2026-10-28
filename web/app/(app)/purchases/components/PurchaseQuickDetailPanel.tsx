'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';
import Loading from '@/app/components/ui/Loading';
import { api } from '@/services/api';
import { getApiErrorMessage, isForbiddenError } from '@/services/errors';

import { canRegisterPurchaseReceipt, getPurchaseStatusDescriptor } from '../purchase-status';
import type { Purchase, PurchaseReceipt } from '../types';

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; purchase: Purchase; receipts: PurchaseReceipt[] | null; receiptsError: string };

type Props = {
  purchaseId: string;
  onClose: () => void;
  formatDate: (value: string) => string;
  formatMoney: (value: number) => string;
  canEdit: boolean;
  canApprove: boolean;
  onEdit: (purchase: Purchase) => void;
  onApprove: (purchase: Purchase) => void;
  onCancel: (purchase: Purchase) => void;
  onReceive: (purchase: Purchase) => void;
  onDownloadPdf: (purchase: Purchase) => void;
  downloadingPurchaseId: string | null;
};

function sumReceived(receipts: PurchaseReceipt[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      totals.set(
        item.purchaseItemId,
        (totals.get(item.purchaseItemId) ?? 0) + Math.max(item.quantityReceived, 0),
      );
    }
  }
  return totals;
}

export default function PurchaseQuickDetailPanel({
  purchaseId,
  onClose,
  formatDate,
  formatMoney,
  canEdit,
  canApprove,
  onEdit,
  onApprove,
  onCancel,
  onReceive,
  onDownloadPdf,
  downloadingPurchaseId,
}: Props) {
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [reloadVersion, setReloadVersion] = useState(0);

  const loadDetail = useCallback(async (isActive: () => boolean) => {
    setDetail({ status: 'loading' });
    try {
      const result = await api.get<Purchase>(`/purchases/${encodeURIComponent(purchaseId)}`);
      if (!isActive()) return;

      // Render the canonical purchase, not a potentially stale list-row snapshot.
      const purchase = result.data;
      if (!purchase || purchase.id !== purchaseId) {
        setDetail({ status: 'error', message: 'No se pudo verificar el detalle de la compra.' });
        return;
      }

      try {
        const receipts = await api.get<PurchaseReceipt[]>(
          `/purchase-receipts/purchase/${encodeURIComponent(purchaseId)}`,
        );
        if (isActive()) {
          setDetail({ status: 'ready', purchase, receipts: receipts.data, receiptsError: '' });
        }
      } catch (error: unknown) {
        if (isActive()) {
          setDetail({
            status: 'ready',
            purchase,
            receipts: null,
            receiptsError: getApiErrorMessage(error, 'No fue posible verificar las recepciones.'),
          });
        }
      }
    } catch (error: unknown) {
      if (!isActive()) return;
      setDetail({
        status: 'error',
        message: isForbiddenError(error)
          ? 'No tienes permiso para consultar esta compra.'
          : getApiErrorMessage(error, 'No fue posible cargar el detalle de la compra.'),
      });
    }
  }, [purchaseId]);

  useEffect(() => {
    let active = true;
    void loadDetail(() => active);
    return () => { active = false; };
  }, [loadDetail, reloadVersion]);

  const receivedByItem = useMemo(
    () => detail.status === 'ready' && detail.receipts
      ? sumReceived(detail.receipts)
      : null,
    [detail],
  );

  function launch(action: (purchase: Purchase) => void, purchase: Purchase) {
    onClose();
    action(purchase);
  }

  const purchase = detail.status === 'ready' ? detail.purchase : null;
  const canReceive = Boolean(
    purchase && canEdit && canRegisterPurchaseReceipt(purchase.status) && receivedByItem,
  );
  const status = purchase ? getPurchaseStatusDescriptor(purchase.status) : null;

  return (
    <Modal
      isOpen
      layout="side-panel"
      title={purchase ? `Compra ${purchase.folio}` : 'Detalle de compra'}
      description="Detalle contextual de la orden seleccionada"
      onClose={onClose}
      footer={purchase ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/purchases/${encodeURIComponent(purchase.id)}`}
            className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Ver detalle completo
          </Link>
          {canApprove && purchase.status === 'DRAFT' ? (
            <Button type="button" variant="success" onClick={() => launch(onApprove, purchase)}>
              Aprobar
            </Button>
          ) : null}
          {canEdit && purchase.status === 'DRAFT' ? (
            <Button type="button" variant="outline" onClick={() => launch(onEdit, purchase)}>
              Editar
            </Button>
          ) : null}
          {canApprove && purchase.status === 'DRAFT' ? (
            <Button type="button" variant="danger" onClick={() => launch(onCancel, purchase)}>
              Cancelar
            </Button>
          ) : null}
          {canEdit && canRegisterPurchaseReceipt(purchase.status) ? (
            <Button
              type="button"
              variant="success"
              disabled={!canReceive}
              onClick={() => launch(onReceive, purchase)}
            >
              Registrar recepción
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            loading={downloadingPurchaseId === purchase.id}
            loadingText="Descargando..."
            onClick={() => onDownloadPdf(purchase)}
          >
            Descargar PDF
          </Button>
        </div>
      ) : undefined}
    >
      {detail.status === 'loading' ? (
        <Loading message="Cargando detalle de la compra..." />
      ) : detail.status === 'error' ? (
        <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p>{detail.message}</p>
          <Button type="button" variant="outline" onClick={() => setReloadVersion((value) => value + 1)}>
            Reintentar
          </Button>
        </div>
      ) : purchase && status ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-text-muted">Registrada: {formatDate(purchase.createdAt)}</p>
              <p className="mt-1 break-words font-semibold">{purchase.supplier.name}</p>
            </div>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>

          <section aria-labelledby="quick-purchase-general" className="space-y-3">
            <h3 id="quick-purchase-general" className="font-semibold text-text">Información general</h3>
            <dl className="grid gap-3 rounded-xl border border-border bg-surface-subtle p-4 sm:grid-cols-2">
              <div><dt className="text-sm text-text-muted">Folio</dt><dd className="mt-1 break-all font-semibold">{purchase.folio}</dd></div>
              <div><dt className="text-sm text-text-muted">Proveedor</dt><dd className="mt-1 break-words font-medium">{purchase.supplier.name}</dd></div>
              <div><dt className="text-sm text-text-muted">Fecha</dt><dd className="mt-1">{formatDate(purchase.createdAt)}</dd></div>
              <div><dt className="text-sm text-text-muted">Estado</dt><dd className="mt-1">{status.label}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-text-muted">Recepción</dt>
                <dd className="mt-1 font-medium">
                  {purchase.status === 'DRAFT' ? 'Pendiente de aprobación'
                    : purchase.status === 'CANCELLED' ? 'No aplica'
                      : receivedByItem
                        ? `${purchase.receiptProgress.receivedUnits} / ${purchase.receiptProgress.orderedUnits} unidades · ${purchase.receiptProgress.pendingUnits} pendientes`
                        : 'Sin verificar'}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="quick-purchase-items" className="space-y-3">
            <h3 id="quick-purchase-items" className="font-semibold text-text">Partidas de la compra</h3>
            {detail.receiptsError ? (
              <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p>{detail.receiptsError} Las cantidades recibidas y pendientes no están verificadas.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setReloadVersion((value) => value + 1)}>
                  Reintentar verificación
                </Button>
              </div>
            ) : null}
            <p className="text-sm text-text-muted sm:hidden">
              Desliza la tabla para consultar todas las columnas.
            </p>
            <div
              role="region"
              aria-label="Partidas de la compra desplazables"
              tabIndex={0}
              className="overflow-x-auto rounded-xl border border-border focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <table className="w-full min-w-[690px] text-sm tabular-nums">
                <caption className="sr-only">Partidas de la compra {purchase.folio}</caption>
                <thead className="bg-surface-subtle">
                  <tr>{['SKU', 'Producto', 'Solicitado', 'Recibido', 'Pendiente', 'Precio unitario', 'Subtotal'].map((label) => (
                    <th scope="col" key={label} className="whitespace-nowrap px-3 py-3 text-left font-semibold">{label}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {purchase.items.map((item) => {
                    const received = receivedByItem?.get(item.id) ?? 0;
                    const pending = Math.max(item.quantity - received, 0);
                    return (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-3 py-3 font-medium">{item.product.sku}</td>
                        <td className="min-w-44 break-words px-3 py-3">{item.product.name}</td>
                        <td className="px-3 py-3">{item.quantity}</td>
                        <td className="px-3 py-3">{receivedByItem ? received : '—'}</td>
                        <td className="px-3 py-3">{receivedByItem ? pending : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-3">{formatMoney(item.price)}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-medium">{formatMoney(item.subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="quick-purchase-totals" className="space-y-3">
            <h3 id="quick-purchase-totals" className="font-semibold text-text">Resumen financiero</h3>
            <dl className="space-y-3 rounded-xl border border-border bg-surface-subtle p-4 tabular-nums">
              <div className="flex justify-between gap-3"><dt>Subtotal</dt><dd>{formatMoney(purchase.subtotal)}</dd></div>
              <div className="flex justify-between gap-3"><dt>IVA</dt><dd>{formatMoney(purchase.iva)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-border pt-3 text-lg font-semibold"><dt>Total</dt><dd>{formatMoney(purchase.total)}</dd></div>
            </dl>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
