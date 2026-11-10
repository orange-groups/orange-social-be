/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { Page } from '../../common/types/page';
import type { SearchUsersDto } from './dto/search-users.dto';
import type { UserSearchResponseDto } from './dto/user-search-response.dto';

@Injectable()
export class UsersService {
  searchUsers(
    _viewerId: string,
    _query: SearchUsersDto,
  ): Promise<Page<UserSearchResponseDto>> {
    throw new NotImplementedException('User search is not implemented.');
  }
}
