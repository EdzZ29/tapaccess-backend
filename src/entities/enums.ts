export enum AdminRole {
  SuperAdmin = 'super_admin',
}

/** The package sold with the card; decides what the public page may show. */
export enum CardPlan {
  Starter = 'starter',
  Business = 'business',
}

export enum CardStatus {
  Active = 'active',
  Inactive = 'inactive',
  Archived = 'archived',
}

/** Fixed set of profile sections. Each card has exactly one row per type. */
export enum SectionType {
  About = 'about',
  Actions = 'actions',
  Contact = 'contact',
  Social = 'social',
  Hours = 'hours',
  Services = 'services',
  Products = 'products',
  Promotions = 'promotions',
  Gallery = 'gallery',
  Announcements = 'announcements',
  Location = 'location',
}

/** Sections whose content lives in `section_items`. */
export const ITEM_SECTION_TYPES: readonly SectionType[] = [
  SectionType.Services,
  SectionType.Products,
  SectionType.Promotions,
  SectionType.Gallery,
  SectionType.Announcements,
];

export enum SocialPlatform {
  Facebook = 'facebook',
  Instagram = 'instagram',
  TikTok = 'tiktok',
  YouTube = 'youtube',
  X = 'x',
  LinkedIn = 'linkedin',
  WhatsApp = 'whatsapp',
  Telegram = 'telegram',
  Pinterest = 'pinterest',
  Threads = 'threads',
  Other = 'other',
}

export enum MediaKind {
  Logo = 'logo',
  Cover = 'cover',
  Gallery = 'gallery',
  Item = 'item',
  Background = 'background',
  Other = 'other',
}

export enum ClickKind {
  Button = 'button',
  Social = 'social',
  Contact = 'contact',
  Item = 'item',
}

export enum DeviceType {
  Mobile = 'mobile',
  Tablet = 'tablet',
  Desktop = 'desktop',
  Unknown = 'unknown',
}
