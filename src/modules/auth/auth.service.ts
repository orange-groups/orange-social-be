import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema';
import { AuthUserDto, RegisterDto } from './dto/register.dto';

export const ACCESS_TOKEN_EXPIRES_IN = '15m';
export const REFRESH_TOKEN_EXPIRES_IN = '1d';
export const REFRESH_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const BCRYPT_SALT_ROUNDS = 10;

export interface RegisterResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const trimmedFullName = dto.fullName.trim();

    const existingUsers = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (existingUsers.length > 0) {
      throw new ConflictException('Email is already registered');
    }

    const username = await this.generateUniqueUsername(normalizedEmail);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const insertedUsers = await this.drizzle.db
      .insert(users)
      .values({
        email: normalizedEmail,
        username,
        passwordHash,
        fullName: trimmedFullName,
      })
      .returning();

    const createdUser = insertedUsers[0];
    if (!createdUser) {
      throw new InternalServerErrorException('Failed to create user account');
    }

    const { accessToken, refreshToken } = await this.issueTokens(
      createdUser.id,
      createdUser.email,
      createdUser.username,
      createdUser.tokenVersion,
    );

    const refreshTokenHash = await this.hashRefreshToken(refreshToken);

    await this.drizzle.db
      .update(users)
      .set({
        refreshTokenHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, createdUser.id));

    return {
      accessToken,
      refreshToken,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        username: createdUser.username,
        fullName: createdUser.fullName,
        avatarUrl: createdUser.avatarUrl,
        isEmailVerified: createdUser.isEmailVerified,
        createdAt: createdUser.createdAt.toISOString(),
      },
    };
  }

  async hashRefreshToken(refreshToken: string): Promise<string> {
    const digest = createHash('sha256').update(refreshToken).digest('hex');
    return bcrypt.hash(digest, BCRYPT_SALT_ROUNDS);
  }

  async issueTokens(
    userId: string,
    email: string,
    username: string,
    tokenVersion: number,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      'orange_dev_access_secret_key';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      'orange_dev_refresh_secret_key';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          username,
          tokenVersion,
        },
        {
          secret: accessSecret,
          expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          tokenVersion,
          type: 'refresh',
        },
        {
          secret: refreshSecret,
          expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    const localPart = email.split('@')[0] ?? 'user';
    const sanitized = localPart
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 36);
    const baseUsername = sanitized.length >= 3 ? sanitized : 'orange_user';

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate =
        attempt === 0
          ? baseUsername
          : `${baseUsername}_${randomBytes(3).toString('hex')}`;

      const existing = await this.drizzle.db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.username}) = ${candidate}`)
        .limit(1);

      if (existing.length === 0) {
        return candidate;
      }
    }

    return `${baseUsername}_${Date.now().toString(36)}`;
  }
}
