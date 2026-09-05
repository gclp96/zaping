import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { buildCorsOptions } from './config/cors-options';
import { parsePort, parseTrustProxyHops } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const port = parsePort(configService.get<string>('PORT'));
  const trustProxyHops = parseTrustProxyHops(
    configService.get<string>('TRUST_PROXY_HOPS'),
  );

  app.enableCors(
    buildCorsOptions({
      nodeEnv: configService.getOrThrow<string>('NODE_ENV'),
      frontendOrigin: configService.getOrThrow<string>('FRONTEND_ORIGIN'),
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(
    err instanceof Error ? err.message : 'Application failed to start',
  );
  process.exitCode = 1;
});
