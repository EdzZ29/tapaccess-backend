import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

/**
 * Small authenticated encryption (AES-256-GCM) for values the admin must be
 * able to read back, like a card owner's access code. The key is derived
 * from the server secret with its own label, so it never equals the JWT
 * signing key. Output: `v1.<iv>.<tag>.<ciphertext>` (base64url).
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(secret: string, label: string) {
    this.key = Buffer.from(hkdfSync('sha256', secret, 'tapaccess', label, 32));
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      data.toString('base64url'),
    ].join('.');
  }

  /** The original text, or null if it can't be read (e.g. the secret changed). */
  open(sealed: string | null | undefined): string | null {
    if (!sealed) return null;
    const [version, iv, tag, data] = sealed.split('.');
    if (version !== 'v1' || !iv || !tag || !data) return null;
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(iv, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }
}
