import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { Page } from '../../common/types/page';
import type { AccessTokenPayload } from '../auth/auth-session.service';
import { SearchUsersDto } from './dto/search-users.dto';
import type { UserSearchResponseDto } from './dto/user-search-response.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  search(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: SearchUsersDto,
  ): Promise<Page<UserSearchResponseDto>> {
    return this.users.searchUsers(user.sub, query);
  }
}
