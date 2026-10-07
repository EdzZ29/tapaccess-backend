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
   * Turns access on (or issues a new code, signing the owner out) and
   * returns the new access code once, it is stored only as a hash.
   */
  @Post(':id/owner-access')
  issueOwnerCode(@Param('id', ParseUUIDPipe) id: string) {
    return this.cards.issueOwnerCode(id);
  }

  @Delete(':id/owner-access')
  revokeOwnerAccess(@Param('id', ParseUUIDPipe) id: string) {
    return this.cards.revokeOwnerAccess(id);
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
