import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { AuthModule } from '../auth/auth.module';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [AuthModule, PostsModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
