import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth-session.service';
import { CompleteProfileImageDto } from './dto/complete-profile-image.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('me')
  getMe(@CurrentUser() user: AccessTokenPayload) {
    return this.profile.getMyProfile(user.sub);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profile.updateProfile(user.sub, dto);
  }

  @Post('me/avatar/complete')
  @HttpCode(200)
  completeAvatar(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CompleteProfileImageDto,
  ) {
    return this.profile.completeAvatarUpload(user.sub, dto.uploadId);
  }

  @Delete('me/avatar')
  deleteAvatar(@CurrentUser() user: AccessTokenPayload) {
    return this.profile.removeAvatar(user.sub);
  }

  @Get(':userId')
  getById(
    @CurrentUser() user: AccessTokenPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.profile.getProfile(user.sub, userId);
  }
}
