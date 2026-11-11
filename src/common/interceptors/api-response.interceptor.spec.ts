import { ExecutionContext, StreamableFile } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';

describe('ApiResponseInterceptor', () => {
  function context(
    method = 'GET',
    statusCode = 200,
    headersSent = false,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ method }),
        getResponse: () => ({ statusCode, headersSent }),
      }),
    } as unknown as ExecutionContext;
  }
  const interceptor = new ApiResponseInterceptor();

  it.each([null, undefined, false, 0, '', [], { message: 'OK' }])(
    'wraps domain data %p',
    async (data) => {
      expect(
        await firstValueFrom(
          interceptor.intercept(context(), { handle: () => of(data) }),
        ),
      ).toEqual({ success: true, data: data ?? null });
    },
  );

  it.each([204, 304])(
    'does not wrap a bodyless response %s',
    async (status) => {
      expect(
        await firstValueFrom(
          interceptor.intercept(context('GET', status), {
            handle: () => of(undefined),
          }),
        ),
      ).toBeUndefined();
    },
  );

  it('passes through HEAD and already written responses', async () => {
    for (const ctx of [context('HEAD'), context('GET', 200, true)]) {
      expect(
        await firstValueFrom(
          interceptor.intercept(ctx, { handle: () => of('unchanged') }),
        ),
      ).toBe('unchanged');
    }
  });

  it('passes through file responses', async () => {
    const file = new StreamableFile(Buffer.from('download'));
    expect(
      await firstValueFrom(
        interceptor.intercept(context(), { handle: () => of(file) }),
      ),
    ).toBe(file);
  });

  it('lets the exception filter handle failures', async () => {
    const error = new Error('failure');
    await expect(
      firstValueFrom(
        interceptor.intercept(context(), {
          handle: () => throwError(() => error),
        }),
      ),
    ).rejects.toBe(error);
  });
});
