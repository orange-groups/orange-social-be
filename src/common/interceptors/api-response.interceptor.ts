import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor<
  unknown,
  unknown
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    return next.handle().pipe(
      map((data: unknown) => {
        if (
          response.headersSent ||
          request.method === 'HEAD' ||
          response.statusCode === 204 ||
          response.statusCode === 304 ||
          data instanceof StreamableFile ||
          Buffer.isBuffer(data)
        )
          return data;
        return { success: true, data: data ?? null };
      }),
    );
  }
}
