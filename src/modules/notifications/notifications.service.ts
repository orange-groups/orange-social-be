import { Injectable, NotFoundException } from '@nestjs/common';
import type { Page } from '../../common/types/page';
import type { DatabaseTransaction } from '../../database/types/transaction';
import type { ListNotificationsDto } from './dto/list-notifications.dto';
import type {
  MarkAllReadResponseDto,
  MarkReadResponseDto,
  NotificationResponseDto,
} from './dto/notification-response.dto';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './repositories/notifications.repository';
import type {
  CreatedNotification,
  CreateNotificationInput,
} from './types/create-notification.types';

type PostNotificationEvent = {
  postId: string;
  authorId: string;
  actorId: string;
  actionId: string;
  type: 'post_reacted' | 'post_commented';
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(
    input: CreateNotificationInput,
  ): Promise<CreatedNotification | null> {
    if (this.isSelf(input)) return null;
    const result = await this.repository.create(input);
    this.publishCreated(input.recipientId, result);
    return result;
  }

  async createInTransaction(
    tx: DatabaseTransaction,
    input: CreateNotificationInput,
  ): Promise<CreatedNotification | null> {
    if (this.isSelf(input)) return null;
    return this.repository.create(input, tx);
  }

  // The caller owns post visibility, authorization, and the committed action ID.
  createPostNotificationInTransaction(
    tx: DatabaseTransaction,
    event: PostNotificationEvent,
  ) {
    return this.createInTransaction(tx, {
      recipientId: event.authorId,
      actorId: event.actorId,
      type: event.type,
      target: { type: 'post', id: event.postId },
      deduplicationKey: event.actionId,
      content:
        event.type === 'post_reacted'
          ? 'Có người bày tỏ cảm xúc về bài viết của bạn.'
          : 'Có người bình luận về bài viết của bạn.',
    });
  }

  // Transactional producers call this only after the transaction commits.
  publishCreated(recipientId: string, result: CreatedNotification | null) {
    if (result?.created) this.gateway.notifyChanged(recipientId);
  }

  async listForUser(
    userId: string,
    query: ListNotificationsDto,
  ): Promise<Page<NotificationResponseDto>> {
    const page = await this.repository.listForUser(userId, query);
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  countUnread(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
  }

  async markRead(userId: string, id: string): Promise<MarkReadResponseDto> {
    const result = await this.repository.markRead(userId, id);
    if (!result) throw new NotFoundException('Không tìm thấy thông báo.');
    this.gateway.notifyChanged(userId);
    return result;
  }

  async markAllRead(userId: string): Promise<MarkAllReadResponseDto> {
    const result = await this.repository.markAllRead(userId);
    if (result.updatedCount > 0) this.gateway.notifyChanged(userId);
    return result;
  }

  private isSelf(input: CreateNotificationInput) {
    return input.actorId?.toLowerCase() === input.recipientId.toLowerCase();
  }
}
