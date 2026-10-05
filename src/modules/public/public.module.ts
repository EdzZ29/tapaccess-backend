import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NfcCard } from '../../entities';
import { AnalyticsModule } from '../analytics/analytics.module';
import { MediaModule } from '../media/media.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [TypeOrmModule.forFeature([NfcCard]), AnalyticsModule, MediaModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
