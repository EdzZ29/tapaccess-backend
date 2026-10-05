import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { AnalyticsRangeQueryDto } from './analytics.dto';
import { AnalyticsService } from './analytics.service';

@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@Query() { days, tz }: AnalyticsRangeQueryDto) {
    return this.analytics.overview(days, tz);
  }

  @Get('cards/:id')
  card(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() { days, tz }: AnalyticsRangeQueryDto,
  ) {
    return this.analytics.cardAnalytics(id, days, tz);
  }
}
