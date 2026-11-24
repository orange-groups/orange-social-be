/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import {
  BadRequestException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import type { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import type { Page } from '../../common/types/page';
import { MediaService } from '../media/media.service';
import type { CreatePostDto } from './dto/create-post.dto';
import type {
  DeletedPostResponseDto,
  PostResponseDto,
} from './dto/post-response.dto';
import { PostsRepository } from './repositories/posts.repository';
import type { LatestPostsPageInput, PostRecord } from './types/post.types';

@Injectable()
export class PostsService {
  constructor(
    private readonly repository: PostsRepository,
    private readonly media: MediaService,
  ) {}

  async createPost(
    userId: string,
    dto: CreatePostDto,
    files: Buffer[],
  ): Promise<PostResponseDto> {
    const content = dto.content?.trim() || null;
    if (!content && !files.length) {
      throw new BadRequestException(
        'Vui lòng nhập nội dung hoặc đính kèm tệp.',
      );
    }
    const media = await this.media.uploadPostMedia(userId, files);
    return this.toPostResponse(
      await this.repository.insertPost(userId, content, media),
    );
  }

  async listOwnPosts(
    userId: string,
    query: CursorPaginationDto,
  ): Promise<Page<PostResponseDto>> {
    const page = await this.repository.listOwnPosts(userId, query);
    return {
      ...page,
      items: page.items.map((post) => this.toPostResponse(post)),
    };
  }

  getVisiblePost(_viewerId: string, _postId: string): Promise<PostResponseDto> {
    throw new NotImplementedException(
      'Post detail and visibility are not implemented.',
    );
  }

  async listPublicByAuthor(
    authorId: string,
    query: CursorPaginationDto,
  ): Promise<Page<PostResponseDto>> {
    const page = await this.repository.listPublicByAuthor(authorId, query);
    return {
      ...page,
      items: page.items.map((post) => this.toPostResponse(post)),
    };
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

  private toPostResponse(record: PostRecord): PostResponseDto {
    return {
      id: record.id,
      author: record.author,
      content: record.content,
      media: record.media,
      privacy: record.privacy,
      reactionCount: record.reactionCount,
      commentCount: record.commentCount,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      permissions: { canEdit: false, canDelete: false },
    };
  }
}
