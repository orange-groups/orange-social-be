export type NotificationType =
  'friend_request_received' | 'friend_request_accepted';

export interface NotificationTarget {
  type: 'friend_request' | 'user' | 'post';
  id: string;
}

export interface CreateNotificationInput {
  recipientId: string;
  actorId: string | null;
  type: NotificationType;
  content: string;
  target: NotificationTarget;
  deduplicationKey: string;
}

export interface CreatedNotification {
  id: string;
  created: boolean;
}
