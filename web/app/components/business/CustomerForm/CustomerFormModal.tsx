import { useState } from 'react';

import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Modal from '../../ui/Modal';

import type {
  CustomerFormCustomer,
  CustomerFormModalProps,
} from './CustomerForm.types';

type FormErrors = {
  name?: string;
  type?: string;
  email?: string;
  phone?: string;
};

type CustomerFormContentProps = {
  customer: CustomerFormCustomer | null;
  onClose: () => void;
  onSaved: (
    customer: CustomerFormCustomer,
  ) => void | Promise<void>;
};

function normalizeOptionalValue(
  value: string,
): string | undefined {
  const trimmedValue = value.trim();

  return trimmedValue || undefined;
}

function CustomerFormContent({
  customer,
  onClose,
  onSaved,
}: CustomerFormContentProps) {
  const [name, setName] = useState(
    customer?.name ?? '',
  );

  const [customerType, setCustomerType] =
    useState(customer?.type ?? '');

  const [email, setEmail] = useState(
    customer?.email ?? '',
  );

  const [phone, setPhone] = useState(
    customer?.phone ?? '',
  );

  const [contactName, setContactName] =
    useState(customer?.contactName ?? '');

  const [address, setAddress] = useState(
    customer?.address ?? '',
  );

  const [notes, setNotes] = useState(
    customer?.notes ?? '',
  );

  const [errors, setErrors] =
    useState<FormErrors>({});

  const [formError, setFormError] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  const editing = Boolean(customer);

  function validateForm(): boolean {
    const nextErrors: FormErrors = {};

    const trimmedName = name.trim();
    const trimmedType =
      customerType.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      nextErrors.name =
        'El nombre del cliente es obligatorio.';
    }

    if (!trimmedType) {
      nextErrors.type =
        'El tipo de cliente es obligatorio.';
    }

    if (!trimmedEmail) {
      nextErrors.email =
        'El correo electrónico es obligatorio.';
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        trimmedEmail,
      )
    ) {
      nextErrors.email =
        'Ingresa un correo electrónico válido.';
    }

    if (!trimmedPhone) {
      nextErrors.phone =
        'El teléfono es obligatorio.';
    }

    setErrors(nextErrors);

    return (
      Object.keys(nextErrors).length === 0
    );
  }

  function handleClose() {
    if (saving) {
      return;
    }

    onClose();
  }

  async function handleSave() {
    setFormError('');

    if (!validateForm()) {
      return;
    }

    const payload = {
      name: name.trim(),
      type: customerType.trim(),
      email: email.trim(),
      phone: phone.trim(),

      contactName:
        normalizeOptionalValue(
          contactName,
        ),

      address:
        normalizeOptionalValue(address),

      notes:
        normalizeOptionalValue(notes),
    };

    try {
      setSaving(true);

      const response = customer
        ? await api.patch<CustomerFormCustomer>(
            `/customers/${customer.id}`,
            payload,
          )
        : await api.post<CustomerFormCustomer>(
            '/customers',
            payload,
          );

      await onSaved(response.data);

      onClose();
    } catch (error) {
      setFormError(
        getApiErrorMessage(
          error,
          customer
            ? 'No fue posible actualizar el cliente.'
            : 'No fue posible registrar el cliente.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Nombre"
          value={name}
          required
          disabled={saving}
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value);

            if (errors.name) {
              setErrors((current) => ({
                ...current,
                name: undefined,
              }));
            }
          }}
        />

        <Input
          label="Tipo"
          value={customerType}
          required
          disabled={saving}
          error={errors.type}
          helperText="Ej. Hospital, clínica, distribuidor o particular."
          onChange={(event) => {
            setCustomerType(
              event.target.value,
            );

            if (errors.type) {
              setErrors((current) => ({
                ...current,
                type: undefined,
              }));
            }
          }}
        />

        <Input
          label="Email"
          type="email"
          value={email}
          required
          disabled={saving}
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value);

            if (errors.email) {
              setErrors((current) => ({
                ...current,
                email: undefined,
              }));
            }
          }}
        />

        <Input
          label="Teléfono"
          type="tel"
          value={phone}
          required
          disabled={saving}
          error={errors.phone}
          onChange={(event) => {
            setPhone(event.target.value);

            if (errors.phone) {
              setErrors((current) => ({
                ...current,
                phone: undefined,
              }));
            }
          }}
        />
      </div>

      <div className="border-t border-gray-200 pt-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          Información adicional
        </h3>

        <div className="space-y-4">
          <Input
            label="Contacto"
            value={contactName}
            disabled={saving}
            onChange={(event) =>
              setContactName(
                event.target.value,
              )
            }
          />

          <Input
            label="Dirección"
            value={address}
            disabled={saving}
            onChange={(event) =>
              setAddress(
                event.target.value,
              )
            }
          />

          <div className="flex flex-col gap-2">
            <label
              htmlFor="customer-notes"
              className="text-sm font-medium text-gray-700"
            >
              Notas
            </label>

            <textarea
              id="customer-notes"
              value={notes}
              rows={3}
              disabled={saving}
              className={[
                'w-full rounded-lg border border-gray-300 bg-white px-3 py-3',
                'text-sm text-gray-900 outline-none',
                'focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
                saving
                  ? 'cursor-not-allowed bg-gray-100'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onChange={(event) =>
                setNotes(
                  event.target.value,
                )
              }
            />
          </div>
        </div>
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
          variant="outline"
          disabled={saving}
          onClick={handleClose}
        >
          Cancelar
        </Button>

        <Button
          loading={saving}
          loadingText={
            editing
              ? 'Actualizando...'
              : 'Registrando...'
          }
          disabled={saving}
          onClick={handleSave}
        >
          {editing
            ? 'Guardar cambios'
            : 'Registrar cliente'}
        </Button>
      </div>
    </div>
  );
}

export default function CustomerFormModal({
  isOpen,
  customer = null,
  onClose,
  onSaved,
}: CustomerFormModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        customer
          ? 'Editar cliente'
          : 'Nuevo cliente'
      }
    >
      {isOpen ? (
        <CustomerFormContent
          key={customer?.id ?? 'new'}
          customer={customer}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Modal>
  );
}