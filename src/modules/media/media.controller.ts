import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  DeleteMediaQueryDto,
  ListMediaQueryDto,
  UploadMediaDto,
} from './media.dto';
import { MediaService } from './media.service';

@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** multipart/form-data with fields `file`, `kind` and optional `cardId`. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadMediaDto,
  ) {
    return this.media.upload(file, dto.kind, dto.cardId);
  }

  /** Whether image storage works, so the editor can warn before an upload fails. */
  @Get('status')
  status() {
    return this.media.status();
  }

  @Get()
  list(@Query() query: ListMediaQueryDto) {
    return this.media.list(query);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() { force }: DeleteMediaQueryDto,
  ) {
    return this.media.remove(id, force);
  }
}
