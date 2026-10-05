import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';

/** Used by Render's health check. Reports nothing beyond up/down. */
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Get()
  async check() {
    try {
      await this.db.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
    return { status: 'ok', database: 'up' };
  }
}
