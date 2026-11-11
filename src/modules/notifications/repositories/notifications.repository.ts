/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { Page } from '../../../common/types/page';
import type { UserSummary } from '../../../common/types/user-summary';
import type { DatabaseTransaction } from '../../../database/types/transaction';
import type { ListNotificationsDto } from '../dto/list-notifications.dto';
import type {
  CreatedNotification,
  CreateNotificationInput,
  NotificationTarget,
} from '../types/create-notification.types';

export interface NotificationRecord {
  id: string;
  type: string;
  actor: UserSummary | null;
  content: string;
  target: NotificationTarget | null;
  isRead: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationsRepository {
  create(
    _input: CreateNotificationInput,
    _tx?: DatabaseTransaction,
  ): Promise<CreatedNotification> {
    throw new NotImplementedException(
      'Notification persistence is not implemented.',
    );
  }

  listForUser(
    _userId: string,
    _query: ListNotificationsDto,
  ): Promise<Page<NotificationRecord>> {
    throw new NotImplementedException(
      'Notification pagination is not implemented.',
    );
  }

  countUnread(_userId: string): Promise<number> {
    throw new NotImplementedException('Unread count query is not implemented.');
  }

  markRead(
    _userId: string,
    _id: string,
  ): Promise<NotificationRecord | undefined> {
    throw new NotImplementedException(
      'Notification read persistence is not implemented.',
    );
  }

  markAllRead(_userId: string, _readThrough: Date): Promise<number> {
    throw new NotImplementedException(
      'Bulk read persistence is not implemented.',
    );
  }
}
