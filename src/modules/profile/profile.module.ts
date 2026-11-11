import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [AuthModule, FriendsModule, MediaModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
