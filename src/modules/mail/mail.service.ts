/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- Skeleton signatures intentionally retain unused parameters. */
import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  PasswordResetMailInput,
  SentMail,
  TransactionalMailInput,
} from './types/mail.types';

/** Skeleton only. Existing SMTP recovery does not use this provider yet. */
@Injectable()
export class MailService {
  sendPasswordReset(_input: PasswordResetMailInput): Promise<SentMail> {
    throw new NotImplementedException(
      'Resend password reset email is not implemented.',
    );
  }

  private sendTransactionalEmail(
    _input: TransactionalMailInput,
  ): Promise<SentMail> {
    throw new NotImplementedException('Resend delivery is not implemented.');
  }
}
