import type { UserSummary } from '../../../common/types/user-summary';
import type { NotificationTarget } from '../types/create-notification.types';

export interface NotificationResponseDto {
  id: string;
  /** String preserves compatibility with legacy notification types. */
  type: string;
  actor: UserSummary | null;
  content: string;
  target: NotificationTarget | null;
  isRead: boolean;
  createdAt: string;
}

export interface UnreadCountResponseDto {
  unreadCount: number;
}

export interface MarkReadResponseDto extends UnreadCountResponseDto {
  id: string;
  isRead: true;
}

export interface MarkAllReadResponseDto {
  updatedCount: number;
  readThrough: string;
}
