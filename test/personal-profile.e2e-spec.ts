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
import type { Relationship } from '../src/modules/friends/types/friends.types';

const ROUTE = '/profile/me';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const TARGET_ID = '00000000-0000-4000-8000-000000000002';
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
  const getRelationship = jest.fn<Promise<Relationship>, [string, string]>();
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
      .useValue({ countFriends, getRelationship })
      .compile();
    app = module.createNestApplication();
    configureHttpApi(app);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    limit.mockResolvedValue([ROW]);
    returning.mockResolvedValue([ROW]);
    getRelationship.mockResolvedValue({ status: 'none', requestId: null });
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

  it('returns only public fields for another user and delegates the actual viewer', async () => {
    limit.mockResolvedValueOnce([
      {
        ...ROW,
        id: TARGET_ID,
        email: 'private@example.test',
        passwordHash: 'private',
      },
    ]);
    getRelationship.mockResolvedValueOnce({
      status: 'friends',
      requestId: null,
    });

    const response = await request(app.getHttpServer())
      .get(`/profile/${TARGET_ID}`)
      .set('Authorization', AUTHORIZE)
      .expect(200);

    expect(select).toHaveBeenCalledWith({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      coverUrl: users.coverUrl,
      createdAt: users.createdAt,
    });
    expect(
      new PgDialect().sqlToQuery(readScope.mock.calls[0][0]),
    ).toMatchObject({
      sql: '("users"."id" = $1 and "users"."deleted_at" is null)',
      params: [TARGET_ID],
    });
    expect(countFriends).toHaveBeenCalledWith(TARGET_ID);
    expect(getRelationship).toHaveBeenCalledWith(USER_ID, TARGET_ID);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: TARGET_ID,
        username: ROW.username,
        fullName: ROW.fullName,
        avatarUrl: null,
        coverUrl: null,
        bio: ROW.bio,
        createdAt: ROW.createdAt.toISOString(),
        friendCount: 3,
        relationship: { status: 'friends', requestId: null },
      },
    });
  });

  it('does not expose the birthday on the public route even for the owner', async () => {
    getRelationship.mockResolvedValueOnce({ status: 'self', requestId: null });
    const response = await request(app.getHttpServer())
      .get(`/profile/${USER_ID}`)
      .set('Authorization', AUTHORIZE)
      .expect(200);
    expect(response.body).not.toHaveProperty('data.dateOfBirth');
  });

  it('rejects unauthenticated, invalid and missing public profiles', async () => {
    await request(app.getHttpServer()).get(`/profile/${TARGET_ID}`).expect(401);
    await request(app.getHttpServer())
      .get('/profile/not-a-uuid')
      .set('Authorization', AUTHORIZE)
      .expect(400);
    expect(select).not.toHaveBeenCalled();
    limit.mockResolvedValueOnce([]);
    await request(app.getHttpServer())
      .get(`/profile/${TARGET_ID}`)
      .set('Authorization', AUTHORIZE)
      .expect(404);
    expect(getRelationship).not.toHaveBeenCalled();
    expect(countFriends).not.toHaveBeenCalled();
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
