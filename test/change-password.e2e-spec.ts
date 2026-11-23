import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApi } from '../src/common/configure-http-api';
import { DrizzleService } from '../src/database/drizzle.service';
import type { SessionUserRecord } from '../src/modules/auth/repositories/user-session.repository';
import { UserSessionRepository } from '../src/modules/auth/repositories/user-session.repository';

const ROUTE = '/auth/change-password';
const EMAIL = 'change-password@example.test';
const CURRENT = 'Current-test-password!';
const NEXT = 'Next-test-password!';
const USER_ID = '00000000-0000-4000-8000-000000000001';

describe('POST /auth/change-password', () => {
  let app: INestApplication<App>;
  let user: SessionUserRecord;
  let originalHash: string;

  const replacePassword = jest.fn(
    (
      expected: Pick<SessionUserRecord, 'id' | 'passwordHash' | 'tokenVersion'>,
      hash: string,
    ) => {
      if (
        user.id !== expected.id ||
        user.tokenVersion !== expected.tokenVersion ||
        user.passwordHash !== expected.passwordHash
      ) {
        return Promise.resolve(false);
      }
      user.passwordHash = hash;
      user.tokenVersion++;
      user.refreshTokenHash = null;
      return Promise.resolve(true);
    },
  );

  beforeAll(async () => {
    originalHash = await bcrypt.hash(CURRENT, 4);
    const config: Record<string, string> = {
      JWT_ACCESS_SECRET: 'test-access',
      JWT_REFRESH_SECRET: 'test-refresh',
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DrizzleService)
      .useValue({ db: {} })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => config[key],
        getOrThrow: (key: string) => config[key],
      })
      .overrideProvider(UserSessionRepository)
      .useValue({
        findById: (id: string) =>
          Promise.resolve(id === user.id ? { ...user } : undefined),
        findByEmail: (email: string) =>
          Promise.resolve(email === user.email ? { ...user } : undefined),
        setRefreshTokenHash: (_id: string, hash: string) => {
          user.refreshTokenHash = hash;
          return Promise.resolve();
        },
        replacePassword,
      })
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    configureHttpApi(app);
    await app.init();
  });

  beforeEach(() => {
    replacePassword.mockClear();
    user = {
      id: USER_ID,
      email: EMAIL,
      fullName: 'Test User',
      username: 'test_user',
      avatarUrl: null,
      isEmailVerified: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      passwordHash: originalHash,
      tokenVersion: 0,
      refreshTokenHash: null,
    };
  });

  afterAll(async () => app.close());

  async function login(
    agent = request(app.getHttpServer()),
    password = CURRENT,
  ) {
    const response = await agent
      .post('/auth/login')
      .send({ email: EMAIL, password })
      .expect(200);
    const body = response.body as { data: { accessToken: string } };
    return {
      token: `Bearer ${body.data.accessToken}`,
      cookie: response.get('set-cookie')?.[0]?.split(';')[0] ?? '',
    };
  }

  it('requires Bearer authentication', async () => {
    await request(app.getHttpServer())
      .post(ROUTE)
      .send({ currentPassword: CURRENT, newPassword: NEXT })
      .expect(401);
    expect(replacePassword).not.toHaveBeenCalled();
  });

  it('rejects invalid new passwords and unexpected fields', async () => {
    const { token } = await login();
    for (const body of [
      { currentPassword: CURRENT, newPassword: 'short' },
      { currentPassword: CURRENT, newPassword: 'ế'.repeat(25) },
      { currentPassword: CURRENT, newPassword: NEXT, userId: USER_ID },
    ]) {
      await request(app.getHttpServer())
        .post(ROUTE)
        .set('Authorization', token)
        .send(body)
        .expect(400);
    }
    expect(replacePassword).not.toHaveBeenCalled();
  });

  it('does not mutate credentials for an incorrect or reused password', async () => {
    const { token } = await login();
    const test = request(app.getHttpServer());
    await test
      .post(ROUTE)
      .set('Authorization', token)
      .send({ currentPassword: 'incorrect', newPassword: NEXT })
      .expect(403);
    await test
      .post(ROUTE)
      .set('Authorization', token)
      .send({ currentPassword: CURRENT, newPassword: CURRENT })
      .expect(400);
    expect(replacePassword).not.toHaveBeenCalled();
    await test.get('/auth/me').set('Authorization', token).expect(200);
  });

  it('hashes the new password, clears the cookie, and invalidates old sessions', async () => {
    const agent = request.agent(app.getHttpServer());
    const { token, cookie } = await login(agent);
    const response = await agent
      .post(ROUTE)
      .set('Authorization', token)
      .send({ currentPassword: CURRENT, newPassword: NEXT })
      .expect(200);
    expect(response.body).toEqual({
      success: true,
      data: { message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' },
    });
    expect(response.get('set-cookie')?.[0]).toMatch(/^refresh_token=;/);
    expect(await bcrypt.compare(NEXT, user.passwordHash)).toBe(true);
    expect(user.tokenVersion).toBe(1);
    expect(user.refreshTokenHash).toBeNull();
    await agent.get('/auth/me').set('Authorization', token).expect(401);
    expect(cookie).toMatch(/^refresh_token=.+/);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
    await agent
      .post('/auth/login')
      .send({ email: EMAIL, password: CURRENT })
      .expect(401);
    await login(agent, NEXT);
  });

  it('does not report success if the credentials changed concurrently', async () => {
    const { token } = await login();
    replacePassword.mockResolvedValueOnce(false);
    await request(app.getHttpServer())
      .post(ROUTE)
      .set('Authorization', token)
      .send({ currentPassword: CURRENT, newPassword: NEXT })
      .expect(409);
  });
});
