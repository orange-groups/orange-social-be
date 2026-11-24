import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema';
import { MailService } from '../mail/mail.service';
import { hashPassword } from './password-hash';

const RECOVERY_MESSAGE =
  'Nếu email đã đăng ký, bạn sẽ nhận được link đặt lại mật khẩu.';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly database: DrizzleService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private redisClient(): Redis {
    const url = this.config.get<string>('UPSTASH_REDIS_REST_URL');
    const token = this.config.get<string>('UPSTASH_REDIS_REST_TOKEN');
    if (!url || !token) {
      throw new ServiceUnavailableException(
        'Dịch vụ khôi phục mật khẩu chưa được cấu hình.',
      );
    }
    return new Redis({ url, token });
  }

  private getResetUrl(): URL {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';
    const url = URL.canParse(frontendUrl) ? new URL(frontendUrl) : null;
    if (
      !url ||
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new ServiceUnavailableException(
        'Dịch vụ khôi phục mật khẩu chưa được cấu hình.',
      );
    }
    return new URL('/reset-password', url);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const redis = this.redisClient();
    const resetLink = this.getResetUrl();
    this.mail.assertConfigured();
    const normalizedEmail = email.trim().toLowerCase();
    // Bound email delivery attempts without exposing whether an account exists.
    const emailHash = createHash('sha256')
      .update(normalizedEmail)
      .digest('hex');
    try {
      const allowed = await redis.set(
        `password-reset-request:${emailHash}`,
        '1',
        { nx: true, ex: 60 },
      );
      if (!allowed) return { message: RECOVERY_MESSAGE };
      const [user] = await this.database.db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(
          and(
            sql`lower(${users.email}) = ${normalizedEmail}`,
            isNull(users.deletedAt),
          ),
        )
        .limit(1);
      if (!user) return { message: RECOVERY_MESSAGE };

      const token = randomBytes(32).toString('hex');
      const key = this.tokenKey(token);
      await redis.set(key, user.id, { ex: 900 });
      resetLink.searchParams.set('token', token);
      try {
        await this.mail.sendPasswordReset({
          to: user.email,
          resetUrl: resetLink.toString(),
          requestId: randomUUID(),
        });
      } catch {
        // Do not reveal which email belongs to an account if the provider fails.
        await redis.del(key).catch(() => {
          this.logger.warn(
            'Could not revoke the undelivered password reset token.',
          );
        });
      }
      return { message: RECOVERY_MESSAGE };
    } catch {
      throw new ServiceUnavailableException(
        'Dịch vụ khôi phục mật khẩu tạm thời không khả dụng.',
      );
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const redis = this.redisClient();
    // Hash before consuming the one-time token.
    const passwordHash = await hashPassword(newPassword);
    let userId: string | null;
    try {
      userId = await redis.getdel<string>(this.tokenKey(token));
    } catch {
      throw new ServiceUnavailableException(
        'Dịch vụ khôi phục mật khẩu tạm thời không khả dụng.',
      );
    }
    if (!userId)
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn.');
    const updated = await this.database.db
      .update(users)
      .set({
        passwordHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        refreshTokenHash: null,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id });
    if (!updated.length)
      throw new BadRequestException('Không thể đặt lại mật khẩu.');
    return { message: 'Đặt lại mật khẩu thành công.' };
  }

  private tokenKey(token: string): string {
    return `password-reset:${createHash('sha256').update(token).digest('hex')}`;
  }
}
