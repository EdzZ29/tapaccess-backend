import { DeviceType } from '../entities/enums';
import { LoginGuard } from '../modules/auth/login-guard';
import { buildVCard } from '../modules/public/vcard';
import type { PublicProfile } from '../modules/public/public-profile.mapper';
import {
  deviceTypeFromUa,
  isLikelyBot,
  referrerHost,
} from './utils/request-meta';
import { slugify, slugProblem } from './utils/slug';
import { sanitizeText } from './validators/sanitize';
import {
  isButtonLink,
  isImageRef,
  isSafeLink,
} from './validators/url.validators';

describe('isSafeLink', () => {
  it.each([
    'https://example.com',
    'https://example.com/path?q=1#x',
    'http://example.org:8080/menu',
    'tel:+1 (555) 010-0100',
    'mailto:hello@example.com',
    'sms:+15550100',
  ])('accepts %s', (url) => {
    expect(isSafeLink(url, ['https', 'http', 'tel', 'mailto', 'sms'])).toBe(
      true,
    );
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    'file:///etc/passwd',
    'https://user:pass@example.com',
    'http://localhost:3000',
    'example.com',
    'tel:not-a-number',
    'mailto:nope',
  ])('rejects %s', (url) => {
    expect(isSafeLink(url, ['https', 'http', 'tel', 'mailto', 'sms'])).toBe(
      false,
    );
  });

  it('restricts schemes per field', () => {
    expect(isSafeLink('tel:+15550100', ['https'])).toBe(false);
  });
});

describe('isImageRef', () => {
  it('accepts only our own storage', () => {
    expect(isImageRef('/uploads/cards/abc/logo/1.webp')).toBe(true);
    // Third-party hosts would learn every visitor's IP.
    expect(isImageRef('https://cdn.example.com/a.webp')).toBe(false);

    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    try {
      expect(
        isImageRef(
          'https://proj.supabase.co/storage/v1/object/public/tapaccess-media/cards/x/logo/1.webp',
        ),
      ).toBe(true);
      expect(
        isImageRef(
          'https://proj.supabase.co/storage/v1/object/public/other/a.webp',
        ),
      ).toBe(false);
    } finally {
      delete process.env.SUPABASE_URL;
    }
  });
  it('rejects traversal and scripts', () => {
    expect(isImageRef('/uploads/../.env')).toBe(false);
    expect(isImageRef('javascript:alert(1)')).toBe(false);
    expect(isImageRef('/etc/passwd')).toBe(false);
  });
});

describe('sanitizeText', () => {
  it('strips tags and control characters and trims', () => {
    expect(sanitizeText('  <b>Bold</b> <script>x</script>\u0007name ')).toBe(
      'Bold xname',
    );
  });
  it('collapses newlines unless multiline', () => {
    expect(sanitizeText('a\r\nb')).toBe('a b');
    expect(sanitizeText('a\r\n\n\n\nb', { multiline: true })).toBe('a\n\nb');
  });
});

describe('slugs', () => {
  it('slugifies names', () => {
    expect(slugify('Bean & Bloom Café!')).toBe('bean-and-bloom-cafe');
  });
  it('validates format and reserved words', () => {
    expect(slugProblem('activezone-001')).toBeNull();
    expect(slugProblem('ab')).toMatch(/3-64/);
    expect(slugProblem('Bad Slug')).toMatch(/lowercase/);
    expect(slugProblem('a--b')).toMatch(/lowercase/);
    expect(slugProblem('admin')).toMatch(/reserved/);
  });
});

describe('request metadata', () => {
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

  it('detects bots and link-preview fetchers', () => {
    for (const ua of [
      undefined,
      'curl/8.0',
      'facebookexternalhit/1.1',
      'WhatsApp/2.23.20 A',
      'Mozilla/5.0 (compatible; Googlebot/2.1)',
      'Mozilla/5.0 HeadlessChrome/120',
    ]) {
      expect(isLikelyBot(ua)).toBe(true);
    }
  });

  it('keeps real browsers, including in-app browsers', () => {
    expect(isLikelyBot(iphone)).toBe(false);
    expect(isLikelyBot(`${iphone} [LinkedInApp]`)).toBe(false);
    expect(isLikelyBot(`${iphone} Instagram 300.0`)).toBe(false);
  });

  it('classifies devices coarsely', () => {
    expect(deviceTypeFromUa(iphone)).toBe(DeviceType.Mobile);
    expect(
      deviceTypeFromUa('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'),
    ).toBe(DeviceType.Tablet);
    expect(deviceTypeFromUa('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
      DeviceType.Desktop,
    );
  });

  it('keeps only the referrer hostname and drops our own', () => {
    expect(referrerHost('https://www.instagram.com/p/abc?utm=1', [])).toBe(
      'instagram.com',
    );
    expect(
      referrerHost('https://tapaccess.app/c/x', ['tapaccess.app']),
    ).toBeNull();
    expect(referrerHost('not a url', [])).toBeNull();
  });
});

describe('buildVCard', () => {
  const profile = {
    slug: 'demo',
    businessName: 'Bean, Bloom; Café',
    tagline: null,
    description: 'x'.repeat(200),
    contact: {
      phone: '+1 555',
      whatsapp: null,
      email: 'a@b.co',
      website: null,
      address: 'Line 1\nLine 2',
    },
    socialLinks: [],
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } as unknown as PublicProfile;

  it('escapes special characters and folds long lines', () => {
    const card = buildVCard(profile, 'https://x.test/c/demo');
    expect(card).toContain('FN:Bean\\, Bloom\\; Café');
    expect(card).toContain('ADR;TYPE=WORK:;;Line 1\\, Line 2;;;;');
    for (const line of card.split('\r\n'))
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(card.startsWith('BEGIN:VCARD\r\n')).toBe(true);
    expect(card.trimEnd().endsWith('END:VCARD')).toBe(true);
  });
});

describe('isButtonLink', () => {
  it('accepts safe links and the built-in vCard action only', () => {
    expect(isButtonLink('https://example.com')).toBe(true);
    expect(isButtonLink('tel:+15550100')).toBe(true);
    expect(isButtonLink('action:vcard')).toBe(true);
    expect(isButtonLink('action:delete')).toBe(false);
    expect(isButtonLink('javascript:alert(1)')).toBe(false);
  });
});

describe('LoginGuard', () => {
  it('locks an email after 10 failures in 15 minutes, for 15 minutes', () => {
    const guard = new LoginGuard();
    const t0 = 1_000_000;
    for (let i = 0; i < 9; i++) guard.recordFailure('a@b.co', t0 + i);
    expect(() => guard.assertNotLocked('a@b.co', t0 + 10)).not.toThrow();
    guard.recordFailure('a@b.co', t0 + 10);
    expect(() => guard.assertNotLocked('a@b.co', t0 + 11)).toThrow(
      /Try again in 15 minutes/,
    );
    expect(() => guard.assertNotLocked('other@b.co', t0 + 11)).not.toThrow();
    expect(() =>
      guard.assertNotLocked('a@b.co', t0 + 10 + 15 * 60_000 + 1),
    ).not.toThrow();
  });

  it('forgets failures after a successful sign-in', () => {
    const guard = new LoginGuard();
    for (let i = 0; i < 9; i++) guard.recordFailure('a@b.co', i);
    guard.recordSuccess('a@b.co');
    guard.recordFailure('a@b.co', 20);
    expect(() => guard.assertNotLocked('a@b.co', 21)).not.toThrow();
  });
});
