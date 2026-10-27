import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthSessionService } from './auth-session.service';
import type { AccessTokenPayload, SessionResult } from './auth-session.service';
import {
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './auth.service';
import type { AuthUserDto } from './dto/register.dto';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TrustedOriginGuard } from './guards/trusted-origin.guard';

/** Same cookie as POST /auth/regis sets, so both flows share one session. */
export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
  };
}

/** Login, silent refresh (F5 / expired access token), logout and current user. */
@Controller('auth')
export class AuthSessionController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TrustedOriginGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.authSessionService.login(
      dto.email,
      dto.password,
    );
    return this.sendSession(res, session);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TrustedOriginGuard)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    try {
      const session = await this.authSessionService.refresh(
        readRefreshCookie(req),
      );
      return this.sendSession(res, session);
    } catch (error) {
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshCookieOptions());
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TrustedOriginGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authSessionService.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshCookieOptions());
    return { message: 'Đã đăng xuất.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AccessTokenPayload): Promise<AuthUserDto> {
    return this.authSessionService.getCurrentUser(user.sub);
  }

  private sendSession(res: Response, session: SessionResult): LoginResponseDto {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, session.refreshToken, {
      ...refreshCookieOptions(),
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
    return { accessToken: session.accessToken, user: session.user };
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  return typeof value === 'string' && value ? value : undefined;
}
