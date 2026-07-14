'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import Modal from '@/app/components/ui/Modal';
import Input from '@/app/components/ui/Input';
import Table from '@/app/components/ui/Table';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import Button from '@/app/components/ui/Button';
import EmptyState from '@/app/components/ui/EmptyState';
import Loading from '@/app/components/ui/Loading';
import MoneyInput from '../components/business/MoneyInput';

import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';


type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  barcode?: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [barcode, setBarcode] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    
async function loadProducts() {
  try {
    const response = await api.get('/products');
    setProducts(response.data);
  } catch (error) {
    console.error(error);
  }
}

async function handleCreateProduct() {
  if (
  !sku.trim() ||
  !name.trim() ||
  cost === '' ||
  price === '' ||
  stock === '' ||
  minStock === ''
) {
  alert('Completa todos los campos obligatorios.');
  return;
}

const costValue = Number(cost);
const priceValue = Number(price);
const stockValue = Number(stock);
const minStockValue = Number(minStock);

if (
  !Number.isFinite(costValue) ||
  !Number.isFinite(priceValue) ||
  !Number.isFinite(stockValue) ||
  !Number.isFinite(minStockValue)
) {
  alert('Los valores numéricos no son válidos.');
  return;
}

if (
  costValue < 0 ||
  priceValue < 0 ||
  stockValue < 0 ||
  minStockValue < 0
) {
  alert('Costo, precio y existencias no pueden ser negativos.');
  return;
}

  try {
    setLoading(true);

    const payload = {
      sku: sku.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      barcode: barcode.trim() || undefined,
      cost: costValue,
      price: priceValue,
      stock: stockValue,
      minStock: minStockValue,
    };

    if (editingProduct) {
      await api.patch(`/products/${editingProduct.id}`, payload);
    } else {
      await api.post('/products', payload);
    }

    setOpenModal(false);
    setEditingProduct(null);

    setSku('');
    setName('');
    setDescription('');
    setBarcode('');
    setCost('');
    setPrice('');
    setStock('');
    setMinStock('');

    await loadProducts();
  } catch (error: unknown) {
    console.error(error);
    alert((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar producto');
  } finally {
    setLoading(false);
  }
}

 function openEditModal(product: Product) {
    setEditingProduct(product);

    setSku(product.sku);
    setName(product.name);
    setDescription(product.description || '');
    setBarcode(product.barcode || '');
    setCost(product.cost.toString());
    setPrice(product.price.toString());
    setStock(product.stock.toString());
    setMinStock(product.minStock.toString());

    setOpenModal(true);
}

 function openDeleteModal(product: Product) {
    setSelectedProduct(product);
    setDeleteModalOpen(true);
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
    alert((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al eliminar producto');
  } finally {
    setDeleteLoading(false);
  }
}

  useEffect(() => {
  let mounted = true;

async function fetchProducts() {
     try {
      const response = await api.get('/products');

      if (mounted) {
        setProducts(response.data);
      }
     } catch (error: unknown) {
      console.error(error);
     } finally {
      if (mounted) {
        setPageLoading(false);
      }
     }
}

  fetchProducts();

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
          <Button
            onClick={() => {
              setEditingProduct(null);

              setSku('');
              setName('');
              setDescription('');
              setBarcode('');
              setCost('');
              setPrice('');
              setStock('');
              setMinStock('');

              setOpenModal(true);
            }}
          >
            Agregar Producto
          </Button>
        }
      />

      {pageLoading ? (
        <Loading message="Cargando productos..." />
      ) : products.length === 0 ? (
        <EmptyState
          title="No hay productos registrados"
          description="Comienza agregando tu primer producto."
        />
      ) : (
        <Section>
          <Table
            headers={[
              'SKU',
              'Nombre',
              'Precio',
              'Stock',
              'Acciones',
            ]}
            data={products.map((product) => ({
              sku: product.sku,
              name: product.name,
              price: `$${product.price.toFixed(2)}`,
              stock: product.stock,
              actions: (
                <div className="flex gap-3">
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
      onClose={() => {
        setOpenModal(false);
        setEditingProduct(null);
      }}
      title={editingProduct ? 'Editar Producto' : 'Agregar Producto'}
    >
      <div className="space-y-4">
        <Input
          label="SKU"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
        />

        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Input
          label="Código de Barras"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />

        <MoneyInput
          label="Costo"
          value={cost}
          onValueChange={setCost}
          required
          helperText="Costo de adquisición del producto."
        />

        <MoneyInput
          label="Precio"
          value={price}
          onValueChange={setPrice}
          required
          helperText="Precio de venta en pesos mexicanos."
        />

        <Input
          label="Stock"
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />

        <Input
          label="Stock Mínimo"
          type="number"
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
        />

        <button
          onClick={handleCreateProduct}
          disabled={loading}
          className={`w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
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