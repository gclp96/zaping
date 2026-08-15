'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import Modal from '@/app/components/ui/Modal';
import Table from '@/app/components/ui/Table';
import PageContainer from '../components/ui/layout/PageContainer';
import Button from '../components/ui/Button';
import Loading from '../components/ui/Loading';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';
import CustomerFormModal from '@/app/components/business/CustomerForm';

type Customer = {
  id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  address?: string | null;
  contactName?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

 export default function CustomersPage() {

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

async function loadCustomers() {
  try {
    setPageLoading(true);

    const response = await api.get('/customers');

    setCustomers(response.data);
  } catch (error) {
    console.error(error);
  } finally {
    setPageLoading(false);
  }
}

 useEffect(() => {
     (async () => {
     await loadCustomers();
  })();
 }, []);

 function openDeleteModal(customer: Customer){
  setSelectedCustomer(customer);
  setDeleteModalOpen(true);
}

function openEditModal(customer: Customer) {
  setEditingCustomer(customer);
  setOpenModal(true);
}

 async function handleDeleteCustomer() {
   if (!selectedCustomer) return;

   try {
    setDeleteLoading(true);

    await api.delete(`/customers/${selectedCustomer.id}`);

    setDeleteModalOpen(false);
    setSelectedCustomer(null);

    await loadCustomers();
   } catch (error) {
      console.error(error);
   } finally {
      setDeleteLoading(false);
   }
 }

 const tableData = customers.map((customer) => ({
  name: customer.name,
  email: customer.email,
  phone: customer.phone,
  actions: (
      <div className="flex gap-3">
        <button
          onClick={() => openEditModal(customer)}
          className="text-blue-600 hover:text-blue-800"
          >
            Editar
          </button>

          <button
            onClick={() => openDeleteModal(customer)}
            className="text-red-600 hover:text-red-800"
            >
              Eliminar
            </button>
        </div>
  )
}));

 const formattedCustomerName = selectedCustomer?.name
   ? selectedCustomer.name.charAt(0).toUpperCase() +
    selectedCustomer.name.slice(1)
    :'';

   return (
    <>
    <PageContainer>
        <PageHeader
            title="Clientes"
            description="Administra los clientes registrados."
            action={
              <Button
                onClick={() => {
                  setEditingCustomer(null);
                  setOpenModal(true);
                }}
              >
                Nuevo Cliente
              </Button>
            }
          />

      {pageLoading ? (
        <Loading
            message="Cargando clientes..."
        />
      ) : customers.length === 0 ? (
        <EmptyState
            title="Sin clientes"
            description="Aún no existen clientes registrados."
        />
      ) : (
        <Section>
          <Table
            headers={['Nombre', 'Email', 'Teléfono', 'Acciones']}
            data={tableData}
          />
        </Section>
      )}
    </PageContainer>

    <CustomerFormModal
      isOpen={openModal}
      customer={editingCustomer}
      onClose={() => {
        setOpenModal(false);
        setEditingCustomer(null);
      }}
      onSaved={async () => {
        await loadCustomers();
      }}
    />

    <Modal
      isOpen={deleteModalOpen}
      onClose={() => {
        setDeleteModalOpen(false);
        setSelectedCustomer(null);
      }}
        title="Confirmar eliminación"
        >
          <div className='space-y-6'>
            <p className='text-gray-700'>
              ¿Seguro que deseas eliminar a{' '}
              <span className='font-semibold text-black'>
                {formattedCustomerName}
              </span>?
            </p>

            <p className='text-sm text-red-600'>
              Esta acción no se puede deshacer.
            </p>

            <div className='flex justify-end gap-3'>
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSelectedCustomer(null);
                }}
                className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50'
                >
                  Cancelar
                </button>

                <button
                onClick={handleDeleteCustomer}
                disabled={deleteLoading}
                className='px-4 py-2 bg-red-700 text-white rounded-lg disabled:bg-gray-400'
                > 
                {deleteLoading ? 'Eliminando...' : 'Eliminar'}
                </button>
            </div>
          </div>
        </Modal>
  </>
);
 }
