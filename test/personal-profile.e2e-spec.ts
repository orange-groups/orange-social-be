import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApi } from '../src/common/configure-http-api';
import { DrizzleService } from '../src/database/drizzle.service';
import { users } from '../src/database/schema';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { FriendsService } from '../src/modules/friends/friends.service';

const ROUTE = '/profile/me';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const AUTHORIZE = 'Bearer test-token';
const ROW = {
  id: USER_ID,
  fullName: 'Test User',
  username: 'test',
  bio: 'Hello',
  avatarUrl: null,
  coverUrl: null,
  dateOfBirth: new Date('2000-02-29T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};
const RESPONSE = {
  ...ROW,
  dateOfBirth: '2000-02-29',
  createdAt: '2026-01-01T00:00:00.000Z',
  friendCount: 3,
  relationship: { status: 'self', requestId: null },
};

describe('Personal profile', () => {
  let app: INestApplication<App>;
  const countFriends = jest.fn().mockResolvedValue(3);
  const limit = jest.fn();
  const readScope = jest.fn<{ limit: typeof limit }, [SQL]>(() => ({ limit }));
  const from = jest.fn(() => ({ where: readScope }));
  const select = jest.fn(() => ({ from }));
  const returning = jest.fn();
  const writeScope = jest.fn<{ returning: typeof returning }, [SQL]>(() => ({
    returning,
  }));
  const set = jest.fn<{ where: typeof writeScope }, [unknown]>(() => ({
    where: writeScope,
  }));
  const tx = { update: jest.fn(() => ({ set })) };
  const transaction = jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
    work(tx),
  );

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DrizzleService)
      .useValue({ db: { select, transaction } })
      .overrideProvider(AuthSessionService)
      .useValue({ verifyAccessToken: () => Promise.resolve({ sub: USER_ID }) })
      .overrideProvider(FriendsService)
      .useValue({ countFriends })
      .compile();
    app = module.createNestApplication();
    configureHttpApi(app);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    limit.mockResolvedValue([ROW]);
    returning.mockResolvedValue([ROW]);
  });

  afterAll(async () => app.close());

  function expectActiveUserScope(scope: SQL) {
    expect(new PgDialect().sqlToQuery(scope)).toMatchObject({
      sql: '("users"."id" = $1 and "users"."deleted_at" is null)',
      params: [USER_ID],
    });
  }

  it('returns only the authenticated profile, with a date-only birthday', async () => {
    const response = await request(app.getHttpServer())
      .get(ROUTE)
      .set('Authorization', AUTHORIZE)
      .expect(200);
    expectActiveUserScope(readScope.mock.calls[0][0]);
    expect(countFriends).toHaveBeenCalledWith(USER_ID);
    expect(response.body).toEqual({ success: true, data: RESPONSE });
  });

  it('trims allowed fields and leaves omitted fields unchanged', async () => {
    returning.mockResolvedValueOnce([{ ...ROW, fullName: 'New name' }]);
    const response = await request(app.getHttpServer())
      .patch(ROUTE)
      .set('Authorization', AUTHORIZE)
      .send({ fullName: '  New name  ' })
      .expect(200);
    expect(tx.update).toHaveBeenCalledWith(users);
    expect(set.mock.calls[0][0]).toMatchObject({ fullName: 'New name' });
    expect(set.mock.calls[0][0]).not.toHaveProperty('bio');
    expect(set.mock.calls[0][0]).not.toHaveProperty('dateOfBirth');
    expectActiveUserScope(writeScope.mock.calls[0][0]);
    expect(countFriends).toHaveBeenCalledWith(USER_ID, tx);
    expect(response.body).toEqual({
      success: true,
      data: { ...RESPONSE, fullName: 'New name' },
    });
  });

  it('accepts explicit null for optional fields and clears a blank bio', async () => {
    returning.mockResolvedValueOnce([{ ...ROW, bio: null, dateOfBirth: null }]);
    const response = await request(app.getHttpServer())
      .patch(ROUTE)
      .set('Authorization', AUTHORIZE)
      .send({ bio: '   ', dateOfBirth: null })
      .expect(200);
    expect(set.mock.calls[0][0]).toMatchObject({
      bio: null,
      dateOfBirth: null,
    });
    expect(response.body).toEqual({
      success: true,
      data: { ...RESPONSE, bio: null, dateOfBirth: null },
    });
  });

  it('stores a birthday at UTC midnight', async () => {
    await request(app.getHttpServer())
      .patch(ROUTE)
      .set('Authorization', AUTHORIZE)
      .send({ dateOfBirth: '2000-02-29' })
      .expect(200);
    expect(set.mock.calls[0][0]).toMatchObject({
      dateOfBirth: ROW.dateOfBirth,
    });
  });

  it.each([
    {},
    { fullName: '   ' },
    { dateOfBirth: '9999-12-31' },
    { dateOfBirth: '0000-01-01' },
    { id: USER_ID, fullName: 'Name' },
    { avatarUrl: 'https://example.test/avatar.png' },
  ])('rejects an invalid update (%j) before hitting the DB', async (body) => {
    await request(app.getHttpServer())
      .patch(ROUTE)
      .set('Authorization', AUTHORIZE)
      .send(body)
      .expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns 404 if the user is no longer active', async () => {
    limit.mockResolvedValueOnce([]);
    returning.mockResolvedValueOnce([]);
    await request(app.getHttpServer())
      .get(ROUTE)
      .set('Authorization', AUTHORIZE)
      .expect(404);
    await request(app.getHttpServer())
      .patch(ROUTE)
      .set('Authorization', AUTHORIZE)
      .send({ bio: null })
      .expect(404);
    expect(countFriends).not.toHaveBeenCalled();
  });
});
