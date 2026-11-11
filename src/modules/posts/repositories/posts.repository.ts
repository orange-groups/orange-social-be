/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import type { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';
import type { Page } from '../../../common/types/page';
import type {
  LatestPostsPageInput,
  PostPrivacy,
  PostRecord,
} from '../types/post.types';

@Injectable()
export class PostsRepository {
  buildVisibilityPredicate(_viewerId: string): SQL {
    throw new NotImplementedException(
      'Post visibility SQL is not implemented.',
    );
  }

  insertTextPost(
    _authorId: string,
    _content: string,
    _privacy: PostPrivacy,
  ): Promise<PostRecord> {
    throw new NotImplementedException('Post persistence is not implemented.');
  }

  findVisiblePost(
    _viewerId: string,
    _postId: string,
  ): Promise<PostRecord | undefined> {
    throw new NotImplementedException('Visible post query is not implemented.');
  }

  listVisibleByAuthor(
    _viewerId: string,
    _authorId: string,
    _query: CursorPaginationDto,
  ): Promise<Page<PostRecord>> {
    throw new NotImplementedException('Author post query is not implemented.');
  }

  softDeleteOwnPost(_userId: string, _postId: string): Promise<boolean> {
    throw new NotImplementedException('Post soft deletion is not implemented.');
  }

  listVisibleByIds(_viewerId: string, _ids: string[]): Promise<PostRecord[]> {
    throw new NotImplementedException(
      'Visible post batch query is not implemented.',
    );
  }

  listLatestVisible(
    _viewerId: string,
    _page: LatestPostsPageInput,
  ): Promise<Page<PostRecord>> {
    throw new NotImplementedException('Latest posts query is not implemented.');
  }
}
