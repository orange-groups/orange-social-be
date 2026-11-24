import { BadRequestException, Injectable } from '@nestjs/common';
import { and, asc, gt, isNull, ne, or, sql } from 'drizzle-orm';
import type { Page } from '../../common/types/page';
import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema';
import { FriendsService } from '../friends/friends.service';
import type { SearchUsersDto } from './dto/search-users.dto';
import type { UserSearchResponseDto } from './dto/user-search-response.dto';
import {
  decodeUserSearchCursor,
  encodeUserSearchCursor,
} from './user-search-cursor';

@Injectable()
export class UsersService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly friends: FriendsService,
  ) {}

  async searchUsers(
    viewerId: string,
    { q, limit, cursor }: SearchUsersDto,
  ): Promise<Page<UserSearchResponseDto>> {
    if (q.includes('\0'))
      throw new BadRequestException('Từ khóa không hợp lệ.');
    const lastId =
      cursor !== undefined
        ? decodeUserSearchCursor(cursor, viewerId, q)
        : undefined;
    const matches = await this.drizzle.db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          ne(users.id, viewerId),
          lastId ? gt(users.id, lastId) : undefined,
          or(
            sql`strpos(lower(${users.fullName}), lower(${q})) > 0`,
            sql`strpos(lower(${users.username}), lower(${q})) > 0`,
          ),
        ),
      )
      .orderBy(asc(users.id))
      .limit(limit + 1);

    const hasMore = matches.length > limit;
    const page = matches.slice(0, limit);
    const relationships = await this.friends.getRelationships(
      viewerId,
      page.map((user) => user.id),
    );
    return {
      items: page.map((user) => ({
        ...user,
        relationship: relationships[user.id],
      })),
      nextCursor: hasMore
        ? encodeUserSearchCursor(viewerId, q, page[page.length - 1].id)
        : null,
      hasMore,
    };
  }
}
