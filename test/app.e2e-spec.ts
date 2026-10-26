import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { createHash } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DrizzleService } from './../src/database/drizzle.service';

interface StoredUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  fullName: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  refreshTokenHash: string | null;
  tokenVersion: number;
  createdAt: Date;
}

describe('App & Auth Registration (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  const usersStore: StoredUser[] = [];

  beforeEach(async () => {
    usersStore.length = 0;

    const mockDrizzleService = {
      db: {
        select: jest.fn().mockImplementation(() => ({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockImplementation(() => {
                return Promise.resolve(
                  usersStore.length > 0 ? [{ id: usersStore[0].id }] : [],
                );
              }),
            }),
          }),
        })),
        insert: jest.fn().mockImplementation(() => ({
          values: jest
            .fn()
            .mockImplementation(
              (val: {
                email: string;
                username: string;
                passwordHash: string;
                fullName: string;
              }) => ({
                returning: jest.fn().mockImplementation(() => {
                  const created: StoredUser = {
                    id: 'e2e-user-uuid-1',
                    email: val.email,
                    username: val.username,
                    passwordHash: val.passwordHash,
                    fullName: val.fullName,
                    avatarUrl: null,
                    isEmailVerified: false,
                    refreshTokenHash: null,
                    tokenVersion: 0,
                    createdAt: new Date('2026-10-26T09:30:00.000Z'),
                  };
                  usersStore.push(created);
                  return Promise.resolve([created]);
                }),
              }),
            ),
        })),
        update: jest.fn().mockImplementation(() => ({
          set: jest
            .fn()
            .mockImplementation((fields: { refreshTokenHash: string }) => ({
              where: jest.fn().mockImplementation(() => {
                if (usersStore[0]) {
                  usersStore[0].refreshTokenHash = fields.refreshTokenHash;
                }
                return Promise.resolve();
              }),
            })),
        })),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DrizzleService)
      .useValue(mockDrizzleService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('POST /auth/regis — registers user, returns 15m accessToken, sets 1d HttpOnly refresh_token cookie, and stores hashed refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/regis')
      .send({
        fullName: 'Ba Dan',
        email: 'BaDan@Example.com',
        password: 'Password@123',
      })
      .expect(201);

    const body = response.body as {
      accessToken: string;
      user: {
        id: string;
        email: string;
        username: string;
        fullName: string;
      };
    };

    expect(body.accessToken).toBeDefined();
    expect(body.user).toMatchObject({
      id: 'e2e-user-uuid-1',
      email: 'badan@example.com',
      username: 'badan',
      fullName: 'Ba Dan',
    });

    const decodedAccess = jwtService.decode<{
      sub: string;
      exp: number;
      iat: number;
    }>(body.accessToken);
    expect(decodedAccess.sub).toBe('e2e-user-uuid-1');
    expect(decodedAccess.exp - decodedAccess.iat).toBe(15 * 60);

    const setCookieHeader = response.headers['set-cookie'] as
      string | string[] | undefined;
    expect(setCookieHeader).toBeDefined();
    const cookies: string[] = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader ?? ''];
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Max-Age=86400');
    expect(refreshCookie).toContain('Path=/auth');

    const rawRefreshToken = refreshCookie!
      .split(';')[0]
      .replace('refresh_token=', '');
    const decodedRefresh = jwtService.decode<{
      sub: string;
      exp: number;
      iat: number;
      type: string;
    }>(rawRefreshToken);
    expect(decodedRefresh.sub).toBe('e2e-user-uuid-1');
    expect(decodedRefresh.type).toBe('refresh');
    expect(decodedRefresh.exp - decodedRefresh.iat).toBe(24 * 60 * 60);

    expect(usersStore[0].refreshTokenHash).toBeTruthy();
    const refreshDigest = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');
    const isHashValid = await bcrypt.compare(
      refreshDigest,
      usersStore[0].refreshTokenHash!,
    );
    expect(isHashValid).toBe(true);
  });

  it('POST /auth/regis — returns 400 Bad Request for weak password', async () => {
    await request(app.getHttpServer())
      .post('/auth/regis')
      .send({
        fullName: 'Ba Dan',
        email: 'badan@example.com',
        password: 'weak',
      })
      .expect(400);
  });
});
