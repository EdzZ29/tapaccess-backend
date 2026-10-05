import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { internalRequests } from './common/internal-request';
import { originCheck } from './common/middleware/origin-check.middleware';
import type { AppConfig } from './config/env';

/**
 * HTTP-level configuration shared by `main.ts` and the e2e tests, so the
 * tests exercise exactly the middleware stack that runs in production.
 * Returns the allowed browser origins.
 */
export function configureApp(app: NestExpressApplication): string[] {
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

  // Needed for correct client IPs (rate limiting, visitor hashing) behind Render's proxy.
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.disable('x-powered-by');

  const origins = [config.get('FRONTEND_URL', { infer: true })]
    .concat((config.get('CORS_ORIGINS', { infer: true }) ?? '').split(','))
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.use(
    helmet({
      // Uploaded images are embedded by the frontend on another origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          imgSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.use(internalRequests(config.get('INTERNAL_API_KEY', { infer: true })));
  app.use(originCheck(origins));
  // Private responses (admin data, sessions) must never be stored by a
  // browser, proxy or CDN.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.path.startsWith('/api/admin/') ||
      req.path.startsWith('/api/auth/')
    ) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  });
  app.useBodyParser('json', { limit: '1mb' });

  if (config.get('STORAGE_DRIVER', { infer: true }) === 'local') {
    app.useStaticAssets(resolve(config.get('UPLOAD_DIR', { infer: true })), {
      prefix: '/uploads/',
      index: false,
      dotfiles: 'deny',
      immutable: true,
      maxAge: '365d',
      setHeaders: (res: ServerResponse) =>
        res.setHeader('X-Content-Type-Options', 'nosniff'),
    });
  }

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );
  return origins;
}
