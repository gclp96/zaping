import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/services/api';
import PurchaseQuickDetailPanel from './PurchaseQuickDetailPanel';
import type { Purchase, PurchaseReceipt } from '../types';

vi.mock('@/services/api', () => ({ api: { get: vi.fn() } }));

const purchase: Purchase = {
  id: 'purchase-1',
  folio: 'OC-0001',
  status: 'PARTIALLY_RECEIVED',
  createdAt: '2026-10-26T10:00:00.000Z',
  subtotal: 100,
  iva: 16,
  total: 116,
  supplier: { id: 'supplier-1', name: 'Proveedor médico' },
  receiptProgress: {
    orderedUnits: 10, receivedUnits: 4, pendingUnits: 6,
    orderedLines: 1, completedLines: 0,
  },
  items: [{
    id: 'item-1', productId: 'product-1', quantity: 10,
    price: 10, subtotal: 100,
    product: {
      id: 'product-1', sku: 'MED-001', name: 'Catéter médico',
      inventoryTracking: 'QUANTITY', lotTracking: 'OPTIONAL',
    },
  }],
};

const receipts: PurchaseReceipt[] = [{
  id: 'receipt-1',
  purchaseId: 'purchase-1',
  folio: 'REC-1',
  receivedAt: '2026-10-27T10:00:00.000Z',
  items: [{
    id: 'receipt-item-1',
    purchaseItemId: 'item-1',
    productId: 'product-1',
    quantityReceived: 4,
    unitCost: 10,
    product: { id: 'product-1', sku: 'MED-001', name: 'Catéter médico' },
  }],
}];

const handlers = {
  onClose: vi.fn(),
  onEdit: vi.fn(),
  onApprove: vi.fn(),
  onCancel: vi.fn(),
  onReceive: vi.fn(),
  onDownloadPdf: vi.fn(),
};

function renderPanel(options: Partial<React.ComponentProps<typeof PurchaseQuickDetailPanel>> = {}) {
  return render(
    <PurchaseQuickDetailPanel
      isOpen
      purchaseId="purchase-1"
      formatDate={() => '26 oct 2026'}
      formatMoney={(amount) => `$${amount.toFixed(2)}`}
      canEdit
      canApprove
      downloadingPurchaseId={null}
      {...handlers}
      {...options}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (String(url) === '/purchases/purchase-1') return { data: purchase } as never;
    if (String(url) === '/purchase-receipts/purchase/purchase-1') return { data: receipts } as never;
    throw new Error('Endpoint inesperado');
  });
});
afterEach(() => { cleanup(); });

describe('PUR-UX-01C — detalle contextual verificado', () => {
  it('consulta compra y recepciones reales, presenta partidas y conserva acceso al detalle completo', async () => {
    renderPanel();
    expect(await screen.findByRole('heading', { name: 'Compra OC-0001' })).toBeTruthy();
    expect(screen.getByRole('dialog').getAttribute('data-modal-layout')).toBe('side-panel');
    expect(await screen.findByText('Catéter médico')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Partidas de la compra OC-0001' });
    const row = within(table).getAllByRole('row')[1];
    expect(within(row).getByText('10')).toBeTruthy();
    expect(within(row).getByText('4')).toBeTruthy();
    expect(within(row).getByText('6')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver detalle completo' }).getAttribute('href'))
      .toBe('/purchases/purchase-1');
    expect(screen.getByRole('button', { name: 'Registrar recepción' }).hasAttribute('disabled')).toBe(false);
    expect(api.get).toHaveBeenCalledWith('/purchases/purchase-1');
    expect(api.get).toHaveBeenCalledWith('/purchase-receipts/purchase/purchase-1');
  });

  it('bloquea nueva recepción y no inventa cantidades al fallar el historial', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === '/purchases/purchase-1') return { data: purchase } as never;
      throw new Error('Sin respuesta');
    });
    renderPanel();
    expect(await screen.findByText('Catéter médico')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Partidas de la compra OC-0001' });
    const cells = within(table).getAllByRole('row')[1].querySelectorAll('td');
    expect(cells[3].textContent).toBe('—');
    expect(cells[4].textContent).toBe('—');
    const receive = screen.getByRole('button', { name: 'Registrar recepción' });
    expect(receive.hasAttribute('disabled')).toBe(true);
    expect(handlers.onReceive).not.toHaveBeenCalled();
  });

  it('no expone los datos si el endpoint de compra niega el acceso', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 403 } });
    renderPanel();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Catéter médico')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registrar recepción' })).toBeNull();
    expect(handlers.onDownloadPdf).not.toHaveBeenCalled();
  });

  it('respeta los permisos y ofrece únicamente descarga y detalle para usuario sin escritura', async () => {
    renderPanel({ canEdit: false, canApprove: false });
    expect(await screen.findByText('Catéter médico')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar recepción' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeTruthy();
  });

  it('cierra el panel antes de ceder a la recepción existente y admite Escape', async () => {
    const user = userEvent.setup();
    renderPanel();
    const receive = await screen.findByRole('button', { name: 'Registrar recepción' });
    await user.click(receive);
    expect(handlers.onClose).toHaveBeenCalledOnce();
    expect(handlers.onReceive).toHaveBeenCalledWith(purchase);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(handlers.onClose).toHaveBeenCalledTimes(2));
  });
});
