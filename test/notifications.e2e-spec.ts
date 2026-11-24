import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApi } from '../src/common/configure-http-api';
import { DrizzleService } from '../src/database/drizzle.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { NotificationsRepository } from '../src/modules/notifications/repositories/notifications.repository';
import type { CreateNotificationInput } from '../src/modules/notifications/types/create-notification.types';

const OWNER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const ITEM = '00000000-0000-8000-8000-000000000003';
const ACTION: CreateNotificationInput = {
  recipientId: OWNER,
  actorId: OTHER,
  type: 'post_reacted',
  content: 'A reaction',
  target: { type: 'post', id: OTHER },
  deduplicationKey: 'reaction-id',
};

describe('Notifications HTTP and WebSocket', () => {
  let app: INestApplication<App>;
  let service: NotificationsService;
  let socketUrl: string;
  const sockets = new Set<WebSocket>();
  const create = jest.fn().mockResolvedValue({ id: ITEM, created: true });
  const listForUser = jest.fn().mockResolvedValue({
    items: [
      {
        id: ITEM,
        type: ACTION.type,
        content: ACTION.content,
        target: ACTION.target,
        actor: null,
        isRead: false,
        createdAt: new Date(0),
      },
    ],
    hasMore: false,
    nextCursor: null,
  });
  const countUnread = jest.fn().mockResolvedValue(1);
  const markRead = jest.fn((user: string) =>
    Promise.resolve(
      user === OWNER ? { id: ITEM, isRead: true, unreadCount: 0 } : undefined,
    ),
  );
  const markAllRead = jest.fn().mockResolvedValue({
    updatedCount: 1,
    readThrough: new Date(0).toISOString(),
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DrizzleService)
      .useValue({ db: {} })
      .overrideProvider(AuthSessionService)
      .useValue({
        verifyAccessToken: (token: string) => {
          if (token === 'owner') return Promise.resolve({ sub: OWNER });
          if (token === 'other') return Promise.resolve({ sub: OTHER });
          return Promise.reject(new UnauthorizedException());
        },
      })
      .overrideProvider(NotificationsRepository)
      .useValue({ create, listForUser, countUnread, markRead, markAllRead })
      .compile();
    app = module.createNestApplication();
    configureHttpApi(app);
    await app.listen(0, '127.0.0.1');
    service = module.get(NotificationsService);
    socketUrl = `${(await app.getUrl()).replace(/^http:/, 'ws:')}/notifications/socket.io/?EIO=4&transport=websocket`;
  });

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    for (const socket of sockets) socket.close();
    sockets.clear();
  });
  afterAll(async () => app.close());

  function connect(token?: string) {
    const socket = new WebSocket(socketUrl);
    sockets.add(socket);
    const frames: string[] = [];
    const handshake = new Promise<string>((resolve, reject) => {
      socket.addEventListener(
        'error',
        () => reject(new Error('Socket connection failed')),
        { once: true },
      );
      socket.addEventListener('message', ({ data }) => {
        if (typeof data !== 'string') return;
        frames.push(data);
        if (data.startsWith('0'))
          socket.send(
            `40${JSON.stringify({ accessToken: token, userId: OWNER })}`,
          );
        if (data === '2') socket.send('3');
        if (data.startsWith('40') || data.startsWith('44')) resolve(data);
      });
    });
    return { socket, frames, handshake };
  }

  it('rejects missing and invalid socket tokens even if a user ID is supplied', async () => {
    const [missing, invalid] = await Promise.all([
      connect().handshake,
      connect('bad-token').handshake,
    ]);
    expect(missing).toContain('UNAUTHORIZED');
    expect(invalid).toContain('UNAUTHORIZED');
  });

  it('publishes only after commit and only to the recipient room', async () => {
    const owner = connect('owner');
    const other = connect('other');
    expect(await owner.handshake).toMatch(/^40/);
    expect(await other.handshake).toMatch(/^40/);
    const change = new Promise<void>((resolve) => {
      owner.socket.addEventListener('message', ({ data }) => {
        if (data === '42["notifications:changed"]') resolve();
      });
    });
    const tx = {} as Parameters<NotificationsService['createInTransaction']>[0];
    const result = await service.createInTransaction(tx, ACTION);
    expect(create).toHaveBeenCalledWith(ACTION, tx);
    service.publishCreated(OWNER, result);
    await change;

    // Synchronize with the second socket by sending it a separate event.
    const otherChange = new Promise<void>((resolve) => {
      other.socket.addEventListener('message', ({ data }) => {
        if (data === '42["notifications:changed"]') resolve();
      });
    });
    service.publishCreated(OTHER, { id: ITEM, created: true });
    await otherChange;
    expect(
      owner.frames.filter((frame) => frame === '42["notifications:changed"]'),
    ).toHaveLength(1);
    expect(
      other.frames.filter((frame) => frame === '42["notifications:changed"]'),
    ).toHaveLength(1);
  });

  it('skips self notifications and supports a committed comment event', async () => {
    expect(await service.create({ ...ACTION, actorId: OWNER })).toBeNull();
    expect(create).not.toHaveBeenCalled();
    const tx = {} as Parameters<NotificationsService['createInTransaction']>[0];
    await service.createPostNotificationInTransaction(tx, {
      postId: OTHER,
      authorId: OWNER,
      actorId: OTHER,
      actionId: 'comment-id',
      type: 'post_commented',
    });
    expect(create).toHaveBeenCalledWith(
      {
        ...ACTION,
        type: 'post_commented',
        deduplicationKey: 'comment-id',
        content: 'Có người bình luận về bài viết của bạn.',
      },
      tx,
    );
  });

  it('lists and updates only for the authenticated account', async () => {
    const http = request(app.getHttpServer());
    await http.get('/notifications').expect(401);
    const list = await http
      .get(`/notifications?cursor=${ITEM}&unreadOnly=true`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(listForUser).toHaveBeenCalledWith(OWNER, {
      cursor: ITEM,
      unreadOnly: true,
      limit: 10,
    });
    expect(list.body).toMatchObject({
      success: true,
      data: {
        items: [
          {
            id: ITEM,
            type: 'post_reacted',
            createdAt: new Date(0).toISOString(),
          },
        ],
      },
    });
    await http
      .get('/notifications/unread-count')
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(countUnread).toHaveBeenCalledWith(OWNER);
    await http
      .patch(`/notifications/${ITEM}/read`)
      .set('Authorization', 'Bearer other')
      .expect(404);
    await http
      .patch(`/notifications/${ITEM}/read`)
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(markRead).toHaveBeenCalledWith(OTHER, ITEM);
    expect(markRead).toHaveBeenCalledWith(OWNER, ITEM);
    await http
      .patch('/notifications/read-all')
      .set('Authorization', 'Bearer owner')
      .expect(200);
    expect(markAllRead).toHaveBeenCalledWith(OWNER);
  });
});
