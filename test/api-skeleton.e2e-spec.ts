import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApi } from '../src/common/configure-http-api';
import { DrizzleService } from '../src/database/drizzle.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { ListNotificationsDto } from '../src/modules/notifications/dto/list-notifications.dto';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const RESOURCE_ID = '00000000-0000-4000-8000-000000000002';

interface RouteCase {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  body?: Record<string, unknown>;
}

const routes: RouteCase[] = [
  {
    method: 'post',
    path: '/media/upload-signature',
    body: { purpose: 'avatar' },
  },
  { method: 'get', path: '/profile/me' },
  { method: 'get', path: `/profile/${RESOURCE_ID}` },
  { method: 'patch', path: '/profile/me', body: { fullName: 'Test User' } },
  {
    method: 'post',
    path: '/profile/me/avatar/complete',
    body: { uploadId: RESOURCE_ID },
  },
  { method: 'delete', path: '/profile/me/avatar' },
  {
    method: 'post',
    path: '/friends/requests',
    body: { receiverId: RESOURCE_ID },
  },
  { method: 'get', path: '/friends/requests?direction=incoming' },
  { method: 'post', path: `/friends/requests/${RESOURCE_ID}/accept` },
  { method: 'post', path: `/friends/requests/${RESOURCE_ID}/reject` },
  { method: 'delete', path: `/friends/requests/${RESOURCE_ID}` },
  { method: 'get', path: '/friends' },
  { method: 'delete', path: `/friends/${RESOURCE_ID}` },
  { method: 'get', path: '/users?q=test' },
  {
    method: 'post',
    path: '/posts',
    body: { content: 'Test post', privacy: 'friends' },
  },
  { method: 'get', path: `/posts/${RESOURCE_ID}` },
  { method: 'get', path: `/posts?authorId=${RESOURCE_ID}` },
  { method: 'delete', path: `/posts/${RESOURCE_ID}` },
  { method: 'get', path: '/feed' },
  { method: 'get', path: '/notifications?unreadOnly=false' },
  { method: 'get', path: '/notifications/unread-count' },
  { method: 'patch', path: '/notifications/read-all' },
  { method: 'patch', path: `/notifications/${RESOURCE_ID}/read` },
];

describe('Backend API skeleton (no business logic)', () => {
  let app: INestApplication<App>;
  let notifications: NotificationsService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DrizzleService)
      .useValue({ db: {} })
      .overrideProvider(AuthSessionService)
      .useValue({
        verifyAccessToken: jest.fn().mockResolvedValue({
          sub: USER_ID,
          email: 'test@example.com',
          username: 'test',
          tokenVersion: 0,
        }),
      })
      .compile();
    app = module.createNestApplication();
    configureHttpApi(app);
    await app.init();
    notifications = module.get(NotificationsService);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it.each(routes)(
    'requires authentication: $method $path',
    async ({ method, path, body }) => {
      const call = request(app.getHttpServer())[method](path);
      if (body) call.send(body);
      const response = await call.expect(401);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED' },
      });
    },
  );

  it.each(routes)(
    'returns 501 instead of fake success: $method $path',
    async ({ method, path, body }) => {
      const call = request(app.getHttpServer())
        [method](path)
        .set('Authorization', 'Bearer test-token');
      if (body) call.send(body);
      const response = await call.expect(501);
      expect(response.body).toMatchObject({
        success: false,
        error: { details: null },
      });
      expect(response.body).not.toHaveProperty('data');
    },
  );

  it.each<RouteCase>([
    {
      method: 'post',
      path: '/media/upload-signature',
      body: { purpose: 'cover' },
    },
    { method: 'post', path: '/posts', body: { content: '' } },
    {
      method: 'post',
      path: '/posts',
      body: { content: 'Test', authorId: RESOURCE_ID },
    },
    {
      method: 'post',
      path: '/posts',
      body: { content: 'Test', privacy: 'private' },
    },
    {
      method: 'post',
      path: '/friends/requests',
      body: { receiverId: 'invalid' },
    },
    {
      method: 'post',
      path: '/profile/me/avatar/complete',
      body: { uploadId: 'invalid' },
    },
    { method: 'patch', path: '/profile/me', body: { fullName: null } },
    {
      method: 'patch',
      path: '/profile/me',
      body: { dateOfBirth: '2025-02-30' },
    },
    {
      method: 'patch',
      path: '/profile/me',
      body: { email: 'other@example.com' },
    },
    { method: 'get', path: '/posts/not-a-uuid' },
    { method: 'get', path: '/posts' },
    { method: 'get', path: '/users?q=a' },
    { method: 'get', path: '/friends/requests?direction=invalid' },
    { method: 'get', path: '/feed?limit=51' },
    { method: 'get', path: '/notifications?unreadOnly=invalid' },
  ])('validates input: $method $path', async ({ method, path, body }) => {
    const call = request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer test-token');
    if (body) call.send(body);
    await call.expect(400);
  });

  it('parses unreadOnly=false as false and delegates the authenticated ID', async () => {
    const list = jest.spyOn(notifications, 'listForUser');
    await request(app.getHttpServer())
      .get('/notifications?unreadOnly=false&limit=5')
      .set('Authorization', 'Bearer test-token')
      .expect(501);
    expect(list).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        unreadOnly: false,
        limit: 5,
      }) as ListNotificationsDto,
    );
  });

  it('allows nullable optional profile fields to reach the placeholder', async () => {
    await request(app.getHttpServer())
      .patch('/profile/me')
      .set('Authorization', 'Bearer test-token')
      .send({ bio: null, dateOfBirth: null })
      .expect(501);
  });
});
