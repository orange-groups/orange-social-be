/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import type { Page } from '../../common/types/page';
import type { CreatePostDto } from './dto/create-post.dto';
import type {
  DeletedPostResponseDto,
  PostResponseDto,
} from './dto/post-response.dto';
import type { LatestPostsPageInput, PostRecord } from './types/post.types';

@Injectable()
export class PostsService {
  createTextPost(
    _userId: string,
    _dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    throw new NotImplementedException('Text post creation is not implemented.');
  }

  getVisiblePost(_viewerId: string, _postId: string): Promise<PostResponseDto> {
    throw new NotImplementedException(
      'Post detail and visibility are not implemented.',
    );
  }

  listVisibleByAuthor(
    _viewerId: string,
    _authorId: string,
    _query: CursorPaginationDto,
  ): Promise<Page<PostResponseDto>> {
    throw new NotImplementedException(
      'Profile post listing is not implemented.',
    );
  }

  deleteOwnPost(
    _userId: string,
    _postId: string,
  ): Promise<DeletedPostResponseDto> {
    throw new NotImplementedException('Post deletion is not implemented.');
  }

  listVisibleByIds(
    _viewerId: string,
    _ids: string[],
  ): Promise<PostResponseDto[]> {
    throw new NotImplementedException('Batch post lookup is not implemented.');
  }

  listLatestVisible(
    _viewerId: string,
    _page: LatestPostsPageInput,
  ): Promise<Page<PostResponseDto>> {
    throw new NotImplementedException(
      'Latest visible posts are not implemented.',
    );
  }

  private toPostResponse(
    _record: PostRecord,
    _viewerId: string,
  ): PostResponseDto {
    throw new NotImplementedException(
      'Post response mapping is not implemented.',
    );
  }
}
