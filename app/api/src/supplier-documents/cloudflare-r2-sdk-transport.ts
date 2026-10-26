import { Readable } from 'node:stream';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';
import type { CloudflareR2Config } from '../config/cloudflare-r2-config';
import type { R2GetObjectTransport } from './cloudflare-r2-read-store';

/** Build a strictly credentialed client. Never use the ambient AWS provider chain. */
export function createCloudflareR2S3Client(config: CloudflareR2Config): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    maxAttempts: 2,
  });
}

/**
 * Read-only SDK bridge, without an upload, bucket mutation or public URL path.
 * Always call through CloudflareR2ReadStore: it validates the tenant-scoped key
 * and selects the private bucket before this transport is invoked.
 */
export class CloudflareR2SdkTransport implements R2GetObjectTransport {
  constructor(private readonly client: S3Client) {}

  async getObject(bucket: string, key: string): Promise<Readable> {
    // Node.js 24 supports timeout signals. The SDK's HTTP request is cancelled
    // rather than left running when R2 is unavailable.
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { abortSignal: AbortSignal.timeout(10_000) },
    );
    if (!(result.Body instanceof Readable)) {
      throw new ServiceUnavailableException('Objeto privado no disponible');
    }
    return result.Body;
  }
}
