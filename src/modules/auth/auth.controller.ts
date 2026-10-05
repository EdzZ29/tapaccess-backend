import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { Admin } from '../../entities';
import { AuthService, toAdminView } from './auth.service';
import { ChangePasswordDto, LoginDto, UpdateAccountDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 5 attempts per minute and 20 per hour per IP. */
  @Public()
  @Throttle({
    default: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { admin, token } = await this.auth.login(dto.email, dto.password);
    res.cookie(this.auth.cookieName(), token, this.auth.cookieOptions());
    return { admin: toAdminView(admin) };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    const { maxAge: _maxAge, ...opts } = this.auth.cookieOptions();
    res.clearCookie(this.auth.cookieName(), opts);
  }

  @Get('me')
  me(@CurrentAdmin() admin: Admin) {
    return { admin: toAdminView(admin) };
  }

  @Patch('me')
  async updateMe(@CurrentAdmin() admin: Admin, @Body() dto: UpdateAccountDto) {
    return {
      admin: toAdminView(await this.auth.updateName(admin.id, dto.name)),
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentAdmin() admin: Admin,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.auth.changePassword(
      admin.id,
      dto.currentPassword,
      dto.newPassword,
    );
    // Re-issue this session's cookie; every other session is now invalid.
    res.cookie(this.auth.cookieName(), token, this.auth.cookieOptions());
  }
}
