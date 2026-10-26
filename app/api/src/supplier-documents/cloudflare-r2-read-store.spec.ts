import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CloudflareR2ReadStore } from './cloudflare-r2-read-store';
import { createR2ObjectKeys } from './cloudflare-r2-object-keys';

describe('Cloudflare R2 read contract (mock S3 transport)', () => {
  const companyId = randomUUID();
  const otherCompany = randomUUID();
  const keys = createR2ObjectKeys(companyId, randomUUID());
  const privateBucket = 'zaping-private-test';
  const transport = { getObject: jest.fn() };
  const store = new CloudflareR2ReadStore(privateBucket, transport);

  beforeEach(() => {
    jest.clearAllMocks();
    transport.getObject.mockResolvedValue(Readable.from([Buffer.from('doc')]));
  });

  it('reads from the configured private bucket, never arbitrary paths', async () => {
    const stream = await store.openReadOnly(keys.privateKey, companyId);
    expect(stream).toBeInstanceOf(Readable);
    expect(transport.getObject).toHaveBeenCalledWith(
      privateBucket,
      keys.privateKey,
    );
  });

  it('does not reach R2 for a different tenant or quarantine object', async () => {
    await expect(
      store.openReadOnly(keys.privateKey, otherCompany),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      store.openReadOnly(keys.quarantineKey, companyId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transport.getObject).not.toHaveBeenCalled();
  });

  it('fails closed on provider faults without exposing underlying errors', async () => {
    transport.getObject.mockRejectedValueOnce(
      new Error('provider secret or bucket name must not be returned'),
    );
    await expect(
      store.openReadOnly(keys.privateKey, companyId),
    ).rejects.toThrow('Objeto privado no disponible');
    expect(transport.getObject).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed non-stream provider response', async () => {
    transport.getObject.mockResolvedValueOnce({ Body: 'not a stream' });
    await expect(
      store.openReadOnly(keys.privateKey, companyId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
