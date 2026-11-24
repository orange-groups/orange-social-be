import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApi } from '../src/common/configure-http-api';
import { DrizzleService } from '../src/database/drizzle.service';
import type { UserSummary } from '../src/common/types/user-summary';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { FriendsRepository } from '../src/modules/friends/repositories/friends.repository';
import type {
  FriendRequestRecord,
  FriendRequestStatus,
  Relationship,
} from '../src/modules/friends/types/friends.types';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import type {
  CreatedNotification,
  CreateNotificationInput,
} from '../src/modules/notifications/types/create-notification.types';

const SENDER = '00000000-0000-4000-8000-00000000000a';
const RECEIVER = '00000000-0000-4000-8000-00000000000b';
const REQUEST = '00000000-0000-4000-8000-000000000001';
const ROUTE = '/friends/requests';
const NOW = new Date('2026-01-01T00:00:00.000Z');
const PENDING: FriendRequestRecord = {
  id: REQUEST,
  senderId: SENDER,
  receiverId: RECEIVER,
  status: 'pending',
  createdAt: NOW,
  updatedAt: NOW,
};
const FRIEND = {
  id: SENDER,
  username: 'sender',
  fullName: 'Test Sender',
  avatarUrl: null,
};
const NOTIFICATION = { id: 'test-notification', created: true };

