'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';
import Modal from '@/app/components/ui/Modal';
import Input from '@/app/components/ui/Input';
import Table from '@/app/components/ui/Table';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import Button from '@/app/components/ui/Button';
import EmptyState from '@/app/components/ui/EmptyState';

type Category = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  async function loadCategories() {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCreateCategory() {
    if (!name.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        isActive,
      };

      if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }

      setOpenModal(false);
      setEditingCategory(null);
      setName('');
      setDescription('');
      setIsActive(true);

      await loadCategories();
    } catch (error: unknown) {
      console.error(error);

      alert(getApiErrorMessage(error, 'Error al guardar categoría'));
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setIsActive(category.isActive);
    setOpenModal(true);
  }

  function openDeleteModal(category: Category) {
    setSelectedCategory(category);
    setDeleteModalOpen(true);
  }

  async function handleDeleteCategory() {
    if (!selectedCategory) return;

    try {
      setDeleteLoading(true);

      await api.delete(`/categories/${selectedCategory.id}`);

      setDeleteModalOpen(false);
      setSelectedCategory(null);

      await loadCategories();
    } catch (error: unknown) {
      console.error(error);

      alert(getApiErrorMessage(error, 'Error al eliminar categoría'));
    } finally {
      setDeleteLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function fetchCategories() {
      try {
        const response = await api.get('/categories');

        if (mounted) {
          setCategories(response.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) {
          setPageLoading(false);
        }
      }
    }

    fetchCategories();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Categorías</h1>

          <Button
            onClick={() => {
              setEditingCategory(null);
              setName('');
              setDescription('');
              setIsActive(true);
              setOpenModal(true);
            }}
          >
            Nueva Categoría
          </Button>
        </div>

        {pageLoading ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            Cargando categorías...
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
              title="No hay categorías registradas"
              description="Crea la primera categoría para organizar tus productos."
          />
        ) : (
          <Table
            headers={['Nombre', 'Estado', 'Acciones']}
            data={categories.map((category) => ({
              name: category.name,
              status: category.isActive ? 'Activa' : 'Inactiva',
              actions: (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => openEditModal(category)}
                  >
                    Editar
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => openDeleteModal(category)}
                  >
                    Eliminar
                  </Button>
                </div>
              ),
            }))}
          />
        )}
      </div>

      <Modal
        isOpen={openModal}
        onClose={() => {
          setOpenModal(false);
          setEditingCategory(null);
          setName('');
          setDescription('');
          setIsActive(true);
        }}
        title={editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
      >
        <div className="space-y-4">
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

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            Activa
          </label>

          <button
            onClick={handleCreateCategory}
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded disabled:bg-gray-400"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </Modal>

       <ConfirmDialog
            isOpen={deleteModalOpen}
            title="Eliminar categoría"
            message={
              <>
                ¿Seguro que deseas eliminar{' '}
                <span className="font-semibold">
                  {selectedCategory?.name}
                </span>
                ?
              </>
            }
            loading={deleteLoading}
            onClose={() => {
              setDeleteModalOpen(false);
              setSelectedCategory(null);
            }}
            onConfirm={handleDeleteCategory}
          />
      </>
  );
}
