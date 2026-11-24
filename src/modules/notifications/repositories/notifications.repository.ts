import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { isUUID } from 'class-validator';
import type { Page } from '../../../common/types/page';
import type { UserSummary } from '../../../common/types/user-summary';
import { DrizzleService } from '../../../database/drizzle.service';
import { notifications, users } from '../../../database/schema';
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

const TARGET_PATHS = {
  friend_request: '/friends?requestId=',
  user: '/profile/',
  post: '/posts/',
};

function parseTarget(link: string | null): NotificationTarget | null {
  if (!link) return null;
  for (const type of ['friend_request', 'user', 'post'] as const) {
    const prefix = TARGET_PATHS[type];
    if (link.startsWith(prefix)) {
      const id = link.slice(prefix.length);
      return isUUID(id) ? { type, id } : null;
    }
  }
  return null;
}

function notificationId({
  recipientId,
  type,
  deduplicationKey,
}: CreateNotificationInput) {
  // UUIDv8: deterministic per action, with the existing primary key enforcing uniqueness.
  const digest = createHash('sha256')
    .update(
      JSON.stringify([
        'notification',
        recipientId.toLowerCase(),
        type,
        deduplicationKey,
      ]),
    )
    .digest('hex');
  const variant = ((parseInt(digest[16], 16) & 3) | 8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(
    input: CreateNotificationInput,
    tx?: DatabaseTransaction,
  ): Promise<CreatedNotification> {
    const id = notificationId(input);
    const [inserted] = await (tx ?? this.drizzle.db)
      .insert(notifications)
      .values({
        id,
        recipientId: input.recipientId,
        actorId: input.actorId,
        type: input.type,
        content: input.content,
        link: `${TARGET_PATHS[input.target.type]}${input.target.id}`,
      })
      .onConflictDoNothing({ target: notifications.id })
      .returning({ id: notifications.id });
    return { id, created: !!inserted };
  }

  async listForUser(
    userId: string,
    { limit, cursor, unreadOnly }: ListNotificationsDto,
  ): Promise<Page<NotificationRecord>> {
    const anchor = alias(notifications, 'anchor');
    const rows = await this.drizzle.db
      .select({
        id: notifications.id,
        type: notifications.type,
        content: notifications.content,
        link: notifications.link,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        actor: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(notifications)
      .leftJoin(
        users,
        and(eq(users.id, notifications.actorId), isNull(users.deletedAt)),
      )
      .where(
        and(
          eq(notifications.recipientId, userId),
          unreadOnly ? eq(notifications.isRead, false) : undefined,
          cursor
            ? sql`(${notifications.createdAt}, ${notifications.id}) < (
          select ${anchor.createdAt}, ${anchor.id} from ${notifications} as ${sql.identifier('anchor')}
          where ${anchor.id} = ${cursor} and ${anchor.recipientId} = ${userId}
        )`
            : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const items = rows
      .slice(0, limit)
      .map(({ link, ...row }) => ({ ...row, target: parseTarget(link) }));
    return {
      items,
      hasMore,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async countUnread(userId: string, tx?: DatabaseTransaction): Promise<number> {
    const [row] = await (tx ?? this.drizzle.db)
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false),
        ),
      );
    return row.value;
  }

  async markRead(userId: string, id: string) {
    return this.drizzle.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(eq(notifications.id, id), eq(notifications.recipientId, userId)),
        )
        .returning({ id: notifications.id });
      if (!updated) return undefined;
      return {
        id: updated.id,
        isRead: true as const,
        unreadCount: await this.countUnread(userId, tx),
      };
    });
  }

  async markAllRead(userId: string) {
    return this.drizzle.db.transaction(async (tx) => {
      const [clock] = await tx.execute<{ readThrough: string }>(
        sql`select transaction_timestamp()::text as "readThrough"`,
      );
      const updates = await tx
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.recipientId, userId),
            eq(notifications.isRead, false),
            sql`${notifications.createdAt} <= transaction_timestamp()`,
          ),
        );
      return {
        updatedCount: updates.count,
        readThrough: new Date(clock.readThrough).toISOString(),
      };
    });
  }
}
