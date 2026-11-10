/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import type { Page } from '../../common/types/page';
import type { DatabaseTransaction } from '../../database/types/transaction';
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
import type { Relationship } from './types/friends.types';

@Injectable()
export class FriendsService {
  sendRequest(
    _senderId: string,
    _receiverId: string,
  ): Promise<FriendRequestResponseDto> {
    throw new NotImplementedException(
      'Sending friend requests is not implemented.',
    );
  }

  listRequests(
    _userId: string,
    _query: ListFriendRequestsDto,
  ): Promise<Page<FriendRequestItemDto>> {
    throw new NotImplementedException(
      'Listing friend requests is not implemented.',
    );
  }

  acceptRequest(
    _userId: string,
    _requestId: string,
  ): Promise<AcceptedFriendRequestDto> {
    throw new NotImplementedException(
      'Accepting friend requests is not implemented.',
    );
  }

  rejectRequest(
    _userId: string,
    _requestId: string,
  ): Promise<RejectedFriendRequestDto> {
    throw new NotImplementedException(
      'Rejecting friend requests is not implemented.',
    );
  }

  cancelRequest(
    _userId: string,
    _requestId: string,
  ): Promise<CancelledFriendRequestDto> {
    throw new NotImplementedException(
      'Cancelling friend requests is not implemented.',
    );
  }

  listFriends(
    _userId: string,
    _query: CursorPaginationDto,
  ): Promise<Page<FriendItemDto>> {
    throw new NotImplementedException('Listing friends is not implemented.');
  }

  removeFriend(_userId: string, _targetId: string): Promise<RemovedFriendDto> {
    throw new NotImplementedException('Removing friends is not implemented.');
  }

  getRelationship(_viewerId: string, _targetId: string): Promise<Relationship> {
    throw new NotImplementedException(
      'Relationship lookup is not implemented.',
    );
  }

  getRelationships(
    _viewerId: string,
    _targetIds: string[],
  ): Promise<Record<string, Relationship>> {
    throw new NotImplementedException(
      'Batch relationship lookup is not implemented.',
    );
  }

  areFriends(
    _a: string,
    _b: string,
    _tx?: DatabaseTransaction,
  ): Promise<boolean> {
    throw new NotImplementedException('Friendship lookup is not implemented.');
  }

  countFriends(_userId: string): Promise<number> {
    throw new NotImplementedException('Friend counting is not implemented.');
  }
}
