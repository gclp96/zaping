import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthenticatedSession, type UserRole } from '@/app/auth-session';
import { api } from '@/services/api';

import ReceiptSupplierDocuments from './ReceiptSupplierDocuments';

vi.mock('@/app/auth-session', () => ({
  useAuthenticatedSession: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

function setRole(role: UserRole) {
  vi.mocked(useAuthenticatedSession).mockReturnValue({
    status: 'success',
    retry: vi.fn(),
    user: {
      id: 'actor-1',
      companyId: 'company-1',
      role,
      email: 'qa@example.invalid',
      firstName: 'QA',
      lastName: 'Pruebas',
      companyTimezone: 'America/Hermosillo',
    },
  });
}

function link(id: string, docId: string) {
  return {
    id,
    receiptId: 'receipt-1',
    documentId: docId,
    document: {
      id: docId,
      type: 'REMISION' as const,
      series: 'A',
      number: '000123',
      status: 'ACTIVE' as const,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setRole('ADMIN');
  vi.mocked(api.get).mockResolvedValue({ data: [] } as never);
});

afterEach(() => cleanup());

describe('ReceiptSupplierDocuments', () => {
  it('opens the exact validated document ID, not a guessed folio', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [link('association-1', 'document-actual-1')],
    } as never);
    render(
      <ReceiptSupplierDocuments
        receiptId="receipt-1" supplierId="supplier-1"
        legacyReference="REMISION · 000123"
      />,
    );

    expect(
      await screen.findByRole('link', {
        name: 'Ver documento REMISION · A-000123',
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Ver documento REMISION · A-000123' })
        .getAttribute('href'),
    ).toBe('/supplier-documents/document-actual-1');
    expect(api.get).toHaveBeenCalledWith(
      '/supplier-documents/receipts/receipt-1/links',
    );
  });

  it('keeps same-folio documents distinct by ID', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        link('association-1', 'first-document'),
        link('association-2', 'second-document'),
      ],
    } as never);
    render(<ReceiptSupplierDocuments receiptId="receipt-1" supplierId="supplier-1" legacyReference={null} />);

    await screen.findByRole('list', {
      name: 'Documentos vinculados a esta recepción',
    });
    expect(
      screen
        .getAllByRole('link', { name: 'Ver documento REMISION · A-000123' })
        .map((item) => item.getAttribute('href')),
    ).toEqual([
      '/supplier-documents/first-document',
      '/supplier-documents/second-document',
    ]);
  });

  it('does not construct a document link from a legacy textual reference', async () => {
    render(
      <ReceiptSupplierDocuments
        receiptId="receipt-1" supplierId="supplier-1"
        legacyReference="REMISION · 000123"
      />,
    );
    expect(
      await screen.findByText(/Referencia documental sin vínculo por ID/),
    ).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it.each(['WAREHOUSE', 'SALES'] as const)(
    'never queries management-only documents for %s',
    (role) => {
      setRole(role);
      render(
        <ReceiptSupplierDocuments
          receiptId="receipt-1" supplierId="supplier-1"
          legacyReference="FACTURA · 451"
        />,
      );
      expect(screen.getByText(/Solo Administración o Gerencia/)).toBeTruthy();
      expect(api.get).not.toHaveBeenCalled();
      expect(screen.queryByRole('link')).toBeNull();
    },
  );

  it('fails closed if a link ID and its populated document ID disagree', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ ...link('association-1', 'doc-1'), documentId: 'different-id' }],
    } as never);
    render(<ReceiptSupplierDocuments receiptId="receipt-1" supplierId="supplier-1" legacyReference={null} />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'La respuesta de vínculos documentales no es válida.',
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('filters documents by receipt supplier and posts the selected ID', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      ({
        data:
          path === '/supplier-documents'
            ? [
                {
                  id: 'document-1',
                  supplierId: 'supplier-1',
                  type: 'REMISION',
                  series: 'A',
                  number: '000123',
                  status: 'ACTIVE',
                  identityOccurrence: 1,
                },
                {
                  id: 'document-2',
                  supplierId: 'supplier-1',
                  type: 'REMISION',
                  series: 'A',
                  number: '000123',
                  status: 'ACTIVE',
                  identityOccurrence: 2,
                },
              ]
            : [],
      }) as never,
    );
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never);
    const user = userEvent.setup();
    render(
      <ReceiptSupplierDocuments
        receiptId="receipt-1"
        supplierId="supplier-1"
        legacyReference="REMISION · 000123"
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Vincular documento existente' }),
    );
    expect(api.get).toHaveBeenCalledWith('/supplier-documents', {
      params: { supplierId: 'supplier-1' },
    });
    await user.selectOptions(
      screen.getByLabelText('Documento del proveedor'),
      'document-2',
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar vínculo' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/supplier-documents/receipts/receipt-1/links',
        { documentId: 'document-2' },
      ),
    );
  });

  it('rejects documents from another supplier returned by the API', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      ({
        data:
          path === '/supplier-documents'
            ? [{
                id: 'foreign-document',
                supplierId: 'other-supplier',
                type: 'FACTURA',
                series: null,
                number: '777',
                status: 'ACTIVE',
                identityOccurrence: 1,
              }]
            : [],
      }) as never,
    );
    const user = userEvent.setup();
    render(
      <ReceiptSupplierDocuments
        receiptId="receipt-1"
        supplierId="supplier-1"
        legacyReference={null}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Vincular documento existente' }),
    );
    expect(
      await screen.findByText('No fue posible cargar los documentos del proveedor.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirmar vínculo' })).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('does not request a link without a selected document', async () => {
    vi.mocked(api.get).mockImplementation(async () => ({ data: [] }) as never);
    const user = userEvent.setup();
    render(
      <ReceiptSupplierDocuments
        receiptId="receipt-1"
        supplierId="supplier-1"
        legacyReference={null}
      />,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Vincular documento existente' }),
    );
    expect(await screen.findByText(/No hay documentos recientes disponibles/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Confirmar vínculo' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
  });


  it('removes the selected exact ID only after a reason and explicit confirmation', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [link('association-1', 'doc-one'), link('association-2', 'doc-two')],
    } as never).mockResolvedValueOnce({
      data: [link('association-1', 'doc-one')],
    } as never);
    vi.mocked(api.delete).mockResolvedValue({ data: { unlinked: true } } as never);
    const user = userEvent.setup();
    render(<ReceiptSupplierDocuments receiptId="receipt-1" supplierId="supplier-1" legacyReference={null} />);
    await screen.findByRole('list', { name: 'Documentos vinculados a esta recepción' });
    await user.click(screen.getAllByRole('button', { name: /Desvincular documento REMISION/ })[1]);

    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmar desvinculación' }).hasAttribute('disabled')).toBe(true);
    await user.type(
      screen.getByRole('textbox', { name: 'Motivo de desvinculación (mínimo 10 caracteres)' }),
      '   Remisión relacionada incorrectamente   ',
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar desvinculación' }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(
      '/supplier-documents/receipts/receipt-1/links/doc-two',
      { data: { reason: 'Remisión relacionada incorrectamente' } },
    ));
    await waitFor(() => expect(
      screen.getAllByRole('link', { name: 'Ver documento REMISION · A-000123' }),
    ).toHaveLength(1));
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('cancels an unlink without sending any mutation', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [link('association-1', 'doc-one')] } as never);
    const user = userEvent.setup();
    render(<ReceiptSupplierDocuments receiptId="receipt-1" supplierId="supplier-1" legacyReference={null} />);
    await user.click(await screen.findByRole('button', { name: 'Desvincular documento REMISION · A-000123' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Motivo de desvinculación (mínimo 10 caracteres)' }),
      'Captura duplicada en el expediente',
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar desvinculación' }));
    expect(screen.queryByRole('button', { name: 'Confirmar desvinculación' })).toBeNull();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('does not allow whitespace-only unlink reasons', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [link('association-1', 'doc-one')] } as never);
    const user = userEvent.setup();
    render(<ReceiptSupplierDocuments receiptId="receipt-1" supplierId="supplier-1" legacyReference={null} />);
    await user.click(await screen.findByRole('button', { name: 'Desvincular documento REMISION · A-000123' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Motivo de desvinculación (mínimo 10 caracteres)' }),
      '                ',
    );
    expect(screen.getByRole('button', { name: 'Confirmar desvinculación' }).hasAttribute('disabled')).toBe(true);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('retains link and typed reason on DELETE failure for safe retry', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [link('association-1', 'doc-one')] } as never);
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();
    render(<ReceiptSupplierDocuments receiptId="receipt-1" supplierId="supplier-1" legacyReference={null} />);
    await user.click(await screen.findByRole('button', { name: 'Desvincular documento REMISION · A-000123' }));
    const input = screen.getByRole('textbox', { name: 'Motivo de desvinculación (mínimo 10 caracteres)' });
    await user.type(input, 'Documento asociado por error al expediente');
    await user.click(screen.getByRole('button', { name: 'Confirmar desvinculación' }));
    expect(await screen.findByText('No fue posible desvincular el documento. Inténtalo de nuevo.')).toBeTruthy();
    expect((input as HTMLTextAreaElement).value).toBe('Documento asociado por error al expediente');
    expect(screen.getByRole('link', { name: 'Ver documento REMISION · A-000123' })).toBeTruthy();
    expect(api.delete).toHaveBeenCalledTimes(1);
  });

  it('reports a request failure and supports retry', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        data: [link('association-1', 'document-actual-1')],
      } as never);

    const user = userEvent.setup();
    render(<ReceiptSupplierDocuments receiptId="receipt-1" supplierId="supplier-1" legacyReference={null} />);
    expect(
      await screen.findByText('No fue posible consultar los documentos vinculados.'),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reintentar documentos' }));
    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'Ver documento REMISION · A-000123' }),
      ).toBeTruthy();
    });
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
