import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../../config/env';
import { NfcCard } from '../../entities';
import { AuthModule } from '../auth/auth.module';
import { CardsModule } from '../cards/cards.module';
import { OwnerController } from './owner.controller';
import { OwnerGuard } from './owner.guard';
import { OwnerService } from './owner.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NfcCard]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
      }),
    }),
    AuthModule,
    CardsModule,
  ],
  controllers: [OwnerController],
  providers: [OwnerService, OwnerGuard],
})
export class OwnerModule {}
