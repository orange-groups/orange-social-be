/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema';
import { FriendsService } from '../friends/friends.service';
import type {
  AvatarResponseDto,
  MyProfileResponseDto,
  ProfileResponseDto,
} from './dto/profile-response.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

const MY_PROFILE_COLUMNS = {
  id: users.id,
  username: users.username,
  fullName: users.fullName,
  avatarUrl: users.avatarUrl,
  coverUrl: users.coverUrl,
  bio: users.bio,
  dateOfBirth: users.dateOfBirth,
  createdAt: users.createdAt,
};

type ProfileRow = Pick<
  typeof users.$inferSelect,
  keyof typeof MY_PROFILE_COLUMNS
>;

function activeProfile(userId: string) {
  return and(eq(users.id, userId), isNull(users.deletedAt));
}

function toMyProfile(
  row: ProfileRow,
  friendCount: number,
): MyProfileResponseDto {
  return {
    ...row,
    dateOfBirth: row.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    createdAt: row.createdAt.toISOString(),
    friendCount,
    relationship: { status: 'self', requestId: null },
  };
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly friends: FriendsService,
  ) {}

  async getMyProfile(userId: string): Promise<MyProfileResponseDto> {
    const [row] = await this.drizzle.db
      .select(MY_PROFILE_COLUMNS)
      .from(users)
      .where(activeProfile(userId))
      .limit(1);
    if (!row) throw new NotFoundException('Không tìm thấy hồ sơ.');
    return toMyProfile(row, await this.friends.countFriends(userId));
  }

  getProfile(_viewerId: string, _userId: string): Promise<ProfileResponseDto> {
    throw new NotImplementedException(
      'Public profile lookup is not implemented.',
    );
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<MyProfileResponseDto> {
    const { fullName, bio, dateOfBirth } = dto;
    if (
      fullName === undefined &&
      bio === undefined &&
      dateOfBirth === undefined
    ) {
      throw new BadRequestException(
        'Cần ít nhất một trường để cập nhật hồ sơ.',
      );
    }

    const trimmedName = fullName?.trim();
    if (trimmedName === '') {
      throw new BadRequestException('Họ tên không được để trống.');
    }

    const now = new Date();
    if (
      dateOfBirth &&
      (dateOfBirth.startsWith('0000-') ||
        dateOfBirth > now.toISOString().slice(0, 10))
    ) {
      throw new BadRequestException('Ngày sinh không hợp lệ.');
    }

    return this.drizzle.db.transaction(async (tx) => {
      const [row] = await tx
        .update(users)
        .set({
          ...(trimmedName !== undefined && { fullName: trimmedName }),
          ...(bio !== undefined && { bio: bio?.trim() || null }),
          ...(dateOfBirth !== undefined && {
            dateOfBirth: dateOfBirth
              ? new Date(`${dateOfBirth}T00:00:00.000Z`)
              : null,
          }),
          updatedAt: now,
        })
        .where(activeProfile(userId))
        .returning(MY_PROFILE_COLUMNS);
      if (!row) throw new NotFoundException('Không tìm thấy hồ sơ.');
      return toMyProfile(row, await this.friends.countFriends(userId, tx));
    });
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
