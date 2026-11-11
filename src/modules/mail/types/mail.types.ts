export interface PasswordResetMailInput {
  to: string;
  resetUrl: string;
  requestId: string;
}

export interface TransactionalMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey: string;
}

export interface SentMail {
  providerMessageId: string;
}
