import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import type { InternalRequest } from '../../common/internal-request';
import { TrackClickDto, TrackVisitDto } from '../analytics/analytics.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { SlugParamPipe } from '../../common/validators/slug-param.pipe';
import { PublicService } from './public.service';

@Public()
@Controller('public/cards')
export class PublicController {
  constructor(
    private readonly publicProfiles: PublicService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  profile(@Param('slug', SlugParamPipe) slug: string) {
    return this.publicProfiles.getProfile(slug);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':slug/vcard')
  async vcard(
    @Param('slug', SlugParamPipe) slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { disposition, body } = await this.publicProfiles.getVCard(
      slug,
      (req as InternalRequest).trustedSiteUrl,
    );
    res
      .status(200)
      .set({
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': disposition,
        'Cache-Control': 'no-store',
      })
      .send(body);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':slug/visits')
  @HttpCode(202)
  visit(
    @Param('slug', SlugParamPipe) slug: string,
    @Req() req: Request,
    @Body() dto: TrackVisitDto,
  ) {
    return this.analytics.recordVisit(slug, req, dto.referrer);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':slug/clicks')
  @HttpCode(202)
  click(
    @Param('slug', SlugParamPipe) slug: string,
    @Req() req: Request,
    @Body() dto: TrackClickDto,
  ) {
    return this.analytics.recordClick(slug, req, dto);
  }
}
