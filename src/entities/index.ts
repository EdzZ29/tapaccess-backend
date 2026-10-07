import { Admin } from './admin.entity';
import { ButtonClick } from './button-click.entity';
import { CardButton } from './card-button.entity';
import { CardProfile } from './card-profile.entity';
import { CardSection } from './card-section.entity';
import { CardSlugRedirect } from './card-slug-redirect.entity';
import { CardVisit } from './card-visit.entity';
import { MediaAsset } from './media-asset.entity';
import { NfcCard } from './nfc-card.entity';
import { SectionItem } from './section-item.entity';
import { SocialLink } from './social-link.entity';

export * from './enums';
export * from './profile-types';
export {
  Admin,
  ButtonClick,
  CardButton,
  CardProfile,
  CardSection,
  CardSlugRedirect,
  CardVisit,
  MediaAsset,
  NfcCard,
  SectionItem,
  SocialLink,
};

export const ENTITIES = [
  Admin,
  NfcCard,
  CardProfile,
  CardSection,
  SectionItem,
  CardButton,
  SocialLink,
  MediaAsset,
  CardVisit,
  ButtonClick,
  CardSlugRedirect,
];
