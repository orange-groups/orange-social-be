import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let errorLog: jest.SpyInstance;
  beforeEach(() => {
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function run(error: unknown) {
    const response = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
    new HttpExceptionFilter().catch(error, host);
    return response;
  }

  it.each([
    'ETIMEDOUT',
    'ENETUNREACH',
    'ECONNRESET',
    'CONNECT_TIMEOUT',
    '08006',
  ])(
    'maps nested connection failure %s to 503 without exposing SQL or params',
    (code) => {
      const response = run({
        query: 'SECRET SQL',
        params: ['private-email'],
        cause: { code },
      });
      expect(response.status).toHaveBeenCalledWith(503);
      expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '5');
      expect(errorLog).toHaveBeenCalledWith(
        `Dependency connection unavailable (${code})`,
      );
      expect(JSON.stringify(response.json.mock.calls)).not.toContain('SECRET');
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
        'private-email',
      );
    },
  );

  it('handles aggregate connection errors', () => {
    const response = run({
      cause: new AggregateError([{ code: 'ETIMEDOUT' }], 'private details'),
    });
    expect(response.status).toHaveBeenCalledWith(503);
  });

  it('returns generic 500 for non-connectivity errors without dumping the exception', () => {
    const error = new Error('password=secret');
    const response = run(error);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(errorLog).toHaveBeenCalledWith('Unhandled server error');
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('secret');
  });

  it('preserves existing validation responses', () => {
    const exception = new BadRequestException(['Invalid email']);
    const response = run(exception);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'BAD_REQUEST', message: exception.message, details: null },
    });
    expect(errorLog).not.toHaveBeenCalled();
  });
});
