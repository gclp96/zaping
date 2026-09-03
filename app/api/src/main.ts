import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { buildCorsOptions } from './config/cors-options';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

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

  await app.listen(3001);
}

bootstrap().catch((err) => {
  console.error(
    err instanceof Error ? err.message : 'Application failed to start',
  );
  process.exitCode = 1;
});
