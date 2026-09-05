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

  it('uses explicit methods and request headers without wildcard access', () => {
    expect(
      buildCorsOptions({
        nodeEnv: 'production',
        frontendOrigin: 'https://app.example.test',
      }),
    ).toMatchObject({
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  });
});
