import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CleanOptionalText, CleanText } from '../../common/validators/sanitize';

/** What the card's owner sends from their review link. */
export class SubmitReviewDto {
  @Type(() => Number)
  @IsInt({ message: 'Choose a rating from 1 to 5 stars.' })
  @Min(1, { message: 'Choose a rating from 1 to 5 stars.' })
  @Max(5, { message: 'Choose a rating from 1 to 5 stars.' })
  rating!: number;

  @CleanText({ multiline: true })
  @IsString()
  @MinLength(10, {
    message: 'Write a few words about TapAccess (at least 10 characters).',
  })
  @MaxLength(500, { message: 'Keep the review under 500 characters.' })
  comment!: string;

  @CleanText()
  @IsString()
  @MinLength(2, { message: 'Enter your name.' })
  @MaxLength(80)
  authorName!: string;

  @CleanOptionalText()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(80)
  authorRole: string | null = null;
}

/** Admin moderation: keep the review but leave it off the homepage. */
export class SetReviewHiddenDto {
  @IsBoolean()
  hidden!: boolean;
}
