import type { PublicProfile } from './public-profile.mapper';

/** RFC 2426 text escaping (backslash, newline, comma, semicolon). */
const esc = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');

/** URIs are not text-escaped (that would corrupt commas in URLs); just keep them on one line. */
const uri = (value: string) => value.replace(/[\r\n]/g, '');

/** Dialable form: digits plus a leading +, so every contacts app can call it. */
export const dial = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return phone.trim().startsWith('+') ? `+${digits}` : digits;
};

/** Fold content lines at 75 octets, as vCard parsers (notably iOS) expect. */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    // Never split inside a multi-byte UTF-8 sequence.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
  }
  return parts.join('\r\n ');
}

/**
 * vCard 3.0: the version iOS Contacts and Android's importer both handle
 * reliably. The required properties (VERSION, N, FN) are always present and
 * the business is saved as a company contact (X-ABShowAs is Apple's flag;
 * other apps ignore it and use FN/ORG).
 */
export function buildVCard(
  profile: PublicProfile,
  profileUrl: string,
  photoJpeg?: Buffer | null,
): string {
  const c = profile.contact;
  const name = esc(profile.businessName);
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:;;;;',
    `FN:${name}`,
    `ORG:${name}`,
    'X-ABShowAs:COMPANY',
  ];
  if (profile.tagline) lines.push(`TITLE:${esc(profile.tagline)}`);
  if (c.phone && c.phoneLabel) {
    lines.push(`item0.TEL;TYPE=CELL,VOICE:${dial(c.phone)}`);
    lines.push(`item0.X-ABLabel:${esc(c.phoneLabel)}`);
  } else if (c.phone) {
    lines.push(`TEL;TYPE=WORK,VOICE:${dial(c.phone)}`);
  }
  const seen = new Set(c.phone ? [dial(c.phone)] : []);
  // Extra numbers keep their label ("Smart", "Globe"…): Apple reads the
  // grouped X-ABLabel; other apps still import the number as a mobile.
  for (const [i, x] of (c.extraPhones ?? []).entries()) {
    const number = dial(x.number);
    if (!number || seen.has(number)) continue;
    seen.add(number);
    lines.push(`item${i + 1}.TEL;TYPE=CELL:${number}`);
    lines.push(`item${i + 1}.X-ABLabel:${esc(x.label)}`);
  }
  if (c.whatsapp && !seen.has(dial(c.whatsapp))) {
    lines.push(`TEL;TYPE=CELL:${dial(c.whatsapp)}`);
  }
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${c.email}`);
  if (c.website) lines.push(`URL;TYPE=WORK:${uri(c.website)}`);
  lines.push(`URL:${uri(profileUrl)}`);
  if (c.address) {
    lines.push(
      `ADR;TYPE=WORK:;;${esc(c.address.replace(/\s*\n\s*/g, ', '))};;;;`,
    );
  }
  for (const s of profile.socialLinks) {
    lines.push(`X-SOCIALPROFILE;TYPE=${s.platform}:${uri(s.url)}`);
  }
  if (profile.description) {
    lines.push(`NOTE:${esc(profile.description.slice(0, 500))}`);
  }
  if (photoJpeg) {
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photoJpeg.toString('base64')}`);
  }
  lines.push(`REV:${new Date(profile.updatedAt).toISOString()}`, 'END:VCARD');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** ASCII file name for old clients, plus the real name for modern ones (RFC 6266). */
export function vCardDisposition(name: string): string {
  const ascii =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'contact';
  const utf8 = encodeURIComponent(`${name.slice(0, 60)}.vcf`);
  return `attachment; filename="${ascii}.vcf"; filename*=UTF-8''${utf8}`;
}
