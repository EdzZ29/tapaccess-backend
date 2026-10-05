import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { CleanText } from '../../../common/validators/sanitize';
import { PASSWORD_MIN_LENGTH } from '../password';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @MaxLength(200)
  newPassword!: string;
}

export class UpdateAccountDto {
  @CleanText()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
