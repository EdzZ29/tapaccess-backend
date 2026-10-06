import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L: easy to read out loud and type on a phone. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 10;

/**
 * A card owner's access code, e.g. "K7QP3-MX9RW": 10 random characters from
 * a 31-letter alphabet (~49 bits). Brute force is further capped by the
 * per-IP rate limit and the per-card lockout.
 */
export function generateOwnerCode(): string {
  let code = '';
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** How a typed code is compared: case, spaces and dashes don't matter. */
export const normalizeOwnerCode = (input: string) =>
  input.toUpperCase().replace(/[^A-Z0-9]/g, '');
