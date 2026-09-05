import type { InventoryMovement } from '../types';
import Button from '@/app/components/ui/Button';

type PurchaseInventoryMovementsProps = {
  movements: InventoryMovement[];
  loading: boolean;
  error: string;
  onRetry?: () => void;
  formatDate: (value: string) => string;
  formatMoney: (value: number) => string;
};

export default function PurchaseInventoryMovements({
  movements,
  loading,
  error,
  onRetry,
  formatDate,
  formatMoney,
}: PurchaseInventoryMovementsProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 font-semibold">
        Movimientos de inventario
      </h3>

      {loading ? (
        <p className="text-sm text-gray-500">
          Cargando movimientos...
        </p>
      ) : error ? (
        <div
          role="alert"
          className="space-y-3 text-sm text-red-600"
        >
          <p>{error}</p>

          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
            >
              Reintentar movimientos
            </Button>
          ) : null}
        </div>
      ) : movements.length === 0 ? (
        <p className="text-sm text-gray-500">
          Esta compra no tiene movimientos de inventario asociados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">
                  Producto
                </th>

                <th className="px-3 py-2 text-left">
                  Tipo
                </th>

                <th className="px-3 py-2 text-right">
                  Cantidad
                </th>

                <th className="px-3 py-2 text-right">
                  Balance
                </th>

                <th className="px-3 py-2 text-right">
                  Costo
                </th>

                <th className="px-3 py-2 text-left">
                  Fecha
                </th>
              </tr>
            </thead>

            <tbody>
              {movements.map((movement) => (
                <tr
                  key={movement.id}
                  className="border-t border-gray-200"
                >
                  <td className="px-3 py-3">
                    <p className="font-medium">
                      {movement.product.name}
                    </p>

                    <p className="text-xs text-gray-500">
                      {movement.product.sku}
                    </p>
                  </td>

                  <td className="px-3 py-3">
                    {movement.movementType}
                  </td>

                  <td className="px-3 py-3 text-right">
                    {movement.quantity}
                  </td>

                  <td className="px-3 py-3 text-right">
                    {movement.balance}
                  </td>

                  <td className="px-3 py-3 text-right">
                    {movement.unitCost != null
                      ? formatMoney(movement.unitCost)
                      : '—'}
                  </td>

                  <td className="px-3 py-3">
                    {formatDate(movement.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
