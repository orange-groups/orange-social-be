import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth-session.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import type { UnreadCountResponseDto } from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notifications.listForUser(user.sub, query);
  }

  @Get('unread-count')
  async unreadCount(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<UnreadCountResponseDto> {
    return { unreadCount: await this.notifications.countUnread(user.sub) };
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: AccessTokenPayload) {
    return this.notifications.markAllRead(user.sub);
  }

  @Patch(':notificationId/read')
  readOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('notificationId', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.sub, id);
  }
}
