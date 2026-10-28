import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { PurchaseReceiptFormItem } from '../types';
import ReceiptCaptureSummary from './ReceiptCaptureSummary';

afterEach(cleanup);

function item(
  purchaseItemId: string,
  pendingQuantity: number,
  quantityReceived: string,
): PurchaseReceiptFormItem {
  return {
    purchaseItemId,
    productId: purchaseItemId,
    sku: purchaseItemId,
    name: 'Producto de prueba',
    inventoryTracking: 'QUANTITY',
    lotTracking: 'OPTIONAL',
    orderedQuantity: 10,
    receivedQuantity: 10 - pendingQuantity,
    pendingQuantity,
    quantityReceived,
    lotNumber: '',
    expirationDate: '',
  };
}

describe('RR-004 — tarjeta resumen de recepción', () => {
  it('muestra cifras en español y explica que no actualiza inventario', () => {
    render(
      <ReceiptCaptureSummary
        items={[
          item('a', 5, '2'),
          item('b', 3, ''),
        ]}
      />,
    );
    const card = screen.getByRole('region', {
      name: 'Resumen de esta recepción',
    });
    expect(
      within(card).getByTestId('receipt-summary-pending-before').textContent,
    ).toBe('8');
    expect(
      within(card).getByTestId('receipt-summary-to-receive').textContent,
    ).toBe('2');
    expect(
      within(card).getByTestId('receipt-summary-pending-after').textContent,
    ).toBe('6');
    expect(within(card).getByText(/se actualizan cuando el servidor/)).toBeTruthy();
    expect(within(card).getByRole('status').textContent).toContain(
      '1 de 2 partidas',
    );
  });

  it('actualiza el resumen cuando cambian las cantidades del formulario', () => {
    const first = [item('a', 5, '1')];
    const result = render(<ReceiptCaptureSummary items={first} />);
    expect(
      screen.getByTestId('receipt-summary-to-receive').textContent,
    ).toBe('1');
    result.rerender(<ReceiptCaptureSummary items={[item('a', 5, '4')]} />);
    expect(
      screen.getByTestId('receipt-summary-to-receive').textContent,
    ).toBe('4');
    expect(
      screen.getByTestId('receipt-summary-pending-after').textContent,
    ).toBe('1');
  });

  it('desactiva cifras derivadas con un valor inválido y conserva aviso visible', () => {
    render(
      <ReceiptCaptureSummary
        items={[item('a', 5, '2'), item('b', 3, '4')]}
      />,
    );
    const card = screen.getByRole('region', {
      name: 'Resumen de esta recepción',
    });
    expect(
      within(card).getByTestId('receipt-summary-pending-before').textContent,
    ).toBe('8');
    expect(
      within(card).getByTestId('receipt-summary-to-receive').textContent,
    ).toBe('—');
    expect(
      within(card).getByTestId('receipt-summary-pending-after').textContent,
    ).toBe('—');
    expect(within(card).getByRole('status').textContent).toContain(
      'valores inválidos',
    );
  });

  it('no representa captura vacía como recepción realizada', () => {
    render(<ReceiptCaptureSummary items={[item('a', 5, '')]} />);
    expect(screen.getByRole('status').textContent).toContain(
      'Indica la cantidad a recibir',
    );
    expect(screen.getByText(/solo se actualizan cuando el servidor/)).toBeTruthy();
  });
});
