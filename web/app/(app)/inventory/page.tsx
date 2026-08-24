'use client';

import { useEffect, useState } from 'react';

import { api } from '@/services/api';

import StatusBadge from '@/app/components/business/StatusBadge';
import EmptyState from '@/app/components/ui/EmptyState';
import Loading from '@/app/components/ui/Loading';
import Table from '@/app/components/ui/Table';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';

import { getInventoryStatusDescriptor } from './inventory-status';

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  price: number;
};

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  async function loadInventory() {
    try {
      const response = await api.get<InventoryItem[]>('/inventory');

      setInventory(response.data);
    } catch (error) {
      console.error('Error al cargar el inventario:', error);
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInventory();
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Inventario"
        description="Consulta el stock actual de todos los productos"
      />

      {pageLoading ? (
        <Loading message="Cargando inventario..." />
      ) : inventory.length === 0 ? (
        <EmptyState
          title="Inventario vacío"
          description="Todavía no existen productos registrados."
        />
      ) : (
        <Section>
          <Table
            headers={[
              'SKU',
              'Producto',
              'Stock',
              'Stock mínimo',
              'Estado',
            ]}
            data={inventory.map((item) => {
              const descriptor = getInventoryStatusDescriptor(
                item.stock,
                item.minStock,
              );

              return {
                sku: item.sku,
                name: item.name,
                stock: item.stock,
                minStock: item.minStock,
                status: (
                  <StatusBadge
                    label={descriptor.label}
                    tone={descriptor.tone}
                    ariaLabel={`Estado del inventario de ${item.name}: ${descriptor.label}`}
                  />
                ),
              };
            })}
          />
        </Section>
      )}
    </PageContainer>
  );
}