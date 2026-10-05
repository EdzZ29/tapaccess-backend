import { Transform } from 'class-transformer';
import {
  isEmail,
  isURL,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

export type LinkScheme = 'https' | 'http' | 'tel' | 'mailto' | 'sms';

const WEB_SCHEMES: LinkScheme[] = ['https', 'http'];
export const ACTION_SCHEMES: LinkScheme[] = [
  'https',
  'http',
  'tel',
  'mailto',
  'sms',
];

const PHONE = /^\+?[0-9 ()\-.]{3,32}$/;

/**
 * Validates a link an admin attaches to a public page. Only explicit schemes
 * are allowed, which rules out `javascript:`, `data:`, `file:` and friends.
 */
export function isSafeLink(
  value: unknown,
  schemes: LinkScheme[] = WEB_SCHEMES,
): boolean {
  if (typeof value !== 'string' || value.length > 2048) return false;
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (!match) return false;
  const scheme = match[1].toLowerCase() as LinkScheme;
  if (!schemes.includes(scheme)) return false;
  const rest = value.slice(match[0].length);

  switch (scheme) {
    case 'http':
    case 'https':
      return isURL(value, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_valid_protocol: true,
        allow_underscores: true,
        disallow_auth: true,
      });
    case 'tel':
    case 'sms':
      return PHONE.test(decodeURIComponent(rest.split('?')[0]));
    case 'mailto':
      return isEmail(decodeURIComponent(rest.split('?')[0]));
  }
}

/**
 * Lets admins type `example.com` instead of `https://example.com`. Applied
 * before validation; anything already carrying a scheme is left untouched.
 */
export const NormalizeLink = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
    if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(trimmed))
      return `https://${trimmed}`;
    return trimmed;
  });

export function IsSafeLink(
  schemes: LinkScheme[] = WEB_SCHEMES,
  options?: ValidationOptions,
) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isSafeLink',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a valid ${schemes.join('/')} link`,
        ...options,
      },
      validator: { validate: (value: unknown) => isSafeLink(value, schemes) },
    });
}

/**
 * Built-in actions a custom button can trigger instead of opening a URL. The
 * public page resolves them (e.g. `action:vcard` → this card's vCard
 * download), so they never depend on the site's domain.
 */
export const BUTTON_ACTIONS = ['action:vcard'] as const;

export const isButtonLink = (value: unknown): boolean =>
  (typeof value === 'string' &&
    (BUTTON_ACTIONS as readonly string[]).includes(value)) ||
  isSafeLink(value, ACTION_SCHEMES);

/** A custom button: an allowed link, or one of BUTTON_ACTIONS. */
export function IsButtonLink(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isButtonLink',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a valid ${ACTION_SCHEMES.join('/')} link`,
        ...options,
      },
      validator: { validate: isButtonLink },
    });
}

/**
 * Image references are either absolute https URLs (object storage) or paths
 * under `/uploads/` served by the local storage driver.
 */
export function isImageRef(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 1024) return false;
  if (value.startsWith('/uploads/'))
    return !value.includes('..') && /^[\w\-./]+$/.test(value);
  // Only images in our own storage: a third-party image URL would make every
  // visitor's phone contact that site and hand it their IP address.
  const bucket = supabasePublicPrefix();
  return Boolean(
    bucket &&
    value.startsWith(bucket) &&
    !value.includes('..') &&
    isSafeLink(value, ['https']),
  );
}

/** Public URL prefix of the Supabase bucket, when that storage driver is configured. */
function supabasePublicPrefix(): string | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!url) return null;
  const bucket = process.env.SUPABASE_BUCKET || 'tapaccess-media';
  return `${url}/storage/v1/object/public/${bucket}/`;
}

export function IsImageRef(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isImageRef',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be an uploaded image or https URL`,
        ...options,
      },
      validator: { validate: isImageRef },
    });
}
