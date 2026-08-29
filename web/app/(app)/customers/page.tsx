'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import CustomerFormModal from '@/app/components/business/CustomerForm';
import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import DataTable, {
  DataTableToolbar,
  type DataTableColumn,
  type SortState,
} from '@/app/components/ui/DataTable';
import Loading from '@/app/components/ui/Loading';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

type Customer = {
  id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  address?: string | null;
  contactName?: string | null;
  notes?: string | null;
};

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const customerCollator = new Intl.Collator('es-MX', {
  numeric: true,
  sensitivity: 'base',
});

function customerMatchesSearch(customer: Customer, search: string): boolean {
  const normalizedSearch = search.trim().toLocaleLowerCase('es-MX');

  if (!normalizedSearch) {
    return true;
  }

  return [customer.name, customer.email, customer.phone, customer.address].some(
    (value) => value?.toLocaleLowerCase('es-MX').includes(normalizedSearch),
  );
}

function compareCustomers(
  first: Customer,
  second: Customer,
  columnId: string,
) {
  const firstValue =
    columnId === 'name'
      ? first.name
      : columnId === 'type'
        ? first.type
        : columnId === 'email'
          ? first.email
          : columnId === 'phone'
            ? first.phone
            : columnId === 'address'
              ? first.address || ''
              : '';
  const secondValue =
    columnId === 'name'
      ? second.name
      : columnId === 'type'
        ? second.type
        : columnId === 'email'
          ? second.email
          : columnId === 'phone'
            ? second.phone
            : columnId === 'address'
              ? second.address || ''
              : '';

  return customerCollator.compare(firstValue, secondValue);
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDeactivate, setCustomerToDeactivate] =
    useState<Customer | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivationError, setDeactivationError] = useState('');
  const [sorting, setSorting] = useState<SortState>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const filteredCustomers = useMemo(
    () => customers.filter((customer) => customerMatchesSearch(customer, search)),
    [customers, search],
  );

  async function loadCustomers() {
    try {
      setPageLoading(true);
      setPageError('');

      const response = await api.get<Customer[]>('/customers');
      setCustomers(response.data);
      setPageIndex(0);
    } catch (error: unknown) {
      console.error(error);
      setPageError(
        getApiErrorMessage(error, 'No fue posible cargar los clientes.'),
      );
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCustomers();
  }, []);

  function openCreateModal() {
    setEditingCustomer(null);
    setFormOpen(true);
  }

  function closeFormModal() {
    setFormOpen(false);
    setEditingCustomer(null);
  }

  function openEditModal(customer: Customer) {
    setEditingCustomer(customer);
    setFormOpen(true);
  }

  function openDeactivateDialog(customer: Customer) {
    setCustomerToDeactivate(customer);
    setDeactivationError('');
  }

  function closeDeactivateDialog() {
    if (deactivating) {
      return;
    }

    setCustomerToDeactivate(null);
    setDeactivationError('');
  }

  async function handleDeactivateCustomer() {
    if (!customerToDeactivate || deactivating) {
      return;
    }

    try {
      setDeactivating(true);
      setDeactivationError('');

      await api.delete(`/customers/${customerToDeactivate.id}`);
      await loadCustomers();

      setCustomerToDeactivate(null);
    } catch (error: unknown) {
      console.error(error);
      setDeactivationError(
        getApiErrorMessage(error, 'No fue posible desactivar el cliente.'),
      );
    } finally {
      setDeactivating(false);
    }
  }

  const isFiltered = Boolean(search.trim());

  const sortedCustomers = useMemo(() => {
    if (!sorting) {
      return filteredCustomers;
    }

    const direction = sorting.direction === 'asc' ? 1 : -1;

    return filteredCustomers
      .map((customer, originalIndex) => ({ customer, originalIndex }))
      .sort((first, second) => {
        const comparison = compareCustomers(
          first.customer,
          second.customer,
          sorting.columnId,
        );

        return comparison === 0
          ? first.originalIndex - second.originalIndex
          : comparison * direction;
      })
      .map(({ customer }) => customer);
  }, [filteredCustomers, sorting]);

  const paginatedCustomers = useMemo(() => {
    const firstRowIndex = pageIndex * pageSize;

    return sortedCustomers.slice(firstRowIndex, firstRowIndex + pageSize);
  }, [pageIndex, pageSize, sortedCustomers]);

  const customerColumns: DataTableColumn<Customer>[] = [
    {
      id: 'name',
      header: 'Cliente',
      cell: (customer) => customer.name,
      sortable: true,
      priority: 'primary',
      minWidth: 180,
    },
    {
      id: 'type',
      header: 'Tipo',
      cell: (customer) => customer.type,
      sortable: true,
      priority: 'secondary',
      minWidth: 130,
    },
    {
      id: 'email',
      header: 'Email',
      cell: (customer) => customer.email,
      sortable: true,
      priority: 'secondary',
      minWidth: 220,
    },
    {
      id: 'phone',
      header: 'Teléfono',
      cell: (customer) => customer.phone,
      sortable: true,
      priority: 'tertiary',
      minWidth: 140,
    },
    {
      id: 'address',
      header: 'Dirección',
      cell: (customer) => customer.address || 'Sin dirección',
      sortable: true,
      priority: 'tertiary',
      minWidth: 220,
    },
  ];

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Clientes"
          description="Administra los clientes disponibles para nuevas operaciones."
          action={
            <Button type="button" onClick={openCreateModal}>
              <Plus aria-hidden="true" size={18} />
              Nuevo cliente
            </Button>
          }
        />

        {pageLoading ? (
          <Loading message="Cargando clientes..." />
        ) : pageError ? (
          <Section>
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{pageError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadCustomers()}
              >
                Reintentar
              </Button>
            </div>
          </Section>
        ) : (
          <Section>
            <DataTable
              caption="Catálogo de clientes"
              rows={paginatedCustomers}
              columns={customerColumns}
              getRowId={(customer) => customer.id}
              sorting={{
                state: sorting,
                onChange: setSorting,
              }}
              toolbar={
                customers.length > 0 ? (
                  <DataTableToolbar
                    search={{
                      value: search,
                      label: 'Buscar clientes',
                      placeholder: 'Nombre, email, teléfono o dirección',
                      onChange: (value) => {
                        setSearch(value);
                        setPageIndex(0);
                      },
                    }}
                    actions={
                      isFiltered ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearch('');
                            setPageIndex(0);
                          }}
                        >
                          Limpiar búsqueda
                        </Button>
                      ) : null
                    }
                  />
                ) : undefined
              }
              pagination={
                customers.length > 0
                  ? {
                      pageIndex,
                      pageSize,
                      totalRows: sortedCustomers.length,
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                      onPageChange: setPageIndex,
                      onPageSizeChange: (nextPageSize) => {
                        setPageSize(nextPageSize);
                        setPageIndex(0);
                      },
                    }
                  : undefined
              }
              rowActions={{
                label: (customer) => `Acciones del cliente ${customer.name}`,
                actions: [
                  {
                    id: 'edit',
                    label: 'Editar',
                    onSelect: openEditModal,
                  },
                  {
                    id: 'deactivate',
                    label: 'Desactivar',
                    variant: 'destructive',
                    onSelect: openDeactivateDialog,
                  },
                ],
              }}
              emptyState={{
                title: 'Sin clientes activos',
                description:
                  'Registra un cliente para comenzar a usarlo en cotizaciones y ventas.',
              }}
              filteredEmptyState={{
                title: 'Sin clientes coincidentes',
                description: 'No encontramos clientes con esa búsqueda.',
              }}
              isFiltered={isFiltered}
            />
          </Section>
        )}
      </PageContainer>

      <CustomerFormModal
        isOpen={formOpen}
        customer={editingCustomer}
        onClose={closeFormModal}
        onSaved={loadCustomers}
      />

      <ConfirmDialog
        isOpen={customerToDeactivate !== null}
        title="Desactivar cliente"
        message={
          <div className="space-y-3">
            <p>
              ¿Desactivar a{' '}
              <span className="font-semibold text-gray-900">
                {customerToDeactivate?.name}
              </span>
              ?
            </p>
            <p className="text-sm text-gray-600">
              El cliente dejará de aparecer en las operaciones nuevas. Su
              historial se conservará.
            </p>
            {deactivationError ? (
              <p role="alert" className="text-sm text-red-700">
                {deactivationError}
              </p>
            ) : null}
          </div>
        }
        confirmText="Desactivar"
        loadingText="Desactivando..."
        confirmVariant="danger"
        loading={deactivating}
        onClose={closeDeactivateDialog}
        onConfirm={() => void handleDeactivateCustomer()}
      />
    </>
  );
}
