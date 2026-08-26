'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import CustomerFormModal from '@/app/components/business/CustomerForm';
import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import EmptyState from '@/app/components/ui/EmptyState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Table from '@/app/components/ui/Table';
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

function customerMatchesSearch(customer: Customer, search: string): boolean {
  const normalizedSearch = search.trim().toLocaleLowerCase('es-MX');

  if (!normalizedSearch) {
    return true;
  }

  return [customer.name, customer.email, customer.phone, customer.address].some(
    (value) => value?.toLocaleLowerCase('es-MX').includes(normalizedSearch),
  );
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

  const tableData = filteredCustomers.map((customer) => ({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address || 'Sin dirección',
    actions: (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Editar cliente ${customer.name}`}
          onClick={() => openEditModal(customer)}
        >
          Editar
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          aria-label={`Desactivar cliente ${customer.name}`}
          onClick={() => openDeactivateDialog(customer)}
        >
          Desactivar
        </Button>
      </div>
    ),
  }));

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
        ) : customers.length === 0 ? (
          <EmptyState
            title="Sin clientes activos"
            description="Registra un cliente para comenzar a usarlo en cotizaciones y ventas."
            action={
              <Button type="button" onClick={openCreateModal}>
                Nuevo cliente
              </Button>
            }
          />
        ) : (
          <Section>
            <Input
              label="Buscar clientes"
              type="search"
              value={search}
              placeholder="Nombre, email, teléfono o dirección"
              startAdornment={<Search size={18} />}
              onChange={(event) => setSearch(event.target.value)}
            />

            {filteredCustomers.length === 0 ? (
              <EmptyState
                title="Sin clientes coincidentes"
                description="No encontramos clientes con esa búsqueda."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSearch('')}
                  >
                    Limpiar búsqueda
                  </Button>
                }
              />
            ) : (
              <Table
                headers={[
                  'Nombre',
                  'Email',
                  'Teléfono',
                  'Dirección',
                  'Acciones',
                ]}
                data={tableData}
              />
            )}
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
