import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * CSRF protection for routes authenticated by the refresh-token cookie:
 * browsers send `Origin` on cross-site POSTs, so reject origins we do not serve.
 */
@Injectable()
export class TrustedOriginGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(configService: ConfigService) {
    this.allowedOrigin = new URL(
      configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173',
    ).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    if (origin && origin !== this.allowedOrigin) {
      throw new ForbiddenException('Origin không được phép.');
    }
    return true;
  }
}
