import { HttpException, HttpStatus } from '@nestjs/common';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;

interface Entry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

/**
 * Per-account brute-force protection, on top of the per-IP rate limit:
 * after 10 wrong passwords for one email within 15 minutes, that email is
 * locked for 15 minutes no matter which IPs the attempts come from.
 *
 * Unknown emails are tracked exactly like real ones, so the lockout reveals
 * nothing about which accounts exist. State is in memory: the API runs as a
 * single instance, and a restart only clears the counters.
 */
export class LoginGuard {
  private readonly entries = new Map<string, Entry>();

  assertNotLocked(email: string, now = Date.now()) {
    const entry = this.entries.get(email);
    if (entry && entry.lockedUntil > now) {
      const minutes = Math.ceil((entry.lockedUntil - now) / 60_000);
      throw new HttpException(
        {
          message: `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
          code: 'ACCOUNT_LOCKED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(email: string, now = Date.now()) {
    this.prune(now);
    const entry = this.entries.get(email);
    if (!entry || now - entry.firstFailureAt > WINDOW_MS) {
      this.entries.set(email, {
        failures: 1,
        firstFailureAt: now,
        lockedUntil: 0,
      });
      return;
    }
    entry.failures += 1;
    if (entry.failures >= MAX_FAILURES) entry.lockedUntil = now + LOCK_MS;
  }

  recordSuccess(email: string) {
    this.entries.delete(email);
  }

  private prune(now: number) {
    if (this.entries.size < 1000) return;
    for (const [key, e] of this.entries) {
      if (e.lockedUntil < now && now - e.firstFailureAt > WINDOW_MS) {
        this.entries.delete(key);
      }
    }
  }
}
