import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { type AppConfig, NodeEnv } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const origins = configureApp(app);
  app.enableShutdownHooks();

  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  const logger = new Logger('Bootstrap');
  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  logger.log(
    `TapAccess API listening on http://localhost:${port}/api (allowed origins: ${origins.join(', ')})`,
  );

  if (
    config.get('NODE_ENV', { infer: true }) === NodeEnv.Production &&
    config.get('STORAGE_DRIVER', { infer: true }) === 'local'
  ) {
    logger.warn(
      'STORAGE_DRIVER=local in production: uploaded images are saved on this server and will be LOST on the next deploy (Render wipes its disk). Set STORAGE_DRIVER=supabase with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
}

void bootstrap();
