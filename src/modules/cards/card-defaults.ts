import { SectionType } from '../../entities';

/** Initial order and visibility of sections on a new card. */
export const DEFAULT_SECTIONS: { type: SectionType; enabled: boolean }[] = [
  { type: SectionType.Actions, enabled: true },
  { type: SectionType.About, enabled: true },
  { type: SectionType.Promotions, enabled: false },
  { type: SectionType.Services, enabled: false },
  { type: SectionType.Products, enabled: false },
  { type: SectionType.Gallery, enabled: false },
  { type: SectionType.Contact, enabled: true },
  { type: SectionType.Hours, enabled: true },
  { type: SectionType.Location, enabled: true },
  { type: SectionType.Announcements, enabled: false },
  { type: SectionType.Social, enabled: true },
];
