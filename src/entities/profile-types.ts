import type { ThemeFont } from '../common/constants';

/**
 * Stored as JSONB on `card_profiles.theme`. The theme is always read and
 * written as one unit and never queried, so JSON avoids a wide table of
 * nullable style columns.
 */
export interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  backgroundStyle: 'solid' | 'gradient' | 'image';
  gradientTo: string;
  backgroundImageUrl: string | null;
  fontHeading: ThemeFont;
  fontBody: ThemeFont;
  buttonStyle: 'solid' | 'soft' | 'outline' | 'glass';
  buttonShape: 'rounded' | 'pill' | 'square';
  /** "personal": no cover, a large round profile picture centred above the name. */
  layout: 'classic' | 'centered' | 'minimal' | 'personal';
}

/**
 * Extra contact numbers besides the main phone, e.g. one per mobile network
 * ("Smart", "Globe") or a landline. Stored as JSONB on
 * `card_profiles.extra_phones`; always read and written with the profile.
 */
export interface ExtraPhone {
  label: string;
  number: string;
}

/** One entry per weekday, 0 = Monday ... 6 = Sunday. Times are "HH:MM". */
export interface OpeningHoursDay {
  day: number;
  closed: boolean;
  open: string;
  close: string;
}

/** Clean monochrome look; also the fixed design for Starter cards. */
export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#111111',
  accentColor: '#2563eb',
  backgroundColor: '#f7f7f5',
  surfaceColor: '#ffffff',
  textColor: '#111111',
  mutedTextColor: '#6b6b6b',
  backgroundStyle: 'solid',
  gradientTo: '#ececea',
  backgroundImageUrl: null,
  fontHeading: 'inter-tight',
  fontBody: 'inter',
  buttonStyle: 'solid',
  buttonShape: 'pill',
  layout: 'classic',
};

export const DEFAULT_OPENING_HOURS: OpeningHoursDay[] = Array.from(
  { length: 7 },
  (_, day) => ({
    day,
    closed: day >= 5,
    open: '09:00',
    close: '18:00',
  }),
);
