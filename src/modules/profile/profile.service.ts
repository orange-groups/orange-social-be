/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  AvatarResponseDto,
  MyProfileResponseDto,
  ProfileResponseDto,
} from './dto/profile-response.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  getMyProfile(_userId: string): Promise<MyProfileResponseDto> {
    throw new NotImplementedException('Own profile lookup is not implemented.');
  }

  getProfile(_viewerId: string, _userId: string): Promise<ProfileResponseDto> {
    throw new NotImplementedException(
      'Public profile lookup is not implemented.',
    );
  }

  updateProfile(
    _userId: string,
    _dto: UpdateProfileDto,
  ): Promise<MyProfileResponseDto> {
    throw new NotImplementedException('Profile updates are not implemented.');
  }

  completeAvatarUpload(
    _userId: string,
    _uploadId: string,
  ): Promise<AvatarResponseDto> {
    throw new NotImplementedException('Avatar completion is not implemented.');
  }

  removeAvatar(_userId: string): Promise<AvatarResponseDto> {
    throw new NotImplementedException('Avatar removal is not implemented.');
  }
}
