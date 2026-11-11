import type { UserSummary } from '../../../common/types/user-summary';
import type { Relationship } from '../../friends/types/friends.types';

export interface ProfileResponseDto extends UserSummary {
  bio: string | null;
  coverUrl: string | null;
  friendCount: number;
  relationship: Relationship;
  createdAt: string;
}

export interface MyProfileResponseDto extends ProfileResponseDto {
  dateOfBirth: string | null;
}

export interface AvatarResponseDto {
  avatarUrl: string | null;
}
