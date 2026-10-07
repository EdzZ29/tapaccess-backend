import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { slugProblem } from '../../../common/utils/slug';
import {
  CleanOptionalText,
  CleanText,
} from '../../../common/validators/sanitize';
import { CardPlan, CardStatus } from '../../../entities';

const lowerTrim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

export function IsCardSlug(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isCardSlug',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && slugProblem(value) === null,
        defaultMessage: (args) =>
          typeof args?.value === 'string'
            ? (slugProblem(args.value) ?? 'Invalid slug')
            : 'Slug is required',
      },
    });
}

const CARD_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/;

export class CreateCardDto {
  @CleanText()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  businessName!: string;

  @lowerTrim()
  @IsCardSlug()
  slug!: string;

  @IsOptional()
  @IsEnum(CardPlan)
  plan: CardPlan = CardPlan.Business;

  /** Leave empty to auto-generate (TA-000001). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== ''
      ? value.trim().toUpperCase()
      : undefined,
  )
  @Matches(CARD_CODE, {
    message:
      'Card ID may contain letters, numbers, hyphens and underscores (2-32 chars)',
  })
  cardCode?: string;

  @IsOptional()
  @CleanOptionalText()
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @IsOptional()
  @CleanOptionalText({ multiline: true })
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class UpdateCardDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(CARD_CODE, {
    message:
      'Card ID may contain letters, numbers, hyphens and underscores (2-32 chars)',
  })
  cardCode?: string;

  @IsOptional()
  @IsEnum(CardPlan)
  plan?: CardPlan;

  /** Live cards keep their old address forwarding to the new one. */
  @IsOptional()
  @lowerTrim()
  @IsCardSlug()
  slug?: string;

  /** Show the card on the public homepage. */
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @CleanOptionalText({ multiline: true })
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class SetStatusDto {
  @IsEnum(CardStatus)
  status!: CardStatus;
}

export class DuplicateCardDto {
  @lowerTrim()
  @IsCardSlug()
  slug!: string;

  @IsOptional()
  @CleanText()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  businessName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== ''
      ? value.trim().toUpperCase()
      : undefined,
  )
  @Matches(CARD_CODE)
  cardCode?: string;
}

export const CARD_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'businessName',
  'slug',
  'cardCode',
  'status',
] as const;
export type CardSortField = (typeof CARD_SORT_FIELDS)[number];

export class ListCardsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().slice(0, 100) : value,
  )
  @IsString()
  search?: string;

  /** `all` = everything except archived; `archived` shows only archived cards. */
  @IsOptional()
  @IsIn(['all', 'active', 'inactive', 'archived'])
  status: 'all' | CardStatus = 'all';

  @IsOptional()
  @IsEnum(CardPlan)
  plan?: CardPlan;

  @IsOptional()
  @IsIn(CARD_SORT_FIELDS)
  sort: CardSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

export class SlugQueryDto {
  @lowerTrim()
  @IsString()
  @MaxLength(100)
  slug!: string;

  @IsOptional()
  @IsString()
  excludeId?: string;
}
