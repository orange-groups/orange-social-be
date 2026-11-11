import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { createTransport } from 'nodemailer';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema';

const RECOVERY_MESSAGE =
  'Nếu email đã đăng ký, bạn sẽ nhận được link đặt lại mật khẩu.';

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly database: DrizzleService,
    private readonly config: ConfigService,
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

  private mailSettings() {
    const host = this.config.get<string>('MAIL_HOST');
    const port = Number(this.config.get<string>('MAIL_PORT') ?? '587');
    const secureValue = this.config.get<string>('MAIL_SECURE');
    const secure =
      secureValue === undefined ? port === 465 : secureValue === 'true';
    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASSWORD');
    const from = this.config.get<string>('MAIL_FROM');
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    if (
      !host ||
      !from ||
      !frontendUrl ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      (secureValue !== undefined &&
        secureValue !== 'true' &&
        secureValue !== 'false') ||
      Boolean(user) !== Boolean(pass)
    ) {
      throw new ServiceUnavailableException(
        'Dịch vụ khôi phục mật khẩu chưa được cấu hình.',
      );
    }
    return {
      transport: createTransport({
        host,
        port,
        secure,
        requireTLS: !secure,
        auth: user && pass ? { user, pass } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
      from,
      frontendUrl,
    };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const redis = this.redisClient();
    const { transport, from, frontendUrl } = this.mailSettings();
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
      const resetLink = new URL('/reset-password', frontendUrl);
      resetLink.searchParams.set('token', token);
      try {
        const result = await transport.sendMail({
          from,
          to: user.email,
          subject: 'Orange Social - Reset Password',
          text: `Bạn đã yêu cầu đặt lại mật khẩu.\n\nTruy cập liên kết: ${resetLink.toString()}\n\nLiên kết hết hạn sau 15 phút.`,
        });
        if (result.rejected.length > 0 || result.accepted.length === 0) {
          throw new Error('Email delivery failed');
        }
      } catch {
        await redis.del(key);
        throw new Error('Email delivery failed');
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
    const passwordHash = await bcrypt.hash(newPassword, 10);
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
