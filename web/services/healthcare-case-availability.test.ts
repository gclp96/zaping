import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { getHealthcareCaseAvailability } from './healthcare-case-availability';
import { availabilityFixture } from './healthcare-case-availability.fixture';

vi.mock('./api', () => ({ api: { get: vi.fn() } }));

describe('healthcare-case-availability service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the exact endpoint and passes through the public response unchanged', async () => {
    const response = availabilityFixture();
    vi.mocked(api.get).mockResolvedValue({ data: response });
    await expect(getHealthcareCaseAvailability('case-1')).resolves.toBe(
      response,
    );
    expect(api.get).toHaveBeenCalledExactlyOnceWith(
      '/healthcare/cases/case-1/availability',
    );
  });

  it.each([401, 403, 404, 500])(
    'propagates %s to the existing API/session handling',
    async (status) => {
      const error = { response: { status } };
      vi.mocked(api.get).mockRejectedValue(error);
      await expect(getHealthcareCaseAvailability('case-1')).rejects.toBe(error);
    },
  );
});
