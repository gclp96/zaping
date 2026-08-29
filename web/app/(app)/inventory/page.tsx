'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import DataTable, {
  DataTableToolbar,
  type DataTableColumn,
  type DataTableSelectFilter,
  type SortState,
} from '@/app/components/ui/DataTable';
import Loading from '@/app/components/ui/Loading';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { paginateRows, stableSort } from '@/app/client-table.utils';
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

const DEFAULT_STOCK_PAGE_SIZE = 25;
const STOCK_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const inventoryCollator = new Intl.Collator('es-MX', {
  numeric: true,
  sensitivity: 'base',
});

function compareInventoryItems(
  first: InventoryItem,
  second: InventoryItem,
  columnId: string,
) {
  if (columnId === 'stock' || columnId === 'minStock') {
    const firstValue = columnId === 'stock' ? first.stock : first.minStock;
    const secondValue = columnId === 'stock' ? second.stock : second.minStock;

    return firstValue - secondValue;
  }

  const firstValue = columnId === 'sku' ? first.sku : first.name;
  const secondValue = columnId === 'sku' ? second.sku : second.name;

  return inventoryCollator.compare(firstValue, secondValue);
}

const stockColumns: DataTableColumn<InventoryItem>[] = [
  {
    id: 'sku',
    header: 'SKU',
    cell: (item) => (
      <span className="font-semibold text-gray-900">{item.sku}</span>
    ),
    sortable: true,
    priority: 'secondary',
    minWidth: 130,
  },
  {
    id: 'name',
    header: 'Producto',
    cell: (item) => item.name,
    sortable: true,
    priority: 'primary',
    minWidth: 220,
  },
  {
    id: 'stock',
    header: 'Stock actual',
    cell: (item) => (
      <span className="font-semibold text-gray-900">{item.stock}</span>
    ),
    sortable: true,
    align: 'end',
    priority: 'primary',
    minWidth: 120,
  },
  {
    id: 'minStock',
    header: 'Stock mínimo',
    cell: (item) => item.minStock,
    sortable: true,
    align: 'end',
    priority: 'tertiary',
    minWidth: 125,
  },
  {
    id: 'status',
    header: 'Estado',
    cell: (item) => {
      const descriptor = getInventoryStatusDescriptor(
        item.stock,
        item.minStock,
      );

      return (
        <StatusBadge
          label={descriptor.label}
          tone={descriptor.tone}
          ariaLabel={`Estado del inventario de ${item.name}: ${descriptor.label}`}
        />
      );
    },
    priority: 'primary',
    minWidth: 145,
  },
];

const DEFAULT_MOVEMENT_PAGE_SIZE = 25;
const MOVEMENT_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const movementCollator = new Intl.Collator('es-MX', {
  numeric: true,
  sensitivity: 'base',
});

function compareInventoryMovements(
  first: InventoryMovement,
  second: InventoryMovement,
  columnId: string,
) {
  if (columnId === 'date') {
    return (
      new Date(first.createdAt).getTime() -
      new Date(second.createdAt).getTime()
    );
  }

  if (columnId === 'quantity') {
    return first.quantity - second.quantity;
  }

  if (columnId === 'type') {
    return movementCollator.compare(
      getMovementTypeDescriptor(first.movementType).label,
      getMovementTypeDescriptor(second.movementType).label,
    );
  }

  return movementCollator.compare(
    first.product.name,
    second.product.name,
  );
}

