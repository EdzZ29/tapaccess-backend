import { RESERVED_SLUGS, SLUG_PATTERN } from '../constants';

export const SLUG_MIN = 3;
export const SLUG_MAX = 64;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

/** Returns a human-readable reason, or null when the slug is acceptable. */
export function slugProblem(slug: string): string | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX)
    return `Slug must be ${SLUG_MIN}-${SLUG_MAX} characters`;
  if (!SLUG_PATTERN.test(slug))
    return 'Use lowercase letters, numbers and single hyphens only';
  if (RESERVED_SLUGS.has(slug)) return 'This slug is reserved';
  return null;
}
