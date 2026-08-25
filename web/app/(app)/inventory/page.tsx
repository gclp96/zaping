'use client';

import { useEffect, useMemo, useState } from 'react';

import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import EmptyState from '@/app/components/ui/EmptyState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Select from '@/app/components/ui/Select';
import Table from '@/app/components/ui/Table';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import {
  compactReferenceId,
  formatMovementDate,
  getMovementTypeDescriptor,
  getReferenceTypeLabel,
  movementMatchesSearch,
  type InventoryItem,
  type InventoryMovement,
  type InventoryMovementType,
} from './inventory-ledger';
import { getInventoryStatusDescriptor } from './inventory-status';

type InventoryView = 'stock' | 'movements';
type MovementTypeFilter = '' | InventoryMovementType;

const movementTypeOptions = [
  { value: 'IN', label: 'Entrada' },
  { value: 'OUT', label: 'Salida' },
  { value: 'ADJUSTMENT', label: 'Ajuste' },
];

export default function InventoryPage() {
  const [activeView, setActiveView] = useState<InventoryView>('stock');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [movementsError, setMovementsError] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] =
    useState<MovementTypeFilter>('');

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      const matchesType =
        !movementTypeFilter || movement.movementType === movementTypeFilter;

      return matchesType && movementMatchesSearch(movement, movementSearch);
    });
  }, [movementSearch, movementTypeFilter, movements]);

  async function loadInventory() {
    try {
      setInventoryLoading(true);
      setInventoryError('');

      const response = await api.get<InventoryItem[]>('/inventory');

      setInventory(response.data);
    } catch (error: unknown) {
      console.error(error);
      setInventoryError(
        getApiErrorMessage(
          error,
          'No fue posible cargar las existencias actuales.',
        ),
      );
    } finally {
      setInventoryLoading(false);
    }
  }

  async function loadMovements() {
    try {
      setMovementsLoading(true);
      setMovementsError('');

      const response = await api.get<InventoryMovement[]>(
        '/inventory/movements',
      );

      setMovements(response.data);
    } catch (error: unknown) {
      console.error(error);
      setMovementsError(
        getApiErrorMessage(
          error,
          'No fue posible cargar el historial de movimientos.',
        ),
      );
    } finally {
      setMovementsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.all([loadInventory(), loadMovements()]);
  }, []);

  function renderInventoryView() {
    if (inventoryLoading) {
      return <Loading message="Cargando existencias..." />;
    }

    if (inventoryError) {
      return (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{inventoryError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadInventory()}
          >
            Reintentar existencias
          </Button>
        </div>
      );
    }

    if (inventory.length === 0) {
      return (
        <EmptyState
          title="Inventario vacío"
          description="Todavía no existen productos registrados."
        />
      );
    }

    return (
      <Table
        headers={[
          'SKU',
          'Producto',
          'Stock actual',
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
    );
  }

  function renderMovementsView() {
    if (movementsLoading) {
      return <Loading message="Cargando movimientos..." />;
    }

    if (movementsError) {
      return (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{movementsError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadMovements()}
          >
            Reintentar movimientos
          </Button>
        </div>
      );
    }

    if (movements.length === 0) {
      return (
        <EmptyState
          title="Sin movimientos de inventario"
          description="Todavía no existe historial de entradas, salidas o ajustes."
        />
      );
    }

    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Buscar movimientos"
            type="search"
            value={movementSearch}
            onChange={(event) => setMovementSearch(event.target.value)}
            placeholder="SKU, producto o referencia"
          />
          <Select
            label="Tipo de movimiento"
            value={movementTypeFilter}
            onChange={(event) =>
              setMovementTypeFilter(event.target.value as MovementTypeFilter)
            }
            options={movementTypeOptions}
            placeholder="Todos los tipos"
          />
        </div>

        {filteredMovements.length === 0 ? (
          <EmptyState
            title="Sin movimientos coincidentes"
            description="Ningún movimiento coincide con los filtros actuales."
          />
        ) : (
          <Table
            headers={[
              'Fecha',
              'Producto',
              'Tipo',
              'Cantidad',
              'Balance posterior',
              'Referencia',
              'Notas',
            ]}
            data={filteredMovements.map((movement) => {
              const typeDescriptor = getMovementTypeDescriptor(
                movement.movementType,
              );
              const quantityUnit =
                movement.quantity === 1 ? 'unidad' : 'unidades';
              const referenceLabel = getReferenceTypeLabel(
                movement.referenceType,
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
                    label={typeDescriptor.label}
                    tone={typeDescriptor.tone}
                    ariaLabel={`Tipo de movimiento: ${typeDescriptor.label}`}
                  />
                ),
                quantity: (
                  <span
                    className={`font-semibold ${typeDescriptor.quantityClassName}`}
                    aria-label={`${typeDescriptor.label}: ${movement.quantity} ${quantityUnit}`}
                  >
                    {movement.quantity}
                  </span>
                ),
                balance: movement.balance ?? 'No disponible',
                reference: (
                  <div>
                    <p className="font-medium text-gray-900">
                      {referenceLabel}
                    </p>
                    {movement.referenceId ? (
                      <p
                        className="text-sm text-gray-500"
                        aria-label={`Identificador de referencia: ${movement.referenceId}`}
                      >
                        ID {compactReferenceId(movement.referenceId)}
                      </p>
                    ) : null}
                  </div>
                ),
                notes: movement.notes || '-',
              };
            })}
          />
        )}
      </>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Inventario"
        description="Consulta existencias actuales y movimientos históricos."
      />

      <div
        role="tablist"
        aria-label="Vistas de inventario"
        className="flex flex-wrap gap-2 border-b border-gray-200"
      >
        <button
          id="inventory-stock-tab"
          type="button"
          role="tab"
          aria-selected={activeView === 'stock'}
          aria-controls="inventory-stock-panel"
          tabIndex={activeView === 'stock' ? 0 : -1}
          onClick={() => setActiveView('stock')}
          className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeView === 'stock'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Existencias
        </button>
        <button
          id="inventory-movements-tab"
          type="button"
          role="tab"
          aria-selected={activeView === 'movements'}
          aria-controls="inventory-movements-panel"
          tabIndex={activeView === 'movements' ? 0 : -1}
          onClick={() => setActiveView('movements')}
          className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeView === 'movements'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Movimientos
        </button>
      </div>

      {activeView === 'stock' ? (
        <div
          id="inventory-stock-panel"
          role="tabpanel"
          aria-labelledby="inventory-stock-tab"
        >
          <Section
            title="Existencias actuales"
            description="Stock disponible y umbrales mínimos por producto."
          >
            {renderInventoryView()}
          </Section>
        </div>
      ) : (
        <div
          id="inventory-movements-panel"
          role="tabpanel"
          aria-labelledby="inventory-movements-tab"
        >
          <Section
            title="Historial de movimientos"
            description="Entradas, salidas y ajustes registrados en orden cronológico."
          >
            {renderMovementsView()}
          </Section>
        </div>
      )}
    </PageContainer>
  );
}
