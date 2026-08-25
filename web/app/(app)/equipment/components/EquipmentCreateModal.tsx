import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';
import Modal from '@/app/components/ui/Modal';
import Select from '@/app/components/ui/Select';

import type {
  EquipmentCondition,
  EquipmentProduct,
} from '../types';

type EquipmentCreateModalProps = {
  isOpen: boolean;
  products: EquipmentProduct[];
  productsLoading: boolean;
  productsError: string;
  productId: string;
  condition: '' | EquipmentCondition;
  serialNumber: string;
  saving: boolean;
  error: string;
  onProductIdChange: (productId: string) => void;
  onConditionChange: (condition: '' | EquipmentCondition) => void;
  onSerialNumberChange: (serialNumber: string) => void;
  onRetryProducts: () => void;
  onClose: () => void;
  onSubmit: () => void;
};

const initialConditionOptions = [
  { value: 'GOOD', label: 'Bueno' },
  { value: 'INSPECTION_PENDING', label: 'Inspección pendiente' },
  { value: 'DAMAGED', label: 'Dañado' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
];

export default function EquipmentCreateModal({
  isOpen,
  products,
  productsLoading,
  productsError,
  productId,
  condition,
  serialNumber,
  saving,
  error,
  onProductIdChange,
  onConditionChange,
  onSerialNumberChange,
  onRetryProducts,
  onClose,
  onSubmit,
}: EquipmentCreateModalProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  const submitDisabled =
    saving ||
    productsLoading ||
    Boolean(productsError) ||
    products.length === 0 ||
    !productId ||
    !condition;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title="Nuevo equipo"
    >
      <form
        aria-label="Nuevo equipo"
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        {productsLoading ? (
          <p role="status" className="text-sm text-gray-600">
            Cargando productos elegibles...
          </p>
        ) : productsError ? (
          <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm text-red-700">
              {productsError}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetryProducts}
            >
              Reintentar productos
            </Button>
          </div>
        ) : products.length === 0 ? (
          <p
            role="status"
            className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
          >
            No hay productos de tipo equipo disponibles para registrar.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Producto"
            required
            value={productId}
            options={products.map((product) => ({
              value: product.id,
              label: `${product.name} · ${product.sku}`,
            }))}
            placeholder="Selecciona un producto"
            disabled={saving || productsLoading || Boolean(productsError)}
            containerClassName="sm:col-span-2"
            onChange={(event) => onProductIdChange(event.target.value)}
          />

          <Select
            label="Condición inicial"
            required
            value={condition}
            options={initialConditionOptions}
            placeholder="Selecciona la condición"
            disabled={saving}
            onChange={(event) =>
              onConditionChange(
                event.target.value as '' | EquipmentCondition,
              )
            }
          />

          <Input
            label="Número de serie (opcional)"
            maxLength={100}
            value={serialNumber}
            disabled={saving}
            placeholder="Ej. QA-G1-001"
            onChange={(event) => onSerialNumberChange(event.target.value)}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={saving}
            loadingText="Registrando..."
            disabled={submitDisabled}
          >
            Registrar equipo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