const movementColumns: DataTableColumn<InventoryMovement>[] = [
  {
    id: 'date',
    header: 'Fecha',
    cell: (movement) => formatMovementDate(movement.createdAt),
    sortable: true,
    priority: 'secondary',
    minWidth: 180,
  },
  {
    id: 'product',
    header: 'Producto',
    cell: (movement) => (
      <div>
        <p className="font-medium text-gray-900">
          {movement.product.name}
        </p>
        <p className="text-sm text-gray-500">{movement.product.sku}</p>
      </div>
    ),
    sortable: true,
    priority: 'primary',
    minWidth: 210,
  },
  {
    id: 'type',
    header: 'Tipo',
    cell: (movement) => {
      const typeDescriptor = getMovementTypeDescriptor(
        movement.movementType,
      );

      return (
        <StatusBadge
          label={typeDescriptor.label}
          tone={typeDescriptor.tone}
          ariaLabel={`Tipo de movimiento: ${typeDescriptor.label}`}
        />
      );
    },
    sortable: true,
    priority: 'primary',
    minWidth: 120,
  },
  {
    id: 'quantity',
    header: 'Cantidad',
    cell: (movement) => {
      const typeDescriptor = getMovementTypeDescriptor(
        movement.movementType,
      );
      const quantityUnit =
        movement.quantity === 1 ? 'unidad' : 'unidades';

      return (
        <span
          className={`font-semibold ${typeDescriptor.quantityClassName}`}
          aria-label={`${typeDescriptor.label}: ${movement.quantity} ${quantityUnit}`}
        >
          {movement.quantity}
        </span>
      );
    },
    sortable: true,
    align: 'end',
    priority: 'primary',
    minWidth: 110,
  },
  {
    id: 'balance',
    header: 'Balance posterior',
    cell: (movement) => movement.balance ?? 'No disponible',
    align: 'end',
    priority: 'tertiary',
    minWidth: 150,
  },
  {
    id: 'reference',
    header: 'Referencia',
    cell: (movement) => {
      const referenceLabel = getReferenceTypeLabel(
        movement.referenceType,
      );

      return (
        <div>
          <p className="font-medium text-gray-900">{referenceLabel}</p>
          {movement.referenceId ? (
            <p
              className="text-sm text-gray-500"
              aria-label={`Identificador de referencia: ${movement.referenceId}`}
            >
              ID {compactReferenceId(movement.referenceId)}
            </p>
          ) : null}
        </div>
      );
    },
    priority: 'secondary',
    minWidth: 190,
  },
  {
    id: 'notes',
    header: 'Notas',
    cell: (movement) => movement.notes || '-',
    priority: 'tertiary',
    minWidth: 220,
  },
];

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <h1 className="sr-only">Inventario</h1>
          <Loading message="Cargando inventario..." />
        </PageContainer>
      }
    >
      <InventoryPageContent />
    </Suspense>
  );
}

function InventoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReferenceType =
    searchParams.get('referenceType')?.trim() || null;
  const requestedReferenceId =
    searchParams.get('referenceId')?.trim() || null;
  const receiptFolio = searchParams.get('receiptFolio')?.trim() || null;
  const queryRequestsMovements = searchParams.get('tab') === 'movements';
  const traceabilityFilterActive = Boolean(
    requestedReferenceType && requestedReferenceId,
  );
  const [selectedView, setSelectedView] = useState<InventoryView>('stock');
  const activeView: InventoryView = queryRequestsMovements
    ? 'movements'
    : selectedView;
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [movementsError, setMovementsError] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] =
    useState<MovementTypeFilter>('');
  const [stockSorting, setStockSorting] = useState<SortState>(null);
  const [stockPageIndex, setStockPageIndex] = useState(0);
  const [stockPageSize, setStockPageSize] = useState(
    DEFAULT_STOCK_PAGE_SIZE,
  );
  const [movementSorting, setMovementSorting] = useState<SortState>(null);
  const [movementPageIndex, setMovementPageIndex] = useState(0);
  const [movementPageSize, setMovementPageSize] = useState(
    DEFAULT_MOVEMENT_PAGE_SIZE,
  );

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      const matchesType =
        !movementTypeFilter || movement.movementType === movementTypeFilter;
      const matchesReference =
        !traceabilityFilterActive ||
        (movement.referenceType === requestedReferenceType &&
          movement.referenceId === requestedReferenceId);

      return (
        matchesReference &&
        matchesType &&
        movementMatchesSearch(movement, movementSearch)
      );
    });
  }, [
    movementSearch,
    movementTypeFilter,
    movements,
    requestedReferenceId,
    requestedReferenceType,
    traceabilityFilterActive,
  ]);

  const sortedMovements = useMemo(() => {
    if (!movementSorting) {
      return filteredMovements;
    }

    return stableSort(
      filteredMovements,
      (first, second) =>
        compareInventoryMovements(first, second, movementSorting.columnId),
      movementSorting.direction,
    );
  }, [filteredMovements, movementSorting]);

  const paginatedMovements = useMemo(() => {
    return paginateRows(
      sortedMovements,
      movementPageIndex,
      movementPageSize,
    );
  }, [movementPageIndex, movementPageSize, sortedMovements]);

  const movementFiltersActive = Boolean(
    movementSearch.trim() || movementTypeFilter,
  );
  const movementTableFilters: DataTableSelectFilter[] = [
    {
      id: 'movementType',
      label: 'Tipo de movimiento',
      value: movementTypeFilter,
      options: movementTypeOptions,
      placeholder: 'Todos los tipos',
      onChange: (value) => {
        setMovementTypeFilter(value as MovementTypeFilter);
        setMovementPageIndex(0);
      },
    },
  ];

  const sortedInventory = useMemo(() => {
    if (!stockSorting) {
      return inventory;
    }

    return stableSort(
      inventory,
      (first, second) =>
        compareInventoryItems(first, second, stockSorting.columnId),
      stockSorting.direction,
    );
  }, [inventory, stockSorting]);

  const paginatedInventory = useMemo(() => {
    return paginateRows(sortedInventory, stockPageIndex, stockPageSize);
  }, [sortedInventory, stockPageIndex, stockPageSize]);

  const traceabilityContext =
    requestedReferenceType === 'PURCHASE_RECEIPT'
      ? receiptFolio
        ? `Movimientos de la recepción ${receiptFolio}`
        : 'Movimientos asociados a la recepción'
      : `Movimientos asociados a ${getReferenceTypeLabel(
          requestedReferenceType,
        ).toLowerCase()}`;

  function replaceInventoryQuery(params: URLSearchParams) {
    const query = params.toString();
    router.replace(query ? `/inventory?${query}` : '/inventory');
  }

  function handleViewChange(view: InventoryView) {
    setSelectedView(view);

    if (
      view === 'stock' &&
      (queryRequestsMovements || traceabilityFilterActive)
    ) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('tab');
      params.delete('referenceType');
      params.delete('referenceId');
      params.delete('receiptFolio');
      replaceInventoryQuery(params);
    }
  }

  function clearTraceabilityFilter() {
    setSelectedView('movements');
    setMovementPageIndex(0);

    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'movements');
    params.delete('referenceType');
    params.delete('referenceId');
    params.delete('receiptFolio');
    replaceInventoryQuery(params);
  }

  async function loadInventory() {
    try {
      setInventoryLoading(true);
      setInventoryError('');

      const response = await api.get<InventoryItem[]>('/inventory');

      setInventory(response.data);
      setStockPageIndex(0);
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
      setMovementPageIndex(0);
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

    return (
      <DataTable
        caption="Existencias actuales"
        rows={paginatedInventory}
        columns={stockColumns}
        getRowId={(item) => item.id}
        sorting={{
          state: stockSorting,
          onChange: setStockSorting,
        }}
        pagination={
          inventory.length > 0
            ? {
                pageIndex: stockPageIndex,
                pageSize: stockPageSize,
                totalRows: sortedInventory.length,
                pageSizeOptions: STOCK_PAGE_SIZE_OPTIONS,
                onPageChange: setStockPageIndex,
                onPageSizeChange: (nextPageSize) => {
                  setStockPageSize(nextPageSize);
                  setStockPageIndex(0);
                },
              }
            : undefined
        }
        emptyState={{
          title: 'Inventario vacío',
          description: 'Todavía no existen productos registrados.',
        }}
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

    function clearMovementFilters() {
      setMovementSearch('');
      setMovementTypeFilter('');
      setMovementPageIndex(0);
    }

    return (
      <DataTable
        caption="Historial de movimientos"
        rows={paginatedMovements}
        columns={movementColumns}
        getRowId={(movement) => movement.id}
        sorting={{
          state: movementSorting,
          onChange: setMovementSorting,
        }}
        toolbar={
          movements.length > 0 ? (
            <DataTableToolbar
              search={{
                value: movementSearch,
                label: 'Buscar movimientos',
                placeholder: 'SKU, producto o referencia',
                onChange: (value) => {
                  setMovementSearch(value);
                  setMovementPageIndex(0);
                },
              }}
              filters={movementTableFilters}
              onReset={clearMovementFilters}
              resetDisabled={!movementFiltersActive}
            />
          ) : undefined
        }
        pagination={
          movements.length > 0
            ? {
                pageIndex: movementPageIndex,
                pageSize: movementPageSize,
                totalRows: sortedMovements.length,
                pageSizeOptions: MOVEMENT_PAGE_SIZE_OPTIONS,
                onPageChange: setMovementPageIndex,
                onPageSizeChange: (nextPageSize) => {
                  setMovementPageSize(nextPageSize);
                  setMovementPageIndex(0);
                },
              }
            : undefined
        }
        emptyState={{
          title: traceabilityFilterActive
            ? 'Sin movimientos asociados'
            : 'Sin movimientos de inventario',
          description: traceabilityFilterActive
            ? 'No hay movimientos de inventario asociados a esta recepción.'
            : 'Todavía no existe historial de entradas, salidas o ajustes.',
        }}
        filteredEmptyState={{
          title: traceabilityFilterActive
            ? 'Sin movimientos asociados'
            : 'Sin movimientos coincidentes',
          description: traceabilityFilterActive
            ? 'No hay movimientos de inventario asociados a esta recepción.'
            : 'Ningún movimiento coincide con los filtros actuales.',
        }}
        isFiltered={Boolean(movementFiltersActive || traceabilityFilterActive)}
      />
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
          onClick={() => handleViewChange('stock')}
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
          onClick={() => handleViewChange('movements')}
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
            {traceabilityFilterActive ? (
              <div
                role="status"
                className="flex flex-col gap-3 border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-blue-950 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium">{traceabilityContext}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearTraceabilityFilter}
                >
                  Limpiar filtro
                </Button>
              </div>
            ) : null}
            {renderMovementsView()}
          </Section>
        </div>
      )}
    </PageContainer>
  );
}
