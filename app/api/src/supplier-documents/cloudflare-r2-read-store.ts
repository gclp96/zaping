import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Readable } from 'node:stream';
import {
  PrivateAttachmentObjectStore,
} from './private-attachment-object-store';
import { requireTenantPrivateR2Key } from './cloudflare-r2-object-keys';

/**
 * Narrow dependency boundary for the future AWS SDK v3 GetObject bridge.
 * A real transport must be separately configured from server-only secrets.
 * No R2 networking is enabled just by registering this class in the source.
 */
export interface R2GetObjectTransport {
  getObject(bucket: string, key: string): Promise<Readable>;
}

@Injectable()
export class CloudflareR2ReadStore extends PrivateAttachmentObjectStore {
  constructor(
    private readonly privateBucket: string,
    private readonly transport: R2GetObjectTransport,
  ) {
    super();
  }

  async openReadOnly(storageKey: string, companyId: string): Promise<Readable> {
    // Verify the Company again at the storage boundary, not only in Prisma.
    const key = requireTenantPrivateR2Key(storageKey, companyId);
    try {
      const body = await this.transport.getObject(this.privateBucket, key);
      if (!(body instanceof Readable)) {
        throw new Error('NON_STREAM_R2_RESPONSE');
      }
      return body;
    } catch {
      // Never leak object keys, bucket names, credentials or provider errors.
      throw new ServiceUnavailableException('Objeto privado no disponible');
    }
  }
}
