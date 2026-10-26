import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import {
  AuthService,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let registerMock: jest.Mock;

  beforeEach(async () => {
    registerMock = jest.fn().mockResolvedValue({
      accessToken: 'access_token_15m',
      refreshToken: 'refresh_token_1d',
      user: {
        id: 'user-uuid-1',
        email: 'badan@example.com',
        username: 'badan',
        fullName: 'Ba Dan',
        avatarUrl: null,
        isEmailVerified: false,
        createdAt: '2026-10-26T09:00:00.000Z',
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { register: registerMock },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should set HttpOnly refresh_token cookie with 1d maxAge and return accessToken + user', async () => {
    const cookieMock = jest.fn();
    const mockResponse = {
      cookie: cookieMock,
    } as unknown as Response;

    const response = await controller.register(
      {
        fullName: 'Ba Dan',
        email: 'badan@example.com',
        password: 'Password@123',
      },
      mockResponse,
    );

    expect(cookieMock).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      'refresh_token_1d',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: REFRESH_TOKEN_MAX_AGE_MS,
        path: '/auth',
      }),
    );

    expect(response).toEqual({
      accessToken: 'access_token_15m',
      user: {
        id: 'user-uuid-1',
        email: 'badan@example.com',
        username: 'badan',
        fullName: 'Ba Dan',
        avatarUrl: null,
        isEmailVerified: false,
        createdAt: '2026-10-26T09:00:00.000Z',
      },
    });
  });
});
