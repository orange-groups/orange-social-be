import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

const CONNECTION_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'ENOTFOUND',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
  '57P01',
  '57P02',
  '57P03',
  '53300',
]);

function connectionCode(
  error: unknown,
  seen = new Set<unknown>(),
): string | undefined {
  if (!error || typeof error !== 'object' || seen.has(error) || seen.size >= 32)
    return;
  seen.add(error);
  if (
    'code' in error &&
    typeof error.code === 'string' &&
    (CONNECTION_CODES.has(error.code) || /^08[0-9A-Z]{3}$/.test(error.code))
  )
    return error.code;
  if ('cause' in error) {
    const code = connectionCode(error.cause, seen);
    if (code) return code;
  }
  if ('errors' in error && Array.isArray(error.errors)) {
    for (const item of error.errors as unknown[]) {
      const code = connectionCode(item, seen);
      if (code) return code;
    }
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTPError');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) this.logger.error(`HTTP ${status}`);
      const body = exception.getResponse();
      response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : body,
        );
      return;
    }

    const code = connectionCode(exception);
    const status = code ? 503 : 500;
    // Never serialize raw errors: database errors contain SQL, params and credentials.
    this.logger.error(
      code
        ? `Dependency connection unavailable (${code})`
        : 'Unhandled server error',
    );
    if (code) response.setHeader('Retry-After', '5');
    response.status(status).json({
      statusCode: status,
      error: code ? 'Service Unavailable' : 'Internal Server Error',
      message: code
        ? 'Kết nối dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau.'
        : 'Có lỗi hệ thống. Vui lòng thử lại sau.',
    });
  }
}
