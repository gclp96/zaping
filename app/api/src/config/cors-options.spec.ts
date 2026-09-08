import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { buildCorsOptions } from './cors-options';

@Controller()
class CorsProbeController {
  @Get('probe')
  probe() {
    return { ok: true };
  }
}

function httpRequest(app: INestApplication) {
  // Nest exposes its underlying HTTP adapter as any in the testing contract.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return request(app.getHttpServer<Server>());
}

describe('CORS configuration', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('allows the configured production origin and rejects foreign origins', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CorsProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableCors(
      buildCorsOptions({
        nodeEnv: 'production',
        frontendOrigin: 'https://app.example.test',
      }),
    );
    await app.init();

    const allowed = await httpRequest(app)
      .get('/probe')
      .set('Origin', 'https://app.example.test');
    const foreign = await httpRequest(app)
      .get('/probe')
      .set('Origin', 'https://foreign.example.test');

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'https://app.example.test',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows localhost during development while keeping the allowlist explicit', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CorsProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableCors(
      buildCorsOptions({
        nodeEnv: 'development',
        frontendOrigin: 'https://dev.example.test',
      }),
    );
    await app.init();

    const localhost = await httpRequest(app)
      .get('/probe')
      .set('Origin', 'http://localhost:3000');
    const foreign = await httpRequest(app)
      .get('/probe')
      .set('Origin', 'https://foreign.example.test');

    expect(localhost.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('accepts the local QA purchase receipt preflight without wildcard access', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CorsProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableCors(
      buildCorsOptions({
        nodeEnv: 'development',
        frontendOrigin: 'http://127.0.0.1:3000',
      }),
    );
    await app.init();

    const preflight = await httpRequest(app)
      .options('/probe')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'authorization,content-type,idempotency-key',
      )
      .expect(204);

    const allowedHeaders = String(
      preflight.headers['access-control-allow-headers'],
    );
    const allowedHeaderNames = allowedHeaders
      .toLowerCase()
      .split(',')
      .map((header) => header.trim());

    expect(preflight.headers['access-control-allow-origin']).toBe(
      'http://127.0.0.1:3000',
    );
    expect(allowedHeaderNames).toEqual(
      expect.arrayContaining([
        'authorization',
        'content-type',
        'idempotency-key',
      ]),
    );
    expect(preflight.headers['access-control-allow-origin']).not.toBe('*');
    expect(allowedHeaders).not.toContain('*');
  });

  it('uses explicit methods and request headers without wildcard access', () => {
    expect(
      buildCorsOptions({
        nodeEnv: 'production',
        frontendOrigin: 'https://app.example.test',
      }),
    ).toMatchObject({
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    });
  });
});
