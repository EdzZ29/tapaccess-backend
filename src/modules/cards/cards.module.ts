import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardVisit, NfcCard } from '../../entities';
import { MediaModule } from '../media/media.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  imports: [TypeOrmModule.forFeature([NfcCard, CardVisit]), MediaModule],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
