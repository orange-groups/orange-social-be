import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

import { AuthService } from './auth.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { AuthUserDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password-hash';
import {
  SessionUserRecord,
  UserSessionRepository,
} from './repositories/user-session.repository';

/** Payloads signed by AuthService.issueTokens (shared with /auth/regis). */
export type AccessTokenPayload = {
  sub: string;
  email: string;
  username: string;
  tokenVersion: number;
};
type RefreshTokenPayload = { sub: string; tokenVersion: number; type: string };

export type SessionResult = {
  accessToken: string;
  /** Goes into the httpOnly cookie, never into the JSON body. */
  refreshToken: string;
  user: AuthUserDto;
};

const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không đúng.';
const SESSION_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';

@Injectable()
export class AuthSessionService implements OnModuleInit {
  /** Keep password verification work for missing accounts and legacy hashes. */
  private dummyPasswordHash = '';

  constructor(
    private readonly authService: AuthService,
    private readonly repository: UserSessionRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await hashPassword('timing-equalizer');
  }

  async login(email: string, password: string): Promise<SessionResult> {
    const user = await this.repository.findByEmail(email);
    const hash = user?.passwordHash ?? this.dummyPasswordHash;
    const [isPasswordValid] = await Promise.all([
      verifyPassword(password, hash),
      hash.startsWith('$2')
        ? verifyPassword(password, this.dummyPasswordHash)
        : undefined,
    ]);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const session = await this.issueSession(user);
    await this.repository.setRefreshTokenHash(
      user.id,
      await this.authService.hashRefreshToken(session.refreshToken),
    );
    return session;
  }

  /** Exchanges a valid refresh cookie for a new token pair (the old one stops working). */
  async refresh(refreshToken: string | undefined): Promise<SessionResult> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.repository.findById(payload.sub);

    if (
      !refreshToken ||
      !user?.refreshTokenHash ||
      user.tokenVersion !== payload.tokenVersion ||
      !(await this.matchesStoredHash(refreshToken, user.refreshTokenHash))
    ) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const session = await this.issueSession(user);
    const isRotated = await this.repository.rotateRefreshTokenHash(
      user.id,
      user.refreshTokenHash,
      await this.authService.hashRefreshToken(session.refreshToken),
    );
    if (!isRotated) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    return session;
  }

  /** Invalidates the refresh token in the database. Safe to call without a cookie. */
  async logout(refreshToken: string | undefined): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken).catch(
      () => null,
    );
    if (!payload || !refreshToken) return;

    const user = await this.repository.findById(payload.sub);
    if (
      user?.refreshTokenHash &&
      (await this.matchesStoredHash(refreshToken, user.refreshTokenHash))
    ) {
      await this.repository.setRefreshTokenHash(user.id, null);
    }
  }

  async getCurrentUser(userId: string): Promise<AuthUserDto> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản.');
    }
    return toAuthUser(user);
  }

  async changePassword(
    session: AccessTokenPayload,
    { currentPassword, newPassword }: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.repository.findById(session.sub);
    if (!user || user.tokenVersion !== session.tokenVersion) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new ForbiddenException('Mật khẩu hiện tại không đúng.');
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException(
        'Mật khẩu mới phải khác mật khẩu hiện tại.',
      );
    }

    const nextHash = await hashPassword(newPassword);
    const didUpdate = await this.repository.replacePassword(user, nextHash);
    if (!didUpdate) {
      throw new ConflictException(
        'Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.',
      );
    }
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Access token không hợp lệ hoặc đã hết hạn.',
      );
    }
    // Database connectivity failures are not invalid credentials.
    const user = await this.repository.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    return payload;
  }

  private async verifyRefreshToken(
    token: string | undefined,
  ): Promise<RefreshTokenPayload> {
    if (!token) throw new UnauthorizedException(SESSION_EXPIRED);
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        { secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET') },
      );
      if (payload.type !== 'refresh') throw new Error('Not a refresh token');
      return payload;
    } catch {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
  }

  /** Same format as AuthService.hashRefreshToken: bcrypt(sha256(token)). */
  private matchesStoredHash(
    token: string,
    storedHash: string,
  ): Promise<boolean> {
    const digest = createHash('sha256').update(token).digest('hex');
    return bcrypt.compare(digest, storedHash).catch(() => false);
  }

  private async issueSession(user: SessionUserRecord): Promise<SessionResult> {
    const { accessToken, refreshToken } = await this.authService.issueTokens(
      user.id,
      user.email,
      user.username,
      user.tokenVersion,
    );
    return { accessToken, refreshToken, user: toAuthUser(user) };
  }
}

/** Same user shape as the /auth/regis response; never includes hashes. */
function toAuthUser(user: SessionUserRecord): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}
