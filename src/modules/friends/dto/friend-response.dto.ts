import type { UserSummary } from '../../../common/types/user-summary';
import type { FriendRequestStatus } from '../types/friends.types';

export interface FriendRequestResponseDto {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FriendRequestItemDto {
  id: string;
  user: UserSummary;
  createdAt: string;
}

export interface FriendItemDto extends UserSummary {
  friendsSince: string;
}

export interface AcceptedFriendRequestDto {
  requestId: string;
  status: 'accepted';
  friend: UserSummary;
}

export interface RejectedFriendRequestDto {
  requestId: string;
  status: 'rejected';
}

export interface CancelledFriendRequestDto {
  requestId: string;
  status: 'cancelled';
}

export interface RemovedFriendDto {
  userId: string;
  relationship: 'none';
}
