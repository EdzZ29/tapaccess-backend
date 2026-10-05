import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../common/decorators/current-admin.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';

/**
 * Registered globally: every route requires a valid super-admin session
 * unless it is explicitly marked `@Public()`.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[
      this.auth.cookieName()
    ];
    if (!token) throw new UnauthorizedException('Not signed in');

    const admin = await this.auth.verifySession(token);
    if (!admin)
      throw new UnauthorizedException('Session expired, please sign in again');

    req.admin = admin;
    return true;
  }
}
