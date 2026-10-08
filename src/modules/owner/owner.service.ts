import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { CookieOptions } from 'express';
import { Repository } from 'typeorm';
import { ownerAccessActive } from '../../common/plans';
import { normalizeOwnerCode } from '../../common/utils/owner-code';
import { NfcCard } from '../../entities';
import { AuthService } from '../auth/auth.service';
import { LoginGuard } from '../auth/login-guard';
import { getDummyHash, verifyPassword } from '../auth/password';

interface OwnerPayload {
  sub: string;
  ver: number;
}

const JWT_ISSUER = 'tapaccess-api';
/** Distinct audience: an owner token can never pass as an admin session. */
const JWT_AUDIENCE = 'tapaccess-owner';
const SESSION_DAYS = 30;

/**
 * Sign-in for card owners. The admin hands the owner an access code; with it
 * they can edit only their own card's buttons and social links. Sessions end
 * when the admin switches access off, archives the card
 * or moves it off the Business package.
 */
@Injectable()
export class OwnerService {
  private readonly loginGuard = new LoginGuard();

  constructor(
    @InjectRepository(NfcCard) private readonly cards: Repository<NfcCard>,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async login(
    slug: string,
    code: string,
  ): Promise<{ cardId: string; token: string }> {
    const key = `owner:${slug}`;
    this.loginGuard.assertNotLocked(key);

    const card = await this.cards
      .createQueryBuilder('c')
      .addSelect('c.ownerCodeHash')
      .where('c.slug = :slug', { slug })
      .getOne();
    const hash = card && ownerAccessActive(card) ? card.ownerCodeHash : null;

    // Always run one scrypt so timing doesn't reveal whether the card has access.
    const ok = await verifyPassword(
      normalizeOwnerCode(code),
      hash ?? (await getDummyHash()),
    );
    if (!card || !hash || !ok) {
      this.loginGuard.recordFailure(key);
      throw new UnauthorizedException({
        message:
          "That access code isn't right for this card, or editing is turned off. Check the code, or ask TapAccess to send it to you again.",
        code: 'OWNER_LOGIN_FAILED',
      });
    }
    this.loginGuard.recordSuccess(key);

    const payload: OwnerPayload = { sub: card.id, ver: card.ownerTokenVersion };
    const token = await this.jwt.signAsync(payload, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
      expiresIn: SESSION_DAYS * 86_400,
    });
    return { cardId: card.id, token };
  }

  /** The card a session token belongs to, while its access is still valid. */
  async verify(token: string): Promise<NfcCard | null> {
    try {
      const payload = await this.jwt.verifyAsync<OwnerPayload>(token, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ['HS256'],
      });
      const card = await this.cards.findOneBy({ id: payload.sub });
      if (
        !card ||
        card.ownerTokenVersion !== payload.ver ||
        !ownerAccessActive(card)
      )
        return null;
      return card;
    } catch {
      return null;
    }
  }

  cookieName(): string {
    return `${this.auth.cookieName()}_owner`;
  }

  cookieOptions(): CookieOptions {
    return { ...this.auth.cookieOptions(), maxAge: SESSION_DAYS * 86_400_000 };
  }
}
