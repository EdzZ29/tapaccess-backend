import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import {
  ClientIpThrottlerGuard,
  type InternalRequest,
} from './common/internal-request';
import { type AppConfig, validateEnv } from './config/env';
import { buildDataSourceOptions } from './database/data-source-options';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminAuthGuard } from './modules/auth/admin-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { CardsModule } from './modules/cards/cards.module';
import { HealthController } from './modules/health/health.controller';
import { MediaModule } from './modules/media/media.module';
import { PublicModule } from './modules/public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        buildDataSourceOptions({
          DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
          DATABASE_SSL: config.get('DATABASE_SSL', { infer: true }),
          DATABASE_LOGGING: config.get('DATABASE_LOGGING', { infer: true }),
        }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => {
        return {
          throttlers: [
            { name: 'default', ttl: 60_000, limit: 120 },
            { name: 'long', ttl: 3_600_000, limit: 3_000 },
          ],
          // Server-side renders come from the Next.js server itself (internal
          // key, no visitor IP) and are not rate-limited. Requests it forwards
          // on a visitor's behalf are limited per visitor IP — see
          // common/internal-request.ts.
          skipIf: (ctx) => {
            const req = ctx.switchToHttp().getRequest<InternalRequest>();
            return Boolean(req.internal && !req.trustedClientIp);
          },
        };
      },
    }),
    AuthModule,
    MediaModule,
    CardsModule,
    AnalyticsModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate-limit first, then authenticate.
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
    { provide: APP_GUARD, useClass: AdminAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
