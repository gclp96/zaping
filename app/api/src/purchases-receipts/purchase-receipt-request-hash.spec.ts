import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto';
import { createPurchaseReceiptRequestHash } from './purchase-receipt-request-hash';

const firstItem = {
  purchaseItemId: '11111111-1111-4111-8111-111111111111',
  quantityReceived: 2,
  lotNumber: 'LOTE-001',
  expirationDate: '2029-06-30',
};

const secondItem = {
  purchaseItemId: '22222222-2222-4222-8222-222222222222',
  quantityReceived: 3,
};

function createDto(
  overrides: Partial<CreatePurchaseReceiptDto> = {},
): CreatePurchaseReceiptDto {
  return {
    purchaseId: '33333333-3333-4333-8333-333333333333',
    notes: 'Recepción inicial',
    items: [firstItem, secondItem],
    ...overrides,
  };
}

describe('createPurchaseReceiptRequestHash', () => {
  it('genera el mismo hash para el mismo payload', () => {
    expect(createPurchaseReceiptRequestHash(createDto())).toBe(
      createPurchaseReceiptRequestHash(createDto()),
    );
  });

  it('ignora el orden de las partidas', () => {
    const reorderedDto = createDto({
      items: [secondItem, firstItem],
    });

    expect(createPurchaseReceiptRequestHash(reorderedDto)).toBe(
      createPurchaseReceiptRequestHash(createDto()),
    );
  });

  it('normaliza notas, lote y representaciones equivalentes de caducidad', () => {
    const normalizedDto = createDto();
    const equivalentDto = createDto({
      notes: '  Recepción inicial  ',
      items: [
        {
          ...firstItem,
          lotNumber: '  LOTE-001  ',
          expirationDate: '2029-06-30T00:00:00.000Z',
        },
        secondItem,
      ],
    });

    expect(createPurchaseReceiptRequestHash(equivalentDto)).toBe(
      createPurchaseReceiptRequestHash(normalizedDto),
    );
  });

  it('cambia cuando cambia una cantidad significativa', () => {
    const changedDto = createDto({
      items: [
        {
          ...firstItem,
          quantityReceived: 4,
        },
        secondItem,
      ],
    });

    expect(createPurchaseReceiptRequestHash(changedDto)).not.toBe(
      createPurchaseReceiptRequestHash(createDto()),
    );
  });

  it('cambia cuando cambia la compra', () => {
    const changedDto = createDto({
      purchaseId: '44444444-4444-4444-8444-444444444444',
    });

    expect(createPurchaseReceiptRequestHash(changedDto)).not.toBe(
      createPurchaseReceiptRequestHash(createDto()),
    );
  });
});
