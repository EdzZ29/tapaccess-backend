import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardReview, NfcCard } from '../../entities';
import {
  AdminReviewsController,
  PublicReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([CardReview, NfcCard])],
  controllers: [AdminReviewsController, PublicReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
