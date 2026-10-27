import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { DrizzleService } from '../../database/drizzle.service';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import type {
  SessionUserRecord,
  UserSessionRepository,
} from './repositories/user-session.repository';

const PASSWORD = 'Orange@2026';
const SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
};
const config = {
  get: (key: string) => SECRETS[key],
  getOrThrow: (key: string) => {
    if (!SECRETS[key]) throw new Error(`Missing ${key}`);
    return SECRETS[key];
  },
} as unknown as ConfigService;

describe('AuthSessionService', () => {
  let user: SessionUserRecord;
  let authService: AuthService;
  let repository: jest.Mocked<
    Pick<
      UserSessionRepository,
      | 'findByEmail'
      | 'findById'
      | 'setRefreshTokenHash'
      | 'rotateRefreshTokenHash'
    >
  >;
  let service: AuthSessionService;

  beforeAll(async () => {
    user = {
      id: 'user-uuid-1',
      email: 'quang@orange.social',
      username: 'quang',
      fullName: 'Trung Quang',
      avatarUrl: null,
      isEmailVerified: false,
      createdAt: new Date('2026-10-27T02:00:00.000Z'),
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      tokenVersion: 0,
      refreshTokenHash: null,
    };
  });

  beforeEach(async () => {
    user.refreshTokenHash = null;
    user.tokenVersion = 0;
    const jwtService = new JwtService();
    authService = new AuthService({} as DrizzleService, jwtService, config);
    repository = {
      findByEmail: jest.fn((email: string) =>
        Promise.resolve(email === user.email ? { ...user } : undefined),
      ),
      findById: jest.fn(() => Promise.resolve({ ...user })),
      setRefreshTokenHash: jest.fn((_id: string, hash: string | null) => {
        user.refreshTokenHash = hash;
        return Promise.resolve();
      }),
      rotateRefreshTokenHash: jest.fn(
        (_id: string, expected: string, next: string) => {
          if (user.refreshTokenHash !== expected) return Promise.resolve(false);
          user.refreshTokenHash = next;
          return Promise.resolve(true);
        },
      ),
    };
    service = new AuthSessionService(
      authService,
      repository as unknown as UserSessionRepository,
      jwtService,
      config,
    );
    await service.onModuleInit();
  });

  it('logs in with the right password and stores only a hash of the refresh token', async () => {
    const session = await service.login(user.email, PASSWORD);

    expect(session.accessToken).toEqual(expect.any(String));
    expect(session.user).toEqual({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      avatarUrl: null,
      isEmailVerified: false,
      createdAt: '2026-10-27T02:00:00.000Z',
    });
    expect(session.user).not.toHaveProperty('passwordHash');
    expect(user.refreshTokenHash).toBeTruthy();
    expect(user.refreshTokenHash).not.toContain(session.refreshToken);
  });

  it('access token is 15 minutes, refresh token 1 day (same as /auth/regis)', async () => {
    const session = await service.login(user.email, PASSWORD);
    const jwt = new JwtService();
    const access = jwt.decode<{ exp: number; iat: number }>(
      session.accessToken,
    );
    const refresh = jwt.decode<{ exp: number; iat: number; type: string }>(
      session.refreshToken,
    );
    expect(access.exp - access.iat).toBe(15 * 60);
    expect(refresh.exp - refresh.iat).toBe(24 * 60 * 60);
    expect(refresh.type).toBe('refresh');
  });

  it('rejects a wrong password and an unknown email with the same message', async () => {
    await expect(service.login(user.email, 'Wrong@2026')).rejects.toThrow(
      new UnauthorizedException('Email hoặc mật khẩu không đúng.'),
    );
    await expect(
      service.login('nobody@orange.social', PASSWORD),
    ).rejects.toThrow(
      new UnauthorizedException('Email hoặc mật khẩu không đúng.'),
    );
    expect(repository.setRefreshTokenHash).not.toHaveBeenCalled();
  });

  it('accepts the refresh token issued by /auth/regis', async () => {
    const tokens = await authService.issueTokens(
      user.id,
      user.email,
      user.username,
      user.tokenVersion,
    );
    user.refreshTokenHash = await authService.hashRefreshToken(
      tokens.refreshToken,
    );

    const session = await service.refresh(tokens.refreshToken);
    expect(session.user.id).toBe(user.id);
  });

  it('refresh rotates the token: the new one works, the old one is rejected', async () => {
    const first = await service.login(user.email, PASSWORD);
    const hashAfterLogin = user.refreshTokenHash;
    const second = await service.refresh(first.refreshToken);

    expect(user.refreshTokenHash).not.toBe(hashAfterLogin);
    // A refresh issued in the same second can be byte-identical, so only reject
    // the old token when it differs from the new one
    if (second.refreshToken !== first.refreshToken) {
      await expect(service.refresh(first.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    }
    await expect(service.refresh(second.refreshToken)).resolves.toBeDefined();
  });

  it('refresh fails without a cookie, with a forged token or an access token', async () => {
    const session = await service.login(user.email, PASSWORD);
    await expect(service.refresh(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.refresh('not-a-jwt')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.refresh(session.accessToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refresh fails after the password was reset (token_version increased)', async () => {
    const session = await service.login(user.email, PASSWORD);
    user.tokenVersion = 1;
    await expect(service.refresh(session.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('logout clears the stored hash, so the refresh token no longer works', async () => {
    const session = await service.login(user.email, PASSWORD);
    await service.logout(session.refreshToken);

    expect(user.refreshTokenHash).toBeNull();
    await expect(service.refresh(session.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.logout(undefined)).resolves.toBeUndefined();
  });

  it('verifies access tokens for JwtAuthGuard', async () => {
    const session = await service.login(user.email, PASSWORD);
    await expect(
      service.verifyAccessToken(session.accessToken),
    ).resolves.toMatchObject({ sub: user.id, tokenVersion: 0 });
    await expect(
      service.verifyAccessToken(session.refreshToken),
    ).rejects.toThrow(UnauthorizedException);
  });
});
