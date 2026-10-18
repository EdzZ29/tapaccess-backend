import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CardsService } from '../cards/cards.service';
import { MediaKind } from '../../entities';
import { SaveOwnerCardDto } from '../cards/dto/owner.dto';
import { MediaService } from '../media/media.service';
import { OwnerGuard, type OwnerRequest } from './owner.guard';
import { OwnerService } from './owner.service';

class OwnerLoginDto {
  @Matches(/^[a-z0-9-]{1,64}$/, { message: 'Unknown card' })
  slug!: string;

  @Type(() => String)
  @IsString()
  @MinLength(1, { message: 'Enter your access code' })
  @MaxLength(40)
  code!: string;
}

/** The kinds of image an owner can upload: what their editor lets them change. */
const OWNER_MEDIA_KINDS = [
  MediaKind.Logo,
  MediaKind.Cover,
  MediaKind.Background,
  MediaKind.Gallery,
] as const;

class OwnerUploadDto {
  @IsIn(OWNER_MEDIA_KINDS, { message: 'Unsupported image type' })
  kind!: (typeof OWNER_MEDIA_KINDS)[number];
}

/**
 * Self-service for card owners (Business package). Not admin routes: they
 * skip the admin guard (`@Public`) and use the owner session instead, which
 * only ever reaches the owner's own card: its profile text, logo and cover,
 * theme colours and fonts, photo gallery, buttons and links.
 */
@Public()
@Controller('owner')
export class OwnerController {
  constructor(
    private readonly owners: OwnerService,
    private readonly cards: CardsService,
    private readonly media: MediaService,
  ) {}

  /** 5 attempts per minute and 20 per hour per IP, plus a per-card lockout. */
  @Throttle({
    default: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: OwnerLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { cardId, token } = await this.owners.login(dto.slug, dto.code);
    res.cookie(this.owners.cookieName(), token, this.owners.cookieOptions());
    return this.cards.ownerView(cardId);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    const { maxAge: _maxAge, ...opts } = this.owners.cookieOptions();
    res.clearCookie(this.owners.cookieName(), opts);
  }

  @UseGuards(OwnerGuard)
  @Get('card')
  card(@Req() req: OwnerRequest) {
    return this.cards.ownerView(req.ownerCard!.id);
  }

  @UseGuards(OwnerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Put('card')
  save(@Req() req: OwnerRequest, @Body() dto: SaveOwnerCardDto) {
    return this.cards.saveOwnerCard(req.ownerCard!.id, dto);
  }

  /**
   * multipart/form-data with `file` and `kind`. Always stored under the
   * owner's own card; the image only appears on the card once they save.
   */
  @UseGuards(OwnerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('media')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Req() req: OwnerRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: OwnerUploadDto,
  ) {
    return this.media.upload(file, dto.kind, req.ownerCard!.id);
  }
}
