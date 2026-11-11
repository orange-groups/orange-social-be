export interface Relationship {
  status: 'self' | 'none' | 'outgoing_request' | 'incoming_request' | 'friends';
  requestId: string | null;
}

export type FriendRequestStatus =
  'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface FriendRequestRecord {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}
