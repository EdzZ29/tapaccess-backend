import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { LIMITS } from '../../../common/constants';
import { ButtonDto, SocialLinkDto } from './profile.dto';

/** The only things a card's owner may change. */
export class SaveOwnerLinksDto {
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
