import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { DrizzleService } from '../../database/drizzle.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let selectLimitMock: jest.Mock;
  let insertReturningMock: jest.Mock;
  let updateWhereMock: jest.Mock;
  let updateSetMock: jest.Mock;
  let signAsyncMock: jest.Mock;

  beforeEach(async () => {
    selectLimitMock = jest.fn();
    insertReturningMock = jest.fn();
    updateWhereMock = jest.fn().mockResolvedValue(undefined);
    updateSetMock = jest.fn().mockReturnValue({ where: updateWhereMock });
    signAsyncMock = jest
      .fn()
      .mockResolvedValueOnce('mock_access_token_15m')
      .mockResolvedValueOnce('mock_refresh_token_1d');

    const mockDrizzleService = {
      db: {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: selectLimitMock,
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: insertReturningMock,
          }),
        }),
        update: jest.fn().mockReturnValue({
          set: updateSetMock,
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DrizzleService, useValue: mockDrizzleService },
        { provide: JwtService, useValue: { signAsync: signAsyncMock } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_ACCESS_SECRET') return 'test_access_secret';
              if (key === 'JWT_REFRESH_SECRET') return 'test_refresh_secret';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw ConflictException when email already exists', async () => {
    selectLimitMock.mockResolvedValueOnce([{ id: 'existing-id' }]);

    await expect(
      service.register({
        fullName: 'Ba Dan',
        email: 'badan@example.com',
        password: 'Password@123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should create user, sign 15m access token & 1d refresh token, and store hashed refresh token in DB', async () => {
    selectLimitMock
      .mockResolvedValueOnce([]) // email check
      .mockResolvedValueOnce([]); // username check

    const now = new Date('2026-10-26T09:00:00.000Z');
    insertReturningMock.mockResolvedValueOnce([
      {
        id: 'user-uuid-1',
        email: 'badan@example.com',
        username: 'badan',
        passwordHash: 'hashed_pw',
        fullName: 'Ba Dan',
        avatarUrl: null,
        isEmailVerified: false,
        tokenVersion: 0,
        createdAt: now,
      },
    ]);

    const result = await service.register({
      fullName: 'Ba Dan',
      email: 'badan@example.com',
      password: 'Password@123',
    });

    expect(result.accessToken).toBe('mock_access_token_15m');
    expect(result.refreshToken).toBe('mock_refresh_token_1d');
    expect(result.user).toEqual({
      id: 'user-uuid-1',
      email: 'badan@example.com',
      username: 'badan',
      fullName: 'Ba Dan',
      avatarUrl: null,
      isEmailVerified: false,
      createdAt: now.toISOString(),
    });

    expect(signAsyncMock).toHaveBeenNthCalledWith(
      1,
      {
        sub: 'user-uuid-1',
        email: 'badan@example.com',
        username: 'badan',
        tokenVersion: 0,
      },
      { secret: 'test_access_secret', expiresIn: '15m' },
    );

    expect(signAsyncMock).toHaveBeenNthCalledWith(
      2,
      {
        sub: 'user-uuid-1',
        tokenVersion: 0,
        type: 'refresh',
      },
      { secret: 'test_refresh_secret', expiresIn: '1d' },
    );

    expect(updateSetMock).toHaveBeenCalledTimes(1);
    const calls = updateSetMock.mock.calls as Array<
      [{ refreshTokenHash: string }]
    >;
    const updatedFields = calls[0][0];
    const digest = createHash('sha256')
      .update('mock_refresh_token_1d')
      .digest('hex');
    const isMatch = await bcrypt.compare(
      digest,
      updatedFields.refreshTokenHash,
    );
    expect(isMatch).toBe(true);
  });
});
