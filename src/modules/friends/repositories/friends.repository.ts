/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';
import type { Page } from '../../../common/types/page';
import type { UserSummary } from '../../../common/types/user-summary';
import type { DatabaseTransaction } from '../../../database/types/transaction';
import type { ListFriendRequestsDto } from '../dto/list-friend-requests.dto';
import type {
  FriendRequestRecord,
  FriendRequestStatus,
  Relationship,
} from '../types/friends.types';

@Injectable()
export class FriendsRepository {
  lockPair(_tx: DatabaseTransaction, _a: string, _b: string): Promise<void> {
    throw new NotImplementedException(
      'Friend pair locking is not implemented.',
    );
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

  findRequestForUpdate(
    _tx: DatabaseTransaction,
    _requestId: string,
  ): Promise<FriendRequestRecord | undefined> {
    throw new NotImplementedException(
      'Friend request locking is not implemented.',
    );
  }

  insertRequest(
    _tx: DatabaseTransaction,
    _senderId: string,
    _receiverId: string,
  ): Promise<FriendRequestRecord> {
    throw new NotImplementedException(
      'Friend request persistence is not implemented.',
    );
  }

  transitionRequest(
    _tx: DatabaseTransaction,
    _id: string,
    _expected: FriendRequestStatus,
    _next: FriendRequestStatus,
  ): Promise<FriendRequestRecord | undefined> {
    throw new NotImplementedException(
      'Friend request transitions are not implemented.',
    );
  }

  insertFriendshipPair(
    _tx: DatabaseTransaction,
    _a: string,
    _b: string,
  ): Promise<void> {
    throw new NotImplementedException(
      'Friendship insertion is not implemented.',
    );
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

  listPendingRequests(
    _userId: string,
    _query: ListFriendRequestsDto,
  ): Promise<Page<{ id: string; user: UserSummary; createdAt: Date }>> {
    throw new NotImplementedException(
      'Friend request pagination is not implemented.',
    );
  }

  listFriends(
    _userId: string,
    _query: CursorPaginationDto,
  ): Promise<Page<UserSummary & { friendsSince: Date }>> {
    throw new NotImplementedException('Friend pagination is not implemented.');
  }

  getRelationship(_viewerId: string, _targetId: string): Promise<Relationship> {
    throw new NotImplementedException(
      'Relationship queries are not implemented.',
    );
  }

  countFriends(_userId: string): Promise<number> {
    throw new NotImplementedException(
      'Friend count queries are not implemented.',
    );
  }
}
