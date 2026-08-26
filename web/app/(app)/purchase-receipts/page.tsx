'use client';

import Link from 'next/link';
import { Eye, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import Button from '@/app/components/ui/Button';
import EmptyState from '@/app/components/ui/EmptyState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Table from '@/app/components/ui/Table';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import {
  formatReceiptDate,
  getReceiptResponsibleLabel,
  receiptMatchesSearch,
} from './receipt-display';
import type { PurchaseReceiptListItem } from './types';

export default function PurchaseReceiptsPage() {
  const [receipts, setReceipts] = useState<PurchaseReceiptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const filteredReceipts = useMemo(
    () => receipts.filter((receipt) => receiptMatchesSearch(receipt, search)),
    [receipts, search],
  );

  const loadReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get<PurchaseReceiptListItem[]>(
        '/purchase-receipts',
      );

      setReceipts(response.data);
    } catch (requestError: unknown) {
      console.error(requestError);
      setError(
        getApiErrorMessage(
          requestError,
          'No fue posible cargar las recepciones.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReceipts();
  }, [loadReceipts]);

  return (
    <PageContainer>
      <PageHeader
        title="Recepciones"
        description="Consulta las entradas de mercancía y su trazabilidad operativa."
      />

      {loading ? (
        <Loading message="Cargando recepciones..." />
      ) : error ? (
        <Section>
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadReceipts()}
            >
              Reintentar
            </Button>
          </div>
        </Section>
      ) : receipts.length === 0 ? (
        <EmptyState
          title="Sin recepciones registradas"
          description="Todavía no existen entradas de mercancía registradas."
        />
      ) : (
        <Section
          title="Historial de recepciones"
          description="Recepciones registradas para las compras de la compañía."
        >
          <div className="max-w-xl">
            <Input
              label="Buscar recepciones"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Folio, compra, proveedor, responsable o producto"
              startAdornment={<Search size={17} />}
            />
          </div>

          {filteredReceipts.length === 0 ? (
            <EmptyState
              title="Sin recepciones coincidentes"
              description="Ninguna recepción coincide con la búsqueda actual."
            />
          ) : (
            <Table
              headers={[
                'Folio',
                'Compra',
                'Proveedor',
                'Fecha de recepción',
                'Responsable',
                'Partidas',
                'Unidades',
                'Acciones',
              ]}
              data={filteredReceipts.map((receipt) => ({
                folio: (
                  <span className="font-semibold text-gray-900">
                    {receipt.folio}
                  </span>
                ),
                purchase: receipt.purchase.folio,
                supplier: receipt.purchase.supplier.name,
                receivedAt: formatReceiptDate(receipt.receivedAt),
                responsible: getReceiptResponsibleLabel(
                  receipt.receivedByUser,
                ),
                items: receipt.items.length,
                units: receipt.items.reduce(
                  (total, item) => total + item.quantityReceived,
                  0,
                ),
                actions: (
                  <Link
                    href={`/purchase-receipts/${receipt.id}`}
                    aria-label={`Ver recepción ${receipt.folio}`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <Eye aria-hidden="true" size={16} />
                    Ver
                  </Link>
                ),
              }))}
            />
          )}
        </Section>
      )}
    </PageContainer>
  );
}
