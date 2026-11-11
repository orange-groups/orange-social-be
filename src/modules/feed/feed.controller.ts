import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth-session.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedService } from './feed.service';

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload, @Query() query: FeedQueryDto) {
    return this.feed.getFeed(user.sub, query);
  }
}
