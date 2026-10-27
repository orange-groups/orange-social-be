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
  private readonly allowedOrigins: string[];

  constructor(configService: ConfigService) {
    this.allowedOrigins = (
      configService.get<string>('FRONTEND_ORIGIN') ?? 'http://localhost:5173'
    )
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    if (origin && !this.allowedOrigins.includes(origin)) {
      throw new ForbiddenException('Origin không được phép.');
    }
    return true;
  }
}