describe('Friend request send, cancel and accept', () => {
  let app: INestApplication<App>;
  const tx = {};
  const lockPair = jest.fn<Promise<boolean>, [unknown, string, string]>();
  const getRelationship = jest.fn<
    Promise<Relationship>,
    [string, string, unknown]
  >();
  const insertRequest = jest.fn<
    Promise<FriendRequestRecord | undefined>,
    [unknown, string, string]
  >();
  const cancelPendingRequest = jest.fn<
    Promise<string | undefined>,
    [string, string]
  >();
  const hasSentRequest = jest.fn<Promise<boolean>, [string, string]>();
  const findIncomingRequestSender = jest.fn<
    Promise<string | undefined>,
    [unknown, string, string]
  >();
  const findRequestForUpdate = jest.fn<
    Promise<FriendRequestRecord | undefined>,
    [unknown, string]
  >();
  const findActiveUserSummary = jest.fn<
    Promise<UserSummary | undefined>,
    [unknown, string]
  >();
  const transitionRequest = jest.fn<
    Promise<FriendRequestRecord | undefined>,
    [unknown, string, FriendRequestStatus, FriendRequestStatus]
  >();
  const insertFriendshipPair = jest.fn<
    Promise<void>,
    [unknown, string, string]
  >();
  const createInTransaction = jest.fn<
    Promise<CreatedNotification | null>,
    [unknown, CreateNotificationInput]
  >();
  const publishCreated = jest.fn<void, [string, CreatedNotification | null]>();
  let committed = false;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DrizzleService)
      .useValue({
        db: {
          transaction: async (work: (client: object) => Promise<unknown>) => {
            const result = await work(tx);
            committed = true;
            return result;
          },
        },
      })
      .overrideProvider(AuthSessionService)
      .useValue({
        verifyAccessToken: (token: string) =>
          Promise.resolve({ sub: token === 'recipient' ? RECEIVER : SENDER }),
      })
      .overrideProvider(FriendsRepository)
      .useValue({
        lockPair,
        getRelationship,
        insertRequest,
        cancelPendingRequest,
        hasSentRequest,
        findIncomingRequestSender,
        findRequestForUpdate,
        findActiveUserSummary,
        transitionRequest,
        insertFriendshipPair,
      })
      .overrideProvider(NotificationsService)
      .useValue({ createInTransaction, publishCreated })
      .compile();
    app = module.createNestApplication();
    configureHttpApi(app);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    lockPair.mockResolvedValue(true);
    getRelationship.mockResolvedValue({ status: 'none', requestId: null });
    insertRequest.mockResolvedValue(PENDING);
    cancelPendingRequest.mockResolvedValue(undefined);
    hasSentRequest.mockResolvedValue(false);
    findIncomingRequestSender.mockImplementation((_tx, _id, receiver) =>
      Promise.resolve(receiver === RECEIVER ? SENDER : undefined),
    );
    findRequestForUpdate.mockResolvedValue(PENDING);
    findActiveUserSummary.mockResolvedValue(FRIEND);
    transitionRequest.mockResolvedValue({ ...PENDING, status: 'accepted' });
    insertFriendshipPair.mockResolvedValue(undefined);
    createInTransaction.mockResolvedValue(NOTIFICATION);
    publishCreated.mockImplementation(() => {
      if (!committed) throw new Error('Published before transaction commit.');
    });
    committed = false;
  });

  afterAll(async () => app.close());

  function send(receiverId: string) {
    return request(app.getHttpServer())
      .post(ROUTE)
      .set('Authorization', 'Bearer sender')
      .send({ receiverId });
  }

  function cancel(actor: 'sender' | 'recipient' = 'sender') {
    return request(app.getHttpServer())
      .delete(`${ROUTE}/${REQUEST}`)
      .set('Authorization', `Bearer ${actor}`);
  }

  function accept(actor: 'sender' | 'recipient' = 'recipient') {
    return request(app.getHttpServer())
      .post(`${ROUTE}/${REQUEST}/accept`)
      .set('Authorization', `Bearer ${actor}`);
  }

  it('creates a pending request for the sender from JWT after locking the pair', async () => {
    const response = await send(RECEIVER).expect(201);
    expect(lockPair).toHaveBeenCalledWith(tx, SENDER, RECEIVER);
    expect(getRelationship).toHaveBeenCalledWith(SENDER, RECEIVER, tx);
    expect(insertRequest).toHaveBeenCalledWith(tx, SENDER, RECEIVER);
    expect(createInTransaction).toHaveBeenCalledWith(tx, {
      recipientId: RECEIVER,
      actorId: SENDER,
      type: 'friend_request_received',
      content: 'Bạn có lời mời kết bạn mới.',
      target: { type: 'friend_request', id: REQUEST },
      deduplicationKey: REQUEST,
    });
    expect(publishCreated).toHaveBeenCalledWith(RECEIVER, NOTIFICATION);
    expect(lockPair.mock.invocationCallOrder[0]).toBeLessThan(
      getRelationship.mock.invocationCallOrder[0],
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        id: REQUEST,
        senderId: SENDER,
        receiverId: RECEIVER,
        status: 'pending',
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    });
  });

  it('rejects requests to self and missing or deleted users', async () => {
    await send(SENDER.toUpperCase()).expect(400);
    expect(lockPair).not.toHaveBeenCalled();
    lockPair.mockResolvedValue(false);
    await send(RECEIVER).expect(404);
    expect(insertRequest).not.toHaveBeenCalled();
  });

  it.each<Relationship>([
    { status: 'friends', requestId: null },
    { status: 'outgoing_request', requestId: REQUEST },
    { status: 'incoming_request', requestId: REQUEST },
  ])('rejects an existing relationship: $status', async (relationship) => {
    getRelationship.mockResolvedValue(relationship);
    await send(RECEIVER).expect(409);
    expect(insertRequest).not.toHaveBeenCalled();
  });

  it('maps a conflicting insert to 409', async () => {
    insertRequest.mockResolvedValue(undefined);
    await send(RECEIVER).expect(409);
    expect(createInTransaction).not.toHaveBeenCalled();
  });

  it('allows the sender to cancel a pending request', async () => {
    cancelPendingRequest.mockResolvedValue(REQUEST);
    const response = await cancel().expect(200);
    expect(cancelPendingRequest).toHaveBeenCalledWith(SENDER, REQUEST);
    expect(response.body).toEqual({
      success: true,
      data: { requestId: REQUEST, status: 'cancelled' },
    });
  });

  it('does not reveal an outgoing request to someone other than its sender', async () => {
    await cancel('recipient').expect(404);
    expect(cancelPendingRequest).toHaveBeenCalledWith(RECEIVER, REQUEST);
    expect(hasSentRequest).toHaveBeenCalledWith(RECEIVER, REQUEST);
  });

  it('does not allow withdrawing a request that is no longer pending', async () => {
    hasSentRequest.mockResolvedValue(true);
    await cancel().expect(409);
    expect(hasSentRequest).toHaveBeenCalledWith(SENDER, REQUEST);
  });

  it('accepts a pending request for the recipient and notifies the sender after commit', async () => {
    const response = await accept().expect(200);
    expect(findIncomingRequestSender).toHaveBeenCalledWith(
      tx,
      REQUEST,
      RECEIVER,
    );
    expect(lockPair).toHaveBeenCalledWith(tx, RECEIVER, SENDER);
    expect(lockPair.mock.invocationCallOrder[0]).toBeLessThan(
      findRequestForUpdate.mock.invocationCallOrder[0],
    );
    expect(transitionRequest).toHaveBeenCalledWith(
      tx,
      REQUEST,
      'pending',
      'accepted',
    );
    expect(insertFriendshipPair).toHaveBeenCalledWith(tx, RECEIVER, SENDER);
    expect(createInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        recipientId: SENDER,
        actorId: RECEIVER,
        type: 'friend_request_accepted',
        deduplicationKey: REQUEST,
      }),
    );
    expect(publishCreated).toHaveBeenCalledWith(SENDER, NOTIFICATION);
    expect(response.body).toEqual({
      success: true,
      data: { requestId: REQUEST, status: 'accepted', friend: FRIEND },
    });
  });

  it('does not let the sender accept their own invitation', async () => {
    await accept('sender').expect(404);
    expect(transitionRequest).not.toHaveBeenCalled();
    expect(insertFriendshipPair).not.toHaveBeenCalled();
  });

  it('rejects a withdrawn request without creating friendships or a notification', async () => {
    findRequestForUpdate.mockResolvedValue({ ...PENDING, status: 'cancelled' });
    await accept().expect(409);
    expect(insertFriendshipPair).not.toHaveBeenCalled();
    expect(createInTransaction).not.toHaveBeenCalled();
  });

  it('does not repeat side effects on a retry or recreate a removed friendship', async () => {
    findRequestForUpdate.mockResolvedValue({ ...PENDING, status: 'accepted' });
    getRelationship.mockResolvedValueOnce({
      status: 'friends',
      requestId: null,
    });
    await accept().expect(200);
    await accept().expect(409);
    expect(insertFriendshipPair).not.toHaveBeenCalled();
    expect(publishCreated).not.toHaveBeenCalled();
  });
});
