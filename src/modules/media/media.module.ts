import { BadRequestException, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import type { AppConfig } from '../../config/env';
import { MediaAsset, NfcCard } from '../../entities';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { LocalStorageDriver } from './storage/local.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage/storage.driver';
import { SupabaseStorageDriver } from './storage/supabase.driver';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaAsset, NfcCard]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: config.get('MAX_UPLOAD_MB', { infer: true }) * 1024 * 1024,
          files: 1,
          fields: 5,
        },
        // A cheap first filter; the real check is decoding the bytes with sharp.
        fileFilter: (_req, file, cb) => {
          if (/^image\/(jpeg|png|webp|gif|avif|tiff)$/.test(file.mimetype))
            return cb(null, true);
          const heic = /^image\/hei[cf]/.test(file.mimetype);
          cb(
            new BadRequestException({
              message: heic
                ? 'HEIC photos (the iPhone camera default) are not supported. Export the photo as JPEG — or on the iPhone set Settings → Camera → Formats → Most Compatible.'
                : `"${file.originalname.slice(0, 80)}" is not a supported image (${file.mimetype || 'unknown type'}). Use JPEG, PNG, WebP, GIF or AVIF.`,
              code: heic ? 'UNSUPPORTED_HEIC' : 'UNSUPPORTED_TYPE',
            }),
            false,
          );
        },
      }),
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
