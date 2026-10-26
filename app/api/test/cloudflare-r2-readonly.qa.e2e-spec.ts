import { randomUUID } from 'node:crypto';
import { ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import { BadRequestException } from '@nestjs/common';
import {
  parseCloudflareR2Config,
} from '../src/config/cloudflare-r2-config';
import {
  requireCloudflareR2QaFixture,
  type CloudflareR2QaFixture,
} from '../src/config/cloudflare-r2-qa-probe';
import { CloudflareR2ReadStore } from '../src/supplier-documents/cloudflare-r2-read-store';
import {
  createCloudflareR2S3Client,
  CloudflareR2SdkTransport,
} from '../src/supplier-documents/cloudflare-r2-sdk-transport';
import {
  consumeAndVerifyPrivateAttachment,
} from '../src/supplier-documents/supplier-document-attachment-download';

const describeQa =
  process.env.RUN_CLOUDFLARE_R2_QA_SMOKE === '1' ? describe : describe.skip;

/**
 * A completely read-only, explicitly opted-in smoke test against actual R2 QA.
 * No bucket creation, PutObject, CopyObject or deletion is performed.
 *
 * Requires a synthetic, manually provisioned fixture in the QA private bucket.
 * No database mutations or changes to attachment scan status occur.
 */
describeQa('Cloudflare R2 QA real read-only smoke', () => {
  let client: S3Client;
  let store: CloudflareR2ReadStore;
  let fixture: CloudflareR2QaFixture;
  let bucket: string;

  beforeAll(() => {
    const config = parseCloudflareR2Config(process.env);
    fixture = requireCloudflareR2QaFixture(process.env, config);
    if (!config) {
      throw new Error('R2 QA is not configured');
    }
    bucket = config.privateBucket;
    client = createCloudflareR2S3Client(config);
    store = new CloudflareR2ReadStore(
      bucket,
      new CloudflareR2SdkTransport(client),
    );
  });

  afterAll(() => {
    client?.destroy();
  });

  it('can list at most one private QA object without printing keys', async () => {
    try {
      await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: 'private/',
          MaxKeys: 1,
        }),
        { abortSignal: AbortSignal.timeout(10_000) },
      );
    } catch {
      throw new Error(
        'R2 QA list failed; verify a QA-only read token, jurisdiction and private bucket',
      );
    }
  }, 45_000);

  it('downloads and verifies exact SHA-256 and length for a synthetic file', async () => {
    const body = await store.openReadOnly(
      fixture.objectKey,
      fixture.companyId,
    );
    const bytes = await consumeAndVerifyPrivateAttachment(
      body,
      fixture.sizeBytes,
      fixture.sha256,
    );
    expect(bytes.length).toBe(fixture.sizeBytes);
  }, 45_000);

  it('rejects cross-tenant and quarantine keys before contacting R2', async () => {
    await expect(
      store.openReadOnly(fixture.objectKey, randomUUID()),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      store.openReadOnly(
        fixture.objectKey.replace('private/', 'quarantine/'),
        fixture.companyId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
