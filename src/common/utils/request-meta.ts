import type { Request } from 'express';
import { DeviceType } from '../../entities/enums';
import type { InternalRequest } from '../internal-request';

/**
 * User agents that should never count as a human visit: crawlers, link
 * unfurlers (WhatsApp/Slack/iMessage previews fire when a link is shared),
 * monitoring, headless browsers and HTTP libraries.
 */
const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|scrape|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp\/|telegrambot|slackbot|slack-imgproxy|discordbot|skypeuripreview|linkedinbot|pinterestbot|embedly|quora link preview|vkshare|redditbot|applebot|bingpreview|google-inspectiontool|googleother|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|headless|phantomjs|puppeteer|playwright|selenium|prerender|python-requests|python-urllib|aiohttp|httpx|curl\/|wget|libwww|okhttp|axios|node-fetch|undici|go-http-client|java\/|postman|insomnia/i;

export function isLikelyBot(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.length < 20) return true;
  return BOT_UA.test(userAgent);
}

export function deviceTypeFromUa(userAgent: string | undefined): DeviceType {
  if (!userAgent) return DeviceType.Unknown;
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(userAgent))
    return DeviceType.Tablet;
  if (
    /mobi|iphone|ipod|android|blackberry|opera mini|iemobile|windows phone/i.test(
      userAgent,
    )
  )
    return DeviceType.Mobile;
  if (/windows|macintosh|linux|cros/i.test(userAgent))
    return DeviceType.Desktop;
  return DeviceType.Unknown;
}

/** Keep only the hostname of a referrer, never paths or query strings. */
export function referrerHost(
  referrer: unknown,
  ownHosts: string[],
): string | null {
  if (typeof referrer !== 'string' || referrer === '') return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (!host || ownHosts.includes(host)) return null;
    return host.slice(0, 255);
  } catch {
    return null;
  }
}

/** The visitor's IP: forwarded by our Next.js server when trusted, else the socket's. */
export function clientIp(req: Request): string {
  return (
    (req as InternalRequest).trustedClientIp ??
    req.ip ??
    req.socket.remoteAddress ??
    '0.0.0.0'
  );
}

export function userAgent(req: Request): string | undefined {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 512) : undefined;
}
