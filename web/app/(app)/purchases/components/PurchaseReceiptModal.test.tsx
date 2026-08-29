import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PurchaseReceiptModal from './PurchaseReceiptModal';

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
});
