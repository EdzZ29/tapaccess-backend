import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { MulterModuleOptions } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { AppConfig } from '../../config/env';

/** Upload limits shared by the admin's and the card owner's image uploads. */
export const uploadOptions = (
  config: ConfigService<AppConfig, true>,
): MulterModuleOptions => ({
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
          ? 'HEIC photos (the iPhone camera default) are not supported. Export the photo as JPEG, or on the iPhone set Settings → Camera → Formats → Most Compatible.'
          : `"${file.originalname.slice(0, 80)}" is not a supported image (${file.mimetype || 'unknown type'}). Use JPEG, PNG, WebP, GIF or AVIF.`,
        code: heic ? 'UNSUPPORTED_HEIC' : 'UNSUPPORTED_TYPE',
      }),
      false,
    );
  },
});
