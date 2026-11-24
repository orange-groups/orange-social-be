import type { UserSummary } from '../../../common/types/user-summary';

export type PostPrivacy = 'public' | 'friends' | 'only_me';

export interface PostAttachment {
  id: string;
  type: 'image' | 'video';
  url: string;
}

export interface PostRecord {
  id: string;
  author: UserSummary;
  content: string | null;
  privacy: PostPrivacy;
  reactionCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  media: PostAttachment[];
}

export interface LatestPostsPageInput {
  limit: number;
  asOf: Date;
  after?: { createdAt: Date; id: string };
}
