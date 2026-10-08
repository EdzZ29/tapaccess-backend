import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SetReviewHiddenDto, SubmitReviewDto } from './reviews.dto';
import { ReviewsService } from './reviews.service';

/** Admin: a card's review link and review (global AdminAuthGuard). */
@Controller('admin/cards/:id/review')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.adminView(id);
  }

  /** Makes a new private review link; the token is returned only now. */
  @Post('link')
  issueLink(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.issueLink(id);
  }

  @Delete('link')
  revokeLink(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.revokeLink(id);
  }

  @Patch()
  setHidden(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetReviewHiddenDto,
  ) {
    return this.reviews.setHidden(id, dto.hidden);
  }

  @Delete()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.removeReview(id);
  }
}

/** The card owner's review page, reached only through the private link. */
@Public()
@Controller('public/reviews')
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':token')
  @Header('Cache-Control', 'no-store')
  get(@Param('token') token: string) {
    return this.reviews.forLink(token);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token')
  @Header('Cache-Control', 'no-store')
  submit(@Param('token') token: string, @Body() dto: SubmitReviewDto) {
    return this.reviews.submit(token, dto);
  }
}
