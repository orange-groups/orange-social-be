/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { Page } from '../../common/types/page';
import type { DatabaseTransaction } from '../../database/types/transaction';
import type { ListNotificationsDto } from './dto/list-notifications.dto';
import type {
  MarkAllReadResponseDto,
  MarkReadResponseDto,
  NotificationResponseDto,
} from './dto/notification-response.dto';
import type {
  CreatedNotification,
  CreateNotificationInput,
} from './types/create-notification.types';

@Injectable()
export class NotificationsService {
  create(
    _input: CreateNotificationInput,
    _tx?: DatabaseTransaction,
  ): Promise<CreatedNotification | null> {
    throw new NotImplementedException(
      'Notification creation is not implemented.',
    );
  }

  createInTransaction(
    _tx: DatabaseTransaction,
    _input: CreateNotificationInput,
  ): Promise<CreatedNotification | null> {
    throw new NotImplementedException(
      'Transactional notification creation is not implemented.',
    );
  }

  listForUser(
    _userId: string,
    _query: ListNotificationsDto,
  ): Promise<Page<NotificationResponseDto>> {
    throw new NotImplementedException(
      'Notification listing is not implemented.',
    );
  }

  countUnread(_userId: string): Promise<number> {
    throw new NotImplementedException(
      'Unread notification counting is not implemented.',
    );
  }

  markRead(_userId: string, _id: string): Promise<MarkReadResponseDto> {
    throw new NotImplementedException(
      'Marking notifications read is not implemented.',
    );
  }

  markAllRead(_userId: string): Promise<MarkAllReadResponseDto> {
    throw new NotImplementedException(
      'Marking all notifications read is not implemented.',
    );
  }
}
