import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth-session.service';
import { SearchUsersDto } from './dto/search-users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  search(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: SearchUsersDto,
  ) {
    return this.users.searchUsers(user.sub, query);
  }
}
