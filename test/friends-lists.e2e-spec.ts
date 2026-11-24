import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApi } from '../src/common/configure-http-api';
import { DrizzleService } from '../src/database/drizzle.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { readFriendCursor } from '../src/modules/friends/friend-list-pagination';

const VIEWER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const REQUEST = '00000000-0000-4000-8000-000000000003';
const TIMESTAMP = '2026-01-01T00:00:00.123456Z';
const USER = {
  id: OTHER,
  username: 'friend',
  fullName: 'Test Friend',
  avatarUrl: null,
};

describe('Friend lists', () => {
  let app: INestApplication<App>;
  const limit = jest.fn();
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn<{ orderBy: typeof orderBy }, [SQL]>(() => ({
    orderBy,
  }));
  const select = jest.fn(() => ({
    from: () => ({ innerJoin: () => ({ where }) }),
  }));
  const dialect = new PgDialect();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DrizzleService)
      .useValue({ db: { select } })
      .overrideProvider(AuthSessionService)
      .useValue({
        verifyAccessToken: (token: string) =>
          Promise.resolve({ sub: token === 'other' ? OTHER : VIEWER }),
      })
      .compile();
    app = module.createNestApplication();
    configureHttpApi(app);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    limit.mockResolvedValue([]);
  });

  afterAll(async () => app.close());

  function get(path: string, token = 'viewer') {
    return request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);
  }

  it('returns only the viewer’s active friends as public summaries', async () => {
    limit.mockResolvedValueOnce([
      {
        ...USER,
        sortAt: TIMESTAMP,
        sortId: OTHER,
        friendsSince: new Date(TIMESTAMP),
      },
    ]);
    const response = await get('/friends').expect(200);
    const filter = dialect.sqlToQuery(where.mock.calls[0][0]);
    expect(filter.sql).toContain('"friendships"."user_id" = $1');
    expect(filter.sql).toContain('"users"."deleted_at" is null');
    expect(filter.params).toEqual([VIEWER]);
    expect(limit).toHaveBeenCalledWith(11);
    expect(response.body).toEqual({
      success: true,
      data: {
        items: [{ ...USER, friendsSince: '2026-01-01T00:00:00.123Z' }],
        hasMore: false,
        nextCursor: null,
      },
    });
  });

  it.each([
    ['incoming', 'receiver_id'],
    ['outgoing', 'sender_id'],
  ])(
    'scopes %s pending requests to the viewer',
    async (direction, ownerColumn) => {
      await get(`/friends/requests?direction=${direction}`).expect(200);
      const filter = dialect.sqlToQuery(where.mock.calls[0][0]);
      expect(filter.sql).toContain(`"friend_requests"."${ownerColumn}" = $1`);
      expect(filter.sql).toContain('"users"."deleted_at" is null');
      expect(filter.params).toEqual([VIEWER, 'pending']);
    },
  );

  it('keeps microseconds in paginated requests and rejects foreign cursors', async () => {
    const row = {
      id: REQUEST,
      user: USER,
      sortId: REQUEST,
      sortAt: TIMESTAMP,
      createdAt: new Date(TIMESTAMP),
    };
    limit.mockResolvedValueOnce([row, { ...row, id: OTHER }]);
    const response = await get(
      '/friends/requests?direction=outgoing&limit=1',
    ).expect(200);
    const { data } = response.body as { data: { nextCursor: string } };
    const { nextCursor } = data;
    expect(readFriendCursor(nextCursor, VIEWER, 'outgoing')).toEqual({
      sortAt: TIMESTAMP,
      sortId: REQUEST,
    });
    expect(response.body).toEqual({
      success: true,
      data: {
        items: [
          { id: REQUEST, user: USER, createdAt: '2026-01-01T00:00:00.123Z' },
        ],
        hasMore: true,
        nextCursor,
      },
    });

    await get(
      `/friends/requests?direction=outgoing&cursor=${nextCursor}`,
    ).expect(200);
    const filter = dialect.sqlToQuery(where.mock.calls[1][0]);
    expect(filter.params).toEqual([VIEWER, 'pending', TIMESTAMP, REQUEST]);
    await get(
      `/friends/requests?direction=incoming&cursor=${nextCursor}`,
    ).expect(400);
    await get(
      `/friends/requests?direction=outgoing&cursor=${nextCursor}`,
      'other',
    ).expect(400);
    await get('/friends?cursor=invalid').expect(400);
    expect(select).toHaveBeenCalledTimes(2);
  });
});
