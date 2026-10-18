import {
  BadRequestException,
  Injectable,
  Logger,
  type OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { CookieOptions } from 'express';
import { Repository } from 'typeorm';
import { type AppConfig, NodeEnv } from '../../config/env';
import { Admin, AdminRole } from '../../entities';
import { LoginGuard } from './login-guard';
import {
  getDummyHash,
  hashPassword,
  needsRehash,
  verifyPassword,
} from './password';

export interface SessionPayload {
  sub: string;
  ver: number;
}

const JWT_ISSUER = 'tapaccess-api';
const JWT_AUDIENCE = 'tapaccess-admin';
/**
 * How long a verified admin row is reused before it is read again. Every
 * dashboard request is authenticated, so this saves one database round trip
 * per request. Password changes and renames drop the entry at once.
 */
const SESSION_CACHE_MS = 30_000;

export interface AdminView {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  lastLoginAt: Date | null;
}

export const toAdminView = (a: Admin): AdminView => ({
  id: a.id,
  email: a.email,
  name: a.name,
  role: a.role,
  lastLoginAt: a.lastLoginAt,
});

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(Admin) private readonly admins: Repository<Admin>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private readonly loginGuard = new LoginGuard();
  private readonly logger = new Logger(AuthService.name);
  /** Admins by id, as last read from the database (single API instance). */
  private readonly sessionCache = new Map<
    string,
    { admin: Admin; expiresAt: number }
  >();

  /** Computes the timing-equaliser hash at startup, not during someone's sign-in. */
  onModuleInit() {
    void getDummyHash();
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ admin: Admin; token: string }> {
    const key = email.toLowerCase();
    this.loginGuard.assertNotLocked(key);

    const admin = await this.admins
      .createQueryBuilder('a')
      .addSelect('a.passwordHash')
      .where('a.email = :email', { email: key })
      .getOne();

    // Always run one scrypt so response time does not reveal whether the email exists.
    const ok = await verifyPassword(
      password,
      admin?.passwordHash ?? (await getDummyHash()),
    );
    if (!admin || !ok) {
      this.loginGuard.recordFailure(key);
      throw new UnauthorizedException('Invalid email or password');
    }
    this.loginGuard.recordSuccess(key);

    // Bookkeeping runs after the reply: the admin doesn't wait for it.
    admin.lastLoginAt = new Date();
    const rehash = needsRehash(admin.passwordHash);
    void (async () => {
      await this.admins.update(admin.id, {
        lastLoginAt: admin.lastLoginAt,
        ...(rehash ? { passwordHash: await hashPassword(password) } : {}),
      });
    })().catch((err: Error) =>
      this.logger.warn(`Sign-in bookkeeping failed: ${err.message}`),
    );
    return { admin, token: await this.sign(admin) };
  }

  /** Resolves a session token to its admin, rejecting revoked or forged tokens. */
  async verifySession(token: string): Promise<Admin | null> {
    try {
      const payload = await this.jwt.verifyAsync<SessionPayload>(token, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ['HS256'],
      });
      const admin = await this.cachedAdmin(payload.sub);
      if (
        !admin ||
        admin.tokenVersion !== payload.ver ||
        admin.role !== AdminRole.SuperAdmin
      )
        return null;
      return admin;
    } catch {
      return null;
    }
  }

  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<string> {
    const admin = await this.admins
      .createQueryBuilder('a')
      .addSelect('a.passwordHash')
      .where('a.id = :id', { id: adminId })
      .getOneOrFail();
    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (currentPassword === newPassword)
      throw new BadRequestException(
        'New password must differ from the current one',
      );

    admin.passwordHash = await hashPassword(newPassword);
    // Bumping the version signs out every other session.
    admin.tokenVersion += 1;
    await this.admins.save(admin);
    this.sessionCache.delete(adminId);
    return this.sign(admin);
  }

  async updateName(adminId: string, name: string): Promise<Admin> {
    await this.admins.update(adminId, { name });
    this.sessionCache.delete(adminId);
    return this.admins.findOneByOrFail({ id: adminId });
  }

  private async cachedAdmin(id: string): Promise<Admin | null> {
    const now = Date.now();
    const hit = this.sessionCache.get(id);
    if (hit && hit.expiresAt > now) return hit.admin;
    const admin = await this.admins.findOneBy({ id });
    if (admin)
      this.sessionCache.set(id, { admin, expiresAt: now + SESSION_CACHE_MS });
    else this.sessionCache.delete(id);
    return admin;
  }

  cookieName(): string {
    return this.config.get('COOKIE_NAME', { infer: true });
  }

  cookieOptions(): CookieOptions {
    const isProd =
      this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }) ?? isProd,
      sameSite: this.config.get('COOKIE_SAMESITE', { infer: true }),
      domain: this.config.get('COOKIE_DOMAIN', { infer: true }) || undefined,
      path: '/',
      maxAge: this.sessionMaxAgeMs(),
    };
  }

  private sign(admin: Admin): Promise<string> {
    const payload: SessionPayload = { sub: admin.id, ver: admin.tokenVersion };
    return this.jwt.signAsync(payload, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
      expiresIn: Math.floor(this.sessionMaxAgeMs() / 1000),
    });
  }

  private sessionMaxAgeMs(): number {
    const raw = this.config.get('JWT_EXPIRES_IN', { infer: true });
    const match = /^(\d+)\s*([smhd])$/.exec(raw);
    if (!match) return 7 * 24 * 3600 * 1000;
    const unit = { s: 1, m: 60, h: 3600, d: 86400 }[
      match[2] as 's' | 'm' | 'h' | 'd'
    ];
    return Number(match[1]) * unit * 1000;
  }
}
