import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Admin } from '../../entities';

export type AuthenticatedRequest = Request & { admin?: Admin };

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Admin => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.admin!;
  },
);
