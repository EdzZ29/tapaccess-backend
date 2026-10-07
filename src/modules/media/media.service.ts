import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination.dto';
import { MediaAsset, MediaKind, NfcCard } from '../../entities';
import { ListMediaQueryDto } from './media.dto';
import {
  STORAGE_DRIVER,
  StorageError,
  type StorageDriver,
} from './storage/storage.driver';

/** Longest edge after re-encoding, per use. */
const MAX_EDGE: Record<MediaKind, number> = {
  [MediaKind.Logo]: 640,
  [MediaKind.Cover]: 1920,
  [MediaKind.Background]: 1920,
  [MediaKind.Gallery]: 1600,
  [MediaKind.Item]: 1200,
  [MediaKind.Other]: 1600,
};

const ACCEPTED_FORMATS = new Set([
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
  'tiff',
]);

/** Guards against decompression bombs (a tiny file that expands to gigapixels). */
const MAX_INPUT_PIXELS = 50_000_000;

@Injectable()
export class MediaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaService.name);
  private statusCache: { at: number; problem: string | null } | null = null;

  constructor(
    @InjectRepository(MediaAsset)
    private readonly assets: Repository<MediaAsset>,
    @InjectRepository(NfcCard) private readonly cards: Repository<NfcCard>,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /** Logs a clear warning at startup if image storage is misconfigured. */
  onApplicationBootstrap() {
    if (!this.storage.check || process.env.NODE_ENV === 'test') return;
    void this.storage.check().then((problem) => {
      if (problem) this.logger.warn(`Image storage: ${problem}`);
      else this.logger.log(`Image storage OK (${this.storage.name})`);
    });
  }

  /**
   * Every upload is decoded and re-encoded to WebP. That verifies it really
   * is an image (the declared MIME type is not trusted), strips EXIF data
   * such as GPS coordinates, applies orientation and shrinks it for mobile.
   * SVG is rejected because it can carry script.
   */
  async upload(
    file: Express.Multer.File | undefined,
    kind: MediaKind,
    cardId?: string,
  ) {
    if (!file)
      throw new BadRequestException({
        message: 'No image was received. Choose the file again.',
        code: 'NO_FILE',
      });
    if (file.size === 0)
      throw new BadRequestException({
        message: 'This file is empty (0 bytes). Choose another image.',
        code: 'EMPTY_FILE',
      });
    if (cardId && !(await this.cards.exists({ where: { id: cardId } })))
      throw new NotFoundException({
        message: 'This card no longer exists. Reload the page.',
        code: 'CARD_NOT_FOUND',
      });

    let output: { data: Buffer; info: sharp.OutputInfo };
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: MAX_INPUT_PIXELS,
        failOn: 'error',
      });
      const meta = await image.metadata();
      if (meta.format === 'heif' && meta.compression !== 'av1') {
        throw new BadRequestException({
          message:
            'HEIC photos (the iPhone camera default) are not supported. Export the photo as JPEG, or on the iPhone set Settings → Camera → Formats → Most Compatible.',
          code: 'UNSUPPORTED_HEIC',
        });
      }
      // AVIF is reported as HEIF with AV1 compression.
      const format = meta.format === 'heif' ? 'avif' : meta.format;
      if (!format || !ACCEPTED_FORMATS.has(format)) {
        throw new BadRequestException({
          message: `${format ? `${format.toUpperCase()} images aren't` : "This file type isn't"} supported. Use JPEG, PNG, WebP, GIF or AVIF.`,
          code: 'UNSUPPORTED_TYPE',
        });
      }
      const pixels = (meta.width ?? 0) * (meta.height ?? 0);
      if (pixels > MAX_INPUT_PIXELS) {
        throw new PayloadTooLargeException({
          message: `This image is ${meta.width}×${meta.height} pixels (${Math.round(pixels / 1e6)} megapixels). The limit is ${MAX_INPUT_PIXELS / 1e6} megapixels. Resize it and try again.`,
          code: 'IMAGE_TOO_MANY_PIXELS',
        });
      }
      const edge = MAX_EDGE[kind];
      output = await image
        .rotate()
        .resize({
          width: edge,
          height: edge,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: kind === MediaKind.Logo ? 90 : 80, effort: 4 })
        .toBuffer({ resolveWithObject: true });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const message = err instanceof Error ? err.message : '';
      if (/pixel limit/i.test(message))
        throw new PayloadTooLargeException({
          message: `This image has too many pixels. The limit is ${MAX_INPUT_PIXELS / 1e6} megapixels. Resize it and try again.`,
          code: 'IMAGE_TOO_MANY_PIXELS',
        });
      throw new BadRequestException({
        message:
          "This file couldn't be opened as an image. It may be damaged, or not really a JPEG/PNG/WebP/GIF/AVIF. Open it and save or export it again as JPEG or PNG, then retry.",
        code: 'INVALID_IMAGE',
      });
    }

    const key = `${cardId ? `cards/${cardId}` : 'library'}/${kind}/${randomUUID()}.webp`;
    let url: string;
    try {
      url = await this.storage.put(key, output.data, 'image/webp');
    } catch (err) {
      throw toStorageHttpError(err, this.logger);
    }

    try {
      const asset = await this.assets.save(
        this.assets.create({
          cardId: cardId ?? null,
          kind,
          provider: this.storage.name,
          storageKey: key,
          url,
          mimeType: 'image/webp',
          width: output.info.width,
          height: output.info.height,
          sizeBytes: output.info.size,
          originalName: file.originalname?.slice(0, 255) ?? null,
        }),
      );
      return toMediaView(asset);
    } catch (err) {
      // Don't leave an orphaned file behind.
      await this.storage.delete(key).catch(() => undefined);
      this.logger.error(
        `Saving media record failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw new InternalServerErrorException({
        message:
          "The image was processed but couldn't be saved to the database. Please try again.",
        code: 'MEDIA_SAVE_FAILED',
      });
    }
  }

  /**
   * Storage health for the editor: lets it warn before an upload fails.
   * Cached briefly so opening several editors doesn't hammer the provider.
   */
  async status(): Promise<{ provider: string; problem: string | null }> {
    const now = Date.now();
    if (!this.statusCache || now - this.statusCache.at > 60_000) {
      const problem = this.storage.check
        ? await this.storage.check().catch((err: Error) => err.message)
        : null;
      this.statusCache = { at: now, problem };
    }
    return { provider: this.storage.name, problem: this.statusCache.problem };
  }

  async list(query: ListMediaQueryDto) {
    const qb = this.assets
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC');
    if (query.cardId) qb.where('a.cardId = :cardId', { cardId: query.cardId });
    if (query.kind) qb.andWhere('a.kind = :kind', { kind: query.kind });
    const [rows, total] = await qb
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return paginate(rows.map(toMediaView), total, query);
  }

  /**
   * Refuses to delete an image that a profile still shows unless `force` is
   * set, so a cleanup cannot silently break a live card.
   */
  async remove(id: string, force = false) {
    const asset = await this.assets.findOneBy({ id });
    if (!asset) throw new NotFoundException('Image not found');

    if (!force) {
      const usage = await this.usageCount(asset.url);
      if (usage > 0) {
        throw new ConflictException({
          message: `This image is used on ${usage} profile field${usage === 1 ? '' : 's'}. Remove it there first or force delete.`,
          code: 'MEDIA_IN_USE',
          details: { usage },
        });
      }
    }
    await this.storage.delete(asset.storageKey);
    await this.assets.delete(id);
  }

  async removeAllForCard(cardId: string) {
    const assets = await this.assets.findBy({ cardId });
    for (const asset of assets) {
      await this.storage.delete(asset.storageKey).catch((err: Error) => {
        this.logger.warn(
          `Could not delete ${asset.storageKey}: ${err.message}`,
        );
      });
    }
    if (assets.length) await this.assets.delete(assets.map((a) => a.id));
  }

  /** Raw bytes of one of our own stored images (used to embed photos in vCards). */
  readByUrl(url: string): Promise<Buffer | null> {
    return this.storage.readByUrl(url);
  }

  private async usageCount(url: string): Promise<number> {
    const [{ count }] = await this.assets.query<{ count: number }[]>(
      `SELECT (
         (SELECT COUNT(*) FROM card_profiles
            WHERE logo_url = $1 OR cover_url = $1 OR theme->>'backgroundImageUrl' = $1)
       + (SELECT COUNT(*) FROM section_items WHERE image_url = $1)
       )::int AS count`,
      [url],
    );
    return count;
  }
}

/** Storage failures become clear, actionable responses (never a bare 500). */
function toStorageHttpError(err: unknown, logger: Logger): HttpException {
  if (err instanceof StorageError) {
    const code = `STORAGE_${err.reason.toUpperCase()}`;
    if (err.reason === 'too_large')
      return new PayloadTooLargeException({ message: err.message, code });
    return new ServiceUnavailableException({ message: err.message, code });
  }
  logger.error(
    `Storage upload failed: ${(err as Error)?.message}`,
    (err as Error)?.stack,
  );
  return new ServiceUnavailableException({
    message: "The image couldn't be stored right now. Please try again.",
    code: 'STORAGE_UNKNOWN',
  });
}

export const toMediaView = (a: MediaAsset) => ({
  id: a.id,
  cardId: a.cardId,
  kind: a.kind,
  url: a.url,
  width: a.width,
  height: a.height,
  sizeBytes: a.sizeBytes,
  mimeType: a.mimeType,
  originalName: a.originalName,
  createdAt: a.createdAt,
});
