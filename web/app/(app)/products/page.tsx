'use client';

import { useEffect, useMemo, useState } from 'react';

import MoneyInput from '@/app/components/business/MoneyInput';
import StatusBadge from '@/app/components/business/StatusBadge';
import Button from '@/app/components/ui/Button';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import EmptyState from '@/app/components/ui/EmptyState';
import Input from '@/app/components/ui/Input';
import Loading from '@/app/components/ui/Loading';
import Modal from '@/app/components/ui/Modal';
import Select, { type SelectOption } from '@/app/components/ui/Select';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import Table from '@/app/components/ui/Table';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

type ProductInventoryTracking = 'QUANTITY' | 'SERIALIZED' | 'ASSET';
type ProductLotTracking = 'NONE' | 'OPTIONAL' | 'REQUIRED';

type Category = {
  id: string;
  name: string;
  isActive: boolean;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  brand?: string | null;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
  barcode?: string | null;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  inventoryTracking: ProductInventoryTracking;
  lotTracking: ProductLotTracking;
};

const DEFAULT_INVENTORY_TRACKING: ProductInventoryTracking = 'QUANTITY';
const DEFAULT_LOT_TRACKING: ProductLotTracking = 'OPTIONAL';

const inventoryTrackingOptions: SelectOption[] = [
  {
    value: 'QUANTITY',
    label: 'Por cantidad',
  },
  {
    value: 'SERIALIZED',
    label: 'Serializado',
  },
  {
    value: 'ASSET',
    label: 'Equipo / activo físico',
  },
];

const lotTrackingOptions: SelectOption[] = [
  {
    value: 'NONE',
    label: 'Sin lote',
  },
  {
    value: 'OPTIONAL',
    label: 'Lote opcional',
  },
  {
    value: 'REQUIRED',
    label: 'Lote requerido',
  },
];

const inventoryTrackingLabels: Record<ProductInventoryTracking, string> = {
  QUANTITY: 'Por cantidad',
  SERIALIZED: 'Serializado',
  ASSET: 'Equipo / activo físico',
};

const inventoryTrackingShortLabels: Record<ProductInventoryTracking, string> = {
  QUANTITY: 'Cantidad',
  SERIALIZED: 'Serializado',
  ASSET: 'Equipo',
};

const lotTrackingLabels: Record<ProductLotTracking, string> = {
  NONE: 'Sin lote',
  OPTIONAL: 'Lote opcional',
  REQUIRED: 'Lote requerido',
};

const inventoryTrackingDescriptions: Record<ProductInventoryTracking, string> = {
  QUANTITY: 'Inventario controlado por unidades.',
  SERIALIZED: 'Cada unidad requiere control por serie.',
  ASSET: 'Cada unidad se controla como EquipmentAsset.',
};

const lotTrackingDescriptions: Record<ProductLotTracking, string> = {
  NONE: 'No requiere datos de lote.',
  OPTIONAL: 'El lote puede capturarse cuando aplique.',
  REQUIRED: 'Requiere flujo de lote específico.',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value);
}

