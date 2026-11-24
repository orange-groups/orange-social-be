/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import type { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';
import type { Page } from '../../../common/types/page';
import type { UserSummary } from '../../../common/types/user-summary';
import { DrizzleService } from '../../../database/drizzle.service';
import { friendRequests, friendships, users } from '../../../database/schema';
import type { DatabaseTransaction } from '../../../database/types/transaction';
import type { ListFriendRequestsDto } from '../dto/list-friend-requests.dto';
import { readFriendCursor, toFriendPage } from '../friend-list-pagination';
import type {
  FriendRequestRecord,
  FriendRequestStatus,
  Relationship,
} from '../types/friends.types';

const USER_SUMMARY = {
  id: users.id,
  username: users.username,
  fullName: users.fullName,
  avatarUrl: users.avatarUrl,
};

@Injectable()
export class FriendsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async lockPair(
    tx: DatabaseTransaction,
    a: string,
    b: string,
  ): Promise<boolean> {
    // Lock in the same order so concurrent A→B and B→A submissions serialize.
    const pair = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, [a, b]), isNull(users.deletedAt)))
      .orderBy(asc(users.id))
      .for('no key update');
    return pair.length === 2;
  }

  findPendingPair(
    _tx: DatabaseTransaction,
    _a: string,
    _b: string,
  ): Promise<FriendRequestRecord | undefined> {
    throw new NotImplementedException(
      'Pending pair lookup is not implemented.',
    );
  }

  async findIncomingRequestSender(
    tx: DatabaseTransaction,
    requestId: string,
    receiverId: string,
  ): Promise<string | undefined> {
    const [request] = await tx
      .select({ senderId: friendRequests.senderId })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.id, requestId),
          eq(friendRequests.receiverId, receiverId),
        ),
      )
      .limit(1);
    return request?.senderId;
  }

  async findRequestForUpdate(
    tx: DatabaseTransaction,
    requestId: string,
  ): Promise<FriendRequestRecord | undefined> {
    const [request] = await tx
      .select()
      .from(friendRequests)
      .where(eq(friendRequests.id, requestId))
      .for('update');
    return request;
  }

  async findActiveUserSummary(
    tx: DatabaseTransaction,
    userId: string,
  ): Promise<UserSummary | undefined> {
    const [user] = await tx
      .select(USER_SUMMARY)
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    return user;
  }

  async insertRequest(
    tx: DatabaseTransaction,
    senderId: string,
    receiverId: string,
  ): Promise<FriendRequestRecord | undefined> {
    const [request] = await tx
      .insert(friendRequests)
      .values({ senderId, receiverId })
      .onConflictDoNothing()
      .returning();
    return request;
  }

  async cancelPendingRequest(
    senderId: string,
    requestId: string,
  ): Promise<string | undefined> {
    // Ownership and status are part of the same atomic write.
    const [request] = await this.drizzle.db
      .update(friendRequests)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(friendRequests.id, requestId),
          eq(friendRequests.senderId, senderId),
          eq(friendRequests.status, 'pending'),
        ),
      )
      .returning({ id: friendRequests.id });
    return request?.id;
  }

  async hasSentRequest(senderId: string, requestId: string): Promise<boolean> {
    const [request] = await this.drizzle.db
      .select({ id: friendRequests.id })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.id, requestId),
          eq(friendRequests.senderId, senderId),
        ),
      )
      .limit(1);
    return Boolean(request);
  }

  async transitionRequest(
    tx: DatabaseTransaction,
    id: string,
    expected: FriendRequestStatus,
    next: FriendRequestStatus,
  ): Promise<FriendRequestRecord | undefined> {
    const [request] = await tx
      .update(friendRequests)
      .set({ status: next, updatedAt: new Date() })
      .where(
        and(eq(friendRequests.id, id), eq(friendRequests.status, expected)),
      )
      .returning();
    return request;
  }

  async insertFriendshipPair(
    tx: DatabaseTransaction,
    a: string,
    b: string,
  ): Promise<void> {
    await tx
      .insert(friendships)
      .values([
        { userId: a, friendId: b },
        { userId: b, friendId: a },
      ])
      .onConflictDoNothing();
  }

  deleteFriendshipPair(
    _tx: DatabaseTransaction,
    _a: string,
    _b: string,
  ): Promise<void> {
    throw new NotImplementedException(
      'Friendship deletion is not implemented.',
    );
  }

  async listPendingRequests(
    userId: string,
    { direction, cursor, limit }: ListFriendRequestsDto,
  ): Promise<Page<{ id: string; user: UserSummary; createdAt: Date }>> {
    const boundary = readFriendCursor(cursor, userId, direction);
    const incoming = direction === 'incoming';
    const ownId = incoming
      ? friendRequests.receiverId
      : friendRequests.senderId;
    const otherId = incoming
      ? friendRequests.senderId
      : friendRequests.receiverId;
    const rows = await this.drizzle.db
      .select({
        id: friendRequests.id,
        user: USER_SUMMARY,
        createdAt: friendRequests.createdAt,
        sortId: friendRequests.id,
        // Preserve PostgreSQL microseconds in the cursor, not JS Date precision.
        sortAt: sql<string>`to_char(${friendRequests.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(friendRequests)
      .innerJoin(users, eq(users.id, otherId))
      .where(
        and(
          eq(ownId, userId),
          eq(friendRequests.status, 'pending'),
          isNull(users.deletedAt),
          boundary
            ? sql`(${friendRequests.createdAt}, ${friendRequests.id}) < (${boundary.sortAt}::timestamptz, ${boundary.sortId}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(friendRequests.createdAt), desc(friendRequests.id))
      .limit(limit + 1);
    return toFriendPage(rows, limit, userId, direction, (row) => ({
      id: row.id,
      user: row.user,
      createdAt: row.createdAt,
    }));
  }

  async listFriends(
    userId: string,
    { cursor, limit }: CursorPaginationDto,
  ): Promise<Page<UserSummary & { friendsSince: Date }>> {
    const boundary = readFriendCursor(cursor, userId, 'friends');
    const rows = await this.drizzle.db
      .select({
        ...USER_SUMMARY,
        friendsSince: friendships.createdAt,
        sortId: friendships.friendId,
        sortAt: sql<string>`to_char(${friendships.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.friendId))
      .where(
        and(
          eq(friendships.userId, userId),
          isNull(users.deletedAt),
          boundary
            ? sql`(${friendships.createdAt}, ${friendships.friendId}) < (${boundary.sortAt}::timestamptz, ${boundary.sortId}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(friendships.createdAt), desc(friendships.friendId))
      .limit(limit + 1);
    return toFriendPage(rows, limit, userId, 'friends', (row) => ({
      id: row.id,
      username: row.username,
      fullName: row.fullName,
      avatarUrl: row.avatarUrl,
      friendsSince: row.friendsSince,
    }));
  }

  async getRelationship(
    viewerId: string,
    targetId: string,
    tx?: DatabaseTransaction,
  ): Promise<Relationship> {
    const viewer = viewerId.toLowerCase();
    if (viewer === targetId.toLowerCase()) {
      return { status: 'self', requestId: null };
    }
    const db = tx ?? this.drizzle.db;
    const [friendship] = await db
      .select({ userId: friendships.userId })
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.userId, viewer),
            eq(friendships.friendId, targetId),
          ),
          and(
            eq(friendships.userId, targetId),
            eq(friendships.friendId, viewer),
          ),
        ),
      )
      .limit(1);
    if (friendship) return { status: 'friends', requestId: null };

    const [pending] = await db
      .select({ id: friendRequests.id, senderId: friendRequests.senderId })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.status, 'pending'),
          or(
            and(
              eq(friendRequests.senderId, viewer),
              eq(friendRequests.receiverId, targetId),
            ),
            and(
              eq(friendRequests.senderId, targetId),
              eq(friendRequests.receiverId, viewer),
            ),
          ),
        ),
      )
      .orderBy(asc(friendRequests.createdAt), asc(friendRequests.id))
      .limit(1);
    if (!pending) return { status: 'none', requestId: null };

    return {
      status:
        pending.senderId === viewer ? 'outgoing_request' : 'incoming_request',
      requestId: pending.id,
    };
  }

  async countFriends(
    userId: string,
    tx?: DatabaseTransaction,
  ): Promise<number> {
    const [result] = await (tx ?? this.drizzle.db)
      .select({ count: count() })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.friendId))
      .where(and(eq(friendships.userId, userId), isNull(users.deletedAt)));
    return result.count;
  }

  async getRelationships(
    viewerId: string,
    targetIds: string[],
  ): Promise<Record<string, Relationship>> {
    const viewer = viewerId.toLowerCase();
    const targets = [...new Set(targetIds.map((id) => id.toLowerCase()))];
    const others = targets.filter((id) => id !== viewer);
    const result: Record<string, Relationship> = Object.fromEntries(
      targets.map((id) => [
        id,
        { status: id === viewer ? 'self' : 'none', requestId: null },
      ]),
    );
    if (!others.length) return result;

    const [connections, pending] = await Promise.all([
      this.drizzle.db
        .select({ userId: friendships.userId, friendId: friendships.friendId })
        .from(friendships)
        .where(
          or(
            and(
              eq(friendships.userId, viewer),
              inArray(friendships.friendId, others),
            ),
            and(
              eq(friendships.friendId, viewer),
              inArray(friendships.userId, others),
            ),
          ),
        ),
      this.drizzle.db
        .select({
          id: friendRequests.id,
          senderId: friendRequests.senderId,
          receiverId: friendRequests.receiverId,
        })
        .from(friendRequests)
        .where(
          and(
            eq(friendRequests.status, 'pending'),
            or(
              and(
                eq(friendRequests.senderId, viewer),
                inArray(friendRequests.receiverId, others),
              ),
              and(
                eq(friendRequests.receiverId, viewer),
                inArray(friendRequests.senderId, others),
              ),
            ),
          ),
        )
        .orderBy(asc(friendRequests.createdAt), asc(friendRequests.id)),
    ]);
    for (const row of connections) {
      const other = row.userId === viewer ? row.friendId : row.userId;
      result[other] = { status: 'friends', requestId: null };
    }
    for (const row of pending) {
      const outgoing = row.senderId === viewer;
      const other = outgoing ? row.receiverId : row.senderId;
      if (result[other]?.status === 'none') {
        result[other] = {
          status: outgoing ? 'outgoing_request' : 'incoming_request',
          requestId: row.id,
        };
      }
    }
    return result;
  }
}
