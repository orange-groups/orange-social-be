import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import {
  AccessTokenPayload,
  AuthSessionService,
} from '../auth-session.service';

export type AuthenticatedRequest = Request & { user?: AccessTokenPayload };

/**
 * Protects a route with `Authorization: Bearer <accessToken>` and puts the
 * token payload on `request.user` (use `@CurrentUser()` to read it).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authSessionService: AuthSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bạn chưa đăng nhập.');
    }
    request.user = await this.authSessionService.verifyAccessToken(token);
    return true;
  }
}
