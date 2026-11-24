import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PasswordResetMailInput,
  SentMail,
  TransactionalMailInput,
} from './types/mail.types';

const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 5_000;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  assertConfigured(): void {
    this.getSettings();
  }

  sendPasswordReset(input: PasswordResetMailInput): Promise<SentMail> {
    return this.sendTransactionalEmail({
      to: input.to,
      subject: 'Orange Social - Đặt lại mật khẩu',
      text: `Bạn đã yêu cầu đặt lại mật khẩu.\n\nTruy cập liên kết: ${input.resetUrl}\n\nLiên kết hết hạn sau 15 phút. Nếu bạn không gửi yêu cầu này, hãy bỏ qua email.`,
      idempotencyKey: `password-reset/${input.requestId}`,
    });
  }

  private getSettings() {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const from = this.config.get<string>('MAIL_FROM')?.trim();
    if (!apiKey || !from) {
      throw new ServiceUnavailableException(
        'Dịch vụ email chưa được cấu hình.',
      );
    }
    return { apiKey, from };
  }

  private async sendTransactionalEmail({
    idempotencyKey,
    ...email
  }: TransactionalMailInput): Promise<SentMail> {
    const { apiKey, from } = this.getSettings();
    let status: number | undefined;
    try {
      const response = await fetch(RESEND_URL, {
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ from, ...email }),
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      });
      status = response.status;
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error('Resend rejected the email.');
      }

      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== 'object' ||
        !('id' in result) ||
        typeof result.id !== 'string' ||
        !result.id.trim()
      ) {
        throw new Error('Resend did not return a message ID.');
      }
      return { providerMessageId: result.id };
    } catch {
      this.logger.warn(
        `Resend email delivery failed (${status ?? 'network error'}).`,
      );
      throw new ServiceUnavailableException('Không gửi được email.');
    }
  }
}
