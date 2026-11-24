import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AuthSessionController } from './auth-session.controller';
import { AuthSessionService } from './auth-session.service';
import { AuthService } from './auth.service';
import { UserSessionRepository } from './repositories/user-session.repository';

describe('Auth session connection failures', () => {
  it.each([false, true])(
    'only clears the refresh cookie for invalid credentials (unauthorized=%s)',
    async (unauthorized) => {
      const error = unauthorized
        ? new UnauthorizedException()
        : Object.assign(new Error('database unavailable'), {
            code: 'ETIMEDOUT',
          });
      const service = {
        refresh: jest.fn().mockRejectedValue(error),
      } as unknown as AuthSessionService;
      const response = { clearCookie: jest.fn() };
      await expect(
        new AuthSessionController(service).refresh(
          { cookies: {} } as Request,
          response as unknown as Response,
        ),
      ).rejects.toBe(error);
      expect(response.clearCookie).toHaveBeenCalledTimes(unauthorized ? 1 : 0);
    },
  );

  it('does not convert database outages to unauthorized errors during access-token validation', async () => {
    const error = Object.assign(new Error('database unavailable'), {
      code: 'ETIMEDOUT',
    });
    const service = new AuthSessionService(
      {} as AuthService,
      {
        findById: jest.fn().mockRejectedValue(error),
      } as unknown as UserSessionRepository,
      {
        verifyAsync: jest
          .fn()
          .mockResolvedValue({ sub: 'user-id', tokenVersion: 0 }),
      } as unknown as JwtService,
      { getOrThrow: () => 'test-secret' } as unknown as ConfigService,
    );
    await expect(service.verifyAccessToken('test-token')).rejects.toBe(error);
  });
});
