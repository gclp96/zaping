import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './api';
import {
  addHealthcareCaseKitItem,
  createHealthcareCaseKit,
  excludeHealthcareCaseKitItem,
  getHealthcareCaseKit,
  type HealthcareCaseKit,
} from './healthcare-case-kits';

vi.mock('./api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const kit = {
  id: 'kit-1',
  caseId: 'case-1',
  status: 'DRAFT',
  items: [],
} as unknown as HealthcareCaseKit;

describe('healthcare-case-kits service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gets the direct CaseKit response', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: kit });
    await expect(getHealthcareCaseKit('case-1')).resolves.toBe(kit);
    expect(api.get).toHaveBeenCalledWith('/healthcare/cases/case-1/case-kit');
  });

  it('creates a kit with a mandatory generated idempotency key', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: kit });
    await createHealthcareCaseKit('case-1');
    expect(api.post).toHaveBeenCalledWith(
      '/healthcare/cases/case-1/case-kit',
      {},
      {
        headers: { 'Idempotency-Key': expect.stringMatching(/^hc-case-kit-/) },
      },
    );
  });

  it('adds the discriminated source payload with its own key', async () => {
    const payload = {
      sourceType: 'REQUIREMENT' as const,
      requirementId: 'requirement-1',
      preparedQuantity: 2,
    };
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'item-1' } });
    await addHealthcareCaseKitItem('kit-1', payload);
    expect(api.post).toHaveBeenCalledWith(
      '/healthcare/case-kits/kit-1/items',
      payload,
      {
        headers: {
          'Idempotency-Key': expect.stringMatching(/^hc-case-kit-item-/),
        },
      },
    );
  });

  it('excludes an item with the normalized API payload and its own key', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'item-1' } });

    await excludeHealthcareCaseKitItem('kit-1', 'item-1', 'No requerido');

    expect(api.post).toHaveBeenCalledWith(
      '/healthcare/case-kits/kit-1/items/item-1/exclude',
      { reason: 'No requerido' },
      {
        headers: {
          'Idempotency-Key': expect.stringMatching(
            /^hc-case-kit-item-exclude-/,
          ),
        },
      },
    );
  });
});
