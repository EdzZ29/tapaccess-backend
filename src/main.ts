import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { AppConfig } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const origins = configureApp(app);
  app.enableShutdownHooks();

  const port = app
    .get<ConfigService<AppConfig, true>>(ConfigService)
    .get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(
    `TapAccess API listening on http://localhost:${port}/api (allowed origins: ${origins.join(', ')})`,
  );
}

void bootstrap();