function buildCategoryOptions(categories: Category[]): SelectOption[] {
  return categories
    .filter((category) => category.isActive)
    .map((category) => ({
      value: category.id,
      label: category.name,
    }));
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [inventoryTracking, setInventoryTracking] =
    useState<ProductInventoryTracking>(DEFAULT_INVENTORY_TRACKING);
  const [lotTracking, setLotTracking] =
    useState<ProductLotTracking>(DEFAULT_LOT_TRACKING);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const categoryOptions = useMemo(
    () => buildCategoryOptions(categories),
    [categories],
  );

  const categoryNameById = useMemo(() => {
    return new Map(
      categories.map((category) => [category.id, category.name]),
    );
  }, [categories]);

  async function loadProducts() {
    const response = await api.get<Product[]>('/products');
    setProducts(response.data);
  }

  async function loadCategories() {
    try {
      const response = await api.get<Category[]>('/categories');
      setCategories(response.data);
      setCategoryError(null);
    } catch (error: unknown) {
      console.error(error);
      setCategoryError(
        getApiErrorMessage(
          error,
          'No fue posible cargar las categorías.',
        ),
      );
    }
  }

  async function loadPage() {
    setPageLoading(true);
    setPageError(null);

    try {
      await Promise.all([loadProducts(), loadCategories()]);
    } catch (error: unknown) {
      console.error(error);
      setPageError(
        getApiErrorMessage(
          error,
          'No fue posible cargar los productos.',
        ),
      );
    } finally {
      setPageLoading(false);
    }
  }

  function resetForm() {
    setSku('');
    setName('');
    setDescription('');
    setBrand('');
    setBarcode('');
    setCost('');
    setPrice('');
    setMinStock('');
    setCategoryId('');
    setInventoryTracking(DEFAULT_INVENTORY_TRACKING);
    setLotTracking(DEFAULT_LOT_TRACKING);
  }

  function openCreateModal() {
    setEditingProduct(null);
    resetForm();
    setOpenModal(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setSku(product.sku);
    setName(product.name);
    setDescription(product.description || '');
    setBrand(product.brand || '');
    setBarcode(product.barcode || '');
    setCost(product.cost.toString());
    setPrice(product.price.toString());
    setMinStock(product.minStock.toString());
    setCategoryId(product.categoryId || '');
    setInventoryTracking(product.inventoryTracking);
    setLotTracking(product.lotTracking);
    setOpenModal(true);
  }

  function closeProductModal() {
    setOpenModal(false);
    setEditingProduct(null);
    resetForm();
  }

  function openDeleteModal(product: Product) {
    setSelectedProduct(product);
    setDeleteModalOpen(true);
  }

  async function handleSaveProduct() {
    if (!sku.trim() || !name.trim() || cost === '' || price === '' || minStock === '') {
      alert('Completa todos los campos obligatorios.');
      return;
    }

    const costValue = Number(cost);
    const priceValue = Number(price);
    const minStockValue = Number(minStock);

    if (
      !Number.isFinite(costValue) ||
      !Number.isFinite(priceValue) ||
      !Number.isFinite(minStockValue)
    ) {
      alert('Los valores numéricos no son válidos.');
      return;
    }

    if (costValue < 0 || priceValue < 0 || minStockValue < 0) {
      alert('Costo, precio y stock mínimo no pueden ser negativos.');
      return;
    }

    try {
      setLoading(true);

      const basePayload = {
        sku: sku.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        categoryId: categoryId || null,
        barcode: barcode.trim() || undefined,
        cost: costValue,
        price: priceValue,
        minStock: minStockValue,
      };

      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, basePayload);
      } else {
        await api.post('/products', {
          ...basePayload,
          categoryId: categoryId || undefined,
          inventoryTracking,
          lotTracking,
        });
      }

      closeProductModal();
      await loadProducts();
    } catch (error: unknown) {
      console.error(error);
      alert(getApiErrorMessage(error, 'Error al guardar producto'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProduct() {
    if (!selectedProduct) return;

    try {
      setDeleteLoading(true);
      await api.delete(`/products/${selectedProduct.id}`);
      setDeleteModalOpen(false);
      setSelectedProduct(null);
      await loadProducts();
    } catch (error: unknown) {
      console.error(error);
      alert(getApiErrorMessage(error, 'Error al eliminar producto'));
    } finally {
      setDeleteLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function fetchInitialData() {
      try {
        await Promise.all([loadProducts(), loadCategories()]);
      } catch (error: unknown) {
        console.error(error);

        if (mounted) {
          setPageError(
            getApiErrorMessage(
              error,
              'No fue posible cargar los productos.',
            ),
          );
        }
      } finally {
        if (mounted) {
          setPageLoading(false);
        }
      }
    }

    fetchInitialData();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Productos"
          description="Administra el catálogo de productos."
          action={
            <Button onClick={openCreateModal}>
              Agregar Producto
            </Button>
          }
        />

        {pageLoading ? (
          <Loading message="Cargando productos..." />
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
                onClick={loadPage}
              >
                Reintentar
              </Button>
            </div>
          </Section>
        ) : products.length === 0 ? (
          <EmptyState
            title="No hay productos registrados"
            description="Comienza agregando tu primer producto."
          />
        ) : (
          <Section>
            {categoryError ? (
              <div
                role="alert"
                className="mb-4 flex flex-col gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-900 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{categoryError}</span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadCategories}
                >
                  Reintentar categorías
                </Button>
              </div>
            ) : null}

            <Table
              headers={[
                'SKU',
                'Nombre',
                'Marca',
                'Categoría',
                'Seguimiento',
                'Precio',
                'Stock',
                'Estado',
                'Acciones',
              ]}
              data={products.map((product) => ({
                sku: product.sku,
                name: product.name,
                brand: product.brand || '-',
                category:
                  product.category?.name ||
                  (product.categoryId
                    ? categoryNameById.get(product.categoryId)
                    : null) ||
                  '-',
                tracking: (
                  <StatusBadge
                    label={inventoryTrackingShortLabels[product.inventoryTracking]}
                    tone={
                      product.inventoryTracking === 'ASSET'
                        ? 'info'
                        : 'neutral'
                    }
                    ariaLabel={`Seguimiento de inventario: ${
                      inventoryTrackingLabels[product.inventoryTracking]
                    }`}
                  />
                ),
                price: formatMoney(product.price),
                stock: product.stock,
                status: (
                  <StatusBadge
                    label={product.isActive ? 'Activo' : 'Inactivo'}
                    tone={product.isActive ? 'success' : 'neutral'}
                    ariaLabel={`Estado del producto: ${
                      product.isActive ? 'Activo' : 'Inactivo'
                    }`}
                  />
                ),
                actions: (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(product)}
                    >
                      Editar
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => openDeleteModal(product)}
                    >
                      Eliminar
                    </Button>
                  </div>
                ),
              }))}
            />
          </Section>
        )}
      </PageContainer>

      <Modal
        isOpen={openModal}
        onClose={closeProductModal}
        title={editingProduct ? 'Editar Producto' : 'Agregar Producto'}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="SKU"
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            required
          />

          <Input
            label="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <Input
            label="Descripción"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            containerClassName="sm:col-span-2"
          />

          <Input
            label="Marca"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
          />

          <Input
            label="Código de Barras"
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
          />

          <Select
            label="Categoría"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            options={categoryOptions}
            placeholder="Sin categoría"
            helperText={
              categoryError
                ? 'Las categorías no están disponibles por ahora.'
                : 'Opcional.'
            }
            disabled={Boolean(categoryError)}
          />

          <MoneyInput
            label="Costo"
            value={cost}
            onValueChange={setCost}
            required
            helperText="Costo de adquisición."
          />

          <MoneyInput
            label="Precio"
            value={price}
            onValueChange={setPrice}
            required
            helperText="Precio de venta en pesos mexicanos."
          />

          <Input
            label="Stock mínimo"
            type="number"
            value={minStock}
            onChange={(event) => setMinStock(event.target.value)}
            required
            helperText="Umbral configurable para alertas."
          />

          {editingProduct ? (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-700">
                  Stock actual
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {editingProduct.stock}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Las operaciones de inventario administran este valor.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-700">
                  Seguimiento de inventario
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {inventoryTrackingLabels[editingProduct.inventoryTracking]}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {inventoryTrackingDescriptions[editingProduct.inventoryTracking]}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:col-span-2">
                <p className="text-sm font-medium text-gray-700">
                  Seguimiento por lote
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {lotTrackingLabels[editingProduct.lotTracking]}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {lotTrackingDescriptions[editingProduct.lotTracking]}
                </p>
              </div>
            </>
          ) : (
            <>
              <Select
                label="Seguimiento de inventario"
                value={inventoryTracking}
                onChange={(event) =>
                  setInventoryTracking(
                    event.target.value as ProductInventoryTracking,
                  )
                }
                options={inventoryTrackingOptions}
                helperText={inventoryTrackingDescriptions[inventoryTracking]}
                required
              />

              <Select
                label="Seguimiento por lote"
                value={lotTracking}
                onChange={(event) =>
                  setLotTracking(event.target.value as ProductLotTracking)
                }
                options={lotTrackingOptions}
                helperText={lotTrackingDescriptions[lotTracking]}
                required
              />
            </>
          )}

          <Button
            type="button"
            onClick={handleSaveProduct}
            loading={loading}
            loadingText="Guardando..."
            fullWidth
            className="w-full sm:col-span-2"
          >
            Guardar
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteModalOpen}
        title="Eliminar producto"
        message={
          <>
            ¿Seguro que deseas eliminar{' '}
            <span className="font-semibold">
              {selectedProduct?.name}
            </span>
            ?
          </>
        }
        loading={deleteLoading}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedProduct(null);
        }}
        onConfirm={handleDeleteProduct}
      />
    </>
  );
}
