/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';
import type { Page } from '../../../common/types/page';
import { DrizzleService } from '../../../database/drizzle.service';
import { postMedia, posts, users } from '../../../database/schema';
import type {
  LatestPostsPageInput,
  PostAttachment,
  PostRecord,
} from '../types/post.types';

const AUTHOR_COLUMNS = {
  id: users.id,
  username: users.username,
  fullName: users.fullName,
  avatarUrl: users.avatarUrl,
};

const MEDIA_COLUMNS = {
  id: postMedia.id,
  type: postMedia.type,
  url: postMedia.url,
};

type NewPostMedia = Pick<
  typeof postMedia.$inferInsert,
  'type' | 'url' | 'storageKey'
>;

@Injectable()
export class PostsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  buildVisibilityPredicate(_viewerId: string): SQL {
    throw new NotImplementedException(
      'Post visibility SQL is not implemented.',
    );
  }

  async insertPost(
    authorId: string,
    content: string | null,
    files: NewPostMedia[],
  ): Promise<PostRecord> {
    return this.drizzle.db.transaction(async (tx) => {
      const [author] = await tx
        .select(AUTHOR_COLUMNS)
        .from(users)
        .where(and(eq(users.id, authorId), isNull(users.deletedAt)))
        .for('share');
      if (!author) throw new NotFoundException('Không tìm thấy tác giả.');

      const [post] = await tx
        .insert(posts)
        .values({ authorId, content, privacy: 'public' })
        .returning();
      const media = files.length
        ? await tx
            .insert(postMedia)
            .values(
              files.map((file, position) => ({
                ...file,
                postId: post.id,
                position,
              })),
            )
            .returning({ ...MEDIA_COLUMNS, position: postMedia.position })
        : [];
      return {
        ...post,
        author,
        media: media
          .sort((a, b) => a.position - b.position)
          .map(({ id, type, url }) => ({ id, type, url })),
      };
    });
  }

  listOwnPosts(
    userId: string,
    query: CursorPaginationDto,
  ): Promise<Page<PostRecord>> {
    return this.listAuthorPosts(userId, query, 'own');
  }

  async listPublicByAuthor(
    authorId: string,
    query: CursorPaginationDto,
  ): Promise<Page<PostRecord>> {
    const [author] = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, authorId), isNull(users.deletedAt)))
      .limit(1);
    if (!author) throw new NotFoundException('Không tìm thấy tác giả.');

    return this.listAuthorPosts(authorId, query, 'public');
  }

  private async listAuthorPosts(
    authorId: string,
    { limit, cursor }: CursorPaginationDto,
    scope: 'own' | 'public',
  ): Promise<Page<PostRecord>> {
    const anchor = alias(posts, 'anchor');
    const anchorFilter = cursor
      ? and(
          eq(anchor.id, cursor),
          eq(anchor.authorId, authorId),
          isNull(anchor.groupId),
          scope === 'public' ? eq(anchor.privacy, 'public') : undefined,
        )
      : undefined;
    const rows = await this.drizzle.db
      .select({ post: posts, author: AUTHOR_COLUMNS })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(
        and(
          eq(posts.authorId, authorId),
          isNull(posts.groupId),
          isNull(posts.deletedAt),
          isNull(users.deletedAt),
          scope === 'public' ? eq(posts.privacy, 'public') : undefined,
          anchorFilter
            ? sql`(${posts.createdAt}, ${posts.id}) < (
                select ${anchor.createdAt}, ${anchor.id} from ${posts} as ${sql.identifier('anchor')}
                where ${anchorFilter}
              )`
            : undefined,
        ),
      )
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const attachments = page.length
      ? await this.drizzle.db
          .select({ ...MEDIA_COLUMNS, postId: postMedia.postId })
          .from(postMedia)
          .where(
            inArray(
              postMedia.postId,
              page.map(({ post }) => post.id),
            ),
          )
          .orderBy(asc(postMedia.position))
      : [];
    const byPost = new Map<string, PostAttachment[]>();
    for (const { postId, ...media } of attachments) {
      const items = byPost.get(postId) ?? [];
      items.push(media);
      byPost.set(postId, items);
    }
    const hasMore = rows.length > limit;
    return {
      items: page.map(({ post, author }) => ({
        ...post,
        author,
        media: byPost.get(post.id) ?? [],
      })),
      hasMore,
      nextCursor: hasMore ? (page.at(-1)?.post.id ?? null) : null,
    };
  }

  findVisiblePost(
    _viewerId: string,
    _postId: string,
  ): Promise<PostRecord | undefined> {
    throw new NotImplementedException('Visible post query is not implemented.');
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
