import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { createHttpRequestLogger } from './http-request-logger';

describe('HTTP request logger', () => {
  function setup(statusCode: number, originalUrl = '/auth/forgot-password') {
    const log = jest.fn();
    const next = jest.fn();
    const response = Object.assign(new EventEmitter(), {
      statusCode,
      writableFinished: true,
    });
    createHttpRequestLogger({ log })(
      { method: 'POST', originalUrl } as Request,
      response as unknown as Response,
      next as NextFunction,
    );
    return { log, next, response };
  }

  it.each([200, 204, 400, 401, 404, 503])(
    'logs the final HTTP status %i exactly once',
    (status) => {
      const { log, next, response } = setup(status);
      expect(next).toHaveBeenCalledTimes(1);
      expect(log).not.toHaveBeenCalled();
      response.emit('finish');
      response.emit('close');
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(`^POST "/auth/forgot-password" ${status} \\d+\\.\\dms$`),
        ),
      );
    },
  );

  it('does not log query parameters or allow newline injection', () => {
    const { log, response } = setup(200, '/reset\n-password?token=secret');
    response.emit('finish');
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"/reset\\n-password"'),
    );
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('secret'));
  });

  it('logs aborted requests and removes both listeners', () => {
    const { log, response } = setup(200);
    response.writableFinished = false;
    response.emit('close');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ABORTED'));
    expect(response.listenerCount('finish')).toBe(0);
    expect(response.listenerCount('close')).toBe(0);
  });
});
