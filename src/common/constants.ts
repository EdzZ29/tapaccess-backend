/**
 * Allow-lists shared with the frontend (`tapaccess-frontend/lib/constants.ts`).
 * Keep the two files in sync when adding options.
 */
export const THEME_FONTS = [
  'inter-tight',
  'plus-jakarta',
  'manrope',
  'bricolage',
  'instrument-serif',
  'inter',
  'poppins',
  'montserrat',
  'playfair',
  'lora',
  'space-grotesk',
] as const;
export type ThemeFont = (typeof THEME_FONTS)[number];

export const BUTTON_STYLES = ['solid', 'soft', 'outline', 'glass'] as const;
export const BUTTON_SHAPES = ['rounded', 'pill', 'square'] as const;
export const LAYOUTS = ['classic', 'centered', 'minimal'] as const;
export const BACKGROUND_STYLES = ['solid', 'gradient', 'image'] as const;

export const BUTTON_ICONS = [
  'link',
  'globe',
  'phone',
  'mail',
  'message-circle',
  'whatsapp',
  'map-pin',
  'navigation',
  'star',
  'calendar',
  'clock',
  'shopping-bag',
  'shopping-cart',
  'utensils',
  'coffee',
  'gift',
  'ticket',
  'tag',
  'credit-card',
  'download',
  'file-text',
  'menu',
  'heart',
  'camera',
  'music',
  'video',
  'car',
  'home',
  'briefcase',
  'dumbbell',
  'scissors',
  'stethoscope',
  'graduation-cap',
  'info',
  'user-plus',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
] as const;
export type ButtonIcon = (typeof BUTTON_ICONS)[number];

/** Slugs that would collide with app routes or look official. */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'login',
  'logout',
  'new',
  'edit',
  'settings',
  'static',
  'uploads',
  'assets',
  'public',
  'tapaccess',
  'support',
  'help',
  'null',
  'undefined',
]);

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const LIMITS = {
  buttons: 20,
  socialLinks: 15,
  itemsPerSection: 40,
} as const;
