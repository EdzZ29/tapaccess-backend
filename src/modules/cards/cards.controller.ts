import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CardsService } from './cards.service';
import {
  CreateCardDto,
  DuplicateCardDto,
  ListCardsQueryDto,
  SetStatusDto,
  SlugQueryDto,
  UpdateCardDto,
} from './dto/card.dto';
import { SaveProfileDto } from './dto/profile.dto';

/** All routes require an admin session (global AdminAuthGuard). */
@Controller('admin/cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list(@Query() query: ListCardsQueryDto) {
    return this.cards.list(query);
  }

  @Get('stats')
  stats() {
    return this.cards.stats();
  }

  @Get('slug-availability')
  slugAvailability(@Query() { slug, excludeId }: SlugQueryDto) {
    return this.cards.slugAvailability(slug, excludeId);
  }

  @Post()
  create(@Body() dto: CreateCardDto) {
    return this.cards.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.cards.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardDto) {
    return this.cards.update(id, dto);
  }

  @Put(':id/profile')
  saveProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveProfileDto,
  ) {
    return this.cards.saveProfile(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetStatusDto) {
    return this.cards.setStatus(id, dto.status);
  }

  /**
   * Business cards: lets the owner edit their own buttons and social links.
   * Turns access on and returns the card's access code, made once per card
   * and kept when access is turned off and on again.
   */
  @Post(':id/owner-access')
  turnOnOwnerAccess(@Param('id', ParseUUIDPipe) id: string) {
    return this.cards.turnOnOwnerAccess(id);
  }

  /** The card's access code, for the admin to give to the owner again. */
  @Get(':id/owner-access')
  ownerCode(@Param('id', ParseUUIDPipe) id: string) {
    return this.cards.ownerCode(id);
  }

  /** Turns access off and signs the owner out; the code is kept. */
  @Delete(':id/owner-access')
  turnOffOwnerAccess(@Param('id', ParseUUIDPipe) id: string) {
    return this.cards.turnOffOwnerAccess(id);
  }

  @Post(':id/duplicate')
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateCardDto,
  ) {
    return this.cards.duplicate(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.cards.remove(id);
  }
}
