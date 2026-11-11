import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { createTransport } from 'nodemailer';
import { DrizzleService } from '../../database/drizzle.service';
import { PasswordRecoveryService } from './password-recovery.service';

const mockRedis = { set: jest.fn(), del: jest.fn(), getdel: jest.fn() };
const mockSend = jest.fn();
jest.mock('@upstash/redis', () => ({ Redis: jest.fn(() => mockRedis) }));
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSend })),
}));

describe('PasswordRecoveryService', () => {
  const settings: Record<string, string> = {
    UPSTASH_REDIS_REST_URL: 'https://redis.example.invalid',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
    MAIL_HOST: 'smtp.example.invalid',
    MAIL_PORT: '587',
    MAIL_SECURE: 'false',
    MAIL_USER: 'test-user',
    MAIL_PASSWORD: 'test-password',
    MAIL_FROM: 'Orange <test@example.invalid>',
    FRONTEND_URL: 'http://localhost:5173',
  };
  const user = { id: 'user-1', email: 'test@example.invalid' };
  let service: PasswordRecoveryService;
  let limit: jest.Mock;
  let set: jest.Mock;
  let returning: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.getdel.mockResolvedValue(user.id);
    mockSend.mockResolvedValue({ accepted: [user.email], rejected: [] });
    limit = jest.fn().mockResolvedValue([user]);
    returning = jest.fn().mockResolvedValue([{ id: user.id }]);
    set = jest
      .fn()
      .mockReturnValue({ where: jest.fn().mockReturnValue({ returning }) });
    const database = {
      db: {
        select: jest.fn().mockReturnValue({
          from: jest
            .fn()
            .mockReturnValue({ where: jest.fn().mockReturnValue({ limit }) }),
        }),
        update: jest.fn().mockReturnValue({ set }),
      },
    } as unknown as DrizzleService;
    service = new PasswordRecoveryService(database, {
      get: (key: string) => settings[key],
    } as ConfigService);
  });

  it('sends a token link and stores only its digest for 15 minutes', async () => {
    await service.forgotPassword(user.email);
    const calls = mockSend.mock.calls as unknown as [
      { text: string; to: string },
    ][];
    const mail = calls[0][0];
    expect(mail.to).toBe(user.email);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: settings.MAIL_HOST,
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: settings.MAIL_USER, pass: settings.MAIL_PASSWORD },
      }),
    );
    const token = mail.text.match(/token=([a-f0-9]{64})/)?.[1];
    expect(token).toBeDefined();
    if (!token) throw new Error('Expected a reset token in the email');
    const digest = createHash('sha256').update(token).digest('hex');
    expect(mockRedis.set).toHaveBeenCalledWith(
      `password-reset:${digest}`,
      user.id,
      { ex: 900 },
    );
  });

  it('does not send to unknown addresses and returns the same message', async () => {
    const known = await service.forgotPassword(user.email);
    limit.mockResolvedValue([]);
    mockSend.mockClear();
    expect(await service.forgotPassword('unknown@example.invalid')).toEqual(
      known,
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('throttles repeated requests without sending another email', async () => {
    mockRedis.set.mockResolvedValue(null);
    await service.forgotPassword(user.email);
    expect(mockSend).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });

  it('removes the token when delivery fails', async () => {
    mockSend.mockRejectedValue(new Error('SMTP unavailable'));
    await expect(service.forgotPassword(user.email)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockRedis.del).toHaveBeenCalledWith(
      expect.stringMatching(/^password-reset:/),
    );
  });

  it('removes the token when SMTP rejects the recipient', async () => {
    mockSend.mockResolvedValue({ accepted: [], rejected: [user.email] });
    await expect(service.forgotPassword(user.email)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('rejects incomplete SMTP credentials without sending email', async () => {
    const invalid = new PasswordRecoveryService(
      {} as DrizzleService,
      {
        get: (key: string) =>
          key === 'MAIL_PASSWORD' ? undefined : settings[key],
      } as ConfigService,
    );
    await expect(invalid.forgotPassword(user.email)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('fails safely when configuration or Redis is unavailable', async () => {
    const unconfigured = new PasswordRecoveryService(
      {} as DrizzleService,
      { get: () => undefined } as unknown as ConfigService,
    );
    await expect(unconfigured.forgotPassword(user.email)).rejects.toThrow(
      ServiceUnavailableException,
    );
    mockRedis.set.mockRejectedValue(new Error('unavailable'));
    await expect(service.forgotPassword(user.email)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('resets using bcrypt and revokes existing refresh sessions', async () => {
    await service.resetPassword('a'.repeat(64), 'new-password-123');
    const calls = set.mock.calls as unknown as [
      {
        passwordHash: string;
        refreshTokenHash: null;
        tokenVersion: unknown;
      },
    ][];
    const values = calls[0][0];
    expect(await bcrypt.compare('new-password-123', values.passwordHash)).toBe(
      true,
    );
    expect(values.refreshTokenHash).toBeNull();
    expect(values.tokenVersion).toBeDefined();
    expect(mockRedis.getdel).toHaveBeenCalledTimes(1);
  });

  it('rejects expired or already used tokens without updating the password', async () => {
    mockRedis.getdel.mockResolvedValue(null);
    await expect(
      service.resetPassword('a'.repeat(64), 'new-password-123'),
    ).rejects.toThrow(BadRequestException);
    expect(set).not.toHaveBeenCalled();
  });
});
