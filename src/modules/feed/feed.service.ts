/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { Page } from '../../common/types/page';
import type { PostResponseDto } from '../posts/dto/post-response.dto';
import type { FeedQueryDto } from './dto/feed-query.dto';

@Injectable()
export class FeedService {
  getFeed(
    _viewerId: string,
    _query: FeedQueryDto,
  ): Promise<Page<PostResponseDto>> {
    throw new NotImplementedException('Feed orchestration is not implemented.');
  }

  private getRecommendedPage(
    _viewerId: string,
    _query: FeedQueryDto,
  ): Promise<Page<PostResponseDto>> {
    throw new NotImplementedException('Recommended feed is not implemented.');
  }

  private getLatestPage(
    _viewerId: string,
    _query: FeedQueryDto,
  ): Promise<Page<PostResponseDto>> {
    throw new NotImplementedException(
      'Latest feed fallback is not implemented.',
    );
  }
}
