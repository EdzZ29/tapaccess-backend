import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../../config/env';
import { MediaAsset, NfcCard } from '../../entities';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { uploadOptions } from './upload-options';
import { LocalStorageDriver } from './storage/local.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage/storage.driver';
import { SupabaseStorageDriver } from './storage/supabase.driver';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaAsset, NfcCard]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: uploadOptions,
    }),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): StorageDriver =>
        config.get('STORAGE_DRIVER', { infer: true }) === 'supabase'
          ? new SupabaseStorageDriver(
              config.get('SUPABASE_URL', { infer: true }),
              config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
              config.get('SUPABASE_BUCKET', { infer: true }),
            )
          : new LocalStorageDriver(
              config.get('UPLOAD_DIR', { infer: true }),
              config.get('LOCAL_UPLOAD_BASE_URL', { infer: true }),
            ),
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
