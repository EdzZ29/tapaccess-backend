import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { MediaKind } from '../../entities';

export class UploadMediaDto {
  @IsOptional()
  @IsEnum(MediaKind)
  kind: MediaKind = MediaKind.Other;

  @IsOptional()
  @IsUUID()
  cardId?: string;
}

export class ListMediaQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  cardId?: string;

  @IsOptional()
  @IsEnum(MediaKind)
  kind?: MediaKind;
}

export class DeleteMediaQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  force = false;
}
