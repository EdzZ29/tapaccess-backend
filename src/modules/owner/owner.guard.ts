import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { NfcCard } from '../../entities';
import { OwnerService } from './owner.service';

export interface OwnerRequest extends Request {
  ownerCard?: NfcCard;
}

/** Requires a valid card-owner session; the card is attached to the request. */
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private readonly owners: OwnerService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OwnerRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[
      this.owners.cookieName()
    ];
    if (!token) {
      throw new UnauthorizedException({
        message: 'Sign in with your access code to edit this card.',
        code: 'OWNER_SIGNED_OUT',
      });
    }
    const card = await this.owners.verify(token);
    if (!card) {
      throw new UnauthorizedException({
        message:
          'Your editing access has ended or the access code was changed. Sign in again with your current code.',
        code: 'OWNER_SESSION_ENDED',
      });
    }
    req.ownerCard = card;
    return true;
  }
}
