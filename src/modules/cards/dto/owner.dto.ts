import { OmitType, PickType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LIMITS } from '../../../common/constants';
import {
  CleanOptionalText,
  CleanText,
} from '../../../common/validators/sanitize';
import { IsImageRef } from '../../../common/validators/url.validators';
import {
  ButtonDto,
  ProfileFieldsDto,
  SocialLinkDto,
  ThemeDto,
} from './profile.dto';

/** The profile fields a card's owner may change (contact details and hours stay with the admin). */
export class OwnerProfileDto extends PickType(ProfileFieldsDto, [
  'businessName',
  'tagline',
  'description',
  'category',
  'logoUrl',
  'coverUrl',
] as const) {}

/** The theme without button style, button shape and layout, which stay with the admin. */
export class OwnerThemeDto extends OmitType(ThemeDto, [
  'buttonStyle',
  'buttonShape',
  'layout',
] as const) {}

export class OwnerGalleryItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  /** Alt text for the photo; the editor fills in "Photo" when left empty. */
  @CleanText()
  @IsString()
  @MinLength(1, { message: 'Every photo needs a description' })
  @MaxLength(160)
  title!: string;

  @IsImageRef()
  imageUrl!: string;

  @IsBoolean()
  enabled = true;
}

export class OwnerGalleryDto {
  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(120)
  title: string | null = null;

  @IsBoolean()
  enabled!: boolean;

  @IsArray()
  @ArrayMaxSize(LIMITS.itemsPerSection)
  @ValidateNested({ each: true })
  @Type(() => OwnerGalleryItemDto)
  items!: OwnerGalleryItemDto[];
}

/**
 * The owner's save. Buttons and links are always sent; profile, theme and
 * gallery are optional so editors opened before they existed keep working.
 */
export class SaveOwnerCardDto {
  /**
   * The card's `updatedAt` as the editor loaded it. If TapAccess changed the
   * card since, the save is refused instead of overwriting their changes.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? new Date(value) : value,
  )
  @IsDate()
  baseUpdatedAt?: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => OwnerProfileDto)
  profile?: OwnerProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OwnerThemeDto)
  theme?: OwnerThemeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OwnerGalleryDto)
  gallery?: OwnerGalleryDto;

  @IsArray()
  @ArrayMaxSize(LIMITS.buttons)
  @ValidateNested({ each: true })
  @Type(() => ButtonDto)
  buttons!: ButtonDto[];

  @IsArray()
  @ArrayMaxSize(LIMITS.socialLinks)
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks!: SocialLinkDto[];
}
