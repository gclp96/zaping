'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import Modal from '@/app/components/ui/Modal';
import Input from '@/app/components/ui/Input';
import Table from '@/app/components/ui/Table';

import Button from '@/app/components/ui/Button';
import EmptyState from '@/app/components/ui/EmptyState';
import Loading from '@/app/components/ui/Loading';

import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';

type Supplier = {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    contactName?: string;
    notes?: string;
};

export default function SuppliersPage() {

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [notes, setNotes] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

async function loadSuppliers() {
  try {
    setPageLoading(true);

    const response = await api.get('/suppliers');

    setSuppliers(response.data);
  } catch (error) {
    console.error(error);
  } finally {
    setPageLoading(false);
  }
}

 useEffect(() => {
     (async () => {
     await loadSuppliers();
  })();
 }, []);

async function handleCreateSupplier() {
  if (!name) {
    alert('El nombre es obligatorio');
    return;
  }

  if (email && !/\S+@\S+\.\S+/.test(email)) {
  alert('Ingresa un email válido');
  return;
}

  try {
    setLoading(true);

    if (editingSupplier) {
      await api.patch(
        `/suppliers/${editingSupplier.id}`,
        {
          name,
          email,
          phone,
          address,
          contactName,
          notes,
        },
      );
    } else {
      await api.post(
        '/suppliers',
        {
          name,
          email,
          phone,
          address,
          contactName,
          notes,
        },
      );
    }

    setOpenModal(false);
    setEditingSupplier(null);

    setName('');
    setAddress('');
    setContactName('');
    setNotes('');
    setEmail('');
    setPhone('');

    await loadSuppliers();
     } catch (error: unknown) {
      console.error(error);
     const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || 'Ocurrió un error';

      alert(message);
      } finally {
     setLoading(false);
  }
}  

function openDeleteModal(supplier: Supplier){
  setSelectedSupplier(supplier);
  setDeleteModalOpen(true);
}

function openEditModal(supplier: Supplier) {
  setEditingSupplier(supplier);

  setName(supplier.name || '');
  setEmail(supplier.email || '');
  setPhone(supplier.phone || '');
  setAddress(supplier.address || '');
  setContactName(supplier.contactName || '');
  setNotes(supplier.notes || '');

  setOpenModal(true);
 }

async function handleDeleteSupplier() {
   if (!selectedSupplier) return;

   try {
    setDeleteLoading(true);

    await api.delete(`/suppliers/${selectedSupplier.id}`);

    setDeleteModalOpen(false);
    setSelectedSupplier(null);

    await loadSuppliers();
     } catch (error: unknown) {
     console.error(error);
     const message =
     (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || 'Ocurrió un error al eliminar';

     alert(message);
     }
       finally {
      setDeleteLoading(false);
   }
 }

const tableData = suppliers.map((supplier) => ({
  name: supplier.name,
  contactName: supplier.contactName || '-',
  email: supplier.email || '-',
  phone: supplier.phone || '-',
  actions: (
      <div className="flex gap-3">
        <button
          onClick={() => openEditModal(supplier)}
          className="text-blue-600 hover:text-blue-800"
          >
            Editar
          </button>

          <button
            onClick={() => openDeleteModal(supplier)}
            className="text-red-600 hover:text-red-800"
            >
              Eliminar
            </button>
        </div>
  )
}));

const formattedSupplierName = selectedSupplier?.name
   ? selectedSupplier.name.charAt(0).toUpperCase() +
    selectedSupplier.name.slice(1)
    :'';

   return (
    <>
    <PageContainer>
         <PageHeader
        title="Proveedores"
        description="Administra los proveedores registrados."
        action={
          <Button
            onClick={() => {
              setEditingSupplier(null);

              setName('');
              setEmail('');
              setPhone('');
              setAddress('');
              setContactName('');
              setNotes('');

              setOpenModal(true);
            }}
          >
            Nuevo Proveedor
          </Button>
        }
         />

      {pageLoading ? (
        <Loading
            message="Cargando proveedores..."
        />
      ) : suppliers.length === 0 ? (
        <EmptyState
            title="Sin proveedores"
            description="Aún no existen proveedores registrados."
        />
      ) : (
          <Section>
          <Table
            headers={['Nombre', 'Contacto', 'Email', 'Teléfono', 'Acciones']}
            data={tableData}
          />
          </Section>
      )}
      </PageContainer>
    
    <Modal
      isOpen={openModal}
        onClose={() => {
          setOpenModal(false);
          setEditingSupplier(null);

          setName('');
          setEmail('');
          setPhone('');
          setAddress('');
          setContactName('');
          setNotes('');
         }}

       title={editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
         >
         <div className="space-y-6">
          <div className="border-b pb-2">
            <h3 className="text-sm font-semibold text-gray-foreground">
              Informacion general
            </h3>
          </div>
          <Input
            label="Nombre *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            />

          <Input
                label="Nombre de contacto"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
            />
          
         <div className="border-b pb-2">
              <h3 className="text-sm font-semibold text-gray-foreground">
                Información de contacto
              </h3>
          </div>
          <Input
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            />

          <Input
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            />

          <Input
              label="Dirección"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

         <div className="border-b pb-2">
            <h3 className="text-sm bg-center font-semibold text-foreground">
              Información adicional
            </h3>
          </div>
            <label className="text-sm font-medium">
              Notas
            </label>
           <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-lg p-3 min-h-28 resize-none"
            />

          <Button
              onClick={handleCreateSupplier}
              disabled={!name}
              loading={loading}
              loadingText={
                editingSupplier
                  ? 'Actualizando...'
                  : 'Guardando...'
              }
              fullWidth
            >
              {editingSupplier ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>

    </Modal>  

    <Modal
      isOpen={deleteModalOpen}
      onClose={() => {
        setDeleteModalOpen(false);
        setSelectedSupplier(null);
      }}
        title="Confirmar eliminación"
        >
          <div className='space-y-6'>
            <p className='text-gray-700'>
              ¿Seguro que deseas eliminar a{' '}
              <span className='font-semibold text-black'>
                {formattedSupplierName}
              </span>?
            </p>

            <p className='text-sm text-red-600'>
              Esta acción no se puede deshacer.
            </p>

            <div className='flex justify-end gap-3'>
              <Button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSelectedSupplier(null);
                }}
                className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50'
                >
                  Cancelar
                </Button>

                <Button
                onClick={handleDeleteSupplier}
                disabled={deleteLoading}
                className='px-4 py-2 bg-red-700 text-white rounded-lg disabled:bg-gray-400'
                > 
                {deleteLoading ? 'Eliminando...' : 'Eliminar'}
                </Button>
            </div>
          </div>
        </Modal>
  </>
);
 }

