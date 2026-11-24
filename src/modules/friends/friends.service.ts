/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import type { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import type { Page } from '../../common/types/page';
import { DrizzleService } from '../../database/drizzle.service';
import type { DatabaseTransaction } from '../../database/types/transaction';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  AcceptedFriendRequestDto,
  CancelledFriendRequestDto,
  FriendItemDto,
  FriendRequestItemDto,
  FriendRequestResponseDto,
  RejectedFriendRequestDto,
  RemovedFriendDto,
} from './dto/friend-response.dto';
import type { ListFriendRequestsDto } from './dto/list-friend-requests.dto';
import { FriendsRepository } from './repositories/friends.repository';
import type { Relationship } from './types/friends.types';

@Injectable()
export class FriendsService {
  constructor(
    private readonly repository: FriendsRepository,
    private readonly drizzle: DrizzleService,
    private readonly notifications: NotificationsService,
  ) {}

  async sendRequest(
    senderId: string,
    receiverId: string,
  ): Promise<FriendRequestResponseDto> {
    if (senderId.toLowerCase() === receiverId.toLowerCase()) {
      throw new BadRequestException('Không thể gửi lời mời cho chính mình.');
    }

    const { request, notification } = await this.drizzle.db.transaction(
      async (tx) => {
        if (!(await this.repository.lockPair(tx, senderId, receiverId))) {
          throw new NotFoundException('Không tìm thấy người dùng.');
        }
        const { status } = await this.repository.getRelationship(
          senderId,
          receiverId,
          tx,
        );
        if (status !== 'none') {
          throw new ConflictException(
            'Hai người đã là bạn hoặc đang có lời mời.',
          );
        }
        const request = await this.repository.insertRequest(
          tx,
          senderId,
          receiverId,
        );
        if (!request) {
          throw new ConflictException('Lời mời kết bạn đã tồn tại.');
        }
        const notification = await this.notifications.createInTransaction(tx, {
          recipientId: request.receiverId,
          actorId: request.senderId,
          type: 'friend_request_received',
          content: 'Bạn có lời mời kết bạn mới.',
          target: { type: 'friend_request', id: request.id },
          deduplicationKey: request.id,
        });
        return { request, notification };
      },
    );
    this.notifications.publishCreated(request.receiverId, notification);
    return {
      ...request,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  async listRequests(
    userId: string,
    query: ListFriendRequestsDto,
  ): Promise<Page<FriendRequestItemDto>> {
    const page = await this.repository.listPendingRequests(userId, query);
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async acceptRequest(
    userId: string,
    requestId: string,
  ): Promise<AcceptedFriendRequestDto> {
    const { friend, notification } = await this.drizzle.db.transaction(
      async (tx) => {
        const senderId = await this.repository.findIncomingRequestSender(
          tx,
          requestId,
          userId,
        );
        if (
          !senderId ||
          !(await this.repository.lockPair(tx, userId, senderId))
        ) {
          throw new NotFoundException('Không tìm thấy lời mời kết bạn.');
        }
        const request = await this.repository.findRequestForUpdate(
          tx,
          requestId,
        );
        if (
          !request ||
          request.receiverId !== userId.toLowerCase() ||
          request.senderId !== senderId
        ) {
          throw new NotFoundException('Không tìm thấy lời mời kết bạn.');
        }
        const friend = await this.repository.findActiveUserSummary(
          tx,
          senderId,
        );
        if (!friend) throw new NotFoundException('Không tìm thấy người dùng.');

        if (request.status === 'accepted') {
          const relationship = await this.repository.getRelationship(
            userId,
            senderId,
            tx,
          );
          if (relationship.status === 'friends')
            return { friend, notification: null };
        }
        if (
          request.status !== 'pending' ||
          !(await this.repository.transitionRequest(
            tx,
            request.id,
            'pending',
            'accepted',
          ))
        ) {
          throw new ConflictException(
            'Lời mời không còn ở trạng thái đang chờ.',
          );
        }
        await this.repository.insertFriendshipPair(tx, userId, senderId);
        const notification = await this.notifications.createInTransaction(tx, {
          recipientId: senderId,
          actorId: userId,
          type: 'friend_request_accepted',
          content: 'Lời mời kết bạn của bạn đã được chấp nhận.',
          target: { type: 'user', id: userId },
          deduplicationKey: request.id,
        });
        return { friend, notification };
      },
    );
    if (notification)
      this.notifications.publishCreated(friend.id, notification);
    return { requestId, status: 'accepted', friend };
  }

  rejectRequest(
    _userId: string,
    _requestId: string,
  ): Promise<RejectedFriendRequestDto> {
    throw new NotImplementedException(
      'Rejecting friend requests is not implemented.',
    );
  }

  async cancelRequest(
    userId: string,
    requestId: string,
  ): Promise<CancelledFriendRequestDto> {
    const id = await this.repository.cancelPendingRequest(userId, requestId);
    if (id) return { requestId: id, status: 'cancelled' };
    if (!(await this.repository.hasSentRequest(userId, requestId))) {
      throw new NotFoundException('Không tìm thấy lời mời đã gửi.');
    }
    throw new ConflictException('Lời mời không còn ở trạng thái đang chờ.');
  }

  async listFriends(
    userId: string,
    query: CursorPaginationDto,
  ): Promise<Page<FriendItemDto>> {
    const page = await this.repository.listFriends(userId, query);
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        friendsSince: item.friendsSince.toISOString(),
      })),
    };
  }

  removeFriend(_userId: string, _targetId: string): Promise<RemovedFriendDto> {
    throw new NotImplementedException('Removing friends is not implemented.');
  }

  getRelationship(viewerId: string, targetId: string): Promise<Relationship> {
    return this.repository.getRelationship(viewerId, targetId);
  }

  getRelationships(
    viewerId: string,
    targetIds: string[],
  ): Promise<Record<string, Relationship>> {
    return this.repository.getRelationships(viewerId, targetIds);
  }

  areFriends(
    _a: string,
    _b: string,
    _tx?: DatabaseTransaction,
  ): Promise<boolean> {
    throw new NotImplementedException('Friendship lookup is not implemented.');
  }

  countFriends(userId: string, tx?: DatabaseTransaction): Promise<number> {
    return this.repository.countFriends(userId, tx);
  }
}
