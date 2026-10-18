import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { type AppConfig, NodeEnv } from './config/env';
import { envFlag } from './database/data-source-options';

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

  // Open a few database connections now (the dashboard loads its panels in
  // parallel), so the first visitor doesn't wait for the TLS handshakes.
  const db = app.get(DataSource);
  void Promise.allSettled(
    Array.from({ length: 4 }, () => db.query('SELECT 1')),
  );

  // Render's free instances sleep after 15 minutes without traffic, and
  // waking one takes 30-60 seconds. Pinging our own public address every
  // 10 minutes keeps it awake (and the database connections warm).
  // RENDER_EXTERNAL_URL is set by Render; KEEP_AWAKE=false turns this off.
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl && envFlag(process.env.KEEP_AWAKE) !== false) {
    setInterval(
      () =>
        void fetch(`${selfUrl.replace(/\/$/, '')}/api/health`, {
          signal: AbortSignal.timeout(30_000),
        }).catch(() => undefined),
      10 * 60_000,
    ).unref();
    logger.log(`Keep-awake ping enabled for ${selfUrl}`);
  }

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
