import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaService } from '../prisma/prisma.service';
import { HealthModule } from './health.module';

describe('HealthController', () => {
  let app: INestApplication<App>;
  let queryRaw: jest.Mock;

  beforeEach(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns a process-only live response without querying Prisma', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });

    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns ok when the database readiness query succeeds', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({ status: 'ok' });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const queryCall = queryRaw.mock.calls[0] as unknown[];
    const queryTemplate = queryCall[0] as readonly string[];
    expect(queryTemplate[0]).toBe('SELECT 1');
  });

  it('returns a safe 503 response when the database readiness query fails', async () => {
    queryRaw.mockRejectedValueOnce(
      new Error('DATABASE_URL and Prisma connection details must stay private'),
    );

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect({ status: 'unavailable' });

    expect(JSON.stringify(response.body)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(response.body)).not.toContain('Prisma');
  });
});
