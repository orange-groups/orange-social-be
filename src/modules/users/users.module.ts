import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [AuthModule, FriendsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
