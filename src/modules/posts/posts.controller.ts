import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth-session.service';
import { MAX_POST_FILES, MAX_POST_MEDIA_BYTES } from '../media/media.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListOwnPostsDto, ListPostsDto } from './dto/list-posts.dto';
import { PostsService } from './posts.service';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_POST_FILES, {
      limits: {
        fileSize: MAX_POST_MEDIA_BYTES + 1,
        files: MAX_POST_FILES,
        fields: 1,
        fieldSize: 24 * 1024,
        parts: MAX_POST_FILES + 2,
      },
    }),
  )
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files?: { buffer: Buffer }[],
  ) {
    return this.posts.createPost(
      user.sub,
      dto,
      files?.map(({ buffer }) => buffer) ?? [],
    );
  }

  @Get('me')
  listMine(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListOwnPostsDto,
  ) {
    return this.posts.listOwnPosts(user.sub, query);
  }

  @Get()
  listByAuthor(@Query() query: ListPostsDto) {
    return this.posts.listPublicByAuthor(query.authorId, query);
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
