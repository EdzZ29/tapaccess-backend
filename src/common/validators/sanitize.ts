import { Transform } from 'class-transformer';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAGS = /<\/?[a-z][^>]*>/gi;

/**
 * Normalises admin-entered plain text: strips control characters and HTML
 * tags, normalises newlines and trims. React escapes everything on output,
 * so this is defence in depth (vCards, OG tags, future integrations).
 */
export function sanitizeText(
  value: string,
  { multiline = false } = {},
): string {
  let text = value
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(HTML_TAGS, '');
  if (!multiline) text = text.replace(/\s*\n\s*/g, ' ');
  else text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/** Required text field. */
export const CleanText = (opts: { multiline?: boolean } = {}) =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? sanitizeText(value, opts) : value,
  );

/** Optional text field: empty strings become `null` so they clear the column. */
export const CleanOptionalText = (opts: { multiline?: boolean } = {}) =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return value;
    if (typeof value !== 'string') return value;
    const cleaned = sanitizeText(value, opts);
    return cleaned === '' ? null : cleaned;
  });
