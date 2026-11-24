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
import { FriendsService } from '../src/modules/friends/friends.service';
import { encodeUserSearchCursor } from '../src/modules/users/user-search-cursor';

const VIEWER = '00000000-0000-4000-8000-000000000001';
const FIRST = '00000000-0000-4000-8000-000000000002';
const SECOND = '00000000-0000-4000-8000-000000000003';
const MATCH = {
  id: FIRST,
  username: 'nguyen_an',
  fullName: 'Nguyễn An',
  avatarUrl: null,
};
const RELATIONSHIP = { status: 'none', requestId: null };

describe('GET /users', () => {
  let app: INestApplication<App>;
  const limit = jest.fn();
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn<{ orderBy: typeof orderBy }, [SQL]>(() => ({
    orderBy,
  }));
  const select = jest.fn(() => ({ from: () => ({ where }) }));
  const getRelationships = jest
    .fn()
    .mockResolvedValue({ [FIRST]: RELATIONSHIP });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DrizzleService)
      .useValue({ db: { select } })
      .overrideProvider(FriendsService)
      .useValue({ getRelationships })
      .overrideProvider(AuthSessionService)
      .useValue({ verifyAccessToken: () => Promise.resolve({ sub: VIEWER }) })
      .compile();
    app = module.createNestApplication();
    configureHttpApi(app);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    limit.mockResolvedValue([MATCH, { ...MATCH, id: SECOND }]);
  });

  afterAll(async () => app.close());

  function search(query: Record<string, string | number>) {
    return request(app.getHttpServer())
      .get('/users')
      .set('Authorization', 'Bearer search-test')
      .query(query);
  }

  it('normalizes the query, parameterizes literal text and reads relationships in one batch', async () => {
    const response = await search({ q: '  @An_%  ', limit: 1 }).expect(200);
    const filter = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(filter.sql).toContain('"users"."deleted_at" is null');
    expect(filter.sql).toContain('strpos(lower("users"."full_name"),');
    expect(filter.sql).toContain('strpos(lower("users"."username"),');
    expect(filter.params).toEqual([VIEWER, 'An_%', 'An_%']);
    expect(limit).toHaveBeenCalledWith(2);
    expect(getRelationships).toHaveBeenCalledTimes(1);
    expect(getRelationships).toHaveBeenCalledWith(VIEWER, [FIRST]);
    expect(response.body).toEqual({
      success: true,
      data: {
        items: [{ ...MATCH, relationship: RELATIONSHIP }],
        nextCursor: encodeUserSearchCursor(VIEWER, 'An_%', FIRST),
        hasMore: true,
      },
    });
  });

  it('uses an ID boundary for the next page and returns an empty page cleanly', async () => {
    limit.mockResolvedValueOnce([]);
    const cursor = encodeUserSearchCursor(VIEWER, 'Nguyễn', FIRST);
    const response = await search({ q: 'Nguyễn', cursor }).expect(200);
    const filter = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(filter.sql).toContain('"users"."id" > $2');
    expect(filter.params).toEqual([VIEWER, FIRST, 'Nguyễn', 'Nguyễn']);
    expect(response.body).toEqual({
      success: true,
      data: { items: [], nextCursor: null, hasMore: false },
    });
  });

  it('rejects unbounded searches and cursors from another search or viewer', async () => {
    await search({ q: '  @ ' }).expect(400);
    await search({ q: 'an\0' }).expect(400);
    await search({ q: 'an', limit: 51 }).expect(400);
    await search({ q: 'an', cursor: 'invalid' }).expect(400);
    await search({
      q: 'an',
      cursor: encodeUserSearchCursor(VIEWER, 'other', FIRST),
    }).expect(400);
    await search({
      q: 'an',
      cursor: encodeUserSearchCursor(SECOND, 'an', FIRST),
    }).expect(400);
    expect(select).not.toHaveBeenCalled();
  });
});
