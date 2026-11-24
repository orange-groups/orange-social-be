import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth-session.service';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { ListFriendRequestsDto } from './dto/list-friend-requests.dto';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Post('requests')
  sendRequest(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateFriendRequestDto,
  ) {
    return this.friends.sendRequest(user.sub, dto.receiverId);
  }

  @Get('requests')
  listRequests(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListFriendRequestsDto,
  ) {
    return this.friends.listRequests(user.sub, query);
  }

  @Post('requests/:requestId/accept')
  @HttpCode(200)
  accept(
    @CurrentUser() user: AccessTokenPayload,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.friends.acceptRequest(user.sub, requestId);
  }

  @Post('requests/:requestId/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() user: AccessTokenPayload,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.friends.rejectRequest(user.sub, requestId);
  }

  @Delete('requests/:requestId')
  cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.friends.cancelRequest(user.sub, requestId);
  }

  @Get()
  listFriends(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: CursorPaginationDto,
  ) {
    return this.friends.listFriends(user.sub, query);
  }

  @Delete(':userId')
  unfriend(
    @CurrentUser() user: AccessTokenPayload,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    return this.friends.removeFriend(user.sub, targetId);
  }
}
