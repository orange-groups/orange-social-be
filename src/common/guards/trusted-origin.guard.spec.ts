import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrustedOriginGuard } from './trusted-origin.guard';

describe('TrustedOriginGuard', () => {
  function context(origin?: string): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ headers: { origin } }) }),
    } as unknown as ExecutionContext;
  }

  it('defaults to the local frontend', () => {
    const guard = new TrustedOriginGuard(new ConfigService({}));
    expect(guard.canActivate(context('http://localhost:5173'))).toBe(true);
  });

  it('uses the origin of the configured frontend URL', () => {
    const guard = new TrustedOriginGuard(
      new ConfigService({ FRONTEND_URL: 'https://social.example.com/app/' }),
    );
    expect(guard.canActivate(context('https://social.example.com'))).toBe(true);
    expect(() => guard.canActivate(context('http://localhost:5173'))).toThrow(
      ForbiddenException,
    );
    expect(() =>
      guard.canActivate(context('https://evil.example.com')),
    ).toThrow(ForbiddenException);
  });

  it('preserves support for requests without Origin', () => {
    const guard = new TrustedOriginGuard(new ConfigService({}));
    expect(guard.canActivate(context())).toBe(true);
  });
});
