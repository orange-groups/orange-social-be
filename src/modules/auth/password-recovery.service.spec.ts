import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DrizzleService } from '../../database/drizzle.service';
import { MailService } from '../mail/mail.service';
import type {
  PasswordResetMailInput,
  SentMail,
} from '../mail/types/mail.types';
import { PasswordRecoveryService } from './password-recovery.service';
import { verifyPassword } from './password-hash';

const mockRedis = { set: jest.fn(), del: jest.fn(), getdel: jest.fn() };
const mockSend = jest.fn<Promise<SentMail>, [PasswordResetMailInput]>();
jest.mock('@upstash/redis', () => ({ Redis: jest.fn(() => mockRedis) }));

describe('PasswordRecoveryService', () => {
  const settings: Record<string, string> = {
    UPSTASH_REDIS_REST_URL: 'https://redis.example.invalid',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
    FRONTEND_URL: 'http://localhost:5173',
  };
  const user = { id: 'user-1', email: 'test@example.invalid' };
  const mail = {
    assertConfigured: jest.fn(),
    sendPasswordReset: mockSend,
  } as unknown as MailService;
  let service: PasswordRecoveryService;
  let limit: jest.Mock;
  let set: jest.Mock;
  let returning: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.getdel.mockResolvedValue(user.id);
    mockSend.mockResolvedValue({ providerMessageId: 'test-message-id' });
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
    service = new PasswordRecoveryService(
      database,
      { get: (key: string) => settings[key] } as ConfigService,
      mail,
    );
  });

  it('sends a token link and stores only its digest for 15 minutes', async () => {
    await service.forgotPassword(user.email);
    const input = mockSend.mock.calls[0][0];
    expect(input.to).toBe(user.email);
    const url = new URL(input.resetUrl);
    expect(url.origin).toBe(settings.FRONTEND_URL);
    expect(url.pathname).toBe('/reset-password');
    expect(input.requestId).toMatch(/^[0-9a-f-]{36}$/);
    const token = url.searchParams.get('token');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
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

  it('removes the token when delivery fails without revealing account existence', async () => {
    mockSend.mockRejectedValue(new ServiceUnavailableException());
    const known = await service.forgotPassword(user.email);
    expect(mockRedis.del).toHaveBeenCalledWith(
      expect.stringMatching(/^password-reset:/),
    );
    limit.mockResolvedValue([]);
    expect(await service.forgotPassword('unknown@example.invalid')).toEqual(
      known,
    );
  });

  it('rejects invalid frontend URLs without sending email', async () => {
    const invalid = new PasswordRecoveryService(
      {} as DrizzleService,
      {
        get: (key: string) =>
          key === 'FRONTEND_URL' ? 'file:///tmp' : settings[key],
      } as ConfigService,
      mail,
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
      mail,
    );
    await expect(unconfigured.forgotPassword(user.email)).rejects.toThrow(
      ServiceUnavailableException,
    );
    mockRedis.set.mockRejectedValue(new Error('unavailable'));
    await expect(service.forgotPassword(user.email)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('hashes the new password and revokes existing refresh sessions', async () => {
    await service.resetPassword('a'.repeat(64), 'new-password-123');
    const calls = set.mock.calls as unknown as [
      {
        passwordHash: string;
        refreshTokenHash: null;
        tokenVersion: unknown;
      },
    ][];
    const values = calls[0][0];
    expect(await verifyPassword('new-password-123', values.passwordHash)).toBe(
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
