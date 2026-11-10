import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth-session.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { PostsService } from './posts.service';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreatePostDto) {
    return this.posts.createTextPost(user.sub, dto);
  }

  @Get()
  listByAuthor(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListPostsDto,
  ) {
    return this.posts.listVisibleByAuthor(user.sub, query.authorId, query);
  }

  @Get(':postId')
  getOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.posts.getVisiblePost(user.sub, postId);
  }

  @Delete(':postId')
  remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.posts.deleteOwnPost(user.sub, postId);
  }
}
