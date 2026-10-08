import { SectionType } from '../../entities';

/**
 * Initial order and visibility of sections on a new card: Quick Actions,
 * Social Media, Gallery and Products lead, then the rest. Existing cards were
 * moved to the same lead order by the ReorderLeadSections migration.
 */
export const DEFAULT_SECTIONS: { type: SectionType; enabled: boolean }[] = [
  { type: SectionType.Contact, enabled: true },
  { type: SectionType.Social, enabled: true },
  { type: SectionType.Gallery, enabled: false },
  { type: SectionType.Products, enabled: false },
  { type: SectionType.Actions, enabled: true },
  { type: SectionType.About, enabled: true },
  { type: SectionType.Promotions, enabled: false },
  { type: SectionType.Services, enabled: false },
  { type: SectionType.Hours, enabled: true },
  { type: SectionType.Location, enabled: true },
  { type: SectionType.Announcements, enabled: false },
];
