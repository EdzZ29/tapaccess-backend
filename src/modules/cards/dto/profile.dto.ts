import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  BACKGROUND_STYLES,
  BUTTON_ICONS,
  BUTTON_SHAPES,
  BUTTON_STYLES,
  LAYOUTS,
  LIMITS,
  THEME_FONTS,
  type ThemeFont,
} from '../../../common/constants';
import {
  CleanOptionalText,
  CleanText,
} from '../../../common/validators/sanitize';
import {
  ACTION_SCHEMES,
  IsImageRef,
  IsButtonLink,
  IsSafeLink,
  NormalizeLink,
} from '../../../common/validators/url.validators';
import { SectionType, SocialPlatform, TapAction } from '../../../entities';

const HEX = /^#[0-9a-f]{6}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^\+?[0-9 ()\-.]{3,32}$/;
/** wa.me links only work in international format: + and country code. */
const INTERNATIONAL_PHONE = /^\+[1-9][0-9 ()\-.]{6,31}$/;

const toDateOrNull = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') return null;
    const date = new Date(value as string);
    return Number.isNaN(date.getTime()) ? value : date;
  });

const nullIfEmpty = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  );

export class ThemeDto {
  @Matches(HEX) primaryColor!: string;
  @Matches(HEX) accentColor!: string;
  @Matches(HEX) backgroundColor!: string;
  @Matches(HEX) surfaceColor!: string;
  @Matches(HEX) textColor!: string;
  @Matches(HEX) mutedTextColor!: string;
  @Matches(HEX) gradientTo!: string;

  @IsIn(BACKGROUND_STYLES) backgroundStyle!: (typeof BACKGROUND_STYLES)[number];

  @nullIfEmpty()
  @ValidateIf((_, v) => v !== null)
  @IsImageRef()
  backgroundImageUrl!: string | null;

  @IsIn(THEME_FONTS) fontHeading!: ThemeFont;
  @IsIn(THEME_FONTS) fontBody!: ThemeFont;
  @IsIn(BUTTON_STYLES) buttonStyle!: (typeof BUTTON_STYLES)[number];
  @IsIn(BUTTON_SHAPES) buttonShape!: (typeof BUTTON_SHAPES)[number];
  @IsIn(LAYOUTS) layout!: (typeof LAYOUTS)[number];
}

export class OpeningHoursDayDto {
  @IsInt() @Min(0) @Max(6) day!: number;
  @IsBoolean() closed!: boolean;
  @Matches(TIME) open!: string;
  @Matches(TIME) close!: string;
}

export class ProfileFieldsDto {
  @CleanText()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  businessName!: string;

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(160)
  tagline!: string | null;

  @CleanOptionalText({ multiline: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(3000)
  description!: string | null;

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(80)
  category!: string | null;

  @nullIfEmpty()
  @ValidateIf((_, v) => v !== null)
  @IsImageRef()
  logoUrl!: string | null;

  @nullIfEmpty()
  @ValidateIf((_, v) => v !== null)
  @IsImageRef()
  coverUrl!: string | null;

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null)
  @Matches(PHONE, { message: 'phone must be a valid phone number' })
  phone!: string | null;

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null)
  @Matches(INTERNATIONAL_PHONE, {
    message:
      'WhatsApp number must start with + and the country code, e.g. +63 917 123 4567',
  })
  whatsapp!: string | null;

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  @MaxLength(254)
  email!: string | null;

  @NormalizeLink()
  @ValidateIf((_, v) => v !== null)
  @IsSafeLink()
  website!: string | null;

  @CleanOptionalText({ multiline: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  address!: string | null;

  @NormalizeLink()
  @ValidateIf((_, v) => v !== null)
  @IsSafeLink(['https'])
  mapsUrl!: string | null;

  @NormalizeLink()
  @ValidateIf((_, v) => v !== null)
  @IsSafeLink(['https'])
  reviewsUrl!: string | null;

  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningHoursDayDto)
  openingHours!: OpeningHoursDayDto[];

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  hoursNote!: string | null;

  @ValidateNested()
  @Type(() => ThemeDto)
  theme!: ThemeDto;

  /** What happens when the card is tapped. Optional so older editors keep working. */
  @IsOptional()
  @IsEnum(TapAction)
  tapAction: TapAction = TapAction.Profile;
}

export class SectionItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @CleanText()
  @IsString()
  @MinLength(1, { message: 'Every item needs a title' })
  @MaxLength(160)
  title!: string;

  @CleanOptionalText({ multiline: true })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2000)
  description: string | null = null;

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(40)
  price: string | null = null;

  @nullIfEmpty()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsImageRef()
  imageUrl: string | null = null;

  @NormalizeLink()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsSafeLink(ACTION_SCHEMES)
  linkUrl: string | null = null;

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(40)
  linkLabel: string | null = null;

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(40)
  badge: string | null = null;

  @toDateOrNull()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDate()
  startsAt: Date | null = null;

  @toDateOrNull()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDate()
  endsAt: Date | null = null;

  @IsBoolean()
  enabled = true;
}

export class SectionDto {
  @IsEnum(SectionType)
  type!: SectionType;

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
  @Type(() => SectionItemDto)
  items: SectionItemDto[] = [];
}

export class ButtonDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @CleanText()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;

  @NormalizeLink()
  @IsButtonLink()
  url!: string;

  @IsIn(BUTTON_ICONS)
  icon!: string;

  @IsBoolean()
  enabled = true;

  @IsBoolean()
  highlighted = false;
}

export class SocialLinkDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @NormalizeLink()
  @IsSafeLink(['https', 'http'])
  url!: string;

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(40)
  label: string | null = null;

  @IsBoolean()
  enabled = true;
}

/**
 * The editor saves the whole public profile in one request. Array order is
 * the display order; rows with an `id` are updated, rows without are created
 * and rows missing from the payload are deleted.
 */
export class SaveProfileDto {
  /**
   * The owner's last edit time as the editor loaded it (`ownerAccess.lastEditAt`,
   * null if there was none). If the owner has edited since, the save is
   * refused instead of silently overwriting their links. Omit for older
   * clients. Compared with the same column, so clock skew can't interfere.
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  baseOwnerEditAt?: Date | null;

  @ValidateNested()
  @Type(() => ProfileFieldsDto)
  profile!: ProfileFieldsDto;

  @IsArray()
  @ArrayMaxSize(Object.keys(SectionType).length)
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  sections!: SectionDto[];

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
