import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';

/**
 * Requests from the Next.js server carry a shared secret. In production all
 * visitor traffic reaches the API through Vercel, so without this the API
 * would see every visitor as Vercel's IP: rate limits would apply to
 * everyone at once and visit de-duplication would merge strangers.
 *
 * With a valid key, the Next.js server may also pass the visitor's real IP,
 * which is then used for rate limiting and the anonymous visitor hash. The
 * header is ignored on any request without the key, so it can't be spoofed
 * by calling the API directly.
 */
export const INTERNAL_KEY_HEADER = 'x-tapaccess-internal-key';
export const CLIENT_IP_HEADER = 'x-tapaccess-client-ip';
/** The site address the visitor actually used (e.g. https://tapaccess.vercel.app). */
export const SITE_URL_HEADER = 'x-tapaccess-site-url';

export type InternalRequest = Request & {
  /** Sent by our own Next.js server (valid internal key). */
  internal?: boolean;
  /** Visitor IP vouched for by our Next.js server. */
  trustedClientIp?: string;
  /** Origin of the site the visitor used, vouched for by our Next.js server. */
  trustedSiteUrl?: string;
};

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function internalRequests(internalKey: string | undefined) {
  return (req: InternalRequest, _res: Response, next: NextFunction) => {
    const key = req.headers[INTERNAL_KEY_HEADER];
    if (internalKey && typeof key === 'string' && safeEqual(key, internalKey)) {
      req.internal = true;
      const ip = req.headers[CLIENT_IP_HEADER];
      if (typeof ip === 'string' && isIP(ip.trim()))
        req.trustedClientIp = ip.trim();
      const site = req.headers[SITE_URL_HEADER];
      if (typeof site === 'string') {
        try {
          const url = new URL(site);
          if (url.protocol === 'https:' || url.protocol === 'http:')
            req.trustedSiteUrl = url.origin;
        } catch {
          // ignore malformed values
        }
      }
    }
    next();
  };
}

/**
 * Rate limits per visitor. Server-side renders (internal, no visitor IP) are
 * skipped by the module's `skipIf`; everything else is tracked by the real
 * client IP.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, any>): Promise<string> {
    const r = req as InternalRequest;
    return Promise.resolve(
      r.trustedClientIp ?? r.ip ?? r.socket?.remoteAddress ?? 'unknown',
    );
  }
}
