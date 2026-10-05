import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * scrypt via Node's built-in crypto (no native add-on to compile on deploy).
 * Parameters follow OWASP guidance (N=2^17, r=8, p=1) and are stored inside
 * the hash string, so they can be raised later without breaking old hashes.
 *
 * Format: scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>
 */
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LEN,
      { N: n, r, p, maxmem: 256 * n * r },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await derive(
    password,
    Buffer.from(saltB64, 'base64'),
    Number(n),
    Number(r),
    Number(p),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A real hash of a random password, used to equalise timing for unknown emails. */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}

export const PASSWORD_MIN_LENGTH = 10;
