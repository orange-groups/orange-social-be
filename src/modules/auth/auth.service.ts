
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { Resend } from 'resend';
import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import * as argon2 from 'argon2';

import { DatabaseService } from '../../database/database.service';
import { users } from '../../database/schema';

@Injectable()
export class AuthService {
  private readonly redis: Redis;
  private readonly resend: Resend;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis({
      url: this.configService.getOrThrow<string>(
        'UPSTASH_REDIS_REST_URL',
      ),
      token: this.configService.getOrThrow<string>(
        'UPSTASH_REDIS_REST_TOKEN',
      ),
    });

    this.resend = new Resend(
      this.configService.getOrThrow<string>(
        'RESEND_API_KEY',
      ),
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  async forgotPassword(email: string) {
    const message =
      'Nếu email đã đăng ký, bạn sẽ nhận được link đặt lại mật khẩu.';

    const normalizedEmail = email.trim().toLowerCase();

    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(
        sql`lower(${users.email}) = ${normalizedEmail}
            AND ${users.deletedAt} IS NULL`,
      )
      .limit(1);

    // Giữ cùng một thông báo dù email không tồn tại.
    if (!user) {
      return { message };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    const redisKey = `password-reset:${tokenHash}`;

    // Token tồn tại trong 15 phút.
    await this.redis.set(redisKey, user.id, {
      ex: 900,
    });

    const frontendUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');

    const resetLink =
      `${frontendUrl}/reset-password?token=${token}`;

    try {
      const result = await this.resend.emails.send({
        from: this.configService.getOrThrow<string>(
          'MAIL_FROM',
        ),
        to: user.email,
        subject: 'Orange Social - Reset Password',
        text:
          `Bạn đã yêu cầu đặt lại mật khẩu.\n\n` +
          `Truy cập liên kết: ${resetLink}\n\n` +
          `Liên kết hết hạn sau 15 phút.`,
      });

      if (result.error) {
        throw new Error('Email delivery failed');
      }
    } catch {
      await this.redis.del(redisKey);

      throw new ServiceUnavailableException(
        'Dịch vụ gửi email tạm thời không khả dụng.',
      );
    }

    return { message };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ) {
    const tokenHash = this.hashToken(token);
    const redisKey = `password-reset:${tokenHash}`;

    // GETDEL lấy và xóa token trong một thao tác Redis.
    const userId =
      await this.redis.getdel<string>(redisKey);

    if (!userId) {
      throw new BadRequestException(
        'Token không hợp lệ hoặc đã hết hạn.',
      );
    }

    const passwordHash = await argon2.hash(newPassword);

    const updated = await this.databaseService.db
      .update(users)
      .set({
        passwordHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(
        sql`${users.id} = ${userId}
            AND ${users.deletedAt} IS NULL`,
      )
      .returning({ id: users.id });

    if (updated.length === 0) {
      throw new BadRequestException(
        'Không thể đặt lại mật khẩu.',
      );
    }

    return {
      message: 'Đặt lại mật khẩu thành công.',
    };
  }
}
