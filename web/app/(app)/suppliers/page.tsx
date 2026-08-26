'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import EmptyState from '@/app/components/ui/EmptyState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Modal from '@/app/components/ui/Modal';
import Table from '@/app/components/ui/Table';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

type Supplier = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contactName?: string | null;
  notes?: string | null;
};

type SupplierFormErrors = {
  name?: string;
  email?: string;
};

function normalizeOptionalValue(value: string): string | undefined {
  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

function supplierMatchesSearch(supplier: Supplier, search: string): boolean {
  const normalizedSearch = search.trim().toLocaleLowerCase('es-MX');

  if (!normalizedSearch) {
    return true;
  }

  return [
    supplier.name,
    supplier.contactName,
    supplier.email,
    supplier.phone,
    supplier.address,
  ].some((value) =>
    value?.toLocaleLowerCase('es-MX').includes(normalizedSearch),
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formErrors, setFormErrors] = useState<SupplierFormErrors>({});
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [notes, setNotes] = useState('');
  const [supplierToDeactivate, setSupplierToDeactivate] =
    useState<Supplier | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivationError, setDeactivationError] = useState('');

  const filteredSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplierMatchesSearch(supplier, search)),
    [search, suppliers],
  );

  async function loadSuppliers() {
    try {
      setPageLoading(true);
      setPageError('');

      const response = await api.get<Supplier[]>('/suppliers');
      setSuppliers(response.data);
    } catch (error: unknown) {
      console.error(error);
      setPageError(
        getApiErrorMessage(error, 'No fue posible cargar los proveedores.'),
      );
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSuppliers();
  }, []);

  function resetSupplierForm() {
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setContactName('');
    setNotes('');
    setFormErrors({});
    setFormError('');
  }

  function openCreateModal() {
    setEditingSupplier(null);
    resetSupplierForm();
    setFormOpen(true);
  }

  function openEditModal(supplier: Supplier) {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setEmail(supplier.email || '');
    setPhone(supplier.phone || '');
    setAddress(supplier.address || '');
    setContactName(supplier.contactName || '');
    setNotes(supplier.notes || '');
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  }

  function closeSupplierForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingSupplier(null);
    resetSupplierForm();
  }

  async function handleSaveSupplier() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const nextErrors: SupplierFormErrors = {};

    setFormError('');

    if (!trimmedName) {
      nextErrors.name = 'El nombre del proveedor es obligatorio.';
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Ingresa un correo electrónico válido.';
    }

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      name: trimmedName,
      email: normalizeOptionalValue(email),
      phone: normalizeOptionalValue(phone),
      address: normalizeOptionalValue(address),
      contactName: normalizeOptionalValue(contactName),
      notes: normalizeOptionalValue(notes),
    };

    try {
      setSaving(true);

      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}`, payload);
      } else {
        await api.post('/suppliers', payload);
      }

      await loadSuppliers();
      setFormOpen(false);
      setEditingSupplier(null);
      resetSupplierForm();
    } catch (error: unknown) {
      console.error(error);
      setFormError(
        getApiErrorMessage(
          error,
          editingSupplier
            ? 'No fue posible actualizar el proveedor.'
            : 'No fue posible registrar el proveedor.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  function openDeactivateDialog(supplier: Supplier) {
    setSupplierToDeactivate(supplier);
    setDeactivationError('');
  }

  function closeDeactivateDialog() {
    if (deactivating) {
      return;
    }

    setSupplierToDeactivate(null);
    setDeactivationError('');
  }

  async function handleDeactivateSupplier() {
    if (!supplierToDeactivate || deactivating) {
      return;
    }

    try {
      setDeactivating(true);
      setDeactivationError('');

      await api.delete(`/suppliers/${supplierToDeactivate.id}`);
      await loadSuppliers();

      setSupplierToDeactivate(null);
    } catch (error: unknown) {
      console.error(error);
      setDeactivationError(
        getApiErrorMessage(error, 'No fue posible desactivar el proveedor.'),
      );
    } finally {
      setDeactivating(false);
    }
  }

  const tableData = filteredSuppliers.map((supplier) => ({
    name: supplier.name,
    contactName: supplier.contactName || 'Sin contacto',
    email: supplier.email || 'Sin email',
    phone: supplier.phone || 'Sin teléfono',
    address: supplier.address || 'Sin dirección',
    actions: (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Editar proveedor ${supplier.name}`}
          onClick={() => openEditModal(supplier)}
        >
          Editar
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          aria-label={`Desactivar proveedor ${supplier.name}`}
          onClick={() => openDeactivateDialog(supplier)}
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
          title="Proveedores"
          description="Administra los proveedores disponibles para nuevas compras."
          action={
            <Button type="button" onClick={openCreateModal}>
              <Plus aria-hidden="true" size={18} />
              Nuevo proveedor
            </Button>
          }
        />

        {pageLoading ? (
          <Loading message="Cargando proveedores..." />
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
                onClick={() => void loadSuppliers()}
              >
                Reintentar
              </Button>
            </div>
          </Section>
        ) : suppliers.length === 0 ? (
          <EmptyState
            title="Sin proveedores activos"
            description="Registra un proveedor para comenzar a usarlo en compras."
            action={
              <Button type="button" onClick={openCreateModal}>
                Nuevo proveedor
              </Button>
            }
          />
        ) : (
          <Section>
            <Input
              label="Buscar proveedores"
              type="search"
              value={search}
              placeholder="Nombre, contacto, email, teléfono o dirección"
              startAdornment={<Search size={18} />}
              onChange={(event) => setSearch(event.target.value)}
            />

            {filteredSuppliers.length === 0 ? (
              <EmptyState
                title="Sin proveedores coincidentes"
                description="No encontramos proveedores con esa búsqueda."
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
                  'Contacto',
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

      <Modal
        isOpen={formOpen}
        onClose={closeSupplierForm}
        title={editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}
      >
        <form
          aria-label={editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveSupplier();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Nombre"
              value={name}
              required
              disabled={saving}
              error={formErrors.name}
              onChange={(event) => {
                setName(event.target.value);
                setFormErrors((current) => ({ ...current, name: undefined }));
              }}
            />
            <Input
              label="Nombre de contacto"
              value={contactName}
              disabled={saving}
              onChange={(event) => setContactName(event.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={email}
              disabled={saving}
              error={formErrors.email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFormErrors((current) => ({ ...current, email: undefined }));
              }}
            />
            <Input
              label="Teléfono"
              type="tel"
              value={phone}
              disabled={saving}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <Input
            label="Dirección"
            value={address}
            disabled={saving}
            onChange={(event) => setAddress(event.target.value)}
          />

          <div className="flex flex-col gap-2">
            <label
              htmlFor="supplier-notes"
              className="text-sm font-medium text-gray-700"
            >
              Notas
            </label>
            <textarea
              id="supplier-notes"
              value={notes}
              rows={3}
              disabled={saving}
              className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {formError ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {formError}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={closeSupplierForm}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              loadingText={editingSupplier ? 'Actualizando...' : 'Registrando...'}
              disabled={saving}
            >
              {editingSupplier ? 'Guardar cambios' : 'Registrar proveedor'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={supplierToDeactivate !== null}
        title="Desactivar proveedor"
        message={
          <div className="space-y-3">
            <p>
              ¿Desactivar a{' '}
              <span className="font-semibold text-gray-900">
                {supplierToDeactivate?.name}
              </span>
              ?
            </p>
            <p className="text-sm text-gray-600">
              El proveedor dejará de aparecer en las operaciones nuevas. Su
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
        onConfirm={() => void handleDeactivateSupplier()}
      />
    </>
  );
}
