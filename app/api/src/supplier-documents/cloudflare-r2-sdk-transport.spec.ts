import { Readable } from 'node:stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';
import { createCloudflareR2S3Client, CloudflareR2SdkTransport } from './cloudflare-r2-sdk-transport';

const config = {
  endpoint: 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
  region: 'auto' as const,
  forcePathStyle: true as const,
  jurisdiction: 'default' as const,
  privateBucket: 'zaping-private-qa',
  quarantineBucket: 'zaping-quarantine-qa',
  accessKeyId: 'fake-id-no-network',
  secretAccessKey: 'fake-secret-no-network',
};

describe('Cloudflare R2 GetObject AWS SDK transport', () => {
  it('sends GetObjectCommand with exact bucket and key and a timeout', async () => {
    const client = createCloudflareR2S3Client(config);
    const body = Readable.from([Buffer.from('%PDF-1.7')]);
    const send = jest.spyOn(client, 'send').mockResolvedValue({ Body: body } as never);
    const transport = new CloudflareR2SdkTransport(client);

    await expect(transport.getObject('zaping-private-qa', 'private/key')).resolves.toBe(body);
    expect(send).toHaveBeenCalledTimes(1);
    const [command, options] = send.mock.calls[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect((command as GetObjectCommand).input).toEqual({
      Bucket: 'zaping-private-qa',
      Key: 'private/key',
    });
    expect(options).toMatchObject({ abortSignal: expect.any(AbortSignal) as AbortSignal });
    client.destroy();
  });

  it('rejects missing or non-readable response bodies', async () => {
    const client = createCloudflareR2S3Client(config);
    jest.spyOn(client, 'send').mockResolvedValue({ Body: undefined } as never);
    const transport = new CloudflareR2SdkTransport(client);
    await expect(transport.getObject('zaping-private-qa', 'private/key')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    client.destroy();
  });

  it('propagates provider errors to the outer sanitized storage boundary', async () => {
    const client = createCloudflareR2S3Client(config);
    jest.spyOn(client, 'send').mockRejectedValue(new Error('private-provider-error'));
    const transport = new CloudflareR2SdkTransport(client);
    await expect(transport.getObject('zaping-private-qa', 'private/key')).rejects.toThrow(
      'private-provider-error',
    );
    client.destroy();
  });
});
