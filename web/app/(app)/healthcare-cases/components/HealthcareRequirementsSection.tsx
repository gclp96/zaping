'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UserRole } from '@/app/auth-session';
import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import DataTable, {
  type DataTableColumn,
  type DataTableRowActions,
} from '@/app/components/ui/DataTable';
import Input from '@/app/components/ui/Input';
import Modal from '@/app/components/ui/Modal';
import Select from '@/app/components/ui/Select';
import Section from '@/app/components/ui/layout/Section';
import { canManageHealthcareRequirements } from '@/app/erp-role-access';
import { api } from '@/services/api';
import {
  createHealthcareRequirement,
  getHealthcareRequirementErrorMessage,
  listHealthcareRequirements,
  reactivateHealthcareRequirement,
  reorderHealthcareRequirements,
  retireHealthcareRequirement,
  updateHealthcareRequirement,
  type HealthcareRequirement,
  type HealthcareRequirementListStatus,
  type HealthcareRequirementProduct,
  type HealthcareRequirementType,
} from '@/services/healthcare-requirements';

import type { HealthcareCase } from '../types';

type RequirementFormState = {
  productId: string;
  requestedQty: string;
  type: HealthcareRequirementType;
  notes: string;
  sortOrder: string;
};

type HealthcareRequirementsSectionProps = {
  healthcareCase: HealthcareCase;
  role: UserRole | null;
};

const emptyForm: RequirementFormState = {
  productId: '',
  requestedQty: '1',
  type: 'REQUIRED',
  notes: '',
  sortOrder: '0',
};

const statusOptions = [
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'RETIRED', label: 'Retirados' },
  { value: 'ALL', label: 'Todos' },
];

const typeOptions = [
  { value: 'REQUIRED', label: 'Requerido' },
  { value: 'BACKUP', label: 'Respaldo' },
];

const typeLabels: Record<HealthcareRequirementType, string> = {
  REQUIRED: 'Requerido',
  BACKUP: 'Respaldo',
};

function productLabel(product: HealthcareRequirementProduct) {
  return `${product.sku} — ${product.name}`;
}

function parseInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export default function HealthcareRequirementsSection({
  healthcareCase,
  role,
}: HealthcareRequirementsSectionProps) {
  const canManage = canManageHealthcareRequirements(role);
  const caseIsReadOnly = healthcareCase.status === 'CANCELLED';
  const canMutate = canManage && !caseIsReadOnly;
  const [status, setStatus] =
    useState<HealthcareRequirementListStatus>('ACTIVE');
  const [requirements, setRequirements] = useState<HealthcareRequirement[]>([]);
  const requirementsRequestId = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formTarget, setFormTarget] = useState<
    HealthcareRequirement | null | undefined
  >(undefined);
  const [form, setForm] = useState<RequirementFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<HealthcareRequirementProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [retireTarget, setRetireTarget] =
    useState<HealthcareRequirement | null>(null);
  const [retirementReason, setRetirementReason] = useState('');
  const [retireError, setRetireError] = useState('');
  const [reactivateTarget, setReactivateTarget] =
    useState<HealthcareRequirement | null>(null);
  const [reactivateError, setReactivateError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const loadRequirements = useCallback(
    async (nextStatus: HealthcareRequirementListStatus = status) => {
      const currentRequestId = ++requirementsRequestId.current;

      try {
        setLoading(true);
        setError('');
        const items = await listHealthcareRequirements(
          healthcareCase.id,
          nextStatus,
        );
        if (currentRequestId === requirementsRequestId.current) {
          setRequirements(items);
        }
      } catch (requestError: unknown) {
        if (currentRequestId === requirementsRequestId.current) {
          setRequirements([]);
          setError(
            getHealthcareRequirementErrorMessage(
              requestError,
              'No fue posible cargar los requerimientos del caso.',
            ),
          );
        }
      } finally {
        if (currentRequestId === requirementsRequestId.current) {
          setLoading(false);
        }
      }
    },
    [healthcareCase.id, status],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequirements();

    return () => {
      requirementsRequestId.current += 1;
    };
  }, [loadRequirements]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase('es-MX');

    return products.filter(
      (product) =>
        product.isActive &&
        (!term ||
          [product.sku, product.name].some((value) =>
            value.toLocaleLowerCase('es-MX').includes(term),
          )),
    );
  }, [productSearch, products]);
  const availableProducts = useMemo(() => {
    const selectedProduct = products.find(
      (product) => product.id === form.productId,
    );

    return selectedProduct &&
      !filteredProducts.some((product) => product.id === selectedProduct.id)
      ? [selectedProduct, ...filteredProducts]
      : filteredProducts;
  }, [filteredProducts, form.productId, products]);

  async function loadProducts() {
    try {
      setProductsLoading(true);
      setProductsError('');
      const response =
        await api.get<HealthcareRequirementProduct[]>('/products');
      setProducts(response.data.filter((product) => product.isActive));
    } catch {
      setProducts([]);
      setProductsError('No fue posible cargar los productos activos.');
    } finally {
      setProductsLoading(false);
    }
  }

  function openCreateForm() {
    if (!canMutate) return;
    setNotice('');
    setForm(emptyForm);
    setFormError('');
    setProductSearch('');
    setProducts([]);
    setProductsError('');
    setFormTarget(null);
    void loadProducts();
  }

  function openEditForm(requirement: HealthcareRequirement) {
    if (!canMutate || requirement.lifecycle !== 'ACTIVE') return;
    setNotice('');
    setForm({
      productId: requirement.productId,
      requestedQty: String(requirement.requestedQty),
      type: requirement.type,
      notes: requirement.notes ?? '',
      sortOrder: String(requirement.sortOrder),
    });
    setFormError('');
    setFormTarget(requirement);
  }

  function closeForm() {
    if (pendingAction) return;
    setFormTarget(undefined);
    setFormError('');
  }

  async function saveRequirement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canMutate || formTarget === undefined || pendingAction) return;

    const requestedQty = parseInteger(form.requestedQty);
    const sortOrder = parseInteger(form.sortOrder);

    if (requestedQty === null || requestedQty < 1) {
      setFormError('La cantidad solicitada debe ser un entero mayor que cero.');
      return;
    }

    if (sortOrder === null) {
      setFormError('El orden debe ser un número entero.');
      return;
    }

    if (formTarget === null && !form.productId) {
      setFormError('Selecciona un producto activo.');
      return;
    }

    const isCreate = formTarget === null;
    const payload = {
      requestedQty,
      type: form.type,
      notes: form.notes.trim() || null,
      sortOrder,
    };

    try {
      setPendingAction(isCreate ? 'create' : `update:${formTarget.id}`);
      setFormError('');

      if (isCreate) {
        await createHealthcareRequirement(healthcareCase.id, {
          productId: form.productId,
          ...payload,
        });
      } else {
        await updateHealthcareRequirement(formTarget.id, payload);
      }

      setFormTarget(undefined);
      setNotice(
        isCreate
          ? 'Requerimiento registrado correctamente.'
          : 'Requerimiento actualizado correctamente.',
      );

      if (isCreate && status !== 'ACTIVE') {
        setStatus('ACTIVE');
      } else {
        await loadRequirements();
      }
    } catch (requestError: unknown) {
      setFormError(
        getHealthcareRequirementErrorMessage(
          requestError,
          isCreate
            ? 'No fue posible registrar el requerimiento.'
            : 'No fue posible actualizar el requerimiento.',
        ),
      );
    } finally {
      setPendingAction(null);
    }
  }

  function openRetire(requirement: HealthcareRequirement) {
    if (!canMutate || requirement.lifecycle !== 'ACTIVE') return;
    setNotice('');
    setRetirementReason('');
    setRetireError('');
    setRetireTarget(requirement);
  }

  async function confirmRetirement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!retireTarget || pendingAction) return;

    const reason = retirementReason.trim();
    if (!reason) {
      setRetireError('El motivo del retiro es obligatorio.');
      return;
    }

    try {
      setPendingAction(`retire:${retireTarget.id}`);
      setRetireError('');
      await retireHealthcareRequirement(retireTarget.id, reason);
      setRetireTarget(null);
      setNotice('Requerimiento retirado correctamente.');
      await loadRequirements();
    } catch (requestError: unknown) {
      setRetireError(
        getHealthcareRequirementErrorMessage(
          requestError,
          'No fue posible retirar el requerimiento.',
        ),
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmReactivation() {
    if (!reactivateTarget || pendingAction) return;

    try {
      setPendingAction(`reactivate:${reactivateTarget.id}`);
      setReactivateError('');
      await reactivateHealthcareRequirement(reactivateTarget.id);
      setReactivateTarget(null);
      setNotice('Requerimiento reactivado correctamente.');
      await loadRequirements();
    } catch (requestError: unknown) {
      setReactivateError(
        getHealthcareRequirementErrorMessage(
          requestError,
          'No fue posible reactivar el requerimiento.',
        ),
      );
    } finally {
      setPendingAction(null);
    }
  }

  function openReactivate(requirement: HealthcareRequirement) {
    if (!canMutate || requirement.lifecycle !== 'RETIRED') return;
    setNotice('');
    setReactivateError('');
    setReactivateTarget(requirement);
  }

  async function moveRequirement(
    requirement: HealthcareRequirement,
    direction: -1 | 1,
  ) {
    if (!canMutate || status !== 'ACTIVE' || pendingAction) return;

    const currentIndex = requirements.findIndex(
      (item) => item.id === requirement.id,
    );
    const targetIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= requirements.length
    ) {
      return;
    }

    const ordered = [...requirements];
    [ordered[currentIndex], ordered[targetIndex]] = [
      ordered[targetIndex],
      ordered[currentIndex],
    ];

    try {
      setPendingAction(`reorder:${requirement.id}`);
      setNotice('');
      setActionError('');
      await reorderHealthcareRequirements(healthcareCase.id, {
        items: ordered.map((item, index) => ({
          requirementId: item.id,
          sortOrder: index,
        })),
      });
      setNotice('Orden de requerimientos actualizado.');
      await loadRequirements();
    } catch (requestError: unknown) {
      setActionError(
        getHealthcareRequirementErrorMessage(
          requestError,
          'No fue posible actualizar el orden de los requerimientos.',
        ),
      );
    } finally {
      setPendingAction(null);
    }
  }

  const columns = useMemo<DataTableColumn<HealthcareRequirement>[]>(
    () => [
      {
        id: 'product',
        header: 'Producto',
        cell: (requirement) => (
          <div>
            <p className="font-semibold">{requirement.product.name}</p>
            <p className="text-xs text-text-muted">{requirement.product.sku}</p>
            {!requirement.product.isActive ? (
              <p className="text-xs font-medium text-amber-800">
                Producto inactivo (histórico)
              </p>
            ) : null}
          </div>
        ),
        minWidth: 180,
      },
      {
        id: 'quantity',
        header: 'Cantidad',
        cell: (requirement) => requirement.requestedQty,
        align: 'end',
        minWidth: 100,
      },
      {
        id: 'type',
        header: 'Tipo',
        cell: (requirement) => typeLabels[requirement.type],
        minWidth: 110,
      },
      {
        id: 'notes',
        header: 'Notas',
        cell: (requirement) => requirement.notes || 'Sin notas',
        minWidth: 180,
      },
      {
        id: 'sortOrder',
        header: 'Orden',
        cell: (requirement) => requirement.sortOrder,
        align: 'end',
        minWidth: 90,
      },
      {
        id: 'lifecycle',
        header: 'Vigencia',
        cell: (requirement) => (
          <div className="space-y-1">
            <StatusBadge
              label={requirement.lifecycle === 'ACTIVE' ? 'Activo' : 'Retirado'}
              tone={requirement.lifecycle === 'ACTIVE' ? 'success' : 'neutral'}
            />
            {requirement.lifecycle === 'RETIRED' &&
            requirement.retirementReason ? (
              <p className="max-w-48 text-xs text-text-muted">
                {requirement.retirementReason}
              </p>
            ) : null}
          </div>
        ),
        minWidth: 120,
      },
    ],
    [],
  );

  const rowActions: DataTableRowActions<HealthcareRequirement> | undefined =
    canMutate
      ? {
          label: (requirement) =>
            `Acciones del requerimiento ${requirement.product.sku}`,
          actions: [
            {
              id: 'edit',
              label: 'Editar',
              disabled: (requirement) =>
                Boolean(pendingAction) || requirement.lifecycle !== 'ACTIVE',
              onSelect: openEditForm,
            },
            {
              id: 'retire',
              label: 'Retirar',
              variant: 'destructive',
              disabled: (requirement) =>
                Boolean(pendingAction) || requirement.lifecycle !== 'ACTIVE',
              onSelect: openRetire,
            },
            {
              id: 'reactivate',
              label: 'Reactivar',
              disabled: (requirement) =>
                Boolean(pendingAction) || requirement.lifecycle !== 'RETIRED',
              onSelect: openReactivate,
            },
            ...(status === 'ACTIVE'
              ? [
                  {
                    id: 'move-up',
                    label: 'Mover arriba',
                    disabled: (requirement: HealthcareRequirement) =>
                      Boolean(pendingAction) ||
                      requirements[0]?.id === requirement.id,
                    onSelect: (requirement: HealthcareRequirement) =>
                      void moveRequirement(requirement, -1),
                  },
                  {
                    id: 'move-down',
                    label: 'Mover abajo',
                    disabled: (requirement: HealthcareRequirement) =>
                      Boolean(pendingAction) ||
                      requirements.at(-1)?.id === requirement.id,
                    onSelect: (requirement: HealthcareRequirement) =>
                      void moveRequirement(requirement, 1),
                  },
                ]
              : []),
          ],
        }
      : undefined;

  return (
    <>
      <Section
        title="Requerimientos"
        description="Productos y cantidades solicitadas para este caso."
        action={
          canMutate ? (
            <Button
              type="button"
              size="sm"
              disabled={Boolean(pendingAction)}
              onClick={openCreateForm}
            >
              <Plus aria-hidden="true" size={16} />
              Nuevo requerimiento
            </Button>
          ) : undefined
        }
      >
        {caseIsReadOnly ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            El caso está cancelado. Sus requerimientos permanecen visibles como
            historial y no pueden modificarse.
          </p>
        ) : null}

        {notice ? (
          <p
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900"
          >
            {notice}
          </p>
        ) : null}

        {actionError ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {actionError}
          </p>
        ) : null}

        {pendingAction ? (
          <p role="status" className="text-sm text-gray-600">
            Guardando cambios...
          </p>
        ) : null}

        <div className="max-w-52">
          <Select
            label="Vigencia"
            value={status}
            options={statusOptions}
            disabled={Boolean(pendingAction)}
            onChange={(event) => {
              setNotice('');
              setActionError('');
              setStatus(event.target.value as HealthcareRequirementListStatus);
            }}
          />
        </div>

        <DataTable
          caption={`Requerimientos del caso ${healthcareCase.folio}`}
          rows={requirements}
          columns={columns}
          getRowId={(requirement) => requirement.id}
          rowActions={rowActions}
          loading={loading}
          loadingMessage="Cargando requerimientos..."
          error={
            error
              ? { message: error, onRetry: () => void loadRequirements() }
              : null
          }
          emptyState={{
            title:
              status === 'ACTIVE'
                ? 'Sin requerimientos activos'
                : status === 'RETIRED'
                  ? 'Sin requerimientos retirados'
                  : 'Sin requerimientos',
            description:
              status === 'ACTIVE' && canMutate
                ? 'Registra el primer producto requerido para este caso.'
                : 'No hay registros para la vigencia seleccionada.',
          }}
        />
      </Section>

      <Modal
        isOpen={formTarget !== undefined}
        title={formTarget ? 'Editar requerimiento' : 'Nuevo requerimiento'}
        dismissible={!pendingAction}
        onClose={closeForm}
      >
        <form
          aria-label={
            formTarget ? 'Editar requerimiento' : 'Nuevo requerimiento'
          }
          className="space-y-5"
          onSubmit={(event) => void saveRequirement(event)}
        >
          {formTarget === null ? (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Input
                label="Buscar productos activos"
                type="search"
                value={productSearch}
                placeholder="SKU o nombre"
                disabled={productsLoading || Boolean(pendingAction)}
                onChange={(event) => setProductSearch(event.target.value)}
              />
              <Select
                label="Producto"
                required
                value={form.productId}
                options={availableProducts.map((product) => ({
                  value: product.id,
                  label: productLabel(product),
                }))}
                placeholder={
                  productsLoading
                    ? 'Cargando productos...'
                    : 'Selecciona un producto activo'
                }
                disabled={
                  productsLoading ||
                  Boolean(productsError) ||
                  Boolean(pendingAction)
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    productId: event.target.value,
                  }))
                }
              />
              {productsError ? (
                <div
                  role="alert"
                  className="flex flex-col gap-2 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>{productsError}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadProducts()}
                  >
                    Reintentar
                  </Button>
                </div>
              ) : !productsLoading && availableProducts.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No se encontraron productos activos.
                </p>
              ) : null}
            </div>
          ) : formTarget ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
              Producto: <strong>{productLabel(formTarget.product)}</strong>
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Cantidad solicitada"
              type="number"
              min="1"
              step="1"
              required
              value={form.requestedQty}
              disabled={Boolean(pendingAction)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  requestedQty: event.target.value,
                }))
              }
            />
            <Select
              label="Tipo"
              required
              value={form.type}
              options={typeOptions}
              disabled={Boolean(pendingAction)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as HealthcareRequirementType,
                }))
              }
            />
            <Input
              label="Orden"
              type="number"
              step="1"
              required
              helperText="Controla la posición visual; no representa prioridad."
              value={form.sortOrder}
              disabled={Boolean(pendingAction)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sortOrder: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label
              htmlFor="healthcare-requirement-notes"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Notas (opcional)
            </label>
            <textarea
              id="healthcare-requirement-notes"
              rows={4}
              maxLength={1000}
              value={form.notes}
              disabled={Boolean(pendingAction)}
              className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </div>

          {formError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(pendingAction)}
              onClick={closeForm}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={Boolean(pendingAction)}
              loadingText="Guardando..."
            >
              {formTarget ? 'Guardar cambios' : 'Registrar requerimiento'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={retireTarget !== null}
        title="Retirar requerimiento"
        dismissible={!pendingAction}
        onClose={() => {
          if (!pendingAction) setRetireTarget(null);
        }}
      >
        <form
          aria-label="Retirar requerimiento"
          className="space-y-5"
          onSubmit={(event) => void confirmRetirement(event)}
        >
          <p className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
            El requerimiento dejará de estar vigente, pero conservará su
            historial. Podrá reactivarse de forma explícita.
          </p>
          <div>
            <label
              htmlFor="healthcare-requirement-retirement-reason"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Motivo del retiro
              <span aria-hidden="true" className="ml-1 text-red-600">
                *
              </span>
            </label>
            <textarea
              id="healthcare-requirement-retirement-reason"
              rows={4}
              maxLength={1000}
              required
              value={retirementReason}
              disabled={Boolean(pendingAction)}
              className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
              onChange={(event) => setRetirementReason(event.target.value)}
            />
          </div>
          {retireError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {retireError}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(pendingAction)}
              onClick={() => setRetireTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={Boolean(pendingAction)}
              loadingText="Retirando..."
            >
              Retirar requerimiento
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={reactivateTarget !== null}
        title="Reactivar requerimiento"
        message={
          <div className="space-y-3">
            <p>
              Se restaurará el requerimiento de{' '}
              <strong>
                {reactivateTarget
                  ? productLabel(reactivateTarget.product)
                  : 'este producto'}
              </strong>
              .
            </p>
            {reactivateError ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {reactivateError}
              </p>
            ) : null}
          </div>
        }
        confirmText="Reactivar"
        confirmVariant="success"
        loading={Boolean(pendingAction)}
        loadingText="Reactivando..."
        onClose={() => {
          if (!pendingAction) setReactivateTarget(null);
        }}
        onConfirm={() => void confirmReactivation()}
      />
    </>
  );
}
