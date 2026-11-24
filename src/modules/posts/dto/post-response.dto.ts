import type { UserSummary } from '../../../common/types/user-summary';
import type { PostAttachment, PostPrivacy } from '../types/post.types';

export interface PostResponseDto {
  id: string;
  author: UserSummary;
  content: string | null;
  media: PostAttachment[];
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
