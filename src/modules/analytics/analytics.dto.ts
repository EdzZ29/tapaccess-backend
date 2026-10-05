import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidateIf,
} from 'class-validator';
import { ClickKind } from '../../entities';

function IsTimeZone() {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isTimeZone',
      target: object.constructor,
      propertyName,
      options: { message: 'tz must be an IANA time zone such as Asia/Manila' },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || value.length > 64) return false;
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: value });
            return true;
          } catch {
            return false;
          }
        },
      },
    });
}

export class AnalyticsRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;

  @IsOptional()
  @IsTimeZone()
  tz = 'UTC';
}

export class TrackVisitDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.slice(0, 2048) : undefined,
  )
  @IsString()
  referrer?: string;
}

/** Targets for built-in actions; custom buttons use `kind=button` + `buttonId`. */
export const CONTACT_TARGETS = [
  'phone',
  'whatsapp',
  'email',
  'website',
  'directions',
  'reviews',
  'vcard',
  'share',
] as const;

export class TrackClickDto {
  @IsEnum(ClickKind)
  kind!: ClickKind;

  /** Required for `button` and `item` clicks. */
  @ValidateIf(
    (o: TrackClickDto) =>
      o.kind === ClickKind.Button || o.kind === ClickKind.Item,
  )
  @IsUUID()
  id?: string;

  /** For `contact` and `social`: which action, e.g. `phone` or `instagram`. */
  @ValidateIf(
    (o: TrackClickDto) =>
      o.kind === ClickKind.Contact || o.kind === ClickKind.Social,
  )
  @IsString()
  @MaxLength(32)
  @Matches(/^[a-z0-9-]+$/)
  target?: string;
}
