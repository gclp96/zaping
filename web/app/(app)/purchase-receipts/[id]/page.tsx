'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import Loading from '@/app/components/ui/Loading';
import Table from '@/app/components/ui/Table';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import {
  getEquipmentConditionDescriptor,
  getEquipmentLifecycleDescriptor,
  getEquipmentOriginLabel,
} from '@/app/(app)/equipment/equipment-display';
import {
  formatMovementDate,
  getMovementTypeDescriptor,
} from '@/app/(app)/inventory/inventory-ledger';
import { getPurchaseStatusDescriptor } from '@/app/(app)/purchases/purchase-status';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import {
  formatReceiptDate,
  formatReceiptMoney,
  getReceiptResponsibleLabel,
} from '../receipt-display';
import type { PurchaseReceiptDetail } from '../types';

type DetailFieldProps = {
  label: string;
  children: ReactNode;
};

function DetailField({ label, children }: DetailFieldProps) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-gray-900">{children}</dd>
    </div>
  );
}

const backLink = (
  <Link
    href="/purchase-receipts"
    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-100"
  >
    <ArrowLeft aria-hidden="true" size={18} />
    Volver
  </Link>
);

const traceabilityActionClassName =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100';

export default function PurchaseReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<PurchaseReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReceipt = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setReceipt(null);

      const response = await api.get<PurchaseReceiptDetail>(
        `/purchase-receipts/${id}`,
      );

      setReceipt(response.data);
    } catch (requestError: unknown) {
      console.error(requestError);
      setError(
        getApiErrorMessage(
          requestError,
          'No fue posible cargar el detalle de la recepción.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReceipt();
  }, [loadReceipt]);

  const equipmentRows = useMemo(
    () =>
      receipt?.items.flatMap((item) =>
        item.equipmentAssets.map((asset) => ({
          asset,
          lotNumber:
            asset.batch?.lotNumber ??
            item.batch?.lotNumber ??
            item.lotNumber ??
            '—',
        })),
      ) ?? [],
    [receipt],
  );

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Recepción" action={backLink} />
        <Loading message="Cargando detalle de la recepción..." />
      </PageContainer>
    );
  }

  if (error || !receipt) {
    return (
      <PageContainer>
        <PageHeader title="Recepción" action={backLink} />
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error || 'Recepción no encontrada.'}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadReceipt()}
          >
            Reintentar
          </Button>
        </div>
      </PageContainer>
    );
  }

  const purchaseStatus = getPurchaseStatusDescriptor(receipt.purchase.status);
  const responsible = getReceiptResponsibleLabel(receipt.receivedByUser);
  const inventorySearchParams = new URLSearchParams({
    tab: 'movements',
    referenceType: 'PURCHASE_RECEIPT',
    referenceId: receipt.id,
    receiptFolio: receipt.folio,
  });

  return (
    <PageContainer>
      <PageHeader
        title={`Recepción ${receipt.folio}`}
        description={`${formatReceiptDate(receipt.receivedAt)} | ${responsible}`}
        action={backLink}
      />

      <Section title="General">
        <dl className="grid gap-x-8 gap-y-5 border-t border-gray-200 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Folio">{receipt.folio}</DetailField>
          <DetailField label="Fecha de recepción">
            {formatReceiptDate(receipt.receivedAt)}
          </DetailField>
          <DetailField label="Responsable">{responsible}</DetailField>
          <DetailField label="Notas">
            {receipt.notes || 'Sin notas'}
          </DetailField>
        </dl>
      </Section>

      <div className="border-t border-gray-200 pt-8">
        <Section
          title="Compra y proveedor"
          action={
            <Link
              href={`/purchases?purchaseId=${encodeURIComponent(receipt.purchase.id)}`}
              className={traceabilityActionClassName}
            >
              Ver compra
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          }
        >
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <DetailField label="Compra">{receipt.purchase.folio}</DetailField>
            <DetailField label="Estado de compra">
              <StatusBadge
                label={purchaseStatus.label}
                tone={purchaseStatus.tone}
                ariaLabel={`Estado de compra: ${purchaseStatus.label}`}
              />
            </DetailField>
            <DetailField label="Proveedor">
              {receipt.purchase.supplier.name}
            </DetailField>
            <DetailField label="Total de compra">
              {formatReceiptMoney(receipt.purchase.total)}
            </DetailField>
          </dl>
        </Section>
      </div>

      <div className="border-t border-gray-200 pt-8">
        <Section
          title="Partidas recibidas"
          description="Productos y costos registrados en esta recepción."
        >
          <Table
            headers={[
              'SKU',
              'Producto',
              'Cantidad recibida',
              'Costo unitario',
              'Lote',
              'Caducidad',
              'Equipo generado',
            ]}
            data={receipt.items.map((item) => ({
              sku: item.product.sku,
              product: item.product.name,
              quantity: item.quantityReceived,
              unitCost: formatReceiptMoney(item.unitCost),
              batch: item.batch?.lotNumber ?? item.lotNumber ?? '—',
              expiration: item.expirationDate
                ? formatReceiptDate(item.expirationDate)
                : '—',
              equipment: item.equipmentAssets.length,
            }))}
          />
        </Section>
      </div>

      <div className="border-t border-gray-200 pt-8">
        <Section
          title="Movimientos de inventario"
          description="Entradas asociadas directamente con esta recepción."
          action={
            <Link
              href={`/inventory?${inventorySearchParams.toString()}`}
              className={traceabilityActionClassName}
            >
              Ver en inventario
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          }
        >
          {receipt.inventoryMovements.length === 0 ? (
            <p className="border-l-4 border-gray-300 py-2 pl-4 text-gray-600">
              No hay movimientos de inventario asociados a esta recepción.
            </p>
          ) : (
            <Table
              headers={[
                'Fecha',
                'Producto',
                'Tipo',
                'Cantidad',
                'Saldo',
                'Costo unitario',
                'Referencia',
              ]}
              data={receipt.inventoryMovements.map((movement) => {
                const descriptor = getMovementTypeDescriptor(
                  movement.movementType,
                );

                return {
                  date: formatMovementDate(movement.createdAt),
                  product: (
                    <div>
                      <p className="font-medium text-gray-900">
                        {movement.product.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {movement.product.sku}
                      </p>
                    </div>
                  ),
                  type: (
                    <StatusBadge
                      label={descriptor.label}
                      tone={descriptor.tone}
                      ariaLabel={`Tipo de movimiento: ${descriptor.label}`}
                    />
                  ),
                  quantity: movement.quantity,
                  balance: movement.balance ?? 'No disponible',
                  unitCost:
                    movement.unitCost == null
                      ? '—'
                      : formatReceiptMoney(movement.unitCost),
                  reference: `Recepción ${receipt.folio}`,
                };
              })}
            />
          )}
        </Section>
      </div>

      <div className="border-t border-gray-200 pt-8">
        <Section
          title="Equipos generados"
          description="Unidades físicas creadas por las partidas recibidas."
        >
          {equipmentRows.length === 0 ? (
            <p className="border-l-4 border-gray-300 py-2 pl-4 text-gray-600">
              Esta recepción no generó equipos.
            </p>
          ) : (
            <Table
              headers={[
                'Código',
                'Producto',
                'Serie',
                'Estado',
                'Condición',
                'Origen',
                'Lote',
              ]}
              data={equipmentRows.map(({ asset, lotNumber }) => {
                const lifecycle = getEquipmentLifecycleDescriptor(
                  asset.lifecycle,
                );
                const condition = getEquipmentConditionDescriptor(
                  asset.condition,
                );

                return {
                  code: (
                    <Link
                      href={`/equipment?assetId=${encodeURIComponent(asset.id)}`}
                      aria-label={`Ver equipo ${asset.assetCode}`}
                      className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                    >
                      {asset.assetCode}
                    </Link>
                  ),
                  product: (
                    <div>
                      <p className="font-medium text-gray-900">
                        {asset.product.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {asset.product.sku}
                      </p>
                    </div>
                  ),
                  serial: asset.serialNumber || '—',
                  lifecycle: (
                    <StatusBadge
                      label={lifecycle.label}
                      tone={lifecycle.tone}
                      ariaLabel={`Estado del equipo ${asset.assetCode}: ${lifecycle.label}`}
                    />
                  ),
                  condition: (
                    <StatusBadge
                      label={condition.label}
                      tone={condition.tone}
                      ariaLabel={`Condición del equipo ${asset.assetCode}: ${condition.label}`}
                    />
                  ),
                  origin: getEquipmentOriginLabel(asset.origin),
                  batch: lotNumber,
                };
              })}
            />
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
