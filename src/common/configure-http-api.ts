import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ApiResponseInterceptor } from './interceptors/api-response.interceptor';
import type { ValidationDetail } from './types/api-response';

function validationDetails(
  errors: ValidationError[],
  parent = '',
): ValidationDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.values(error.constraints ?? {}).map((message) => ({
        field,
        message,
      })),
      ...validationDetails(error.children ?? [], field),
    ];
  });
}

export function configureHttpApi(app: INestApplication): void {
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ.',
          details: validationDetails(errors),
        }),
    }),
  );
}
