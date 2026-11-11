import type { UserSummary } from '../../../common/types/user-summary';
import type { PostPrivacy } from '../types/post.types';

export interface PostResponseDto {
  id: string;
  author: UserSummary;
  content: string | null;
  privacy: PostPrivacy;
  reactionCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  permissions: { canEdit: boolean; canDelete: boolean };
}

export interface DeletedPostResponseDto {
  id: string;
  deleted: true;
}
