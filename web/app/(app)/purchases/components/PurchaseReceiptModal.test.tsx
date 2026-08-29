import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PurchaseReceiptModal from './PurchaseReceiptModal';

import type { PurchaseReceiptFormItem } from '../types';

afterEach(cleanup);

function createReceiptItem(
  overrides: Partial<PurchaseReceiptFormItem> = {},
): PurchaseReceiptFormItem {
  return {
    purchaseItemId: 'purchase-item-1',
    productId: 'product-1',
    sku: 'QTY-001',
    name: 'Producto por cantidad',
    inventoryTracking: 'QUANTITY',
    lotTracking: 'OPTIONAL',
    orderedQuantity: 10,
    receivedQuantity: 4,
    pendingQuantity: 6,
    quantityReceived: '',
    lotNumber: '',
    expirationDate: '',
    ...overrides,
  };
}

describe('PurchaseReceiptModal — recepción registrada', () => {
  it('expone navegación a la recepción y a su contexto de inventario', async () => {
    const user = userEvent.setup();
    const onViewReceipt = vi.fn();
    const onViewInventory = vi.fn();

    render(
      <PurchaseReceiptModal
        isOpen
        purchase={null}
        items={[]}
        notes=""
        saving={false}
        error=""
        fieldErrors={{}}
        createdReceipt={{ id: 'receipt-123', folio: 'REC-000123' }}
        onClose={vi.fn()}
        onItemChange={vi.fn()}
        onNotesChange={vi.fn()}
        onSubmit={vi.fn()}
        onViewReceipt={onViewReceipt}
        onViewInventory={onViewInventory}
      />,
    );

    const receiptButton = screen.getByRole('button', {
      name: 'Ver recepción',
    });
    const inventoryButton = screen.getByRole('button', {
      name: 'Ver en inventario',
    });

    expect(receiptButton.className).toContain('w-full');
    expect(inventoryButton.className).toContain('w-full');

    await user.click(receiptButton);
    await user.click(inventoryButton);

    expect(onViewReceipt).toHaveBeenCalledWith('receipt-123');
    expect(onViewInventory).toHaveBeenCalledWith(
      'receipt-123',
      'REC-000123',
    );
  });

  it('mantiene tabla y editor responsive con tracking por partida', async () => {
    const onItemChange = vi.fn();

    render(
      <PurchaseReceiptModal
        isOpen
        purchase={{
          folio: 'OC-0001',
          supplier: { name: 'Proveedor médico' },
        }}
        items={[
          createReceiptItem({
            purchaseItemId: 'none-item',
            sku: 'QTY-NONE',
            name: 'Producto sin lote',
            lotTracking: 'NONE',
          }),
          createReceiptItem({
            purchaseItemId: 'optional-item',
            sku: 'QTY-OPTIONAL',
            name: 'Producto opcional',
          }),
          createReceiptItem({
            purchaseItemId: 'required-item',
            sku: 'QTY-REQUIRED',
            name: 'Producto requerido',
            lotTracking: 'REQUIRED',
          }),
          createReceiptItem({
            purchaseItemId: 'asset-item',
            sku: 'ASSET-001',
            name: 'Equipo individual',
            inventoryTracking: 'ASSET',
          }),
        ]}
        notes=""
        saving={false}
        error=""
        fieldErrors={{}}
        createdReceipt={null}
        onClose={vi.fn()}
        onItemChange={onItemChange}
        onNotesChange={vi.fn()}
        onSubmit={vi.fn()}
        onViewReceipt={vi.fn()}
        onViewInventory={vi.fn()}
      />,
    );

    const desktop = await screen.findByTestId('receipt-desktop-items');
    const mobile = screen.getByTestId('receipt-mobile-items');
    const table = within(desktop).getByRole('table');

    expect(desktop.className).toContain('xl:block');
    expect(mobile.className).toContain('xl:hidden');
    expect(within(table).getByText(/líneas pendientes/i)).toBeTruthy();
    expect(
      within(table).getAllByRole('columnheader'),
    ).toHaveLength(7);
    expect(
      within(table).getAllByRole('columnheader').every(
        (header) => header.getAttribute('scope') === 'col',
      ),
    ).toBe(true);

    expect(
      within(desktop).getAllByText('No aplica'),
    ).toHaveLength(2);
    expect(
      within(mobile).getByText('Lote y caducidad: no aplica.'),
    ).toBeTruthy();

    const requiredLot = within(desktop).getByLabelText(
      'Lote de Producto requerido',
    );
    expect(requiredLot.getAttribute('required')).toBe('');
    expect(
      within(desktop).getByLabelText('Lote de Producto opcional'),
    ).toBeTruthy();

    expect(
      screen.getByRole('note', {
        name: 'Información sobre generación de equipos',
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByText(
        'Al registrar esta recepción se generarán equipos individuales para esta partida.',
      ),
    ).toHaveLength(2);

    const mobileAssetItem = within(mobile).getByTestId(
      'receipt-mobile-item-asset-item',
    );
    fireEvent.change(
      within(mobileAssetItem).getByLabelText('Lote de Equipo individual'),
      { target: { value: 'ASSET-LOT-001' } },
    );

    expect(onItemChange).toHaveBeenCalledWith(
      'asset-item',
      'lotNumber',
      'ASSET-LOT-001',
    );
  });
});
